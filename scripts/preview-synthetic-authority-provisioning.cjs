"use strict";

const { createHash, randomBytes } = require("node:crypto");
const path = require("node:path");
const { createRequire } = require("node:module");
const { performance } = require("node:perf_hooks");

const PROJECT_ID = "aura-intel-preview";
const ENVIRONMENT = "PREVIEW";
const CHANGE_ID =
  "AI-02H2.2D-PREVIEW-SYNTHETIC-CLOUD-PROVISIONING-20260806-01";
const IDENTITY_LABEL = "AI02H2-PREVIEW-SYNTHETIC-IDENTITY-01";
const TENANT_LABEL = "AI02H2-PREVIEW-SYNTHETIC-TENANT-01";
const APPROVED_USE = "CONTROLLED_PREVIEW_HAPPY_PATH";
const AUTH_UID = "ai02h2-preview-synthetic-identity-01";
const SYNTHETIC_EMAIL = "synthetic.preview.01@aura-intel-preview.invalid";
const CREDENTIAL_SECRET_ID = "preview-synthetic-identity-password";
const REQUEST_ID = "ai02h2d-request-preview-synthetic-identity-01";
const CORRELATION_ID = "ai02h2d-correlation-preview-synthetic-identity-01";
const IDEMPOTENCY_KEY = "ai02h2d-preview-synthetic-identity-tenant-v1";
const REQUESTED_AT = "2026-08-06T18:00:00.000Z";
const APPROVED_DOMAINS = Object.freeze([
  "localhost",
  "aura-intel-preview.firebaseapp.com",
  "aura-intel-preview.web.app",
  "preview-controlcenter.auranexus.io",
]);
const PROHIBITED_USE = Object.freeze([
  "STAGING",
  "PRODUCTION",
  "LOAD_TEST",
  "PENTEST",
  "PERSONAL_DATA",
  "COMMERCIAL_OPERATION",
]);

function parseArguments(argv) {
  return Object.freeze({
    apply: argv.includes("--apply"),
    project: argv.find((value) => value.startsWith("--project="))?.slice(10),
    environment: argv.find((value) => value.startsWith("--environment="))?.slice(14),
    changeId: argv.find((value) => value.startsWith("--confirm-change-id="))?.slice(20),
  });
}

function assertInvocation(input) {
  if (input.project !== PROJECT_ID || input.environment !== ENVIRONMENT) {
    throw new Error("TARGET_GUARD_REJECTED");
  }
  if (input.apply && input.changeId !== CHANGE_ID) {
    throw new Error("CHANGE_ID_GUARD_REJECTED");
  }
}

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function locator(value) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function fingerprintLocator(value) {
  const normalized = value.startsWith("sha256:") ? value.slice(7) : value;
  return `sha256:${normalized.slice(0, 10)}...${normalized.slice(-8)}`;
}

function maskedEmail(value) {
  const [local, domain] = value.split("@");
  const labels = domain.split(".");
  return `${local.slice(0, 2)}***@${labels[0].slice(0, 2)}***.${labels.at(-1)}`;
}

function isStatus(error, status) {
  return error && typeof error === "object" && error.response?.status === status;
}

function isAuthCode(error, code) {
  return error && typeof error === "object" && error.code === code;
}

function safeFailure(error) {
  if (error && typeof error === "object" && typeof error.code === "string") {
    const code = error.code.replace(/[^A-Za-z0-9_/-]/g, "_").slice(0, 80);
    if (/^(auth\/|[A-Z_]+$)/u.test(code)) return code;
  }
  if (error && typeof error === "object" && Number.isInteger(error.response?.status)) {
    return `HTTP_${error.response.status}`;
  }
  if (error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)) {
    return error.message;
  }
  return "CONTROLLED_OPERATION_FAILED";
}

async function countCollection(firestore, name) {
  const snapshot = await firestore.collection(name).count().get();
  return snapshot.data().count;
}

async function countUsers(auth) {
  let count = 0;
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    count += page.users.length;
    pageToken = page.pageToken;
  } while (pageToken);
  return count;
}

