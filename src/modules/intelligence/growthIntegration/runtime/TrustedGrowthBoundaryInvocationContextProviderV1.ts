import type {
  BoundaryInvocationContextV1,
} from '../../os/boundary/types';

import type {
  TrustedServerRequestContextV1,
} from '../../serverComposition/types';

export class TrustedGrowthBoundaryInvocationContextProviderV1 {
  private readonly trustedContext:
    TrustedServerRequestContextV1;

  constructor(
    trustedContext: TrustedServerRequestContextV1,
  ) {
    this.trustedContext = trustedContext;
  }

  create(): BoundaryInvocationContextV1 {
    return {
      schemaVersion: '1',
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
