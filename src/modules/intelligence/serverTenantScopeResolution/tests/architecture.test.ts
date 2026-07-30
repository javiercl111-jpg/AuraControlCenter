import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as serverExports from '../../server';
import {
  AUTHORITY_RETRY_DISPOSITIONS,
  AUTHORITY_TENANT_SCOPE_RETRY_DISPOSITIONS,
} from '../../server';

const MODULE_ROOT = path.resolve(
  process.cwd(),
  'src/modules/intelligence/serverTenantScopeResolution',
);
const PRODUCTION_FILES = [
  'tenantScopeResolutionTypes.ts',
  'tenantScopeResolutionPorts.ts',
  'tenantScopeResolutionValidators.ts',
  'tenantScopeResolutionFactories.ts',
  'tenantScopeResolutionErrors.ts',
  'index.ts',
].map((file) => path.join(MODULE_ROOT, file));

function productionSource(): string {
  return PRODUCTION_FILES.map((file) =>
    fs.readFileSync(file, 'utf8'),
  ).join('\n');
}

describe('Authority tenant and scope architecture', () => {
  it('50 uses no ambient clock', () => {
    expect(productionSource()).not.toMatch(/\bDate\.now\s*\(/);
  });

  it('51 uses no random identifier generation', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:Math\.random|randomUUID)\s*\(/,
    );
  });

  it('52 has no Firebase, React, or UI imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:firebase|react|components|pages|hooks)[^'"]*['"]/i,
    );
  });

  it('53 has no Firestore runtime or reader', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:getFirestore|collection|doc|getDoc|getDocs|runTransaction)\s*\(/,
    );
    expect(productionSource()).not.toContain('TenantFirestoreReader');
  });

  it('54 has no Functions imports or handlers', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*functions[^'"]*['"]/i,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:onCall|onRequest|onSchedule|onDocument)\s*\(/,
    );
  });

  it('55 defines exactly one resolver port', () => {
    const source = fs.readFileSync(
      path.join(MODULE_ROOT, 'tenantScopeResolutionPorts.ts'),
      'utf8',
    );
    expect(source.match(/\binterface\s+\w+Port\b/g)).toEqual([
      'interface AuthorityTenantScopeResolverPort',
    ]);
    expect(source).toContain('resolve(');
  });

  it('56 exports the exact certified server surface', () => {
    for (const name of [
      'AUTHORITY_TENANT_SCOPE_TYPES',
      'AUTHORITY_TENANT_SELECTOR_TYPES',
      'AUTHORITY_TENANT_SCOPE_RETRY_DISPOSITIONS',
      'AuthorityTenantScopeContractError',
      'createAuthorityTenantSelectorV1',
      'createResolvedTenantAuthorityScopeV1',
      'validateResolvedAuthorityTenantScopeV1',
      'validateAuthorityTenantScopeResolutionResultV1',
    ]) {
      expect(Object.keys(serverExports)).toContain(name);
    }
  });

  it('57 keeps architecture boundaries fail-closed', () => {
    expect(productionSource()).not.toMatch(
      /\bclass\s+(?:.*Resolver|.*CompositionRoot)\b/,
    );
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:serverPolicy|authorityPersistence|authorityDarkComposition)[^'"]*['"]/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:process\.env|import\.meta\.env|fetch|localStorage|sessionStorage)\b/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:as any|@ts-ignore|@ts-nocheck|eslint-disable)\b/,
    );
    const declarations = productionSource().match(
      /\b(?:interface|type|class)\s+\w+/g,
    ) ?? [];
    expect(declarations.join('\n')).not.toMatch(
      /AuthorizationDecision|Permission|RepositoryPort|Adapter/,
    );
  });

  it('58 keeps retry semantics separate from persistence', () => {
    expect(AUTHORITY_TENANT_SCOPE_RETRY_DISPOSITIONS).not.toEqual(
      AUTHORITY_RETRY_DISPOSITIONS,
    );
    expect(AUTHORITY_TENANT_SCOPE_RETRY_DISPOSITIONS).toContain(
      'RETRY_AFTER_MEMBERSHIP_REFRESH',
    );
  });

  it('59 keeps the package on the single server subpath', () => {
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

  it('60 has no direct production Functions consumer', () => {
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
        /serverTenantScopeResolution|ResolvedAuthorityTenantScope/.test(
          source,
        ),
      );
    expect(violations).toEqual([]);
  });
});
