import { createHash, randomBytes as secureRandomBytes } from "node:crypto";

import {
  assertDeploymentReadinessReceiptV1,
  createBrowserProofResultV1,
} from "./ai-ux-02d2e4x-browser-proof-deployment-contract-v1.mjs";

export const D2E4_PREVIEW_CEREMONY_VERSION =
  "AI_UX_02D2E4_OPERATIONAL_PREVIEW_CEREMONY_V1";
export const D2E4_BOOTSTRAP_VERSION = "AUTHORIZED_JIT_BOOTSTRAP_V1";
export const D2E4_CLAIM_PROPERTY = "__auraAuthorizedJitBootstrapClaimV1";
export const D2E4_CONTROL_CONTEXT = "AI_UX_02D2E4_PREVIEW_CONTROL";
export const D2E4_PROJECT_NAME = "aura-control-center";
export const D2E4_FIREBASE_PROJECT_ID = "aura-intel-preview";
export const D2E4_RELEASE_BRANCH = "release/ai-ux-02d2e4-preview-control";

export const D2E4_CEREMONY_STATES = Object.freeze({
  CREATED: "CREATED",
  DIGEST_READY: "DIGEST_READY",
  DEPLOY_READY: "DEPLOY_READY",
  BROWSER_READY: "BROWSER_READY",
  PROOF_REJECTED: "PROOF_REJECTED",
  CONSUMED: "CONSUMED",
  DESTROYED: "DESTROYED",
});

const SHA256 = /^[a-f0-9]{64}$/u;
const FIXTURE = /^SYNTHETIC_FIXTURE_V1_[A-F0-9]{32}$/u;
const TENANT = /^tenant-[a-f0-9]{64}$/u;
const SAFE_RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/u;
const BINDING_KEYS = Object.freeze([
  "authoritativeTenantId", "environment", "linkId", "sessionId",
  "syntheticFixtureLocator", "turnId",
]);

export class D2E4PreviewCeremonyError extends Error {
  constructor(code) {
    super(code);
    this.name = "D2E4PreviewCeremonyError";
    this.code = code;
  }
}

function fail(code) {
  throw new D2E4PreviewCeremonyError(code);
}

function assertPreviewControlTarget(input) {
  if (
    input?.environment !== "PREVIEW" ||
    typeof input?.projectName !== "string" ||
    !/^[a-z0-9][a-z0-9-]{2,99}$/u.test(input.projectName) ||
    input?.firebaseProjectId !== D2E4_FIREBASE_PROJECT_ID ||
    typeof input?.gitBranch !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,255}$/u.test(input.gitBranch) ||
    input?.controlContext !== D2E4_CONTROL_CONTEXT
  ) {
    fail("D2E4_PREVIEW_CONTROL_TARGET_REJECTED");
  }
}

function canonicalDigest(controlProof) {
  return createHash("sha256").update(controlProof, "utf8").digest("hex");
}

function exactAuthoritativeBinding(input) {
  const keys = input && typeof input === "object"
    ? Object.keys(input).sort()
    : [];
  const expected = [...BINDING_KEYS].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    input?.environment !== "PREVIEW" ||
    !TENANT.test(input?.authoritativeTenantId ?? "") ||
    !FIXTURE.test(input?.syntheticFixtureLocator ?? "") ||
    !SAFE_RESOURCE_ID.test(input?.linkId ?? "") ||
    !SAFE_RESOURCE_ID.test(input?.sessionId ?? "") ||
    !SAFE_RESOURCE_ID.test(input?.turnId ?? "")
  ) {
    fail("D2E4_AUTHORITATIVE_BINDING_REJECTED");
  }
  return Object.freeze({ ...input });
}

