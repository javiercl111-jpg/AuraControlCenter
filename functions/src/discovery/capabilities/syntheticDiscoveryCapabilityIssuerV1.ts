import { createHash } from "node:crypto";
import {
  DISCOVERY_CAPABILITY_VERSION,
  type DiscoveryCapabilityV1,
} from "./discoveryCapabilityTypes";
import {
  generateDiscoveryCapabilityTokenV1,
  hashDiscoveryCapabilityToken,
} from "./discoveryCapabilityHashes";

const SYNTHETIC_TENANT_LABEL = "AI02H2-PREVIEW-SYNTHETIC-TENANT-01";

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export const SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1 = Object.freeze({
  version: "SYNTHETIC_DISCOVERY_CAPABILITY_ISSUER_V1" as const,
  projectId: "aura-intel-preview" as const,
  environment: "PREVIEW" as const,
  authorizedActorId: "ai02h2-preview-synthetic-identity-01" as const,
  tenantId: `tenant-${digest(SYNTHETIC_TENANT_LABEL)}`,
  linkId: "ai-ux-02d3-preview-synthetic-discovery-link-v1" as const,
  sessionId: "ai-ux-02d3-preview-synthetic-discovery-session-v1" as const,
  fixtureLocator: "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE" as const,
  requiredCapability: "EVALUATE_CONVERSATION" as const,
  capabilityScope: "DISCOVERY_SESSION" as const,
  generation: 1,
  ttlMs: 5 * 60 * 1_000,
  authorizedWriteCount: 3,
});

export interface SyntheticDiscoveryIssuerAuthorityV1 {
  readonly projectId: string;
  readonly environment: string;
  readonly actorId: string;
  readonly tenantId: string;
}

export interface SyntheticDiscoveryPreparationV1 {
  readonly binding: Readonly<Record<string, unknown>>;
  readonly session: Readonly<Record<string, unknown>>;
  readonly capability: DiscoveryCapabilityV1;
}

export interface SyntheticDiscoveryCapabilityPersistenceV1 {
  prepareAtomic(
    preparation: SyntheticDiscoveryPreparationV1,
  ): Promise<"CREATED" | "EXISTING_IDENTICAL">;
}

export interface SyntheticDiscoveryCapabilityHandoffV1 {
  readonly bearerToken: string;
  readonly expiresAt: number;
  readonly linkId: string;
  readonly sessionId: string;
  readonly handoffBoundary: "AUTHORIZED_IN_MEMORY_CALLER";
  readonly requestBoundary: "EVALUATE_CONVERSATION_CALLABLE_BODY";
}

export interface SyntheticDiscoveryCapabilitySafeSummaryV1 {
  readonly version: typeof SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1.version;
  readonly environment: "PREVIEW";
  readonly tenantId: string;
  readonly linkId: string;
  readonly sessionId: string;
  readonly fixtureLocator: string;
  readonly requiredCapability: "EVALUATE_CONVERSATION";
  readonly hashOnlyPersistence: true;
  readonly plaintextPersisted: false;
  readonly plaintextLogged: false;
  readonly authorizedWriteCount: 3;
  readonly fourthWriteRequired: false;
}

export class SyntheticDiscoveryCapabilityIssuerErrorV1 extends Error {
  constructor(readonly code: "AUTHORITY_REJECTED" | "ISSUANCE_CONFLICT") {
    super(code);
    this.name = "SyntheticDiscoveryCapabilityIssuerErrorV1";
  }
}

function assertAuthority(authority: SyntheticDiscoveryIssuerAuthorityV1): void {
  const policy = SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1;
  if (
    authority.projectId !== policy.projectId ||
    authority.environment !== policy.environment ||
    authority.actorId !== policy.authorizedActorId ||
    authority.tenantId !== policy.tenantId
  ) {
    throw new SyntheticDiscoveryCapabilityIssuerErrorV1("AUTHORITY_REJECTED");
  }
}

export class SyntheticDiscoveryCapabilityIssuerV1 {
  constructor(
    private readonly persistence: SyntheticDiscoveryCapabilityPersistenceV1,
    private readonly clock: () => number = Date.now,
    private readonly tokenFactory: () => string = generateDiscoveryCapabilityTokenV1,
  ) {}

