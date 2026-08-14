import { describe, expect, it, vi } from "vitest";

import {
  AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1,
  AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
  DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
  hashAuthorizedJitControlProofV1,
  installAuthorizedJitBootstrapV1,
  type AuthorizedJitBootstrapTargetV1,
} from "../../src/modules/discovery/security/authorizedJitBootstrapV1";
import {
  DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1,
} from "../../src/modules/discovery/security/directEphemeralDiscoveryCapabilityInjectionV1";
import {
  authorizeDiscoveryCapabilityV1,
  hashDiscoveryCapabilityToken,
  SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1,
  SyntheticDiscoveryCapabilityIssuerV1,
  type SyntheticDiscoveryCapabilityPersistenceV1,
  type SyntheticDiscoveryPreparationV1,
} from "../src/discovery/capabilities";

const NOW = 1_786_493_200_000;
const CONTROL_PROOF = "AIUX02D2E4.Server.Control.Proof.For.Tests.0001";
const BEARER = "d".repeat(64);

class MemoryPersistence
  implements SyntheticDiscoveryCapabilityPersistenceV1 {
  public preparation: SyntheticDiscoveryPreparationV1 | undefined;

  public async prepareAtomic(
    preparation: SyntheticDiscoveryPreparationV1,
  ): Promise<"CREATED"> {
    this.preparation = preparation;
    return "CREATED";
  }
}

describe("AI-UX-02D2E4 same-ceremony issuer bootstrap integration", () => {
  it("mounts, issues, verifies, consumes, clears, and invalidates once", async () => {
    const policy = SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1;
    const binding = Object.freeze({
      environment: policy.environment,
      authoritativeTenantId: policy.tenantId,
      syntheticFixtureLocator:
        "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE",
      linkId: policy.linkId,
      sessionId: policy.sessionId,
      turnId: "AI_UX_02D3_CANARY_TURN_0001",
    });
    const target: AuthorizedJitBootstrapTargetV1 = {};
    const evaluateConversation = vi.fn(async (sessionToken: string) => {
      const preparation = persistence.preparation;
      if (!preparation) throw new Error("PREPARATION_MISSING");
      return authorizeDiscoveryCapabilityV1(preparation.capability, {
        now: NOW,
        tokenHash: hashDiscoveryCapabilityToken(sessionToken),
        type: "SESSION",
        purpose: "DISCOVERY_SESSION",
        linkId: policy.linkId,
        sessionId: policy.sessionId,
        environment: policy.environment,
        projectId: policy.projectId,
        tenantId: policy.tenantId,
        fixtureLocator: policy.fixtureLocator,
        requiredCapability: policy.requiredCapability,
        capabilityScope: policy.capabilityScope,
      }).synthetic;
    });
    const installation = installAuthorizedJitBootstrapV1({
      environment: "PREVIEW",
      projectId: policy.projectId,
      controlProofDigest: await hashAuthorizedJitControlProofV1(CONTROL_PROOF),
      target,
      mountFrontend(source) {
        const boundary =
          new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
            source.scope,
            () => NOW,
          );
        source.connect((injection) =>
          boundary.injectAndExecute(injection, (request) =>
            evaluateConversation(request.sessionToken)));
      },
    });
    const claimBoundary =
      target[AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1];
    if (!claimBoundary) throw new Error("CLAIM_BOUNDARY_MISSING");
    const decision = await claimBoundary.claim({
      version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
      controlProof: CONTROL_PROOF,
      binding,
    });
    expect(decision.proofObservation).toMatchObject({
      status: "VERIFIED",
      expectedControlProofDigest:
        await hashAuthorizedJitControlProofV1(CONTROL_PROOF),
      observedControlProofDigest:
        await hashAuthorizedJitControlProofV1(CONTROL_PROOF),
    });
    const handle = decision.handle;
    if (!handle) throw new Error("CLAIM_HANDLE_MISSING");
    expect(installation.status).toBe("WAITING_FOR_AUTHORIZED_CLAIM");
    expect(handle.isFrontendReady()).toBe(true);

    const persistence = new MemoryPersistence();
    const issued = await new SyntheticDiscoveryCapabilityIssuerV1(
      persistence,
      () => NOW,
      () => BEARER,
    ).issue({
      projectId: policy.projectId,
      environment: policy.environment,
      actorId: policy.authorizedActorId,
      tenantId: policy.tenantId,
    });
    await expect(handle.deliverOnce({
      version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
      bearer: issued.bearerToken,
      expiresAt: issued.expiresAt,
    })).resolves.toMatchObject({ status: "CONSUMED", result: true });
    expect(evaluateConversation).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(handle)).not.toContain(issued.bearerToken);
    expect(handle.isFrontendReady()).toBe(false);
  });
});
