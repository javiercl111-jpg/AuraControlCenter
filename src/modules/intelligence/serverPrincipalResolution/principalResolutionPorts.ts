import type {
  AuthorityPrincipalResolutionContextV1,
  AuthorityPrincipalResolutionRequestV1,
  AuthorityPrincipalResolutionResultV1,
} from './principalResolutionTypes';

export interface AuthorityPrincipalResolverPort {
  resolve(
    request: AuthorityPrincipalResolutionRequestV1,
    context: AuthorityPrincipalResolutionContextV1,
  ): Promise<AuthorityPrincipalResolutionResultV1>;
}