  async issue(
    authority: SyntheticDiscoveryIssuerAuthorityV1,
  ): Promise<SyntheticDiscoveryCapabilityHandoffV1> {
    assertAuthority(authority);
    const policy = SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1;
    const issuedAt = this.clock();
    const expiresAt = issuedAt + policy.ttlMs;
    const bearerToken = this.tokenFactory();
    if (!/^[a-f0-9]{64}$/u.test(bearerToken)) {
      throw new SyntheticDiscoveryCapabilityIssuerErrorV1("ISSUANCE_CONFLICT");
    }
    const tokenHash = hashDiscoveryCapabilityToken(bearerToken);
    const binding = Object.freeze({
      version: "SYNTHETIC_DISCOVERY_BINDING_V1",
      synthetic: true,
      environment: policy.environment,
      projectId: policy.projectId,
      tenantId: policy.tenantId,
      fixtureLocator: policy.fixtureLocator,
      requiredCapability: policy.requiredCapability,
      linkId: policy.linkId,
      sessionId: policy.sessionId,
      sessionCapabilityHash: tokenHash,
      sessionCapabilityGeneration: policy.generation,
      status: "pending",
      usageCount: 1,
      createdAt: issuedAt,
      updatedAt: issuedAt,
      expiresAt,
    });
    const session = Object.freeze({
      version: "SYNTHETIC_DISCOVERY_SESSION_V1",
      synthetic: true,
      environment: policy.environment,
      projectId: policy.projectId,
      tenantId: policy.tenantId,
      fixtureLocator: policy.fixtureLocator,
      requiredCapability: policy.requiredCapability,
      linkId: policy.linkId,
      sessionId: policy.sessionId,
      status: "READY",
      createdAt: issuedAt,
      updatedAt: issuedAt,
      expiresAt,
    });
    const capability: DiscoveryCapabilityV1 = Object.freeze({
      version: DISCOVERY_CAPABILITY_VERSION,
      type: "SESSION",
      subjectId: policy.sessionId,
      linkId: policy.linkId,
      sessionId: policy.sessionId,
      audience: "PUBLIC_DISCOVERY",
      purpose: "DISCOVERY_SESSION",
      generation: policy.generation,
      tokenHash,
      issuedAt,
      expiresAt,
      consumedAt: null,
      completedAt: null,
      revokedAt: null,
      revocationReason: null,
      createdAt: issuedAt,
      updatedAt: issuedAt,
      synthetic: true,
      environment: policy.environment,
      projectId: policy.projectId,
      tenantId: policy.tenantId,
      fixtureLocator: policy.fixtureLocator,
      requiredCapability: policy.requiredCapability,
      capabilityScope: policy.capabilityScope,
      issuedByActorId: policy.authorizedActorId,
      issuerVersion: policy.version,
    });
    await this.persistence.prepareAtomic({ binding, session, capability });
    const handoff = {
      expiresAt,
      linkId: policy.linkId,
      sessionId: policy.sessionId,
      handoffBoundary: "AUTHORIZED_IN_MEMORY_CALLER" as const,
      requestBoundary: "EVALUATE_CONVERSATION_CALLABLE_BODY" as const,
    } as SyntheticDiscoveryCapabilityHandoffV1;
    Object.defineProperty(handoff, "bearerToken", {
      value: bearerToken,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return Object.freeze(handoff);
  }
}

export function summarizeSyntheticDiscoveryCapabilityV1():
SyntheticDiscoveryCapabilitySafeSummaryV1 {
  const policy = SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1;
  return Object.freeze({
    version: policy.version,
    environment: policy.environment,
    tenantId: policy.tenantId,
    linkId: policy.linkId,
    sessionId: policy.sessionId,
    fixtureLocator: policy.fixtureLocator,
    requiredCapability: policy.requiredCapability,
    hashOnlyPersistence: true,
    plaintextPersisted: false,
    plaintextLogged: false,
    authorizedWriteCount: policy.authorizedWriteCount,
    fourthWriteRequired: false,
  });
}
