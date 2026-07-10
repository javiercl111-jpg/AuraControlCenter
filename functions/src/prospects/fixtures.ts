import * as admin from "firebase-admin";
import { ProspectResolutionEngine } from "./ProspectResolutionEngine";
import { MergePayload, MatchClassification } from "./types";

// Note: To run this, you need FIREBASE_AUTH_EMULATOR_HOST or a real project connected via Admin SDK
// This is structured as a module you can call from a script.

export async function runFixtures() {
  const engine = new ProspectResolutionEngine();
  const db = admin.firestore();

  console.log("Setting up fixtures...");
  
  // Clean up
  const collections = ["platform_leads", "prospect_identity_index", "platform_events"];
  for (const c of collections) {
    const snaps = await db.collection(c).get();
    const batch = db.batch();
    snaps.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  const results: any[] = [];

  const addResult = (scenario: string, classification: MatchClassification, passed: boolean) => {
    results.push({ scenario, classification, passed });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${scenario} -> ${classification}`);
  };

  // 1. Empresa Completamente Nueva
  const s1: MergePayload = {
    companyName: "Acme Corp SA de CV",
    email: "john@acmecorp.com",
    phone: "5551234567",
    rfc: "ACME123456789",
    advisorId: "ADV-001"
  };
  const r1 = await engine.resolveProspect(s1);
  addResult("1. Nueva Empresa", r1.matchClassification, r1.matchClassification === MatchClassification.NEW_COMPANY);

  // 2. Empresa con RFC Exacto
  const s2: MergePayload = {
    companyName: "Acme Corporation", // distinct name
    email: "jane@otherdomain.com",   // distinct email
    phone: "0000000000",             // distinct phone
    rfc: "ACME123456789"             // SAME RFC
  };
  const r2 = await engine.resolveProspect(s2);
  addResult("2. RFC Exacto", r2.matchClassification, r2.matchClassification === MatchClassification.EXACT_MATCH && r2.matchedProspectId === r1.matchedProspectId);

  // 3. Email Exacto
  const s3: MergePayload = {
    companyName: "Acme LLC",
    email: "john@acmecorp.com",
    rfc: "OTHER123"
  };
  const r3 = await engine.resolveProspect(s3);
  addResult("3. Email Exacto", r3.matchClassification, r3.matchClassification === MatchClassification.EXACT_MATCH && r3.matchedProspectId === r1.matchedProspectId);

  // 4. Dominio + Empresa Exacta (High Confidence)
  const s4: MergePayload = {
    companyName: "Acme Corp", // Normalizes to "ACME CORP"
    email: "admin@acmecorp.com",
    phone: "9999999999"
  };
  const r4 = await engine.resolveProspect(s4);
  addResult("4. Dominio + Empresa", r4.matchClassification, r4.matchClassification === MatchClassification.HIGH_CONFIDENCE && r4.matchedProspectId === r1.matchedProspectId);

  // 5. Mismo Dominio, Empresa Distinta (Possible Duplicate)
  const s5: MergePayload = {
    companyName: "Acme Logistics", // Distinct name
    email: "shipping@acmecorp.com" // Same domain
  };
  const r5 = await engine.resolveProspect(s5);
  addResult("5. Mismo Dominio, Empresa Distinta", r5.matchClassification, r5.matchClassification === MatchClassification.POSSIBLE_DUPLICATE);

  // 6. Mismo Nombre, Email Gmail (Possible Duplicate - Gmail is public domain, so domain match fails)
  const s6_base: MergePayload = { companyName: "Global Tech", email: "globaltech@gmail.com" };
  await engine.resolveProspect(s6_base); // Create new
  
  const s6_dup: MergePayload = { companyName: "Global Tech", email: "globaltech123@gmail.com" };
  const r6 = await engine.resolveProspect(s6_dup);
  addResult("6. Public Domain + Same Name", r6.matchClassification, r6.matchClassification === MatchClassification.POSSIBLE_DUPLICATE);

  // 7. Mismo Teléfono + Empresa
  const s7_base: MergePayload = { companyName: "TeleCorp", phone: "8180001122" };
  await engine.resolveProspect(s7_base);
  
  const s7_dup: MergePayload = { companyName: "Telecorp", phone: "8180001122" };
  const r7 = await engine.resolveProspect(s7_dup);
  addResult("7. Mismo Teléfono + Nombre", r7.matchClassification, r7.matchClassification === MatchClassification.HIGH_CONFIDENCE);

  // 8. sourceLeadId Exacto
  const s8: MergePayload = {
    companyName: "Some Name",
    sourceLeadId: r1.matchedProspectId
  };
  const r8 = await engine.resolveProspect(s8);
  addResult("8. sourceLeadId Exacto", r8.matchClassification, r8.matchClassification === MatchClassification.EXACT_MATCH && r8.matchedProspectId === r1.matchedProspectId);

  // 9. Atribución Conflictiva
  const s9: MergePayload = {
    companyName: "Acme Corp",
    email: "john@acmecorp.com",
    advisorId: "ADV-002" // Different advisor
  };
  const r9 = await engine.resolveProspect(s9);
  const acmeDoc = await db.collection("platform_leads").doc(r1.matchedProspectId!).get();
  const hasConflict = acmeDoc.data()?.attributionConflict === true && acmeDoc.data()?.originalAdvisorId === "ADV-001";
  addResult("9. Atribución Conflictiva detectada", r9.matchClassification, r9.matchClassification === MatchClassification.EXACT_MATCH && hasConflict);

  // 10. Empresa sin Asesor -> UNASSIGNED
  const s10: MergePayload = { companyName: "Lonely Corp", email: "lonely@lonely.com" };
  const r10 = await engine.resolveProspect(s10);
  const lonelyDoc = await db.collection("platform_leads").doc(r10.matchedProspectId!).get();
  addResult("10. Sin Asesor -> UNASSIGNED", r10.matchClassification, lonelyDoc.data()?.ownerStatus === "UNASSIGNED");

  // Summary
  const passed = results.filter(r => r.passed).length;
  console.log(`\nResults: ${passed}/${results.length} passed.`);
}
