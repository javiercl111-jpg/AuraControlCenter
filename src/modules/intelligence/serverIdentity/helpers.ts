import type { VerifiedIdentityTenantBindingContractIssue } from './errors';
import { VerifiedIdentityTenantBindingContractError } from './errors';

type PlainRecord = Record<string, unknown>;

export function failContract(
  issue: VerifiedIdentityTenantBindingContractIssue,
): never {
  throw new VerifiedIdentityTenantBindingContractError(issue);
}

export function getClosedRecord(
  value: unknown,
  allowedKeys: readonly string[],
  issue: VerifiedIdentityTenantBindingContractIssue,
): PlainRecord {
  try {
    if (!isPlainRecord(value)) {
      return failContract(issue);
    }

    const keys = Reflect.ownKeys(value);
    if (
      keys.some((key) => typeof key !== 'string' || !allowedKeys.includes(key))
    ) {
      return failContract(issue);
    }

    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        return failContract(issue);
      }
    }

    return value;
  } catch (error: unknown) {
    if (error instanceof VerifiedIdentityTenantBindingContractError) {
      throw error;
    }
    return failContract(issue);
  }
}

export function requireExactLiteral<T extends string>(
  value: unknown,
  expected: T,
  issue: VerifiedIdentityTenantBindingContractIssue,
): T {
  if (value !== expected) {
    return failContract(issue);
  }
  return expected;
}

export function requireEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  issue: VerifiedIdentityTenantBindingContractIssue,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return failContract(issue);
  }
  return value as T;
}

export function requireCanonicalIdentifier(
  value: unknown,
  issue: VerifiedIdentityTenantBindingContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) ||
    value.toLowerCase() === 'system'
  ) {
    return failContract(issue);
  }
  return value;
}

export function requireCanonicalReference(
  value: unknown,
  issue: VerifiedIdentityTenantBindingContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 256 ||
    !/^[A-Za-z0-9][A-Za-z0-9_:/.-]*$/.test(value) ||
    value.includes('..') ||
    value.includes('@')
  ) {
    return failContract(issue);
  }
  return value;
}

export function requireFirebaseUid(
  value: unknown,
  issue: VerifiedIdentityTenantBindingContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)
  ) {
    return failContract(issue);
  }
  return value;
}

export function requireNonEmptyVersion(
  value: unknown,
  issue: VerifiedIdentityTenantBindingContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 128 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  ) {
    return failContract(issue);
  }
  return value;
}

export function requireFingerprint(
  value: unknown,
  issue: VerifiedIdentityTenantBindingContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failContract(issue);
  }
  return value;
}

export function requireTenantSlug(
  value: unknown,
  issue: VerifiedIdentityTenantBindingContractIssue,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 128 ||
    !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value)
  ) {
    return failContract(issue);
  }
  return value;
}

export function requireOptionalFingerprint(
  value: unknown,
  issue: VerifiedIdentityTenantBindingContractIssue,
): string | undefined {
  return value === undefined ? undefined : requireFingerprint(value, issue);
}

export function requireOptionalCanonicalReference(
  value: unknown,
  issue: VerifiedIdentityTenantBindingContractIssue,
): string | undefined {
  return value === undefined
    ? undefined
    : requireCanonicalReference(value, issue);
}

export function requireCanonicalTimestamp(
  value: unknown,
  issue: VerifiedIdentityTenantBindingContractIssue,
): string {
  if (typeof value !== 'string') {
    return failContract(issue);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    return failContract(issue);
  }
  return value;
}

export function requireTimestampOrder(
  earlier: string,
  later: string,
  allowEqual: boolean,
  issue: VerifiedIdentityTenantBindingContractIssue,
): void {
  const earlierMs = Date.parse(earlier);
  const laterMs = Date.parse(later);
  if (allowEqual ? earlierMs > laterMs : earlierMs >= laterMs) {
    failContract(issue);
  }
}

export function cloneFrozenOptional<T>(
  value: T | undefined,
): T | undefined {
  return value;
}

export function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
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

export function hasDefined(record: PlainRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key) &&
    record[key] !== undefined;
}
