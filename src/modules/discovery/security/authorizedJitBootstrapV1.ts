import {
  DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
  createDirectEphemeralDiscoveryCapabilityChannelV1,
  type DirectEphemeralDiscoveryCapabilityInjectionV1,
  type DirectEphemeralDiscoveryCapabilityReceiptV1,
  type DirectEphemeralDiscoveryCapabilitySourceV1,
} from "./directEphemeralDiscoveryCapabilityInjectionV1";

export const AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1 =
  "AUTHORIZED_JIT_BOOTSTRAP_V1" as const;
export const AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1 =
  "__auraAuthorizedJitBootstrapClaimV1" as const;
export const AUTHORIZED_JIT_BOOTSTRAP_CONTROL_HASH_VARIABLE_V1 =
  "VITE_AI_UX_02D2E4_CONTROL_PROOF_DIGEST_V1" as const;
export const AUTHORIZED_JIT_BOOTSTRAP_HANDLE_TTL_MS_V1 = 5 * 60 * 1_000;

const PREVIEW_PROJECT_ID = "aura-intel-preview";
const CONTROL_HASH = /^[a-f0-9]{64}$/u;
const CONTROL_PROOF = /^[A-Za-z0-9._~:+/-]{32,512}$/u;
const FIXTURE = /^SYNTHETIC_FIXTURE_V1_[A-F0-9]{32}$/u;
const TENANT = /^tenant-[a-f0-9]{64}$/u;
const SAFE_RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/u;
const CLAIM_KEYS = Object.freeze(["binding", "controlProof", "version"] as const);
const BINDING_KEYS = Object.freeze([
  "authoritativeTenantId",
  "environment",
  "linkId",
  "sessionId",
  "syntheticFixtureLocator",
  "turnId",
] as const);

const AUTHORIZED_JIT_BOOTSTRAP_DISPLAY_CONTEXT_V1 = Object.freeze({
  companyName: "Synthetic Preview Fixture",
  contactName: "Canary",
});

export type AuthorizedJitBootstrapErrorCodeV1 =
  | "JIT_BOOTSTRAP_ALREADY_CLAIMED"
  | "JIT_BOOTSTRAP_CLAIM_INVALID"
  | "JIT_BOOTSTRAP_AUTHORITY_REJECTED"
  | "JIT_BOOTSTRAP_MOUNT_FAILED"
  | "JIT_BOOTSTRAP_HANDLE_STALE"
  | "JIT_BOOTSTRAP_FRONTEND_NOT_READY";

export class AuthorizedJitBootstrapErrorV1 extends Error {
  public readonly code: AuthorizedJitBootstrapErrorCodeV1;

  public constructor(code: AuthorizedJitBootstrapErrorCodeV1) {
    super(code);
    this.name = "AuthorizedJitBootstrapErrorV1";
    this.code = code;
  }
}

function fail(code: AuthorizedJitBootstrapErrorCodeV1): never {
  throw new AuthorizedJitBootstrapErrorV1(code);
}

export interface AuthorizedJitBootstrapClaimV1 {
  readonly version: typeof AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1;
  readonly controlProof: string;
  readonly binding: AuthorizedJitBootstrapBindingV1;
}

export interface AuthorizedJitBootstrapBindingV1 {
  readonly environment: "PREVIEW";
  readonly authoritativeTenantId: string;
  readonly syntheticFixtureLocator: string;
  readonly linkId: string;
  readonly sessionId: string;
  readonly turnId: string;
}

export interface AuthorizedJitBootstrapClaimHandleV1 {
  readonly version: typeof AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1;
  isFrontendReady(): boolean;
  deliverOnce(
    injection: DirectEphemeralDiscoveryCapabilityInjectionV1,
  ): Promise<DirectEphemeralDiscoveryCapabilityReceiptV1<unknown>>;
  invalidate(): void;
  toJSON(): Readonly<Record<string, unknown>>;
}

