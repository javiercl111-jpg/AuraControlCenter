import { describe, expect, it, vi } from "vitest";

import {
  AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1,
  AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
  DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
  hashAuthorizedJitControlProofV1,
  installAuthorizedJitBootstrapV1,
  type AuthorizedJitBootstrapTargetV1,
} from "./authorizedJitBootstrapV1";
import {
  DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1,
  type DirectEphemeralDiscoveryCapabilityRequestV1,
  type DirectEphemeralDiscoveryCapabilitySourceV1,
} from "./directEphemeralDiscoveryCapabilityInjectionV1";

const NOW = 1_786_493_200_000;
const CONTROL_PROOF = "AIUX02D2E4.Control.Proof.For.Local.Tests.0001";
const BEARER = "c".repeat(64);
const BINDING = Object.freeze({
  environment: "PREVIEW" as const,
  authoritativeTenantId: `tenant-${"ab".repeat(32)}`,
  syntheticFixtureLocator: "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE",
  linkId: "synthetic_link_certified_v1",
  sessionId: "dossier_synthetic_certified_v1",
  turnId: "AI_UX_02D3_CANARY_TURN_0001",
});
const SCOPE = Object.freeze({
  environment: BINDING.environment,
  linkId: BINDING.linkId,
  sessionId: BINDING.sessionId,
  turnId: BINDING.turnId,
});

async function configured(
  mountFrontend: (source: DirectEphemeralDiscoveryCapabilitySourceV1) => void,
  clock: () => number = () => NOW,
) {
  const target: AuthorizedJitBootstrapTargetV1 = {};
  const controlProofDigest = await hashAuthorizedJitControlProofV1(
    CONTROL_PROOF,
  );
  const installation = installAuthorizedJitBootstrapV1({
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    controlProofDigest,
    target,
    clock,
    mountFrontend,
  });
  return { installation, target };
}

function connectFrontend(
  source: DirectEphemeralDiscoveryCapabilitySourceV1,
  evaluate: (
    request: DirectEphemeralDiscoveryCapabilityRequestV1,
  ) => Promise<unknown> = vi.fn(async () =>
    Object.freeze({ accepted: true })),
) {
  const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
    source.scope,
    () => NOW,
  );
  source.connect((injection) =>
    boundary.injectAndExecute(injection, evaluate));
  return { boundary, evaluate };
}

async function claim(target: AuthorizedJitBootstrapTargetV1) {
  const boundary = target[AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1];
  if (!boundary) throw new Error("CLAIM_BOUNDARY_MISSING");
  return boundary.claim({
    version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
    controlProof: CONTROL_PROOF,
    binding: BINDING,
  });
}