async function readSyntheticUser(auth) {
  try {
    return await auth.getUser(AUTH_UID);
  } catch (error) {
    if (isAuthCode(error, "auth/user-not-found")) return null;
    throw error;
  }
}

async function readConfig(googleAuth) {
  try {
    const response = await googleAuth.request({
      url: `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`,
      method: "GET",
    });
    return response.data;
  } catch (error) {
    if (isStatus(error, 404)) return null;
    throw error;
  }
}

async function readEnabledExternalProviders(googleAuth) {
  const endpoints = [
    "defaultSupportedIdpConfigs",
    "oauthIdpConfigs",
    "inboundSamlConfigs",
  ];
  let enabled = 0;
  for (const endpoint of endpoints) {
    const response = await googleAuth.request({
      url: `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/${endpoint}`,
      method: "GET",
    });
    const entries = Object.values(response.data).find(Array.isArray) || [];
    enabled += entries.filter((item) => item.enabled !== false).length;
  }
  return enabled;
}

function configSummary(config, externalProviders) {
  const domains = Array.isArray(config?.authorizedDomains)
    ? config.authorizedDomains
    : [];
  return Object.freeze({
    status: config === null ? "CONFIGURATION_NOT_FOUND" : "CONFIGURED",
    emailPasswordEnabled: config?.signIn?.email?.enabled === true,
    passwordRequired: config?.signIn?.email?.passwordRequired === true,
    anonymousEnabled: config?.signIn?.anonymous?.enabled === true,
    externalProvidersEnabled: externalProviders,
    authorizedDomainCount: domains.length,
    approvedDomainsPresent: APPROVED_DOMAINS.every((domain) => domains.includes(domain)),
    prohibitedDomainPresent: domains.some((domain) =>
      /^(?:aura-control-center-debb3|aura-intel-staging|controlcenter\.auranexus\.io)$/iu.test(domain),
    ),
  });
}

async function initializeAndConfigureAuth(googleAuth, beforeConfig) {
  let initialized = false;
  if (beforeConfig === null) {
    await googleAuth.request({
      url: `https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/identityPlatform:initializeAuth`,
      method: "POST",
      data: {},
    });
    initialized = true;
  }
  await googleAuth.request({
    url: `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`,
    method: "PATCH",
    params: {
      updateMask: [
        "signIn.email.enabled",
        "signIn.email.passwordRequired",
        "signIn.anonymous.enabled",
        "signIn.allowDuplicateEmails",
        "authorizedDomains",
      ].join(","),
    },
    data: {
      signIn: {
        email: { enabled: true, passwordRequired: true },
        anonymous: { enabled: false },
        allowDuplicateEmails: false,
      },
      authorizedDomains: APPROVED_DOMAINS,
    },
  });
  return initialized;
}

async function readSecret(googleAuth) {
  const base = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${CREDENTIAL_SECRET_ID}`;
  try {
    const metadata = await googleAuth.request({ url: base, method: "GET" });
    if (
      metadata.data.labels?.environment !== "preview" ||
      metadata.data.labels?.approved_use !== "controlled_happy_path"
    ) {
      throw new Error("CREDENTIAL_STORAGE_CONFLICT");
    }
  } catch (error) {
    if (isStatus(error, 404)) return null;
    throw error;
  }
  try {
    const response = await googleAuth.request({
      url: `${base}/versions/latest:access`,
      method: "GET",
    });
    return Buffer.from(response.data.payload.data, "base64").toString("utf8");
  } catch (error) {
    if (isStatus(error, 404)) return "";
    throw error;
  }
}

async function createSecretVersion(googleAuth, password) {
  const parent = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}`;
  const base = `${parent}/secrets/${CREDENTIAL_SECRET_ID}`;
  let created = false;
  try {
    await googleAuth.request({ url: base, method: "GET" });
  } catch (error) {
    if (!isStatus(error, 404)) throw error;
    await googleAuth.request({
      url: `${parent}/secrets`,
      method: "POST",
      params: { secretId: CREDENTIAL_SECRET_ID },
      data: {
        replication: { automatic: {} },
        labels: {
          environment: "preview",
          synthetic: "true",
          approved_use: "controlled_happy_path",
        },
      },
    });
    created = true;
  }
  await googleAuth.request({
    url: `${base}:addVersion`,
    method: "POST",
    data: { payload: { data: Buffer.from(password, "utf8").toString("base64") } },
  });
  return created;
}

