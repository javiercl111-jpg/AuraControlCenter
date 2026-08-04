export interface PublicIntakeCertificationEvidenceV1 {
  readonly file: string;
  readonly contains: readonly string[];
}

export interface PublicIntakeCertificationCaseV1 {
  readonly id: `CT-${string}`;
  readonly threat: string;
  readonly surfaces: readonly string[];
  readonly controls: readonly (`P2` | `P3` | `P4` | `P5` | `P6` | `P7` | `P8`)[];
  readonly test: string;
  readonly runner: string;
  readonly evidence: readonly PublicIntakeCertificationEvidenceV1[];
  readonly expected: string;
  readonly blocking: boolean;
}

const emulatorRoot = "functions/tests/emulator";

export const PUBLIC_INTAKE_ABUSE_CERTIFICATION_MATRIX_V1 = Object.freeze([
  {
    id: "CT-01", threat: "Missing, invalid, or replayed App Check attestation",
    surfaces: ["all public callables"], controls: ["P7", "P8"],
    test: "App Check seam denies before state and cost",
    runner: "test:public-intake-abuse-matrix",
    evidence: [
      { file: "functions/src/discovery/createDiscoveryLead.ts", contains: ["enforceAppCheck: true", "request.app == undefined"] },
      { file: "functions/tests/publicIntakeAbuseCertification/publicIntakeAbuseHarness.ts", contains: ["APP_CHECK_REQUIRED", "APP_CHECK_INVALID", "APP_CHECK_REPLAYED"] },
    ], expected: "Safe denial and zero state, quota, or downstream calls", blocking: true,
  },
  {
    id: "CT-02", threat: "Malformed public payload",
    surfaces: ["create", "AI", "completion", "report"], controls: ["P5"],
    test: "Strict schemas reject unknown and malformed input",
    runner: "test:discovery-payload-bounds-emulator",
    evidence: [{ file: `${emulatorRoot}/payloadBounds/firestorePayloadBoundsEmulator.test.ts`, contains: ["rejects unknown public intake fields", "invalid-argument rather than an internal error"] }],
    expected: "Opaque invalid-argument before writes or downstream", blocking: true,
  },
  {
    id: "CT-03", threat: "Payload byte, depth, and cardinality amplification",
    surfaces: ["create", "AI", "completion"], controls: ["P5"],
    test: "UTF-8 bytes, depth, fields, arrays, and strings are bounded",
    runner: "test:discovery-payload-bounds-emulator",
    evidence: [{ file: `${emulatorRoot}/payloadBounds/firestorePayloadBoundsEmulator.test.ts`, contains: ["bounds total payload bytes", "bounds object depth", "bounds total fields"] }],
    expected: "Boundary accepted; excess rejected before cost", blocking: true,
  },
  {
    id: "CT-04", threat: "Commercial-code enumeration",
    surfaces: ["resolveAdvisorByCode", "createDiscoveryLead"], controls: ["P5", "P7"],
    test: "Invalid, missing, and inactive codes use the approved opaque response",
    runner: "test:public-intake-abuse-matrix",
    evidence: [{ file: "functions/src/advisors/resolveAdvisorByCode.ts", contains: ["No pudimos validar el contexto del consultor.", "status: \"INVALID\""] }],
    expected: "No advisor ID, UID, role, or tenant disclosure", blocking: true,
  },
  {
    id: "CT-05", threat: "Intake replay",
    surfaces: ["createDiscoveryLead"], controls: ["P3", "P4"],
    test: "Active COMPLETED replay converges on one link",
    runner: "test:firestore-idempotency-emulator",
    evidence: [{ file: `${emulatorRoot}/idempotency/firestoreIdempotencyEmulator.test.ts`, contains: ["reuses an active completed result", "concurrent completed replays converge"] }],
    expected: "One authoritative link and cached result", blocking: true,
  },
  {
    id: "CT-06", threat: "Concurrent intake and capability rotation",
    surfaces: ["createDiscoveryLead"], controls: ["P3", "P4"],
    test: "Concurrent replays retain one usable capability",
    runner: "test:firestore-idempotency-emulator",
    evidence: [{ file: `${emulatorRoot}/idempotency/firestoreIdempotencyEmulator.test.ts`, contains: ["does not rotate capability state during concurrent replays", "without duplicating the atomic effect"] }],
    expected: "One link, one result, one capability generation", blocking: true,
  },
  {
    id: "CT-07", threat: "Flooding by IP hash or App ID",
    surfaces: ["create", "advisor code"], controls: ["P2", "P7"],
    test: "Atomic quota cannot over-consume under concurrency",
    runner: "test:firestore-rate-limit-emulator",
    evidence: [{ file: `${emulatorRoot}/rateLimits/firestoreRateLimitEmulator.test.ts`, contains: ["allows exactly one of two simultaneous requests", "holds the exact quota under one hundred parallel requests"] }],
    expected: "Exact allowed/denied counts and one counter", blocking: true,
  },
  {
    id: "CT-08", threat: "Distributed identities evade local quotas",
    surfaces: ["createDiscoveryLead"], controls: ["P2", "P7"],
    test: "Purpose-separated dimensions include GLOBAL",
    runner: "test:firestore-rate-limit-emulator",
    evidence: [{ file: `${emulatorRoot}/rateLimits/firestoreRateLimitEmulator.test.ts`, contains: ["supports all certified dimensions", "without sharing counters"] }],
    expected: "GLOBAL counter closes identity rotation", blocking: true,
  },
  {
    id: "CT-09", threat: "Email enumeration and individual flooding",
    surfaces: ["createDiscoveryLead"], controls: ["P2", "P6"],
    test: "EMAIL_HASH is HMAC-scoped and never stored in plaintext",
    runner: "test:firestore-rate-limit-emulator",
    evidence: [{ file: `${emulatorRoot}/rateLimits/firestoreRateLimitEmulator.test.ts`, contains: ["EMAIL_HASH", "without exposing raw subjects"] }],
    expected: "Stable individual quota and no plaintext email", blocking: true,
  },
  {
    id: "CT-10", threat: "Unbounded new idempotency keys",
    surfaces: ["createDiscoveryLead"], controls: ["P3"],
    test: "Active keys per derived namespace are bounded",
    runner: "test:firestore-idempotency-emulator",
    evidence: [{ file: `${emulatorRoot}/idempotency/firestoreIdempotencyEmulator.test.ts`, contains: ["bounds active keys per derived namespace"] }],
    expected: "Cardinality ceiling fails closed", blocking: true,
  },
  {
    id: "CT-11", threat: "Expired, reused, revoked, or manipulated token",
    surfaces: ["exchange", "resolve", "complete", "report"], controls: ["P4"],
    test: "Capability lifecycle rejects invalid state and scope",
    runner: "test:firestore-capability-emulator",
    evidence: [{ file: `${emulatorRoot}/capabilities/firestoreCapabilityEmulator.test.ts`, contains: ["consumed exchange fails on reuse", "expired SESSION fails", "revoked SESSION fails", "incorrect generation fails"] }],
    expected: "Opaque denial and zero secondary effects", blocking: true,
  },
  {
    id: "CT-12", threat: "Cross-session capability",
    surfaces: ["resolve", "complete", "report"], controls: ["P4"],
    test: "Capability A cannot authorize session B",
    runner: "test:firestore-capability-emulator",
    evidence: [{ file: `${emulatorRoot}/capabilities/firestoreCapabilityEmulator.test.ts`, contains: ["SESSION A cannot authorize link/session B", "REPORT capability cannot cross dossier/session"] }],
    expected: "No cross-session read, write, report, or download", blocking: true,
  },
  {
    id: "CT-13", threat: "Duplicate or concurrent completion",
    surfaces: ["completeDiscoverySession", "notification fan-out", "report"], controls: ["P4", "P5"],
    test: "Exactly-once completion converges durable effects",
    runner: "test:firestore-capability-emulator",
    evidence: [{ file: `${emulatorRoot}/capabilities/firestoreCapabilityEmulator.test.ts`, contains: ["one hundred simultaneous completions converge", "one logical event ID", "one stable notification key", "one REPORT capability"] }],
    expected: "One dossier, event, notification key, and report capability", blocking: true,
  },
  {
    id: "CT-14", threat: "Containment unavailable or disabled",
    surfaces: ["all controlled surfaces"], controls: ["P7"],
    test: "Switch OFF and missing/corrupt policy fail closed",
    runner: "test:discovery-containment-emulator",
    evidence: [{ file: `${emulatorRoot}/containment/firestoreContainmentEmulator.test.ts`, contains: ["missing policy fails closed", "corrupted policy fails closed", "blocked decisions do not invoke downstream side effects"] }],
    expected: "DENY before state or expensive downstream", blocking: true,
  },
  {
    id: "CT-15", threat: "Authority and server-owned field injection",
    surfaces: ["create", "completion"], controls: ["P5", "P8"],
    test: "Public schemas reject tenant, organization, role, claim, and path control",
    runner: "test:discovery-payload-bounds-emulator",
    evidence: [{ file: `${emulatorRoot}/payloadBounds/firestorePayloadBoundsEmulator.test.ts`, contains: ["rejects server-owned public intake fields", "caller-controlled organizationId", "raw completion routing identifiers"] }],
    expected: "Zero Authority, membership, role, claim, admin, or arbitrary-path mutation", blocking: true,
  },
  {
    id: "CT-16", threat: "Sensitive data in logs or telemetry",
    surfaces: ["all instrumented surfaces"], controls: ["P6"],
    test: "Canary PII, tokens, payloads, prompts, and URLs are rejected",
    runner: "test:discovery-abuse-telemetry-emulator",
    evidence: [{ file: `${emulatorRoot}/abuseTelemetry/firestoreAbuseTelemetryEmulator.test.ts`, contains: ["contain no PII, token, signed URL, prompt, or model response", "no longer print raw payloads or exceptions"] }],
    expected: "Structured allowlist only; no free-form sensitive values", blocking: true,
  },
  {
    id: "CT-17", threat: "Expired retention record reused or retained indefinitely",
    surfaces: ["createDiscoveryLead", "idempotency cleanup"], controls: ["P3"],
    test: "Semantic expiration, cleanup, and TTL evidence agree",
    runner: "test:firestore-idempotency-emulator",
    evidence: [{ file: `${emulatorRoot}/idempotency/firestoreIdempotencyEmulator.test.ts`, contains: ["does not reuse an expired completed result", "deletes only semantically expired records", "keeps TTL evidence versioned"] }],
    expected: "Expired cache never succeeds; active records survive cleanup", blocking: true,
  },
  {
    id: "CT-18", threat: "AI cost amplification",
    surfaces: ["evaluateConversation"], controls: ["P5", "P7"],
    test: "Atomic budget and AI switch prevent Gemini after DENY",
    runner: "test:discovery-containment-emulator",
    evidence: [{ file: `${emulatorRoot}/containment/firestoreContainmentEmulator.test.ts`, contains: ["AI OFF is enforced before Gemini"] }, { file: `${emulatorRoot}/payloadBounds/firestorePayloadBoundsEmulator.test.ts`, contains: ["conversation budget allows the exact quota", "two simultaneous evaluations cannot hold one lease"] }],
    expected: "Bounded attempts; zero Gemini calls after denial", blocking: true,
  },
  {
    id: "CT-19", threat: "PDF and Storage cost amplification",
    surfaces: ["generateDiscoveryReport"], controls: ["P4", "P5", "P7"],
    test: "One report capability plus bounded report policy and switch",
    runner: "test:discovery-payload-bounds-emulator",
    evidence: [{ file: `${emulatorRoot}/payloadBounds/firestorePayloadBoundsEmulator.test.ts`, contains: ["report generation policy bounds dataset, PDF, attempts and timeout"] }, { file: `${emulatorRoot}/containment/firestoreContainmentEmulator.test.ts`, contains: ["report generation OFF is enforced before GENERATING metadata"] }],
    expected: "No duplicate generation or save after DENY", blocking: true,
  },
  {
    id: "CT-20", threat: "Download amplification and signed URL theft",
    surfaces: ["requestExecutiveDocument"], controls: ["P4", "P5", "P7"],
    test: "REPORT scope, download quota, expiry, and switch are enforced",
    runner: "test:discovery-payload-bounds-emulator",
    evidence: [{ file: `${emulatorRoot}/payloadBounds/firestorePayloadBoundsEmulator.test.ts`, contains: ["one hundred parallel downloads remain atomically bounded", "legacy SESSION token in document download"] }, { file: `${emulatorRoot}/containment/firestoreContainmentEmulator.test.ts`, contains: ["download OFF is enforced before signed URL creation"] }],
    expected: "Bounded grants, no cross-scope URL, no URL in telemetry", blocking: true,
  },
  {
    id: "CT-21", threat: "Notification fan-out amplification",
    surfaces: ["completion", "notification fan-out"], controls: ["P4", "P5", "P7"],
    test: "Stable notification key, bounded fan-out, and switch",
    runner: "test:firestore-capability-emulator",
    evidence: [{ file: `${emulatorRoot}/capabilities/firestoreCapabilityEmulator.test.ts`, contains: ["one stable notification key"] }, { file: `${emulatorRoot}/containment/firestoreContainmentEmulator.test.ts`, contains: ["notification OFF is enforced before gateway fan-out"] }, { file: `${emulatorRoot}/payloadBounds/firestorePayloadBoundsEmulator.test.ts`, contains: ["notification policy bounds payload, fan-out, channels and retries"] }],
    expected: "At most one logical fan-out and zero delivery when OFF", blocking: true,
  },
  {
    id: "CT-22", threat: "Configuration, environment, observability, or regression drift",
    surfaces: ["all public intake surfaces"], controls: ["P2", "P3", "P4", "P5", "P6", "P7", "P8"],
    test: "Fail-closed policy, redaction, isolation, and inherited regressions",
    runner: "test:public-intake-abuse-certification",
    evidence: [{ file: `${emulatorRoot}/containment/firestoreContainmentEmulator.test.ts`, contains: ["environment separates active policies", "valid rollback atomically activates"] }, { file: `${emulatorRoot}/abuseTelemetry/firestoreAbuseTelemetryEmulator.test.ts`, contains: ["validator rejects forbidden PII keys"] }, { file: "docs/security/discovery/manifests/DISCOVERY_INTAKE_IDEMPOTENCY_TTL_V1.json", contains: ["TARGET_NOT_APPLIED", "P9_REQUIRED"] }],
    expected: "All domains green; remote configuration remains a P9 blocker", blocking: true,
  },
] satisfies readonly PublicIntakeCertificationCaseV1[]);
