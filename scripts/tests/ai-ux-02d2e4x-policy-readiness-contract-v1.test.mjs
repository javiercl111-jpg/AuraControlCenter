import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAuthorityReceiptV1,
  assertPolicyReadinessReceiptV1,
  assertRuntimeErrorV1,
  authorityEvidenceDigestV1,
  canonicalJsonV1,
  createAuthorityReceiptV1,
  createPolicyReadinessReceiptV1,
  createRuntimeErrorFieldsV1,
  policyArtifactDigestV1,
} from "../ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const NOW = Date.parse("2026-08-13T18:00:00.000Z");
const TENANT = `tenant-${"ab".repeat(32)}`;
const FIXTURE =
  "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE";

function authorityEvidence(overrides = {}) {
  return {
    authorityEvidenceSchema: "AUTHORITY_EVIDENCE_V1",
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    authoritativeTenantId: TENANT,
    authoritativeTenantLocator: TENANT,
    syntheticFixtureLocator: FIXTURE,
    linkId: "synthetic-link-policy-test",
    sessionId: "synthetic-session-policy-test",
    turnId: "synthetic-turn-policy-test",
    intentClass: "DISCOVER_PROBLEM",
    linkEvidence: {
      synthetic: true,
      environment: "PREVIEW",
      projectId: "aura-intel-preview",
      tenantId: TENANT,
      fixtureLocator: FIXTURE,
      requiredCapability: "EVALUATE_CONVERSATION",
      linkId: "synthetic-link-policy-test",
      sessionId: "synthetic-session-policy-test",
    },
    sessionEvidence: {
      synthetic: true,
      environment: "PREVIEW",
      projectId: "aura-intel-preview",
      tenantId: TENANT,
      fixtureLocator: FIXTURE,
      linkId: "synthetic-link-policy-test",
      sessionId: "synthetic-session-policy-test",
    },
    ...overrides,
  };
}

function authority(overrides = {}) {
  return Object.freeze({
    contractName: "AuthorityReceiptV1",
    contractVersion: "V1",
    receiptId: "authority-receipt-policy-test",
    status: "CERTIFIED",
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    authoritativeTenantId: TENANT,
    authoritativeTenantLocator: TENANT,
    syntheticFixtureLocator: FIXTURE,
    linkId: "synthetic-link-policy-test",
    sessionId: "synthetic-session-policy-test",
    turnId: "synthetic-turn-policy-test",
    intentClass: "DISCOVER_PROBLEM",
    evidenceDigest: "11".repeat(32),
    certifiedAtMs: NOW - 1_000,
    expiresAtMs: NOW + 60_000,
    ...overrides,
  });
}

function digestInput(overrides = {}) {
  return Object.freeze({
    schemaVersion: "DISCOVERY_ADAPTIVE_CANARY_POLICY_V1",
    activationVersion: "DISCOVERY_ADAPTIVE_ACTIVATION_V1",
    policyVersion: "AI_UX_02D3_PREVIEW_CANARY_POLICY_TEST_V1",
    authoritativeTenantLocator: TENANT,
    environment: "PREVIEW",
    mode: "CANARY",
    enabled: true,
    expiresAtMs: NOW + 60_000,
    killSwitchState: Object.freeze({
      environment: "PREVIEW",
      state: "OFF",
      revision: "kill-switch-policy-test",
      source: "SERVER_CONFIGURATION",
    }),
    allowedSyntheticFixtureLocators: Object.freeze([FIXTURE]),
    allowedIntentClasses: Object.freeze([
      "CLARIFICATION",
      "DISCOVER_PROBLEM",
    ]),
    source: "SERVER_CONFIGURATION",
    ...overrides,
  });
}

