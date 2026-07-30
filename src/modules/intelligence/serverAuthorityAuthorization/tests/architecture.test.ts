import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as serverExports from '../../server';
import {
  AUTHORITY_AUTHORIZATION_RETRY_DISPOSITIONS,
  AUTHORITY_RETRY_DISPOSITIONS,
} from '../../server';

const MODULE_ROOT = path.resolve(
  process.cwd(),
  'src/modules/intelligence/serverAuthorityAuthorization',
);
const PRODUCTION_FILES = [
  'authorityAuthorizationTypes.ts',
  'authorityAuthorizationPorts.ts',
  'authorityAuthorizationValidators.ts',
  'authorityAuthorizationFactories.ts',
  'authorityAuthorizationErrors.ts',
  'index.ts',
].map((file) => path.join(MODULE_ROOT, file));

function productionSource(): string {
  return PRODUCTION_FILES.map((file) =>
    fs.readFileSync(file, 'utf8'),
  ).join('\n');
}

describe('Authority authorization architecture', () => {
  it('62 uses no ambient clock', () => {
    expect(productionSource()).not.toMatch(/\bDate\.now\s*\(/);
  });

  it('63 uses no random identifiers', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:Math\.random|randomUUID)\s*\(/,
    );
  });

  it('64 has no Firebase, React, or UI imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:firebase|react|components|pages|hooks)[^'"]*['"]/i,
    );
  });

  it('65 has no Firestore access or policy reader', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:getFirestore|collection|doc|getDoc|getDocs|runTransaction)\s*\(/,
    );
    expect(productionSource()).not.toContain('PolicyReader');
  });

  it('66 has no Functions imports or handlers', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*functions[^'"]*['"]/i,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:onCall|onRequest|onSchedule|onDocument)\s*\(/,
    );
  });

  it('67 has no repository runtime import or implementation', () => {
    expect(productionSource()).not.toMatch(
      /import\s+(?!type\b)[\s\S]*?from\s+['"][^'"]*serverAuthorityPersistence/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:InMemoryAuthorityMutationRepository|AuthorityMutationRepositoryPort)\b/,
    );
  });

  it('68 defines exactly one evaluator port', () => {
    const source = fs.readFileSync(
      path.join(MODULE_ROOT, 'authorityAuthorizationPorts.ts'),
      'utf8',
    );
    expect(source.match(/\binterface\s+\w+Port\b/g)).toEqual([
      'interface AuthorityAuthorizationEvaluatorPort',
    ]);
    expect(source).toContain('evaluate(');
  });

  it('69 exports the exact certified server surface', () => {
    for (const name of [
      'AUTHORITY_AUTHORIZATION_DECISIONS',
      'AUTHORITY_PERMISSIONS',
      'AUTHORITY_AUTHORIZATION_OBLIGATION_TYPES',
      'AuthorityAuthorizationContractError',
      'createAuthorityAuthorizationDecisionV1',
      'validateAuthorityAuthorizationRequestV1',
      'validateAuthorityAuthorizationResultV1',
    ]) {
      expect(Object.keys(serverExports)).toContain(name);
    }
  });

  it('70 keeps architecture boundaries fail-closed', () => {
    expect(productionSource()).not.toMatch(
      /\bclass\s+(?:.*Evaluator|.*PolicyEngine|.*Rbac|.*CompositionRoot)\b/i,
    );
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:authorityPersistence|authorityDarkComposition|adapter)[^'"]*['"]/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:process\.env|import\.meta\.env|fetch|localStorage|sessionStorage)\b/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:as any|@ts-ignore|@ts-nocheck|eslint-disable)\b/,
    );
    expect(productionSource()).not.toMatch(
      /PERMIT_ALL|DEFAULT_ALLOW|SUPERADMIN_ALLOW|ALLOW_CROSS_TENANT/,
    );
  });

  it('71 keeps retry semantics separate from persistence', () => {
    expect(AUTHORITY_AUTHORIZATION_RETRY_DISPOSITIONS).not.toEqual(
      AUTHORITY_RETRY_DISPOSITIONS,
    );
    expect(AUTHORITY_AUTHORIZATION_RETRY_DISPOSITIONS).toContain(
      'RETRY_AFTER_POLICY_REFRESH',
    );
  });

  it('72 keeps the package on the single server subpath', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          'packages/aura-intelligence-os/package.json',
        ),
        'utf8',
      ),
    ) as Readonly<Record<string, unknown>>;
    expect(
      Object.keys(
        manifest.exports as Readonly<Record<string, unknown>>,
      ),
    ).toEqual(['./server']);
  });

  it('73 has no direct production Functions consumer', () => {
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
        /serverAuthorityAuthorization|AuthorityAuthorizationDecisionV1/.test(
          source,
        ),
      );
    expect(violations).toEqual([]);
  });
});
