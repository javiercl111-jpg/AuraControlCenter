import { describe, expect, it, vi } from "vitest";

import {
  DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1,
  DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
  createDirectEphemeralDiscoveryCapabilityChannelV1,
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
const TURN_ID = "AI_UX_02D3_CANARY_TURN_0001";
const BEARER = "b".repeat(64);

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

describe("AI-UX-02D2E3 issuer-to-evaluate integration", () => {
  it("issues, verifies, consumes, clears, and rejects a second delivery", async () => {
    const policy = SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1;
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
    const channel = createDirectEphemeralDiscoveryCapabilityChannelV1(
      {
        environment: "PREVIEW",
        linkId: policy.linkId,
        sessionId: policy.sessionId,
        turnId: TURN_ID,
      },
      { companyName: "Synthetic Preview Fixture", contactName: "Canary" },
    );
    const boundary =
      new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
        channel.source.scope,
        () => NOW,
      );
    const evaluateConversation = vi.fn(async (sessionToken: string) => {
      const preparation = persistence.preparation;
      if (!preparation) throw new Error("PREPARATION_MISSING");
      const authorized = authorizeDiscoveryCapabilityV1(
        preparation.capability,
        {
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
        },
      );
      return authorized.synthetic;
    });
    channel.source.connect((injection) =>
      boundary.injectAndExecute(injection, async (request) =>
        evaluateConversation(request.sessionToken)));

    await expect(channel.issuerPort.deliverOnce({
      version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
      bearer: issued.bearerToken,
      expiresAt: issued.expiresAt,
    })).resolves.toMatchObject({ status: "CONSUMED", result: true });
    expect(evaluateConversation).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(boundary)).not.toContain(issued.bearerToken);
    await expect(channel.issuerPort.deliverOnce({
      version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
      bearer: issued.bearerToken,
      expiresAt: issued.expiresAt,
    })).rejects.toThrow("DIRECT_CAPABILITY_ALREADY_CONSUMED");
  });
});
