import { buildAuthorityApplicationServiceV1 } from './AuthorityApplicationService';
import type {
  AuthorityApplicationServiceDependenciesV1,
} from './authorityApplicationServicePorts';
import type {
  AuthorityApplicationServiceV1,
} from './authorityApplicationServiceTypes';
import {
  validateAuthorityApplicationServiceDependenciesV1,
} from './authorityApplicationServiceValidators';

export function createAuthorityApplicationServiceV1(
  dependencies: AuthorityApplicationServiceDependenciesV1,
): AuthorityApplicationServiceV1 {
  return buildAuthorityApplicationServiceV1(
    validateAuthorityApplicationServiceDependenciesV1(dependencies),
  );
}