function assertUserContract(user) {
  if (
    user.uid !== AUTH_UID ||
    user.email !== SYNTHETIC_EMAIL ||
    user.displayName !== IDENTITY_LABEL ||
    user.emailVerified !== true ||
    user.disabled !== false ||
    Object.keys(user.customClaims || {}).length !== 0
  ) {
    throw new Error("SYNTHETIC_IDENTITY_CONFLICT");
  }
}

async function ensureSyntheticUser(auth, googleAuth) {
  let password = await readSecret(googleAuth);
  let credentialCreated = false;
  if (!password) {
    password = `${randomBytes(32).toString("base64url")}Aa1!`;
    credentialCreated = await createSecretVersion(googleAuth, password);
  }
  let user = await readSyntheticUser(auth);
  let created = false;
  if (user === null) {
    user = await auth.createUser({
      uid: AUTH_UID,
      email: SYNTHETIC_EMAIL,
      emailVerified: true,
      password,
      displayName: IDENTITY_LABEL,
      disabled: false,
    });
    created = true;
  }
  assertUserContract(user);
  const byEmail = await auth.getUserByEmail(SYNTHETIC_EMAIL);
  if (byEmail.uid !== user.uid) throw new Error("SYNTHETIC_IDENTITY_CONFLICT");
  return Object.freeze({ user, password, created, credentialCreated });
}

async function baseline(auth, firestore, authConfigured) {
  const tenantId = `tenant-${digest(TENANT_LABEL)}`;
  const auditId = `authority-audit-${digest(IDEMPOTENCY_KEY)}`;
  let userCount = 0;
  let syntheticUser = null;
  if (authConfigured) {
    userCount = await countUsers(auth);
    syntheticUser = await readSyntheticUser(auth);
  }
  const principalId = syntheticUser === null
    ? null
    : `principal-${digest(`${syntheticUser.uid}\u0000${IDENTITY_LABEL}`)}`;
  const membershipId = principalId === null
    ? null
    : `membership-${digest(`${principalId}\u0000${tenantId}`)}`;
  const [principals, tenants, memberships, aliases, audits, links, sessions, capabilities, completions] =
    await Promise.all([
      countCollection(firestore, "platform_global_admins"),
      countCollection(firestore, "platform_tenants"),
      countCollection(firestore, "tenant_memberships"),
      countCollection(firestore, "tenant_aliases"),
      countCollection(firestore, "authority_audit_events"),
      countCollection(firestore, "market_discovery_links"),
      countCollection(firestore, "discovery_sessions"),
      countCollection(firestore, "discovery_capabilities_v1"),
      countCollection(firestore, "discovery_completions_v1"),
    ]);
  const [principalDoc, tenantDoc, membershipDoc, auditDoc] = await Promise.all([
    firestore.collection("platform_global_admins").doc(AUTH_UID).get(),
    firestore.collection("platform_tenants").doc(tenantId).get(),
    membershipId === null
      ? Promise.resolve(null)
      : firestore.collection("tenant_memberships").doc(membershipId).get(),
    firestore.collection("authority_audit_events").doc(auditId).get(),
  ]);
  return Object.freeze({
    counts: Object.freeze({
      authUsers: userCount,
      platformPrincipals: principals,
      platformTenants: tenants,
      tenantMemberships: memberships,
      tenantAliases: aliases,
      authorityAuditRecords: audits,
      discoveryLinks: links,
      discoverySessions: sessions,
      discoveryCapabilities: capabilities,
      discoveryCompletions: completions,
    }),
    synthetic: Object.freeze({
      identity: syntheticUser !== null,
      principal: principalDoc.exists,
      tenant: tenantDoc.exists,
      membership: membershipDoc?.exists === true,
      audit: auditDoc.exists,
    }),
  });
}

