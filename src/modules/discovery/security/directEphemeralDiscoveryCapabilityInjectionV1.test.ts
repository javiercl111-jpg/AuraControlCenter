import { describe, expect, it, vi } from "vitest";

import {
  DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
  DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1,
  createDirectEphemeralDiscoveryCapabilityChannelV1,
} from "./directEphemeralDiscoveryCapabilityInjectionV1";

const NOW = 1_786_493_200_000;
const LINK_ID = "synthetic-discovery-preview-link-0001";
const SESSION_ID = "synthetic-discovery-preview-session-0001";
const TURN_ID = "AI_UX_02D3_CANARY_TURN_0001";
const BEARER = "a".repeat(64);

function scope() {
  return Object.freeze({
    environment: "PREVIEW" as const,
    linkId: LINK_ID,
    sessionId: SESSION_ID,
    turnId: TURN_ID,
  });
}

function injection(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
    bearer: BEARER,
    expiresAt: NOW + 300_000,
    ...overrides,
  };
}

describe("AI-UX-02D2E3 direct ephemeral capability injection", () => {
  it("01 carries an emitted bearer directly into one evaluate request", async () => {
    const channel = createDirectEphemeralDiscoveryCapabilityChannelV1(
      scope(),
      { companyName: "Synthetic Preview Fixture", contactName: "Canary" },
    );
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      channel.source.scope,
      () => NOW,
    );
    channel.source.connect((next) =>
      boundary.injectAndExecute(next, evaluate));
    const evaluate = vi.fn(async (request: Readonly<{
      sessionToken: string;
      linkId: string;
      sessionId: string;
      turnId: string;
    }>) => {
      expect(request.linkId).toBe(scope().linkId);
      expect(request.sessionId).toBe(scope().sessionId);
      expect(request.turnId).toBe(TURN_ID);
      expect(request.sessionToken).toBe(BEARER);
      return Object.freeze({ accepted: true });
    });
    const receipt = await channel.issuerPort.deliverOnce({
      version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
      bearer: BEARER,
      expiresAt: NOW + 300_000,
    });
    expect(receipt).toMatchObject({ status: "CONSUMED" });
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it("02 rejects second delivery through the issuer port", async () => {
    const channel = createDirectEphemeralDiscoveryCapabilityChannelV1(
      scope(), { companyName: "Fixture", contactName: "Canary" },
    );
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    channel.source.connect((next) =>
      boundary.injectAndExecute(next, async () => "accepted"));
    await channel.issuerPort.deliverOnce(injection());
    await expect(channel.issuerPort.deliverOnce(
      injection(),
    )).rejects.toThrow("DIRECT_CAPABILITY_ALREADY_CONSUMED");
  });

  it("03 rejects second consumption at the browser boundary", async () => {
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    await boundary.injectAndExecute(injection(), async () => "accepted");
    await expect(boundary.injectAndExecute(
      injection(), async () => "duplicate",
    )).rejects.toThrow("DIRECT_CAPABILITY_ALREADY_CONSUMED");
  });

  it("04 clears the bearer after success", async () => {
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    await boundary.injectAndExecute(injection(), async () => "accepted");
    expect(JSON.stringify(boundary)).not.toContain(BEARER);
    expect(JSON.stringify(boundary)).toContain("UNAVAILABLE");
  });

  it("05 clears the bearer after uncertain request failure", async () => {
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    await expect(boundary.injectAndExecute(injection(), async () => {
      throw new Error("NETWORK_UNCERTAIN");
    })).rejects.toThrow("NETWORK_UNCERTAIN");
    await expect(boundary.injectAndExecute(
      injection(), async () => "retry",
    )).rejects.toThrow("DIRECT_CAPABILITY_ALREADY_CONSUMED");
  });

  it("06 rejects an expired bearer before request construction", async () => {
    const operation = vi.fn(async () => "unexpected");
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    await expect(boundary.injectAndExecute(
      injection({ expiresAt: NOW }), operation,
    )).rejects.toThrow("DIRECT_CAPABILITY_EXPIRED");
    expect(operation).not.toHaveBeenCalled();
  });

  it("07 rejects a lifetime longer than PT5M", async () => {
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    await expect(boundary.injectAndExecute(
      injection({ expiresAt: NOW + 300_001 }), async () => "unexpected",
    )).rejects.toThrow("DIRECT_CAPABILITY_EXPIRED");
  });

  it("08 rejects arbitrary client-supplied scope fields", async () => {
    const operation = vi.fn(async () => "unexpected");
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    await expect(boundary.injectAndExecute(
      injection({ capabilityScope: "DISCOVERY_REPORT" }) as never,
      operation,
    )).rejects.toThrow("DIRECT_CAPABILITY_INJECTION_INVALID");
    expect(operation).not.toHaveBeenCalled();
  });

  it("09 rejects non-Preview runtime scope", () => {
    expect(() => new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1({
      ...scope(), environment: "PRODUCTION" as "PREVIEW",
    })).toThrow("DIRECT_CAPABILITY_SCOPE_INVALID");
  });

  it("10 exposes no bearer through JSON or object spread", async () => {
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    const pending = boundary.injectAndExecute(injection(), async () => {
      expect(JSON.stringify(boundary)).not.toContain(BEARER);
      expect({ ...boundary }).toEqual({});
      return "accepted";
    });
    await pending;
  });

  it("11 requires a live consumer before issuer delivery", async () => {
    const channel = createDirectEphemeralDiscoveryCapabilityChannelV1(
      scope(), { companyName: "Fixture", contactName: "Canary" },
    );
    await expect(channel.issuerPort.deliverOnce(
      injection(),
    )).rejects.toThrow("DIRECT_CAPABILITY_CONSUMER_UNAVAILABLE");
  });

  it("12 permits only one connected frontend consumer", () => {
    const channel = createDirectEphemeralDiscoveryCapabilityChannelV1(
      scope(), { companyName: "Fixture", contactName: "Canary" },
    );
    channel.source.connect((next) =>
      new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
        scope(), () => NOW,
      ).injectAndExecute(next, async () => "accepted"));
    expect(() => channel.source.connect((next) =>
      new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
        scope(), () => NOW,
      ).injectAndExecute(next, async () => "duplicate")))
      .toThrow("DIRECT_CAPABILITY_CONSUMER_ALREADY_CONNECTED");
  });

  it("13 a reload creates a fresh boundary without the earlier bearer", async () => {
    const first = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    await first.injectAndExecute(injection(), async () => "accepted");
    const reloaded = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    expect(JSON.stringify(reloaded)).toContain("READY");
    expect(JSON.stringify(reloaded)).not.toContain(BEARER);
  });

  it("14 never places the bearer in a URL-shaped request field", async () => {
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      scope(), () => NOW,
    );
    await boundary.injectAndExecute(injection(), async (request) => {
      expect(Object.keys(request)).toEqual([
        "sessionToken", "linkId", "sessionId", "turnId",
      ]);
      expect(JSON.stringify(request)).not.toContain("url");
      expect(JSON.stringify(request)).not.toContain("fragment");
      expect(JSON.stringify(request)).not.toContain("query");
      return "accepted";
    });
  });
});
