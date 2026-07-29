import {
  BOUNDARY_ACTOR_TYPES_V1,
  type BoundaryActorReferenceV1,
} from '../os/boundary/types';
import type { AuthorityPersistenceContractIssue } from './errors';
import { AuthorityPersistenceContractError } from './errors';
import type { TenantAliasType } from './types';

export type PlainRecord = Record<string, unknown>;

export function failAuthorityPersistenceContract(
  issue: AuthorityPersistenceContractIssue,
): never {
  throw new AuthorityPersistenceContractError(issue);
}

export function isPlainRecord(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

export function getClosedRecord(
  value: unknown,
  allowedKeys: readonly string[],
  issue: AuthorityPersistenceContractIssue,
): PlainRecord {
  try {
    if (!isPlainRecord(value)) {
      return failAuthorityPersistenceContract(issue);
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.some((key) => typeof key !== 'string' || !allowedKeys.includes(key))
    ) {
      return failAuthorityPersistenceContract(issue);
    }
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        return failAuthorityPersistenceContract(issue);
      }
    }
    return value;
  } catch (error: unknown) {
    if (error instanceof AuthorityPersistenceContractError) {
      throw error;
    }
    return failAuthorityPersistenceContract(issue);
  }
}

export function hasDefined(record: PlainRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key) &&
    record[key] !== undefined;
}

export function requireExactLiteral<T extends string>(
  value: unknown,
  expected: T,
  issue: AuthorityPersistenceContractIssue,
): T {
  if (value !== expected) {
    return failAuthorityPersistenceContract(issue);
  }
  return expected;
}

export function requireEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  issue: AuthorityPersistenceContractIssue,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return failAuthorityPersistenceContract(issue);
  }
  return value as T;
}

export function requirePositiveInteger(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireNonNegativeInteger(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireCanonicalDocumentId(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) ||
    value.toLowerCase() === 'aura_root'
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireCanonicalPrincipalId(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  const identifier = requireCanonicalDocumentId(value, issue);
  if (identifier.toLowerCase() === 'system') {
    return failAuthorityPersistenceContract(issue);
  }
  return identifier;
}

export function requireOperationalId(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 128 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) ||
    value.includes('..')
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireReasonCode(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 128 ||
    !/^[A-Z][A-Z0-9_]*$/.test(value)
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireCanonicalReference(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 256 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9_:/.-]*$/.test(value) ||
    value.includes('..') ||
    value.includes('@')
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireAuthorityResourceReference(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 768 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9_%|:/.-]*$/.test(value) ||
    value.includes('..') ||
    value.includes('@')
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireNonEmptyVersion(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 128 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireFingerprint(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireCanonicalTimestamp(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (typeof value !== 'string') {
    return failAuthorityPersistenceContract(issue);
  }
  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireTimestampOrder(
  earlier: string,
  later: string,
  allowEqual: boolean,
  issue: AuthorityPersistenceContractIssue,
): void {
  const earlierMs = Date.parse(earlier);
  const laterMs = Date.parse(later);
  if (allowEqual ? earlierMs > laterMs : earlierMs >= laterMs) {
    failAuthorityPersistenceContract(issue);
  }
}

export function requireTenantSlug(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 128 ||
    !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value)
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireNormalizedAlias(
  value: unknown,
  aliasType: TenantAliasType,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (aliasType === 'TENANT_SLUG') {
    return requireTenantSlug(value, issue);
  }
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 256 ||
    value !== value.toLowerCase() ||
    !/^[a-z0-9][a-z0-9_:/.-]*$/.test(value) ||
    value.includes('..') ||
    value.includes('@')
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  return value;
}

export function requireCanonicalActor(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): BoundaryActorReferenceV1 {
  const actor = getClosedRecord(value, ['actorType', 'actorId'], issue);
  return Object.freeze({
    actorType: requireEnumValue(
      actor.actorType,
      BOUNDARY_ACTOR_TYPES_V1,
      issue,
    ),
    actorId: requireCanonicalPrincipalId(actor.actorId, issue),
  });
}

export function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}
