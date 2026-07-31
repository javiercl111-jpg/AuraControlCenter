import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as serverExports from '../../server';

const REPOSITORY_ROOT = path.resolve(process.cwd());
const MODULE_ROOT = path.join(
  REPOSITORY_ROOT,
  'src/modules/intelligence/serverAuthorityApplicationService',
);
const PRODUCTION_FILES = fs
  .readdirSync(MODULE_ROOT)
  .filter((entry) => entry.endsWith('.ts'))
  .map((entry) => path.join(MODULE_ROOT, entry));

function productionSource(): string {
  return PRODUCTION_FILES.map((file) =>
    fs.readFileSync(file, 'utf8'),
  ).join('\n');
}

describe('Authority Application Service architecture', () => {
  it('is server-only and React-free', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:react|components|pages|hooks|ui)[^'"]*['"]/i,
    );
  });

  it('is Firebase-free', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*firebase[^'"]*['"]/i,
    );
  });

  it('is Firestore-free', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:getFirestore|collection|doc|getDoc|getDocs|runTransaction)\s*\(/,
    );
  });

  it('is Functions-free and exposes no handlers', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*functions[^'"]*['"]/i,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:Request|Response|CallableRequest|HttpsError|onCall|onRequest)\b/,
    );
  });

  it('contains no resolver or evaluator runtime implementation', () => {
    expect(productionSource()).not.toMatch(
      /\bclass\s+\w*(?:Resolver|Evaluator)\b/,
    );
    expect(productionSource()).not.toMatch(
      /(?:firebase|firestore).*(?:Resolver|Evaluator)/i,
    );
  });

  it('contains no transport or middleware imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:handler|controller|middleware|transport|express)[^'"]*['"]/i,
    );
  });

  it('reads no ambient environment', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:process\.env|import\.meta\.env|localStorage|sessionStorage)\b/,
    );
  });

  it('uses no ambient clock or randomness', () => {
    expect(productionSource()).not.toMatch(/\bDate\.now\s*\(/);
    expect(productionSource()).not.toMatch(
      /\b(?:Math\.random|randomUUID)\s*\(/,
    );
  });

  it('contains no productive Composition Root', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:CompositionRoot|composeProduction|darkComposition)\b/i,
    );
  });

  it('does not import the adapter or planner', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:authorityPersistence\/planner|authorityPersistence\/adapter|firestore|authorityPersistence\/InMemory)[^'"]*['"]/i,
    );
    expect(productionSource()).not.toContain('planAuthorityMutationV1');
  });

  it('does not duplicate policy or persistence logic', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:RBAC|roleHierarchy|permissionMatrix|runTransaction|writeBatch)\b/,
    );
  });

  it('contains none of the prohibited TypeScript escapes', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:as any|@ts-ignore|@ts-nocheck|eslint-disable|console\.log|TODO)\b/,
    );
  });

  it('limits repository port ownership to certified locations', () => {
    const roots = [
      path.join(REPOSITORY_ROOT, 'src'),
      path.join(REPOSITORY_ROOT, 'functions/src'),
    ];
    const violations = roots.flatMap((root) =>
      fs
        .readdirSync(root, { recursive: true })
        .filter(
          (entry): entry is string =>
            typeof entry === 'string' && /\.(?:ts|tsx|js|cjs)$/.test(entry),
        )
        .map((entry) => {
          const normalized = path
            .relative(REPOSITORY_ROOT, path.join(root, entry))
            .replaceAll('\\', '/');
          return {
            normalized,
            source: fs.readFileSync(path.join(root, entry), 'utf8'),
          };
        })
        .filter(({ source }) =>
          /AuthorityMutationRepositoryPort/.test(source),
        )
        .map(({ normalized }) => normalized)
        .filter(
          (entry) =>
            entry !== 'src/modules/intelligence/server.ts' &&
            entry !==
              'src/modules/intelligence/serverAuthorityAuthorization/tests/architecture.test.ts' &&
            !entry.startsWith(
              'src/modules/intelligence/serverAuthorityPersistence/',
            ) &&
            !entry.startsWith(
              'src/modules/intelligence/serverAuthorityApplicationService/',
            ) &&
            !entry.startsWith(
              'functions/src/infrastructure/firestore/authorityPersistence/',
            ) &&
            !entry.startsWith(
              'functions/src/composition/authorityDarkComposition/',
            ),
        ),
    );
    expect(violations).toEqual([]);
  });

  it('exports only certified Application Service runtime symbols', () => {
    const expected = [
      'AUTHORITY_APPLICATION_EXECUTION_CONTEXT_VERSION',
      'AUTHORITY_APPLICATION_EXECUTION_MODES',
      'AUTHORITY_APPLICATION_IDEMPOTENCY_INPUT_VERSION',
      'AUTHORITY_APPLICATION_OBLIGATION_INPUT_VERSION',
      'AUTHORITY_APPLICATION_RESULT_STATUSES',
      'AUTHORITY_APPLICATION_RETRY_DISPOSITIONS',
      'AUTHORITY_APPLICATION_SAFE_CODES',
      'AUTHORITY_APPLICATION_SERVICE_CONTRACT_ISSUES',
      'AUTHORITY_APPLICATION_SERVICE_ERROR_CODES',
      'AUTHORITY_APPLICATION_SERVICE_ERROR_VERSION',
      'AUTHORITY_APPLICATION_SERVICE_REQUEST_VERSION',
      'AUTHORITY_APPLICATION_SERVICE_RESULT_VERSION',
      'AUTHORITY_APPLICATION_SERVICE_VERSION',
      'AUTHORITY_APPLICATION_STAGE_STATUSES',
      'AUTHORITY_APPLICATION_STAGE_TRACE_VERSION',
      'AUTHORITY_APPLICATION_STAGES',
      'AUTHORITY_OBLIGATION_VERIFICATION_RESULT_VERSION',
      'AUTHORITY_OBLIGATION_VERIFICATION_STATUSES',
      'AuthorityApplicationServiceContractError',
      'AuthorityApplicationServiceExecutionError',
      'AuthorityApplicationServiceValidationError',
      'createAuthorityApplicationServiceV1',
      'validateAuthorityApplicationExecutionContextV1',
      'validateAuthorityApplicationIdempotencyInputV1',
      'validateAuthorityApplicationObligationEvidenceInputV1',
      'validateAuthorityApplicationServiceDependenciesV1',
      'validateAuthorityApplicationServiceRequestV1',
      'validateAuthorityApplicationServiceResultV1',
      'validateAuthorityApplicationStageTraceV1',
      'validateAuthorityObligationVerificationResultV1',
    ];
    for (const name of expected) {
      expect(Object.keys(serverExports)).toContain(name);
    }
    for (const forbidden of [
      'buildAuthorityApplicationServiceV1',
      'mapAuthorizationRequestV1',
      'mapRepositoryResultV1',
    ]) {
      expect(Object.keys(serverExports)).not.toContain(forbidden);
    }
  });

  it('keeps the package on the single server subpath', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(
          REPOSITORY_ROOT,
          'packages/aura-intelligence-os/package.json',
        ),
        'utf8',
      ),
    ) as Readonly<{
      exports: Readonly<Record<string, unknown>>;
    }>;
    expect(Object.keys(manifest.exports)).toEqual(['./server']);
  });

  it('adds no direct Functions consumer', () => {
    const functionsRoot = path.join(REPOSITORY_ROOT, 'functions/src');
    const consumers = fs
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
        /serverAuthorityApplicationService|AuthorityApplicationService/.test(
          source,
        ),
      );
    expect(consumers.map(({ entry }) => entry).sort()).toEqual([
      'composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionFactory.ts',
      'composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionTypes.ts',
    ]);
    expect(consumers.every(({ source }) =>
      source.includes('@aura/intelligence-os/server') &&
      !source.includes('src/modules/intelligence')
    )).toBe(true);
  });
});
