import * as admin from "firebase-admin";

const projectId = "aura-control-center-debb3";
const region = "us-central1";

admin.initializeApp({ projectId });
const db = admin.firestore();

const RESOLVE_ADVISOR_URL = `https://${region}-${projectId}.cloudfunctions.net/resolveAdvisorByCode`;
const CREATE_LEAD_URL = `https://${region}-${projectId}.cloudfunctions.net/createDiscoveryLead`;

const testCode = "SMOKETEST_CODE";
const testAdvisorId = "smoke_test_advisor_123";
const APP_ID = "1:768266998149:web:c6c9883aa44acb9476f4ec";

async function getAppCheckToken() {
  const token = await admin.appCheck().createToken(APP_ID);
  return token.token;
}

async function postCallable(url: string, data: any, appCheckToken?: string) {
  const headers: any = {
    "Content-Type": "application/json"
  };
  if (appCheckToken) {
    headers["X-Firebase-AppCheck"] = appCheckToken;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ data })
  });
  
  const result = await response.json();
  return { status: response.status, body: result };
}

async function setupTestData() {
  console.log("Seeding test data...");
  await db.collection("platform_sales_advisors").doc(testAdvisorId).set({
    name: "Smoke Test Advisor",
    displayName: "Smoke Tester",
    advisorStatus: "ACTIVE",
    email: "smoketest@auranexus.io"
  });

  await db.collection("advisor_commercial_codes").doc(testCode).set({
    advisorId: testAdvisorId,
    status: "ACTIVE"
  });
}

