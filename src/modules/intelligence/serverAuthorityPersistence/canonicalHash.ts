import { createHash } from 'node:crypto';

import type { AuthorityPersistenceContractIssue } from './errors';
import {
  failAuthorityPersistenceContract,
  isPlainRecord,
} from './helpers';

function frame(value: string): string {
  return `${value.length}:${value}`;
}

function serializeCanonicalValue(
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  if (typeof value === 'string') {
    return `s${frame(value)}`;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return `n${frame(String(value))}`;
  }
  if (typeof value === 'boolean') {
    return value ? 'b1' : 'b0';
  }
  if (value === null) {
    return 'z';
  }
  if (Array.isArray(value)) {
    return `a${value.length}[${value
      .map((item) => serializeCanonicalValue(item, issue))
      .join('')}]`;
  }
  if (isPlainRecord(value)) {
    const keys = Object.keys(value).sort();
    return `o${keys.length}{${keys
      .map((key) => {
        const nested = value[key];
        if (nested === undefined) {
          return failAuthorityPersistenceContract(issue);
        }
        return `${frame(key)}${serializeCanonicalValue(nested, issue)}`;
      })
      .join('')}}`;
  }
  return failAuthorityPersistenceContract(issue);
}

export function createCanonicalAuthorityHashV1(
  namespace: string,
  value: unknown,
  issue: AuthorityPersistenceContractIssue,
): string {
  const canonical = `${frame(namespace)}${serializeCanonicalValue(
    value,
    issue,
  )}`;
  return `sha256:${createHash('sha256')
    .update(canonical, 'utf8')
    .digest('hex')}`;
}
