import type {
  AuthorityAdministrativeCommandV1,
  AuthorityRepositoryInvocationContextV1,
  AuthorityRepositoryResultV1,
} from './types';

export interface AuthorityMutationRepositoryPort {
  execute(
    command: AuthorityAdministrativeCommandV1,
    context: AuthorityRepositoryInvocationContextV1,
  ): Promise<AuthorityRepositoryResultV1>;
}

export interface AuthorityClockPort {
  nowIso(): string;
}