function encodeControlProof(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

class RemoteBrowserClaimHandleV1 {
  #page;
  #remoteHandle;
  #available = true;

  constructor(page, remoteHandle) {
    this.#page = page;
    this.#remoteHandle = remoteHandle;
  }

  async isFrontendReady() {
    if (!this.#available) return false;
      return this.#page.evaluate(
      (decision) => decision.handle?.isFrontendReady() === true,
      this.#remoteHandle,
    );
  }

  async deliverOnce(injection) {
    if (!this.#available) fail("D2E4_BROWSER_HANDLE_STALE");
    this.#available = false;
    try {
      return await this.#page.evaluate(
        ({ decision, injectionInput }) =>
          decision.handle.deliverOnce(injectionInput),
        { decision: this.#remoteHandle, injectionInput: injection },
      );
    } finally {
      await this.#remoteHandle.dispose?.();
    }
  }

  async invalidate() {
    if (!this.#available) return;
    this.#available = false;
    try {
      await this.#page.evaluate(
        (decision) => decision.handle?.invalidate(),
        this.#remoteHandle,
      );
    } finally {
      await this.#remoteHandle.dispose?.();
    }
  }
}

export class BrowserAutomationEphemeralBootstrapAdapterV1 {
  #page;

  constructor({ page, telemetryDisabled }) {
    if (
      telemetryDisabled !== true ||
      typeof page?.evaluateHandle !== "function" ||
      typeof page?.evaluate !== "function"
    ) {
      fail("D2E4_BROWSER_ADAPTER_REJECTED");
    }
    this.#page = page;
  }

  async claimEphemeral(controlProof, authoritativeBinding) {
    const binding = exactAuthoritativeBinding(authoritativeBinding);
    let payload = {
      claimProperty: D2E4_CLAIM_PROPERTY,
      version: D2E4_BOOTSTRAP_VERSION,
      controlProof,
      binding,
    };
    try {
      const remoteDecision = await this.#page.evaluateHandle(async (claimInput) => {
        let proof = claimInput.controlProof;
        claimInput.controlProof = "";
        try {
          const boundary = globalThis[claimInput.claimProperty];
          if (!boundary || typeof boundary.claim !== "function") {
            throw new Error("D2E4_BROWSER_CLAIM_BOUNDARY_MISSING");
          }
          return await boundary.claim({
            version: claimInput.version,
            controlProof: proof,
            binding: claimInput.binding,
          });
        } finally {
          proof = "";
        }
      }, payload);
      const proofObservation = await this.#page.evaluate(
        (decision) => decision.proofObservation,
        remoteDecision,
      );
      const hasHandle = await this.#page.evaluate(
        (decision) => decision.handle !== null,
        remoteDecision,
      );
      return Object.freeze({
        proofObservation: Object.freeze({ ...proofObservation }),
        handle: hasHandle
          ? new RemoteBrowserClaimHandleV1(this.#page, remoteDecision)
          : null,
      });
    } finally {
      payload.controlProof = "";
      payload = undefined;
      controlProof = "";
    }
  }
}

export class BrowserProofCustodyV1 {
  #proofBytes;
  #digest;
  #used = false;

  constructor({ randomBytes = secureRandomBytes } = {}) {
    const generated = randomBytes(32);
    if (!(generated instanceof Uint8Array) || generated.byteLength < 32) {
      fail("D2E4_CRYPTOGRAPHIC_RANDOMNESS_REJECTED");
    }
    this.#proofBytes = new Uint8Array(generated);
  }

