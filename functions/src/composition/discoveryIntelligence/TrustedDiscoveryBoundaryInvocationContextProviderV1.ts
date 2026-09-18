import type {
  BoundaryInvocationContextV1,
  TrustedServerRequestContextV1,
} from "@aura/intelligence-os/server";

export class TrustedDiscoveryBoundaryInvocationContextProviderV1 {
  private readonly trustedContext:
    TrustedServerRequestContextV1;

  public constructor(
    trustedContext: TrustedServerRequestContextV1,
  ) {
    this.trustedContext = trustedContext;
  }

  public create(): BoundaryInvocationContextV1 {
    return {
      schemaVersion: "1",
      tenantId:
        this.trustedContext.tenantMembership.tenantId,
      actor: {
        actorType:
          this.trustedContext.authenticatedPrincipal
            .principalType,
        actorId:
          this.trustedContext.authenticatedPrincipal
            .principalId,
      },
      consumerId: this.trustedContext.consumer,
      source: this.trustedContext.source,
      requestId:
        this.trustedContext.requestIdentity.requestId,
      correlationId:
        this.trustedContext.requestIdentity.correlationId,
    };
  }
}