export interface AuthorizedJitBootstrapProofObservationV1 {
  readonly status: "VERIFIED" | "REJECTED";
  readonly expectedControlProofDigest: string;
  readonly observedControlProofDigest: string;
  readonly verifiedAtMs: number;
}

export interface AuthorizedJitBootstrapClaimDecisionV1 {
  readonly proofObservation: AuthorizedJitBootstrapProofObservationV1;
  readonly handle: AuthorizedJitBootstrapClaimHandleV1 | null;
}

export interface AuthorizedJitBootstrapClaimBoundaryV1 {
  readonly version: typeof AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1;
  claim(
    input: AuthorizedJitBootstrapClaimV1,
  ): Promise<AuthorizedJitBootstrapClaimDecisionV1>;
}

export interface AuthorizedJitBootstrapTargetV1 {
  [AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1]?:
    AuthorizedJitBootstrapClaimBoundaryV1;
}

export interface AuthorizedJitBootstrapInstallationInputV1 {
  readonly environment?: string;
  readonly projectId?: string;
  readonly controlProofDigest?: string;
  readonly target: AuthorizedJitBootstrapTargetV1;
  readonly clock?: () => number;
  readonly mountFrontend: (
    source: DirectEphemeralDiscoveryCapabilitySourceV1,
  ) => void;
}

export type AuthorizedJitBootstrapInstallationV1 = Readonly<{
  version: typeof AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1;
  status: "UNAVAILABLE" | "WAITING_FOR_AUTHORIZED_CLAIM";
  dispose(): void;
  toJSON(): Readonly<Record<string, unknown>>;
}>;

function exactBinding(
  input: AuthorizedJitBootstrapBindingV1,
): AuthorizedJitBootstrapBindingV1 {
  if (!input || typeof input !== "object") {
    fail("JIT_BOOTSTRAP_CLAIM_INVALID");
  }
  const keys = Object.keys(input).sort();
  const expected = [...BINDING_KEYS].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    input.environment !== "PREVIEW" ||
    !TENANT.test(input.authoritativeTenantId) ||
    !FIXTURE.test(input.syntheticFixtureLocator) ||
    !SAFE_RESOURCE_ID.test(input.linkId) ||
    !SAFE_RESOURCE_ID.test(input.sessionId) ||
    !SAFE_RESOURCE_ID.test(input.turnId)
  ) {
    fail("JIT_BOOTSTRAP_CLAIM_INVALID");
  }
  return Object.freeze({ ...input });
}

function exactClaim(input: AuthorizedJitBootstrapClaimV1): Readonly<{
  controlProof: string;
  binding: AuthorizedJitBootstrapBindingV1;
}> {
  if (!input || typeof input !== "object") {
    fail("JIT_BOOTSTRAP_CLAIM_INVALID");
  }
  const keys = Object.keys(input).sort();
  const expected = [...CLAIM_KEYS].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    input.version !== AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1 ||
    typeof input.controlProof !== "string" ||
    !CONTROL_PROOF.test(input.controlProof)
  ) {
    fail("JIT_BOOTSTRAP_CLAIM_INVALID");
  }
  return Object.freeze({
    controlProof: input.controlProof,
    binding: exactBinding(input.binding),
  });
}