async function getFirebaseWebApiKey(googleAuth) {
  const list = await googleAuth.request({
    url: `https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps`,
    method: "GET",
  });
  const apps = Array.isArray(list.data.apps) ? list.data.apps : [];
  if (apps.length !== 1) throw new Error("PREVIEW_WEB_APP_NOT_UNIQUE");
  const config = await googleAuth.request({
    url: `https://firebase.googleapis.com/v1beta1/${apps[0].name}/config`,
    method: "GET",
  });
  if (typeof config.data.apiKey !== "string" || config.data.apiKey.length === 0) {
    throw new Error("PREVIEW_WEB_APP_CONFIG_MISSING");
  }
  return config.data.apiKey;
}

async function verifyPasswordSignIn(googleAuth, password) {
  const apiKey = await getFirebaseWebApiKey(googleAuth);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: SYNTHETIC_EMAIL,
        password,
        returnSecureToken: true,
      }),
    },
  );
  if (!response.ok) throw new Error("AUTHENTICATION_CHECK_FAILED");
  const result = await response.json();
  return typeof result.idToken === "string" && typeof result.refreshToken === "string";
}

function sanitizeProvisioning(result) {
  return Object.freeze({
    status: result.status,
    principalLocator: result.principalLocator,
    tenantLocator: result.tenantLocator,
    membershipLocator: result.membershipLocator,
    assignedCapabilities: result.assignedCapabilities,
    created: result.created,
    idempotencyResult: result.idempotencyResult,
    auditFingerprint: fingerprintLocator(result.auditFingerprint),
  });
}

