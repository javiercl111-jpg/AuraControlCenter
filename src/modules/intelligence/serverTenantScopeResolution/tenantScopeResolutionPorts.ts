import type {
  AuthorityTenantScopeResolutionContextV1,
  AuthorityTenantScopeResolutionRequestV1,
  AuthorityTenantScopeResolutionResultV1,
} from './tenantScopeResolutionTypes';

export interface AuthorityTenantScopeResolverPort {
  resolve(
    request: AuthorityTenantScopeResolutionRequestV1,
    context: AuthorityTenantScopeResolutionContextV1,
  ): Promise<AuthorityTenantScopeResolutionResultV1>;
}
