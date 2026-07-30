import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as serverExports from '../../server';
import {
  AUTHORITY_PRINCIPAL_RETRY_DISPOSITIONS,
  AUTHORITY_RETRY_DISPOSITIONS,
} from '../../server';

const MODULE_ROOT = path.resolve(
  process.cwd(),
  'src/modules/intelligence/serverPrincipalResolution',
);
const PRODUCTION_FILES = [
  'principalResolutionTypes.ts',
  'principalResolutionPorts.ts',
  'principalResolutionValidators.ts',
  'principalResolutionFactories.ts',
  'principalResolutionErrors.ts',
  'index.ts',
].map((file) => path.join(MODULE_ROOT, file));

function productionSource(): string {
  return PRODUCTION_FILES.map((file) =>
    fs.readFileSync(file, 'utf8'),
  ).join('\n');
}

describe('Authority principal resolution architecture', () => {
  it('49 remains a dedicated contract module', () => {
    expect(PRODUCTION_FILES.every((file) => fs.existsSync(file))).toBe(true);
  });

  it('50 has no Firebase, Firestore, Functions, React, or UI imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:firebase|firestore|functions|react|components|pages|hooks)[^'"]*['"]/i,
    );
  });

  it('51 has no handler, middleware, runtime resolver, or composition root', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:onCall|onRequest|onSchedule|onDocument|verifyIdToken|initializeApp)\s*\(/,
    );
    expect(productionSource()).not.toMatch(
      /\bclass\s+(?:.*Resolver|.*CompositionRoot)\b/,
    );
  });

  it('52 has no environment, I/O, network, ambient time, or randomness', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:process\.env|import\.meta\.env|fetch|XMLHttpRequest|localStorage|sessionStorage)\b/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:Date\.now|Math\.random|randomUUID)\s*\(/,
    );
  });

  it('53 has no unsafe TypeScript or lint escape hatch', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:as any|@ts-ignore|@ts-nocheck|eslint-disable)\b/,
    );
  });

  it('54 contains no tenant, membership, authorization, repository, adapter, or dark-composition contract', () => {
    const declarations = productionSource().match(
      /\b(?:interface|type|class)\s+\w+/g,
    ) ?? [];
    expect(declarations.join('\n')).not.toMatch(
      /Tenant|Membership|Authorization|Repository|Adapter|DarkComposition/,
    );
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:serverAuthorityPersistence|serverPolicy|authorityPersistence|authorityDarkComposition)[^'"]*['"]/,
    );
  });

  it('55 defines only one resolver port and no binding reader port', () => {
    const ports = fs.readFileSync(
      path.join(MODULE_ROOT, 'principalResolutionPorts.ts'),
      'utf8',
    );
    expect(ports.match(/\binterface\s+\w+Port\b/g)).toEqual([
      'interface AuthorityPrincipalResolverPort',
    ]);
    expect(ports).not.toContain('AuthorityPrincipalBindingReaderPort');
  });

  it('56 keeps cancellation outside the serializable contract', () => {
    expect(productionSource()).not.toContain('AbortSignal');
    expect(productionSource()).not.toContain('cancellationSignal');
  });

  it('57 exports the exact new runtime surface through server', () => {
    for (const name of [
      'AUTHORITY_PRINCIPAL_TYPES',
      'AUTHORITY_AUTHENTICATION_METHODS',
      'AUTHORITY_PRINCIPAL_RETRY_DISPOSITIONS',
      'AuthorityPrincipalContractError',
      'createAuthorityPrincipalIdV1',
      'createResolvedHumanAuthorityPrincipalV1',
      'createAuthorityPrincipalResolutionResultV1',
      'validateResolvedAuthorityPrincipalV1',
      'validateAuthorityPrincipalResolutionRequestV1',
    ]) {
      expect(Object.keys(serverExports)).toContain(name);
    }
  });

  it('58 does not duplicate persistence retry semantics', () => {
    expect(AUTHORITY_PRINCIPAL_RETRY_DISPOSITIONS).not.toEqual(
      AUTHORITY_RETRY_DISPOSITIONS,
    );
    expect(AUTHORITY_PRINCIPAL_RETRY_DISPOSITIONS).toContain(
      'RETRY_AFTER_REAUTHENTICATION',
    );
    expect(AUTHORITY_RETRY_DISPOSITIONS).toContain(
      'SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY',
    );
  });

  it('59 is not imported by production Functions', () => {
    const functionsRoot = path.resolve(process.cwd(), 'functions/src');
    const violations = fs
      .readdirSync(functionsRoot, { recursive: true })
      .filter(
        (entry): entry is string =>
          typeof entry === 'string' && /\.(?:ts|js)$/.test(entry),
      )
      .map((entry) => ({
        entry: entry.replaceAll('\\', '/'),
        source: fs.readFileSync(path.join(functionsRoot, entry), 'utf8'),
      }))
      .filter(({ source }) =>
        /serverPrincipalResolution|ResolvedAuthorityPrincipal/.test(source),
      );
    expect(violations).toEqual([]);
  });

  it('60 keeps the public package on the single server subpath', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          'packages/aura-intelligence-os/package.json',
        ),
        'utf8',
      ),
    ) as Readonly<Record<string, unknown>>;
    expect(Object.keys(
      manifest.exports as Readonly<Record<string, unknown>>,
    )).toEqual(['./server']);
  });
});