async function run() {
  const input = parseArguments(process.argv.slice(2));
  assertInvocation(input);
  const functionsRequire = createRequire(
    path.resolve(__dirname, "..", "functions", "package.json"),
  );
  const { applicationDefault, getApps, initializeApp } = functionsRequire("firebase-admin/app");
  const { getAuth } = functionsRequire("firebase-admin/auth");
  const { getFirestore } = functionsRequire("firebase-admin/firestore");
  const { GoogleAuth } = functionsRequire("google-auth-library");
  const googleAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const app = getApps().find((candidate) => candidate.name === "ai02h2d") ||
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID }, "ai02h2d");
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  const beforeConfig = await readConfig(googleAuth);
  const beforeExternalProviders = beforeConfig === null
    ? 0
    : await readEnabledExternalProviders(googleAuth);
  const before = await baseline(auth, firestore, beforeConfig !== null);
  const report = {
    schemaVersion: "PREVIEW_SYNTHETIC_CLOUD_PROVISIONING_EXECUTION_V1",
    mode: input.apply ? "APPLY" : "AUDIT_ONLY",
    target: PROJECT_ID,
    environment: ENVIRONMENT,
    approvedUse: APPROVED_USE,
    prohibitedUse: PROHIBITED_USE,
    authBefore: configSummary(beforeConfig, beforeExternalProviders),
    baseline: before,
  };

  if (!input.apply) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const startedAt = performance.now();
  const authInitialized = await initializeAndConfigureAuth(googleAuth, beforeConfig);
  const afterConfig = await readConfig(googleAuth);
  const afterExternalProviders = await readEnabledExternalProviders(googleAuth);
  const authAfter = configSummary(afterConfig, afterExternalProviders);
  if (
    !authAfter.emailPasswordEnabled ||
    !authAfter.passwordRequired ||
    authAfter.anonymousEnabled ||
    authAfter.externalProvidersEnabled !== 0 ||
    !authAfter.approvedDomainsPresent ||
    authAfter.prohibitedDomainPresent
  ) {
    throw new Error("AUTH_CONFIGURATION_NOT_CLOSED");
  }

  const identity = await ensureSyntheticUser(auth, googleAuth);
  const {
    AUTHORITY_PROVISIONING_REQUEST_VERSION,
    AUTHORITY_RESOLUTION_REQUEST_VERSION,
    CONTROLLED_PREVIEW_HAPPY_PATH,
    PREVIEW_SYNTHETIC_AUTHORITY_RETENTION_POLICY_VERSION,
  } = functionsRequire("@aura/intelligence-os/server");
  const { createPrivatePreviewAuthorityProvisioningCompositionV1 } = require(
    path.resolve(
      __dirname,
      "..",
      "functions",
      "lib",
      "composition",
      "authorityProvisioning",
    ),
  );
  const service = createPrivatePreviewAuthorityProvisioningCompositionV1(firestore);
  const request = Object.freeze({
    version: AUTHORITY_PROVISIONING_REQUEST_VERSION,
    requestId: REQUEST_ID,
    correlationId: CORRELATION_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    authUid: identity.user.uid,
    identityLabel: IDENTITY_LABEL,
    tenantLabel: TENANT_LABEL,
    requestedCapabilities: [],
    environment: ENVIRONMENT,
    retentionPolicy: Object.freeze({
      version: PREVIEW_SYNTHETIC_AUTHORITY_RETENTION_POLICY_VERSION,
      principalRetention: "PERMANENT_PREVIEW_FIXTURE",
      tenantRetention: "PERMANENT_PREVIEW_FIXTURE",
      membershipRetention: "PREVIEW_ENVIRONMENT_LIFETIME",
      happyPathDataRetentionDays: 30,
      cleanup: "VERSIONED_AUTHORIZED_PROCEDURE",
      approvedUse: CONTROLLED_PREVIEW_HAPPY_PATH,
    }),
    requestedAt: REQUESTED_AT,
  });
  const first = await service.provisionSyntheticIdentityAuthority(request);
  const retry = await service.provisionSyntheticIdentityAuthority(request);
  const tenantId = `tenant-${digest(TENANT_LABEL)}`;
  const resolved = await service.resolveAuthority({
    version: AUTHORITY_RESOLUTION_REQUEST_VERSION,
    authUid: identity.user.uid,
    environment: ENVIRONMENT,
    expectedTenantId: tenantId,
  });
  const canAuthenticate = await verifyPasswordSignIn(googleAuth, identity.password);
  const after = await baseline(auth, firestore, true);
  const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
  const readinessClassification = canAuthenticate &&
    resolved.status === "ACTIVE" &&
    resolved.effectiveCapabilities.length === 0
    ? "READY_FOR_HAPPY_PATH"
    : "AUTH_CLIENT_FLOW_PENDING";
  Object.assign(report, {
    authInitialization: authInitialized ? "INITIALIZED" : "UNCHANGED",
    authAfter,
    syntheticIdentity: {
      locator: locator(identity.user.uid),
      maskedEmail: maskedEmail(identity.user.email),
      provider: "password",
      createdAt: identity.user.metadata.creationTime,
      disabled: identity.user.disabled,
      emailVerified: identity.user.emailVerified,
      customClaimsCount: Object.keys(identity.user.customClaims || {}).length,
      created: identity.created,
      credentialStorage: "GOOGLE_SECRET_MANAGER",
      credentialCreated: identity.credentialCreated,
    },
    provisioning: sanitizeProvisioning(first),
    retry: sanitizeProvisioning(retry),
    resolution: {
      status: resolved.status,
      environment: resolved.environment,
      principalLocator: resolved.principalLocator,
      tenantLocator: resolved.tenantLocator,
      membershipLocator: resolved.membershipLocator,
      effectiveCapabilities: resolved.effectiveCapabilities,
      ambiguousMemberships: false,
      crossTenantAccess: false,
      globalPrivileges: [],
    },
    operationalAudit: {
      requestId: REQUEST_ID,
      correlationId: CORRELATION_ID,
      idempotencyResult: retry.idempotencyResult,
      firstStatus: first.status,
      retryStatus: retry.status,
      durationMs,
      safeStatus: "SUCCESS",
      fingerprint: fingerprintLocator(first.auditFingerprint),
    },
    authenticationCheck: canAuthenticate ? "PASS" : "FAIL",
    readinessClassification,
    postBaseline: after,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ status: "FAILED", safeErrorCode: safeFailure(error) })}\n`,
    );
    process.exitCode = 1;
  });
}

module.exports = {
  APPROVED_DOMAINS,
  CHANGE_ID,
  ENVIRONMENT,
  PROJECT_ID,
  parseArguments,
  assertInvocation,
  configSummary,
  fingerprintLocator,
  locator,
  maskedEmail,
};
