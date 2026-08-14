import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  D2E4G_PREVIEW_DEPLOYMENT_ID,
  D2E4G_PREVIEW_PROJECT_ID,
  D2E4G_PREVIEW_URL,
  ExistingPreviewDeploymentReadBackAdapterV1,
} from "../ai-ux-02d2e4g-execution-entrypoint-separation.mjs";
import {
  D2E4_CEREMONY_STATES,
  createOperationalD2E4PreviewCeremonyControllerV1,
} from "../ai-ux-02d2e4-preview-ceremony-controller.mjs";
import { D2E4D_TARGET } from "../ai-ux-02d2e4-final-preview-ceremony.mjs";
import {
  BROWSER_PROOF_RESULT_FIELDS_V1,
  DEPLOYMENT_READINESS_FIELDS_V1,
  createDeploymentArtifactManifestV1,
  createDeploymentCertificationSidecarV1,
  createDeploymentReadinessReceiptV1,
} from "../ai-ux-02d2e4x-browser-proof-deployment-contract-v1.mjs";
import {
  AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1,
  AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
  installAuthorizedJitBootstrapV1,
  type AuthorizedJitBootstrapTargetV1,
} from "../../src/modules/discovery/security/authorizedJitBootstrapV1";

const NOW = 1_786_500_000_000;
const PROOF_BYTES = Buffer.alloc(32, 0x5a);
const PROOF = PROOF_BYTES.toString("base64url");
const PROOF_DIGEST = createHash("sha256").update(PROOF, "utf8").digest("hex");
const BUILD_BYTES = Buffer.from("certified browser build", "utf8");
const BUILD_FILE_DIGEST = createHash("sha256").update(BUILD_BYTES).digest("hex");
const BINDING = Object.freeze({
  environment: "PREVIEW" as const,
  authoritativeTenantId: `tenant-${"ab".repeat(32)}`,
  syntheticFixtureLocator: "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE",
  linkId: "synthetic_link_certified_v1",
  sessionId: "synthetic_session_certified_v1",
  turnId: "AI_UX_02D2E4_BROWSER_PROOF_TURN_0001",
});

function sidecar() {
  return createDeploymentCertificationSidecarV1(
    createDeploymentArtifactManifestV1({
      projectId: D2E4G_PREVIEW_PROJECT_ID,
      controlProofDigest: PROOF_DIGEST,
      files: [Object.freeze({
        path: "assets/application.js",
        byteLength: BUILD_BYTES.byteLength,
        sha256: BUILD_FILE_DIGEST,
      })],
    }),
  );
}

function directReceipt(overrides: Record<string, unknown> = {}) {
  return createDeploymentReadinessReceiptV1({
    receiptId: "deployment-readiness-contract-0001",
    status: "READY",
    environment: "PREVIEW",
    projectId: D2E4D_TARGET.projectName,
    deploymentId: D2E4G_PREVIEW_DEPLOYMENT_ID,
    deploymentRevision: "revision-contract-certified-0001",
    deploymentArtifactDigest: sidecar().deploymentArtifactDigest,
    controlProofDigest: PROOF_DIGEST,
    previewUrl: D2E4G_PREVIEW_URL,
    deploymentType: "Preview",
    readyState: "READY",
    reusedExistingPreview: true,
    deploymentInvocations: 0,
    productionChanged: false,
    stagingChanged: false,
    readBackSource: "VERCEL_INSPECT",
    certifiedAtMs: NOW - 1,
    expiresAtMs: NOW + 300_000,
    ...overrides,
  }, { now: NOW });
}

function readBackBoundary(providerOverrides: Record<string, unknown> = {}) {
  const certification = sidecar();
  const commands: Array<Readonly<{ args: readonly string[] }>> = [];
  let id = 0;
  const producer = new ExistingPreviewDeploymentReadBackAdapterV1({
    releaseRoot: "D:/contract-test-release",
    clock: () => NOW,
    idFactory: () => `contract-${++id}`,
    executor: {
      async execute(_executable: string, args: readonly string[]) {
        commands.push(Object.freeze({ args }));
        return Object.freeze({
          stdout: JSON.stringify({
            id: D2E4G_PREVIEW_DEPLOYMENT_ID,
            readyState: "READY",
            target: "preview",
            project: { id: D2E4G_PREVIEW_PROJECT_ID },
            url: D2E4G_PREVIEW_URL,
            deploymentRevision: "revision-contract-certified-0001",
            deploymentArtifactDigest: certification.deploymentArtifactDigest,
            controlProofDigest: certification.controlProofDigest,
            ...providerOverrides,
          }),
        });
      },
    },
    httpReader: {
      async readJson() { return certification; },
      async readBytes() { return new Uint8Array(BUILD_BYTES); },
    },
  });
  return { commands, producer };
}

async function frontendDecision(controlProof: string) {
  const target: AuthorizedJitBootstrapTargetV1 = {};
  const installation = installAuthorizedJitBootstrapV1({
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    controlProofDigest: PROOF_DIGEST,
    target,
    clock: () => NOW,
    mountFrontend() {},
  });
  const boundary = target[AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1];
  const decision = await boundary?.claim({
    version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
    controlProof,
    binding: BINDING,
  });
  installation.dispose();
  return decision;
}

