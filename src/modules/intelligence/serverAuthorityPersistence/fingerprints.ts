import { createCanonicalAuthorityHashV1 } from './canonicalHash';
import type {
  AuthorityAdministrativeCommandV1,
  AuthorityRepositoryResultV1,
} from './types';
import {
  validateAuthorityAdministrativeCommandV1,
  validateAuthorityRepositoryResultV1,
} from './validators';

export function createAuthorityCommandFingerprintV1(
  command: unknown,
): string {
  const validated = validateAuthorityAdministrativeCommandV1(command);
  return createCanonicalAuthorityHashV1(
    'authority-command-fingerprint:v1',
    validated,
    'INVALID_COMMAND_FINGERPRINT',
  );
}

export function createAuthorityRepositoryResultFingerprintV1(
  result: unknown,
): string {
  const validated = validateAuthorityRepositoryResultV1(result);
  return createCanonicalAuthorityHashV1(
    'authority-repository-result-fingerprint:v1',
    validated,
    'INVALID_REPOSITORY_RESULT',
  );
}

export function replayAuthorityRepositoryResultV1(
  result: AuthorityRepositoryResultV1,
): AuthorityRepositoryResultV1 {
  return validateAuthorityRepositoryResultV1(result);
}

export type {
  AuthorityAdministrativeCommandV1,
  AuthorityRepositoryResultV1,
};