export async function hashAuthorizedJitControlProofV1(
  controlProof: string,
): Promise<string> {
  if (!CONTROL_PROOF.test(controlProof)) {
    fail("JIT_BOOTSTRAP_CLAIM_INVALID");
  }
  const bytes = new TextEncoder().encode(controlProof);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function unavailable(): AuthorizedJitBootstrapInstallationV1 {
  return Object.freeze({
    version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
    status: "UNAVAILABLE" as const,
    dispose() {},
    toJSON: () => Object.freeze({
      version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
      status: "UNAVAILABLE",
    }),
  });
}

export function installAuthorizedJitBootstrapV1(
  input: AuthorizedJitBootstrapInstallationInputV1,
): AuthorizedJitBootstrapInstallationV1 {
  const configuredDigest = input.controlProofDigest;
  if (
    input.environment !== "PREVIEW" ||
    input.projectId !== PREVIEW_PROJECT_ID ||
    !configuredDigest ||
    !CONTROL_HASH.test(configuredDigest)
  ) {
    return unavailable();
  }

  let claimAvailable = true;
  let handleAvailable = false;
  let handleExpiresAt = 0;
  const clock = input.clock ?? Date.now;
  const removeClaim = () => {
    const installed = input.target[
      AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1
    ];
    if (installed === claimBoundary) {
      Reflect.deleteProperty(
        input.target,
        AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1,
      );
    }
  };

  const claimBoundary: AuthorizedJitBootstrapClaimBoundaryV1 = Object.freeze({
    version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
    async claim(claimInput: AuthorizedJitBootstrapClaimV1) {
      if (!claimAvailable) fail("JIT_BOOTSTRAP_ALREADY_CLAIMED");
      claimAvailable = false;
      removeClaim();
      const claim = exactClaim(claimInput);
      const observedHash = await hashAuthorizedJitControlProofV1(
        claim.controlProof,
      );
      const proofObservation: AuthorizedJitBootstrapProofObservationV1 =
        Object.freeze({
          status: constantTimeEqual(observedHash, configuredDigest)
            ? "VERIFIED" as const
            : "REJECTED" as const,
          expectedControlProofDigest: configuredDigest,
          observedControlProofDigest: observedHash,
          verifiedAtMs: clock(),
        });
      if (proofObservation.status === "REJECTED") {
        return Object.freeze({ proofObservation, handle: null });
      }

      const channel = createDirectEphemeralDiscoveryCapabilityChannelV1(
        Object.freeze({
          environment: claim.binding.environment,
          linkId: claim.binding.linkId,
          sessionId: claim.binding.sessionId,
          turnId: claim.binding.turnId,
        }),
        AUTHORIZED_JIT_BOOTSTRAP_DISPLAY_CONTEXT_V1,
      );
      try {
        input.mountFrontend(channel.source);
      } catch {
        fail("JIT_BOOTSTRAP_MOUNT_FAILED");
      }
      handleAvailable = true;
      handleExpiresAt = clock() + AUTHORIZED_JIT_BOOTSTRAP_HANDLE_TTL_MS_V1;

      const isHandleAvailable = () => {
        if (handleAvailable && clock() >= handleExpiresAt) {
          handleAvailable = false;
        }
        return handleAvailable;
      };

      const handle: AuthorizedJitBootstrapClaimHandleV1 = Object.freeze({
        version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
        isFrontendReady: () =>
          isHandleAvailable() && channel.issuerPort.isReady(),
        async deliverOnce(
          injection: DirectEphemeralDiscoveryCapabilityInjectionV1,
        ) {
          if (!isHandleAvailable()) fail("JIT_BOOTSTRAP_HANDLE_STALE");
          if (!channel.issuerPort.isReady()) {
            handleAvailable = false;
            fail("JIT_BOOTSTRAP_FRONTEND_NOT_READY");
          }
          handleAvailable = false;
          return channel.issuerPort.deliverOnce(injection);
        },
        invalidate() {
          handleAvailable = false;
        },
        toJSON: () => Object.freeze({
          version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
          status: isHandleAvailable() ? "AUTHORIZED" : "STALE",
          frontendReady:
            isHandleAvailable() && channel.issuerPort.isReady(),
        }),
      });
      return Object.freeze({ proofObservation, handle });
    },
  });

  Object.defineProperty(
    input.target,
    AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1,
    {
      configurable: true,
      enumerable: false,
      writable: false,
      value: claimBoundary,
    },
  );

  return Object.freeze({
    version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
    status: "WAITING_FOR_AUTHORIZED_CLAIM" as const,
    dispose() {
      claimAvailable = false;
      handleAvailable = false;
      removeClaim();
    },
    toJSON: () => Object.freeze({
      version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
      status: claimAvailable ? "WAITING_FOR_AUTHORIZED_CLAIM" : "UNAVAILABLE",
    }),
  });
}

export { DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1 };
