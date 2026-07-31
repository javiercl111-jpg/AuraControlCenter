import type {
  AuthorityAuthorizationDecisionV1,
} from '../serverAuthorityAuthorization/authorityAuthorizationTypes';
import type {
  AuthorityMutationRepositoryPort,
  AuthorityClockPort,
} from '../serverAuthorityPersistence/ports';
import type {
  AuthorityPrincipalResolverPort,
} from '../serverPrincipalResolution/principalResolutionPorts';
import type {
  AuthorityTenantScopeResolverPort,
} from '../serverTenantScopeResolution/tenantScopeResolutionPorts';
import type {
  AuthorityAuthorizationEvaluatorPort,
} from '../serverAuthorityAuthorization/authorityAuthorizationPorts';
import type {
  AuthorityApplicationObligationEvidenceInputV1,
  AuthorityInvocationContextFingerprintInputV1,
  AuthorityObligationVerificationContextV1,
  AuthorityObligationVerificationResultV1,
} from './authorityApplicationServiceTypes';

export interface AuthorityObligationVerifierPort {
  verify(
    decision: AuthorityAuthorizationDecisionV1,
    evidence: readonly AuthorityApplicationObligationEvidenceInputV1[],
    context: AuthorityObligationVerificationContextV1,
  ): Promise<AuthorityObligationVerificationResultV1>;
}

export interface AuthorityInvocationContextFingerprintPort {
  fingerprint(
    input: AuthorityInvocationContextFingerprintInputV1,
  ): Promise<string>;
}

export interface AuthorityApplicationServiceDependenciesV1 {
  readonly principalResolver: AuthorityPrincipalResolverPort;
  readonly tenantScopeResolver: AuthorityTenantScopeResolverPort;
  readonly authorizationEvaluator: AuthorityAuthorizationEvaluatorPort;
  readonly obligationVerifier: AuthorityObligationVerifierPort;
  readonly contextFingerprintProvider:
    AuthorityInvocationContextFingerprintPort;
  readonly repository: AuthorityMutationRepositoryPort;
  readonly clock: AuthorityClockPort;
}