async function cleanupTestData() {
  console.log("\nCleaning up test data...");
  await db.collection("platform_sales_advisors").doc(testAdvisorId).delete();
  await db.collection("advisor_commercial_codes").doc(testCode).delete();
  
  // Clean up any test leads/links created
  const leads = await db.collection("market_discovery_links").where("email", "==", "smoketest@acme.com").get();
  for (const doc of leads.docs) {
    await doc.ref.delete();
  }

  // Clean idempotency records
  const idemps = await db.collection("discovery_intake_idempotency").get();
  for (const doc of idemps.docs) {
    await doc.ref.delete();
  }

  // Clean rate limits
  const rateLimits = await db.collection("platform_rate_limits").get();
  for (const doc of rateLimits.docs) {
    await doc.ref.delete();
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  function assert(cond: boolean, name: string) {
    if (cond) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  await cleanupTestData(); // Ensure clean slate
  await setupTestData();
  const validAppCheckToken = await getAppCheckToken();

  try {
    console.log("\n--- TEST 1: App Check Missing ---");
    const resNoAppCheck = await postCallable(RESOLVE_ADVISOR_URL, { commercialCode: testCode });
    // Without App Check, functions v2 returns 401
    assert(resNoAppCheck.status === 401, "Rechazado sin App Check (401)");

    console.log("\n--- TEST 2: Resolve Advisor Valid ---");
    const resAdvValid = await postCallable(RESOLVE_ADVISOR_URL, { commercialCode: testCode }, validAppCheckToken);
    assert(resAdvValid.status === 200 && resAdvValid.body.result?.status === "VALID", "Código válido resuelto");
    assert(resAdvValid.body.result?.advisorDisplayName === "Smoke Tester", "Nombre correcto");
    assert(!resAdvValid.body.result?.advisorId, "No expone advisorId");

    console.log("\n--- TEST 3: Resolve Advisor Invalid ---");
    const resAdvInvalid = await postCallable(RESOLVE_ADVISOR_URL, { commercialCode: "NOT_EXISTS" }, validAppCheckToken);
    assert(resAdvInvalid.status === 200 && resAdvInvalid.body.result?.status === "INVALID", "Código inexistente es INVALID");
    assert(resAdvInvalid.body.result?.publicMessage === "No pudimos validar el contexto del consultor.", "Mensaje genérico (inexistente)");

    console.log("\n--- TEST 4: Resolve Advisor Rate Limit ---");
    for(let i = 0; i < 11; i++) {
        await postCallable(RESOLVE_ADVISOR_URL, { commercialCode: "RATE_TEST" }, validAppCheckToken);
    }
    const resRateLimit = await postCallable(RESOLVE_ADVISOR_URL, { commercialCode: "RATE_TEST" }, validAppCheckToken);
    assert(resRateLimit.body.error?.message === "RATE_LIMITED" || resRateLimit.status !== 200, "Rate limit aplicado tras múltiples intentos");

    console.log("\n--- TEST 5: Create Discovery Lead Valid ---");
    const payload = {
        companyName: "Acme Smoke Corp",
        contactName: "Jane Doe",
        email: "smoketest@acme.com",
        jobTitle: "CEO",
        state: "CA",
        city: "San Francisco",
        employeeRange: "10-50",
        origin: "WEBSITE",
        acquisitionSource: "AURA_NEXUS",
        privacyConsent: true,
        diagnosticDeliveryConsent: true,
        idempotencyKey: "test-uuid-smoketest-1"
    };

    const createRes = await postCallable(CREATE_LEAD_URL, payload, validAppCheckToken);
    assert(createRes.status === 200 && createRes.body.result?.status === "SUCCESS", "Creación exitosa");
    assert(createRes.body.result?.nextAction === "REDIRECT_DISCOVERY", "Next action es REDIRECT_DISCOVERY");
    assert(createRes.body.result?.organizationProfile === "UNKNOWN", "organizationProfile UNKNOWN");
    assert(!createRes.body.result?.trustScore, "No expone trustScore");
    const discoveryUrl = createRes.body.result?.discoveryUrl;
    assert(typeof discoveryUrl === "string" && discoveryUrl.includes("access="), "Genera URL con access");

    console.log("\n--- TEST 6: Idempotency (Same Payload) ---");
    const createRes2 = await postCallable(CREATE_LEAD_URL, payload, validAppCheckToken);
    assert(createRes2.status === 200 && createRes2.body.result?.status === "SUCCESS", "Idempotencia exitosa");
    
    // Check that we only have 1 lead in DB
    const leadsCount = await db.collection("market_discovery_links").where("email", "==", "smoketest@acme.com").get();
    assert(leadsCount.size === 1, "Solo existe un prospecto en la BD tras repetición idempotente");

    console.log("\n--- TEST 7: Idempotency Conflict (Diff Payload) ---");
    const createRes3 = await postCallable(CREATE_LEAD_URL, { ...payload, contactName: "Different Name" }, validAppCheckToken);
    assert(createRes3.body.error?.message === "IDEMPOTENCY_CONFLICT", "Rechaza payload distinto con misma key");

    console.log("\n--- TEST 8: Token Consumed Resumption ---");
    // Simulate token consumed by manually updating DB
    const linkDoc = leadsCount.docs[0];
    await linkDoc.ref.update({ usageCount: 1 });
    
    const createRes4 = await postCallable(CREATE_LEAD_URL, payload, validAppCheckToken);
    assert(createRes4.status === 200 && createRes4.body.result?.status === "SUCCESS", "Reanuda exitosamente");
    const newDiscoveryUrl = createRes4.body.result?.discoveryUrl;
    assert(newDiscoveryUrl !== discoveryUrl, "Generó un NUEVO access token");
    
    const finalLeads = await db.collection("market_discovery_links").where("email", "==", "smoketest@acme.com").get();
    assert(finalLeads.size === 1, "Sigue existiendo solo 1 documento en BD");

    console.log("\n--- TEST 9: Consentimientos Inválidos ---");
    const createRes5 = await postCallable(CREATE_LEAD_URL, { ...payload, privacyConsent: false, idempotencyKey: "test-uuid-smoketest-2" }, validAppCheckToken);
    assert(createRes5.body.error?.message === "INVALID_INPUT", "Falta privacyConsent arroja INVALID_INPUT");

  } finally {
    await cleanupTestData();
  }
  
  console.log(`\nResultados Puros: ${passed} PASS, ${failed} FAIL`);
}

runTests().catch(console.error);