describe("AI_UX_02D2E4X P1.3 browser proof deployment contract", () => {
  it("uses BrowserProofResultV1 and never introduces BrowserProofReceiptV1", () => {
    const source = readFileSync(
      new URL("../../AI_UX_02D2E4X_RUNTIME_CONTRACT_V1.md", import.meta.url),
      "utf8",
    );
    expect(source).toContain("`BrowserProofResultV1` is exactly:");
    expect(source).not.toContain("`BrowserProofReceiptV1` is exactly:");
  });

  it("Deployment ReadBack emits the exact immutable certified receipt", async () => {
    const { commands, producer } = readBackBoundary();
    const receipt = await producer.readBack({ traceId: "trace-contract-readback-0001" });
    expect(Object.keys(receipt)).toEqual(DEPLOYMENT_READINESS_FIELDS_V1);
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(receipt).toMatchObject({
      contractName: "DeploymentReadinessReceiptV1",
      contractVersion: "V1",
      deploymentRevision: "revision-contract-certified-0001",
      controlProofDigest: PROOF_DIGEST,
      deploymentInvocations: 0,
      productionChanged: false,
      stagingChanged: false,
    });
    expect(commands).toHaveLength(1);
    expect(commands[0]?.args).toEqual([
      "inspect", D2E4G_PREVIEW_DEPLOYMENT_ID, "--json",
    ]);
  });

  it("frontend verifies the build-embedded certified digest", async () => {
    const decision = await frontendDecision(PROOF);
    expect(decision?.proofObservation).toEqual({
      status: "VERIFIED",
      expectedControlProofDigest: PROOF_DIGEST,
      observedControlProofDigest: PROOF_DIGEST,
      verifiedAtMs: NOW,
    });
    expect(decision?.handle).not.toBeNull();
  });

  it("frontend returns immutable rejected evidence for a mismatched proof", async () => {
    const decision = await frontendDecision(Buffer.alloc(32, 0x2d).toString("base64url"));
    expect(decision?.proofObservation.status).toBe("REJECTED");
    expect(decision?.proofObservation.expectedControlProofDigest).toBe(PROOF_DIGEST);
    expect(decision?.proofObservation.observedControlProofDigest).not.toBe(PROOF_DIGEST);
    expect(decision?.handle).toBeNull();
    expect(Object.isFrozen(decision?.proofObservation)).toBe(true);
  });

  it("browser controller emits exact deployment-bound BrowserProofResultV1", async () => {
    const controller = createOperationalD2E4PreviewCeremonyControllerV1({
      target: D2E4D_TARGET,
      randomBytes: () => Buffer.from(PROOF_BYTES),
      clock: () => NOW,
    });
    await controller.deriveDigest();
    const receipt = directReceipt();
    controller.bindCertifiedDeployment(receipt);
    const result = await controller.bootstrapBrowser({
      async claimEphemeral() {
        return Object.freeze({
          proofObservation: Object.freeze({
            status: "VERIFIED",
            expectedControlProofDigest: PROOF_DIGEST,
            observedControlProofDigest: PROOF_DIGEST,
            verifiedAtMs: NOW,
          }),
          handle: Object.freeze({
            async isFrontendReady() { return true; },
            async deliverOnce() { return Object.freeze({ status: "CONSUMED" }); },
            async invalidate() {},
          }),
        });
      },
    }, BINDING);
    expect(Object.keys(result)).toEqual(BROWSER_PROOF_RESULT_FIELDS_V1);
    expect(result).toMatchObject({
      status: "VERIFIED",
      deploymentId: receipt.deploymentId,
      deploymentArtifactDigest: receipt.deploymentArtifactDigest,
      expectedControlProofDigest: receipt.controlProofDigest,
      observedControlProofDigest: receipt.controlProofDigest,
    });
    expect(controller.state).toBe(D2E4_CEREMONY_STATES.BROWSER_READY);
    controller.destroy();
  });

  it("stale deployment evidence is rejected before proof consumption", async () => {
    const controller = createOperationalD2E4PreviewCeremonyControllerV1({
      target: D2E4D_TARGET,
      randomBytes: () => Buffer.from(PROOF_BYTES),
      clock: () => NOW + 300_000,
    });
    await controller.deriveDigest();
    expect(() => controller.bindCertifiedDeployment(directReceipt())).toThrow(
      "DEPLOYMENT_READINESS_EXPIRED",
    );
    controller.destroy();
  });

  it("runtime proof substitution cannot bind to the immutable deployment", async () => {
    const controller = createOperationalD2E4PreviewCeremonyControllerV1({
      target: D2E4D_TARGET,
      randomBytes: () => Buffer.alloc(32, 0x2d),
      clock: () => NOW,
    });
    await controller.deriveDigest();
    expect(() => controller.bindCertifiedDeployment(directReceipt())).toThrow(
      "D2E4_CERTIFIED_DEPLOYMENT_BINDING_REJECTED",
    );
    controller.destroy();
  });

  it("deployment failures cross the boundary as RuntimeErrorV1", async () => {
    const { producer } = readBackBoundary({ project: { id: "wrong-project" } });
    await expect(producer.readBack({
      traceId: "trace-contract-failure-0001",
    })).rejects.toMatchObject({
      contractName: "RuntimeErrorV1",
      contractVersion: "V1",
      code: "D2E4G_EXISTING_PREVIEW_REJECTED",
      stage: "DEPLOYMENT",
      producer: "DeploymentReadBack",
      traceId: "trace-contract-failure-0001",
    });
  });
});
