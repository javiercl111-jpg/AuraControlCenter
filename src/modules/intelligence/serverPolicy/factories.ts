import type {
  AuthoritativePolicySnapshotV1,
} from './types';
import {
  validateAuthoritativePolicySnapshotV1,
} from './validators';

export function createAuthoritativePolicySnapshotV1(
  value: unknown
): AuthoritativePolicySnapshotV1 {
  return validateAuthoritativePolicySnapshotV1(value);
}