  deriveDigest() {
    if (!this.#proofBytes || this.#used) fail("D2E4_CONTROL_PROOF_DESTROYED");
    if (!this.#digest) {
      let proof = encodeControlProof(this.#proofBytes);
      try {
        this.#digest = canonicalDigest(proof);
      } finally {
        proof = "";
      }
    }
    return this.#digest;
  }

  async claimOnce(operation) {
    if (!this.#proofBytes || this.#used || typeof operation !== "function") {
      fail("D2E4_CONTROL_PROOF_DESTROYED");
    }
    this.#used = true;
    let proof = encodeControlProof(this.#proofBytes);
    try {
      return await operation(proof);
    } finally {
      proof = "";
      this.#proofBytes.fill(0);
      this.#proofBytes = undefined;
    }
  }

  destroy() {
    this.#proofBytes?.fill(0);
    this.#proofBytes = undefined;
    this.#digest = undefined;
    this.#used = true;
  }

  toJSON() {
    return Object.freeze({
      version: "BROWSER_PROOF_CUSTODY_V1",
      available: Boolean(this.#proofBytes) && !this.#used,
    });
  }
}

export function createBrowserProofCustodyV1(input) {
  return new BrowserProofCustodyV1(input);
}

function exactProofObservation(value) {
  const keys = value && typeof value === "object"
    ? Object.keys(value).sort()
    : [];
  const expected = [
    "expectedControlProofDigest", "observedControlProofDigest", "status",
    "verifiedAtMs",
  ].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      !new Set(["VERIFIED", "REJECTED"]).has(value?.status) ||
      !SHA256.test(value?.expectedControlProofDigest ?? "") ||
      !SHA256.test(value?.observedControlProofDigest ?? "") ||
      !Number.isSafeInteger(value?.verifiedAtMs) || value.verifiedAtMs < 0 ||
      (value.status === "VERIFIED") !==
        (value.expectedControlProofDigest === value.observedControlProofDigest)) {
    fail("D2E4_BROWSER_PROOF_OBSERVATION_REJECTED");
  }
  return Object.freeze({ ...value });
}

export class OperationalD2E4PreviewCeremonyControllerV1 {
  #state = D2E4_CEREMONY_STATES.CREATED;
  #proofCustody;
  #digest;
  #deployment;
  #browserHandle;
  #lifecycle;
  #exitHandler;
  #target;
  #clock;

  constructor({
    target,
    randomBytes = secureRandomBytes,
    proofCustody,
    lifecycle,
    clock = Date.now,
  } = {}) {
    assertPreviewControlTarget(target);
    const custody = proofCustody ?? createBrowserProofCustodyV1({ randomBytes });
    if (typeof custody?.deriveDigest !== "function" ||
        typeof custody?.claimOnce !== "function" ||
        typeof custody?.destroy !== "function" || typeof clock !== "function") {
      fail("D2E4_BROWSER_PROOF_CUSTODY_REJECTED");
    }
    this.#proofCustody = custody;
    this.#target = Object.freeze({ ...target });
    this.#clock = clock;
    this.#lifecycle = lifecycle;
    this.#exitHandler = () => this.destroy();
    this.#lifecycle?.once?.("exit", this.#exitHandler);
  }

  get state() {
    return this.#state;
  }

  #expect(expected) {
    if (this.#state !== expected) fail("D2E4_INVALID_STATE_TRANSITION");
  }

  async deriveDigest() {
    this.#expect(D2E4_CEREMONY_STATES.CREATED);
    this.#digest = this.#proofCustody.deriveDigest();
    this.#state = D2E4_CEREMONY_STATES.DIGEST_READY;
    return this.#digest;
  }

  bindCertifiedDeployment(receipt) {
    this.#expect(D2E4_CEREMONY_STATES.DIGEST_READY);
    const now = this.#clock();
    const certified = assertDeploymentReadinessReceiptV1(receipt, { now });
    if (certified.projectId !== this.#target.projectName ||
        certified.controlProofDigest !== this.#digest) {
      fail("D2E4_CERTIFIED_DEPLOYMENT_BINDING_REJECTED");
    }
    this.#deployment = certified;
    this.#state = D2E4_CEREMONY_STATES.DEPLOY_READY;
    return certified;
  }

  async bootstrapBrowser(adapter, authoritativeBinding) {
    this.#expect(D2E4_CEREMONY_STATES.DEPLOY_READY);
    if (typeof adapter?.claimEphemeral !== "function") {
      fail("D2E4_BROWSER_ADAPTER_REQUIRED");
    }
    const now = this.#clock();
    assertDeploymentReadinessReceiptV1(this.#deployment, { now });
    const decision = await this.#proofCustody.claimOnce((proof) =>
      adapter.claimEphemeral(proof, exactAuthoritativeBinding(
        authoritativeBinding,
      )));
    const observation = exactProofObservation(decision?.proofObservation);
    if (observation.expectedControlProofDigest !== this.#deployment.controlProofDigest ||
        observation.verifiedAtMs < this.#deployment.certifiedAtMs ||
        observation.verifiedAtMs >= this.#deployment.expiresAtMs ||
        observation.verifiedAtMs > now) {
      decision?.handle?.invalidate?.();
      fail("D2E4_BROWSER_PROOF_BINDING_REJECTED");
    }
    const proofResult = createBrowserProofResultV1({
      status: observation.status,
      deploymentId: this.#deployment.deploymentId,
      deploymentArtifactDigest: this.#deployment.deploymentArtifactDigest,
      expectedControlProofDigest: observation.expectedControlProofDigest,
      observedControlProofDigest: observation.observedControlProofDigest,
      verifiedAtMs: now,
    }, this.#deployment, now);
    if (proofResult.status === "REJECTED") {
      await decision?.handle?.invalidate?.();
      this.#state = D2E4_CEREMONY_STATES.PROOF_REJECTED;
      return proofResult;
    }
    this.#browserHandle = decision?.handle;
    if (!this.#browserHandle ||
        typeof this.#browserHandle.isFrontendReady !== "function" ||
        typeof this.#browserHandle.deliverOnce !== "function") {
      fail("D2E4_BROWSER_HANDLE_REJECTED");
    }
    if (!await this.#browserHandle.isFrontendReady()) {
      await this.#browserHandle.invalidate?.();
      this.#browserHandle = undefined;
      fail("D2E4_BROWSER_NOT_READY");
    }
    this.#state = D2E4_CEREMONY_STATES.BROWSER_READY;
    return proofResult;
  }

  async consumeOnce(injection) {
    this.#expect(D2E4_CEREMONY_STATES.BROWSER_READY);
    if (!injection || typeof injection !== "object" ||
        typeof injection.bearer !== "string" || injection.bearer.length === 0) {
      fail("D2E4_CAPABILITY_INJECTION_REJECTED");
    }
    const handle = this.#browserHandle;
    this.#browserHandle = undefined;
    this.#state = D2E4_CEREMONY_STATES.CONSUMED;
    return handle.deliverOnce(injection);
  }

  destroy() {
    if (this.#state === D2E4_CEREMONY_STATES.DESTROYED) return;
    void this.#browserHandle?.invalidate?.();
    this.#browserHandle = undefined;
    this.#proofCustody?.destroy();
    this.#proofCustody = undefined;
    this.#digest = undefined;
    this.#deployment = undefined;
    this.#state = D2E4_CEREMONY_STATES.DESTROYED;
    this.#lifecycle?.off?.("exit", this.#exitHandler);
  }

  toJSON() {
    return Object.freeze({
      version: D2E4_PREVIEW_CEREMONY_VERSION,
      state: this.#state,
      environment: "PREVIEW",
      projectName: this.#target.projectName,
      gitBranch: this.#target.gitBranch,
      digestReady: typeof this.#digest === "string",
    });
  }
}

export function createOperationalD2E4PreviewCeremonyControllerV1(input) {
  return new OperationalD2E4PreviewCeremonyControllerV1(input);
}
