import type {
  AuthoritativeFeaturePolicyPort,
  BoundaryAuditPort,
  BoundaryClockPort,
  BoundaryExecutionPort,
} from '../os/boundary/ports';
import type {
  TrustedPrincipalResolutionInputV1,
  TrustedRegistrySelectionV1,
  TrustedRequestIdentityFactoryInputV1,
  TrustedRequestIdentityV1,
  TrustedServerExecutionResponseV1,
  TrustedServerLifecycleV1,
  TrustedServerPrincipalV1,
  TrustedServerRequestContextV1,
  TrustedServerResponseSourceV1,
  TrustedTenantAuthorityResolutionInputV1,
  TrustedTenantMembershipV1,
} from './types';

export interface TrustedRequestIdentityFactoryPort {
  createIdentity(
    input: TrustedRequestIdentityFactoryInputV1
  ): TrustedRequestIdentityV1;
}

export interface TrustedConsumerSourceRegistryPort {
  resolve(
    input: Pick<
      TrustedServerRequestContextV1,
      'consumer' | 'source' | 'transport' | 'requestedExecutionMode'
    >
  ): TrustedRegistrySelectionV1;
}

export interface TrustedPrincipalResolverPort {
  resolvePrincipal(
    input: TrustedPrincipalResolutionInputV1
  ): Promise<TrustedServerPrincipalV1>;
}

export interface TrustedTenantAuthorityResolverPort {
  resolveMembership(
    input: TrustedTenantAuthorityResolutionInputV1
  ): Promise<TrustedTenantMembershipV1>;
}

export interface TrustedServerResponseSanitizerPort {
  sanitize(
    input: TrustedServerResponseSourceV1
  ): TrustedServerExecutionResponseV1;
}

export interface TrustedCancellationAdapterPort {
  adapt(
    lifecycle: TrustedServerLifecycleV1
  ): AbortSignal | undefined;
}

export interface TrustedCompositionRootDependencies {
  readonly featurePolicyPort: AuthoritativeFeaturePolicyPort;
  readonly executionPort: BoundaryExecutionPort;
  readonly clockPort: BoundaryClockPort;
  readonly auditPort: BoundaryAuditPort;
  readonly requestIdentityFactory: TrustedRequestIdentityFactoryPort;
  readonly registry: TrustedConsumerSourceRegistryPort;
  readonly tenantAuthorityResolver: TrustedTenantAuthorityResolverPort;
  readonly principalResolver: TrustedPrincipalResolverPort;
  readonly responseSanitizer: TrustedServerResponseSanitizerPort;
  readonly cancellationAdapter?: TrustedCancellationAdapterPort;
}