describe("AI-UX-02D2E4 authorized JIT bootstrap", () => {
  it("01 is unavailable in Production", async () => {
    const target: AuthorizedJitBootstrapTargetV1 = {};
    const installation = installAuthorizedJitBootstrapV1({
      environment: "PRODUCTION",
      projectId: "aura-control-center-debb3",
      controlProofDigest: await hashAuthorizedJitControlProofV1(CONTROL_PROOF),
      target,
      mountFrontend: vi.fn(),
    });
    expect(installation.status).toBe("UNAVAILABLE");
    expect(target).not.toHaveProperty(
      AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1,
    );
  });

  it("02 is unavailable in Staging", async () => {
    const target: AuthorizedJitBootstrapTargetV1 = {};
    const installation = installAuthorizedJitBootstrapV1({
      environment: "STAGING",
      projectId: "aura-intel-staging",
      controlProofDigest: await hashAuthorizedJitControlProofV1(CONTROL_PROOF),
      target,
      mountFrontend: vi.fn(),
    });
    expect(installation.status).toBe("UNAVAILABLE");
    expect(Object.keys(target)).toEqual([]);
  });

  it("03 is unavailable to ordinary Preview without a control hash", () => {
    const target: AuthorizedJitBootstrapTargetV1 = {};
    const installation = installAuthorizedJitBootstrapV1({
      environment: "PREVIEW",
      projectId: "aura-intel-preview",
      target,
      mountFrontend: vi.fn(),
    });
    expect(installation.status).toBe("UNAVAILABLE");
    expect(Reflect.ownKeys(target)).toEqual([]);
  });

  it("04 installs only a non-enumerable temporary claim boundary", async () => {
    const { installation, target } = await configured(vi.fn());
    expect(installation.status).toBe("WAITING_FOR_AUTHORIZED_CLAIM");
    expect(Object.keys(target)).toEqual([]);
    expect(Object.getOwnPropertyDescriptor(
      target,
      AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1,
    )).toMatchObject({ configurable: true, enumerable: false, writable: false });
    expect(JSON.stringify(target)).not.toContain(CONTROL_PROOF);
  });

  it("05 removes the claim boundary and fails closed on wrong proof", async () => {
    const mount = vi.fn();
    const { target } = await configured(mount);
    const boundary = target[AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1];
    await expect(boundary?.claim({
      version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
      controlProof: "AIUX02D2E4.Control.Proof.For.Local.Tests.WRONG",
      binding: BINDING,
    })).resolves.toMatchObject({
      proofObservation: { status: "REJECTED" },
      handle: null,
    });
    expect(mount).not.toHaveBeenCalled();
    expect(Reflect.ownKeys(target)).toEqual([]);
  });

  it("06 rejects arbitrary claim fields before mounting", async () => {
    const mount = vi.fn();
    const { target } = await configured(mount);
    const boundary = target[AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1];
    await expect(boundary?.claim({
      version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
      controlProof: CONTROL_PROOF,
      binding: BINDING,
      capabilityScope: "ARBITRARY",
    } as never)).rejects.toThrow("JIT_BOOTSTRAP_CLAIM_INVALID");
    expect(mount).not.toHaveBeenCalled();
  });

  it("07 mounts only the controller-resolved source after authorized claim", async () => {
    let observedSource: DirectEphemeralDiscoveryCapabilitySourceV1 | undefined;
    const { target } = await configured((source) => {
      observedSource = source;
      connectFrontend(source);
    });
    const decision = await claim(target);
    const handle = decision.handle!;
    expect(decision.proofObservation).toMatchObject({
      status: "VERIFIED",
      expectedControlProofDigest: decision.proofObservation.observedControlProofDigest,
    });
    expect(observedSource?.scope).toEqual(SCOPE);
    expect(target).not.toHaveProperty(
      AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1,
    );
    expect(handle.isFrontendReady()).toBe(true);
  });

  it("08 issues one request and makes the handle stale", async () => {
    const evaluate = vi.fn(async (request: Readonly<{
      sessionToken: string;
      linkId: string;
      sessionId: string;
      turnId: string;
    }>) => {
      expect(request.sessionToken).toBe(BEARER);
      expect(request).toMatchObject({
        linkId: BINDING.linkId,
        sessionId: BINDING.sessionId,
        turnId: BINDING.turnId,
      });
      return Object.freeze({ accepted: true });
    });
    const { target } = await configured((source) => {
      connectFrontend(source, evaluate);
    });
    const handle = (await claim(target)).handle!;
    await expect(handle.deliverOnce({
      version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
      bearer: BEARER,
      expiresAt: NOW + 300_000,
    })).resolves.toMatchObject({ status: "CONSUMED" });
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(handle.isFrontendReady()).toBe(false);
    await expect(handle.deliverOnce({
      version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
      bearer: BEARER,
      expiresAt: NOW + 300_000,
    })).rejects.toThrow("JIT_BOOTSTRAP_HANDLE_STALE");
  });

  it("09 invalidates an early delivery when the frontend is not ready", async () => {
    const { target } = await configured(vi.fn());
    const handle = (await claim(target)).handle!;
    expect(handle.isFrontendReady()).toBe(false);
    await expect(handle.deliverOnce({
      version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
      bearer: BEARER,
      expiresAt: NOW + 300_000,
    })).rejects.toThrow("JIT_BOOTSTRAP_FRONTEND_NOT_READY");
    expect(JSON.stringify(handle)).toContain("STALE");
  });

  it("10 dispose simulates reload and invalidates claim and handle", async () => {
    const { installation, target } = await configured((source) => {
      connectFrontend(source);
    });
    const handle = (await claim(target)).handle!;
    installation.dispose();
    expect(handle.isFrontendReady()).toBe(false);
    expect(Reflect.ownKeys(target)).toEqual([]);
  });

  it("11 exposes no proof or bearer through safe serialization", async () => {
    const { installation, target } = await configured((source) => {
      connectFrontend(source);
    });
    const decision = await claim(target);
    const handle = decision.handle!;
    const serialized = JSON.stringify({ installation, handle, target });
    expect(serialized).not.toContain(CONTROL_PROOF);
    expect(serialized).not.toContain(BEARER);
    expect(serialized).not.toContain(`"controlProof":"${CONTROL_PROOF}"`);
  });

  it("12 expires an unused authorized handle after five minutes", async () => {
    let now = NOW;
    const { target } = await configured((source) => {
      connectFrontend(source);
    }, () => now);
    const handle = (await claim(target)).handle!;
    expect(handle.isFrontendReady()).toBe(true);
    now += 300_000;
    expect(handle.isFrontendReady()).toBe(false);
    await expect(handle.deliverOnce({
      version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
      bearer: BEARER,
      expiresAt: now + 60_000,
    })).rejects.toThrow("JIT_BOOTSTRAP_HANDLE_STALE");
  });
});
