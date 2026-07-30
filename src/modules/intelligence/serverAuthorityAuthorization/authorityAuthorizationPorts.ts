import type {
  AuthorityAuthorizationEvaluationContextV1,
  AuthorityAuthorizationRequestV1,
  AuthorityAuthorizationResultV1,
} from './authorityAuthorizationTypes';

export interface AuthorityAuthorizationEvaluatorPort {
  evaluate(
    request: AuthorityAuthorizationRequestV1,
    context: AuthorityAuthorizationEvaluationContextV1,
  ): Promise<AuthorityAuthorizationResultV1>;
}
