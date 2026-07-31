import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as serverExports from '../../server';

const MODULE_ROOT = path.resolve(
  process.cwd(),
  'src/modules/intelligence/serverAuthorityInvocationContext',
);
const PRODUCTION_FILES = [
  'authorityInvocationContextTypes.ts',
  'authorityInvocationContextValidators.ts',
  'authorityInvocationContextFactories.ts',
  'authorityInvocationContextProjectors.ts',
  'authorityInvocationContextErrors.ts',
  'index.ts',
].map((file) => path.join(MODULE_ROOT, file));

function productionSource(): string {
  return PRODUCTION_FILES.map((file) =>
    fs.readFileSync(file, 'utf8'),
  ).join('\n');
}

describe('Authority invocation context architecture', () => {
  it('62 has no ambient time or randomness', () => {
    expect(productionSource()).not.toMatch(/\bDate\.now\s*\(/);
    expect(productionSource()).not.toMatch(
      /\b(?:Math\.random|randomUUID)\s*\(/,
    );
  });

  it('63 is Firebase, Firestore, Functions, and React free', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:firebase|firestore|functions|react)[^'"]*['"]/i,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:getFirestore|runTransaction|onCall|onRequest)\s*\(/,
    );
  });

  it('64 defines no resolver or evaluator runtime', () => {
    expect(productionSource()).not.toMatch(
      /\bclass\s+\w*(?:Resolver|Evaluator|PolicyEngine)\b/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:resolvePrincipal|resolveScope|evaluateAuthorization)\s*\(/,
    );
  });

  it('65 defines no application service, handler, or middleware', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:ApplicationService|Handler|Middleware)\b/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:onCall|onRequest|onSchedule|onDocument)\s*\(/,
    );
  });

  it('66 imports no repository implementation, adapter, or composition root', () => {
    const runtimeImports =
      productionSource().match(
        /import\s+(?!type\b)[\s\S]*?from\s+['"][^'"]+['"]/g,
      ) ?? [];
    expect(runtimeImports.join('\n')).not.toMatch(
      /InMemoryAuthorityMutationRepository|authorityPersistence|authorityDarkComposition|infrastructure|adapter/i,
    );
  });

  it('67 reads no environment and contains no default allow or bypass', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:process\.env|import\.meta\.env|localStorage|sessionStorage)\b/,
    );
    expect(productionSource()).not.toMatch(
      /PERMIT_ALL|DEFAULT_ALLOW|SUPERADMIN_ALLOW|BYPASSED|IGNORED|WAIVED/,
    );
  });

  it('68 uses strict source without suppression escapes', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:as any|@ts-ignore|@ts-nocheck|eslint-disable)\b/,
    );
    expect(productionSource()).not.toMatch(/\bconsole\.log\s*\(/);
    expect(productionSource()).not.toMatch(/\bTODO\b/);
  });

  it('69 exports the exact certified concepts through server', () => {
    for (const name of [
      'AUTHORITY_INVOCATION_CONTEXT_VERSION',
      'AUTHORITY_INVOCATION_CONTEXT_STATUSES',
      'AuthorityInvocationContextProjectionError',
      'createAuthorityInvocationContextV1',
      'validateAuthorityRepositoryProjectionInputV1',
      'projectAuthorityInvocationContextToRepositoryV1',
    ]) {
      expect(Object.keys(serverExports)).toContain(name);
    }
  });

  it('70 leaves the persistence contract unchanged', () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/modules/intelligence/serverAuthorityPersistence/types.ts',
      ),
      'utf8',
    );
    const context = source.match(
      /export interface AuthorityRepositoryInvocationContextV1 \{[\s\S]*?\n\}/,
    );
    expect(context?.[0]).not.toContain('obligation');
    expect(context?.[0]).not.toContain('scopeProjection');
    expect(context?.[0]).not.toContain('contextFingerprint');
  });

  it('71 keeps package and production consumption boundaries closed', () => {
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
    const functionsRoot = path.resolve(process.cwd(), 'functions/src');
    const consumers = fs
      .readdirSync(functionsRoot, { recursive: true })
      .filter(
        (entry): entry is string =>
          typeof entry === 'string' && /\.(?:ts|js)$/.test(entry),
      )
      .map((entry) =>
        fs.readFileSync(path.join(functionsRoot, entry), 'utf8'),
      )
      .filter((source) =>
        /serverAuthorityInvocationContext|AuthorityInvocationContextV1/.test(
          source,
        ),
      );
    expect(consumers).toEqual([]);
  });
});