function policyReceipt(overrides = {}) {
  const digest = policyArtifactDigestV1(digestInput());
  return createPolicyReadinessReceiptV1({
    receiptId: "policy-receipt-contract-test",
    projectId: "aura-intel-preview",
    authoritativeTenantId: TENANT,
    authoritativeTenantLocator: TENANT,
    policyVersion: "AI_UX_02D3_PREVIEW_CANARY_POLICY_TEST_V1",
    activePointerVersion: "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1",
    policyArtifactDigest: digest,
    activationAuditId: "activation-audit-policy-test",
    killSwitchState: { revision: "kill-switch-policy-test" },
    allowedSyntheticFixtureLocators: [FIXTURE],
    allowedIntentClasses: ["CLARIFICATION", "DISCOVER_PROBLEM"],
    activatedAtMs: NOW - 2_000,
    expiresAtMs: NOW + 60_000,
    certifiedAtMs: NOW,
    ...overrides,
  });
}

test("canonical JSON is stable and policy digest uses the approved field set", () => {
  assert.equal(canonicalJsonV1({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(
    policyArtifactDigestV1(digestInput()),
    "4509eec7ae8b242210411bbb0f214a69fb811b0d1a10ee59b78d9028cb93e4dd",
  );
  assert.equal(
    policyArtifactDigestV1({ ...digestInput() }),
    policyArtifactDigestV1(digestInput()),
  );
});

test("authority and policy receipts require exact V1 and freshness", () => {
  assert.equal(assertAuthorityReceiptV1(authority(), { atMs: NOW }).status,
    "CERTIFIED");
  const receipt = policyReceipt();
  assert.equal(
    assertPolicyReadinessReceiptV1(receipt, { atMs: NOW }).status,
    "ACTIVE",
  );
  assert.throws(
    () => assertAuthorityReceiptV1(authority({ contractVersion: "V2" })),
    /AUTHORITY_RECEIPT_V1_REJECTED/u,
  );
  assert.throws(
    () => assertAuthorityReceiptV1(authority(), { atMs: NOW + 60_000 }),
    /AUTHORITY_RECEIPT_V1_REJECTED/u,
  );
});

test("authority evidence digest and receipt construction are exact and frozen", () => {
  const evidenceDigest = authorityEvidenceDigestV1(authorityEvidence());
  assert.equal(
    evidenceDigest,
    "a7f03843f3cded4ad693fd71354b84048f64388865f396ea85c9d53ce55cf10d",
  );
  const receipt = createAuthorityReceiptV1({
    receiptId: "authority-receipt-policy-test",
    projectId: "aura-intel-preview",
    authoritativeTenantId: TENANT,
    authoritativeTenantLocator: TENANT,
    syntheticFixtureLocator: FIXTURE,
    linkId: "synthetic-link-policy-test",
    sessionId: "synthetic-session-policy-test",
    turnId: "synthetic-turn-policy-test",
    intentClass: "DISCOVER_PROBLEM",
    evidenceDigest,
    certifiedAtMs: NOW,
    expiresAtMs: NOW + 60_000,
  });

  assert.equal(Object.keys(receipt).length, 16);
  assert.equal(Object.hasOwn(receipt, "authorityRevision"), false);
  assert.equal(Object.hasOwn(receipt, "targetProjectId"), false);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(assertAuthorityReceiptV1(receipt, { atMs: NOW }), receipt);
  assert.throws(
    () => authorityEvidenceDigestV1(authorityEvidence({
      authoritativeTenantLocator: `tenant-${"cd".repeat(32)}`,
    })),
    /AUTHORITY_EVIDENCE_V1_REJECTED/u,
  );
  assert.throws(
    () => createAuthorityReceiptV1({
      receiptId: "authority-receipt-policy-test",
      projectId: "aura-intel-preview",
      authoritativeTenantId: TENANT,
      authoritativeTenantLocator: TENANT,
      syntheticFixtureLocator: FIXTURE,
      linkId: "synthetic-link-policy-test",
      sessionId: "synthetic-session-policy-test",
      turnId: "synthetic-turn-policy-test",
      intentClass: "DISCOVER_PROBLEM",
      evidenceDigest,
      certifiedAtMs: NOW,
      expiresAtMs: NOW + 60_000,
      authorityRevision: "forbidden",
    }),
    /AUTHORITY_RECEIPT_V1_INPUT_REJECTED/u,
  );
});

test("policy receipt creation is exact and deeply immutable", () => {
  const receipt = policyReceipt();
  assert.equal(Object.keys(receipt).length, 20);
  assert.equal(Object.hasOwn(receipt, "pointerVersion"), false);
  assert.equal(Object.hasOwn(receipt, "policy"), false);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.killSwitchState), true);
  assert.equal(Object.isFrozen(receipt.allowedIntentClasses), true);
  assert.throws(() => {
    receipt.killSwitchState.state = "ON";
  }, TypeError);
  assert.throws(() => {
    receipt.allowedIntentClasses.push("OTHER");
  }, TypeError);
});

test("non-canonical sets, extra fields, and malformed digests fail closed", () => {
  assert.throws(
    () => policyArtifactDigestV1(digestInput({
      allowedIntentClasses: Object.freeze([
        "DISCOVER_PROBLEM",
        "CLARIFICATION",
      ]),
    })),
    /POLICY_ARTIFACT_DIGEST_INPUT_REJECTED/u,
  );
  assert.throws(
    () => policyArtifactDigestV1(digestInput({
      allowedIntentClasses: Object.freeze([
        "CLARIFICATION",
        "CLARIFICATION",
      ]),
    })),
    /POLICY_ARTIFACT_DIGEST_INPUT_REJECTED/u,
  );
  assert.throws(
    () => assertPolicyReadinessReceiptV1(Object.freeze({
      ...policyReceipt(),
      pointerVersion: "legacy",
    })),
    /POLICY_READINESS_RECEIPT_V1_REJECTED/u,
  );
});

test("RuntimeErrorV1 fields are bounded, frozen, and preserve cause", () => {
  const root = createRuntimeErrorFieldsV1({
    errorId: "policy-error-root",
    code: "D2E4O_POLICY_NOT_ELIGIBLE",
    stage: "POLICY",
    producer: "D2E4O_POLICY_REPOSITORY",
    severity: "BLOCKING",
    retryable: false,
    partialSideEffects: false,
    details: { reason: "fixture" },
    traceId: "trace-policy-contract-test",
    occurredAtMs: NOW,
  });
  const wrapper = createRuntimeErrorFieldsV1({
    errorId: "policy-error-wrapper",
    code: "D2E4E_CANARY_POLICY_NOT_READY",
    stage: "POLICY",
    producer: "D2E4E_READINESS",
    severity: "BLOCKING",
    cause: root,
    retryable: false,
    partialSideEffects: false,
    details: {},
    traceId: "trace-policy-contract-test",
    occurredAtMs: NOW,
  });
  assert.equal(assertRuntimeErrorV1(wrapper).cause.code,
    "D2E4O_POLICY_NOT_ELIGIBLE");
  assert.equal(Object.isFrozen(wrapper), true);
  assert.equal(Object.isFrozen(wrapper.cause), true);
  assert.throws(() => createRuntimeErrorFieldsV1({
    ...wrapper,
    errorId: "policy-error-too-large",
    cause: null,
    details: { value: "x".repeat(17_000) },
  }), /RUNTIME_ERROR_V1_REJECTED/u);

  assert.throws(() => {
    let cause = null;
    for (let index = 0; index < 17; index += 1) {
      cause = createRuntimeErrorFieldsV1({
        errorId: `policy-error-chain-${index}`,
        code: "D2E4O_POLICY_READ_FAILED",
        stage: "POLICY",
        producer: "D2E4O_POLICY_REPOSITORY",
        severity: "BLOCKING",
        cause,
        retryable: true,
        partialSideEffects: false,
        details: {},
        traceId: "trace-policy-contract-test",
        occurredAtMs: NOW,
      });
    }
  }, /RUNTIME_ERROR_V1_REJECTED/u);
});
