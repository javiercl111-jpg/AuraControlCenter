import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as serverExports from '../../../server';
import {
  CANCELLATION_MATRIX,
  OBLIGATION_TYPE_MATRIX,
  PRINCIPAL_FAILURE_MATRIX,
  REPOSITORY_RESULT_MATRIX,
  SCOPE_FAILURE_MATRIX,
} from './authorityBoundaryCertificationMatrix';

const REPOSITORY_ROOT = path.resolve(process.cwd());
const APPLICATION_ROOT = path.join(
  REPOSITORY_ROOT,
  'src/modules/intelligence/serverAuthorityApplicationService',
);
const CERTIFICATION_ROOT = path.join(
  APPLICATION_ROOT,
  'tests/certification',
);

function readFiles(root: string, exclude = ''): string {
  return fs
    .readdirSync(root, { recursive: true })
    .filter(
      (entry): entry is string =>
        typeof entry === 'string' &&
        /\.(?:ts|md)$/.test(entry) &&
        !entry.endsWith(exclude),
    )
    .map((entry) => fs.readFileSync(path.join(root, entry), 'utf8'))
    .join('\n');
}

function applicationProductionSource(): string {
  return fs
    .readdirSync(APPLICATION_ROOT)
    .filter((entry) => entry.endsWith('.ts'))
    .map((entry) =>
      fs.readFileSync(path.join(APPLICATION_ROOT, entry), 'utf8'),
    )
    .join('\n');
}

describe('Authority Boundary Unit Certification architecture', () => {
  it('keeps every certification artifact in a test-only directory', () => {
    expect(
      fs.readdirSync(CERTIFICATION_ROOT).every((entry) =>
        path
          .join(CERTIFICATION_ROOT, entry)
          .replaceAll('\\', '/')
          .includes('/tests/certification/'),
      ),
    ).toBe(true);
  });

  it('keeps the Application Service Firebase-free', () => {
    expect(applicationProductionSource()).not.toMatch(
      /from\s+['"][^'"]*firebase[^'"]*['"]/i,
    );
  });

  it('keeps the Application Service Firestore-free', () => {
    expect(applicationProductionSource()).not.toMatch(
      /\b(?:getFirestore|runTransaction|writeBatch|DocumentReference)\b/,
    );
  });

  it('keeps the Application Service Functions-free', () => {
    expect(applicationProductionSource()).not.toMatch(
      /from\s+['"][^'"]*functions[^'"]*['"]/i,
    );
  });

  it('exposes no handler or transport surface', () => {
    expect(applicationProductionSource()).not.toMatch(
      /\b(?:onCall|onRequest|CallableRequest|HttpsError|Request|Response)\b/,
    );
  });

  it('uses no ambient environment or clock', () => {
    expect(applicationProductionSource()).not.toMatch(
      /\b(?:process\.env|import\.meta\.env|Date\.now)\b/,
    );
  });

  it('uses no randomness', () => {
    expect(applicationProductionSource()).not.toMatch(
      /\b(?:Math\.random|randomUUID)\s*\(/,
    );
  });

  it('imports no concrete adapter', () => {
    expect(applicationProductionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:firestore|adapter)[^'"]*['"]/i,
    );
  });

  it('imports no mutation planner', () => {
    expect(applicationProductionSource()).not.toContain(
      'planAuthorityMutationV1',
    );
  });

  it('limits repository port imports to certified ownership locations', () => {
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
        .map((entry) => ({
          entry: path
            .relative(REPOSITORY_ROOT, path.join(root, entry))
            .replaceAll('\\', '/'),
          source: fs.readFileSync(path.join(root, entry), 'utf8'),
        }))
        .filter(({ source }) =>
          /AuthorityMutationRepositoryPort/.test(source),
        )
        .map(({ entry }) => entry)
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

  it('does not expose certification helpers from the server entrypoint', () => {
    const names = Object.keys(serverExports);
    expect(names.some((name) => name.includes('Certification'))).toBe(false);
  });

  it('keeps the package on exactly one server subpath', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(
          REPOSITORY_ROOT,
          'packages/aura-intelligence-os/package.json',
        ),
        'utf8',
      ),
    ) as Readonly<{ exports: Readonly<Record<string, unknown>> }>;
    expect(Object.keys(manifest.exports)).toEqual(['./server']);
  });

  it('uses none of the prohibited TypeScript escapes in certification', () => {
    expect(readFiles(CERTIFICATION_ROOT, 'architecture.test.ts')).not.toMatch(
      /\b(?:as any|@ts-ignore|@ts-nocheck|eslint-disable|console\.log|TODO)\b/,
    );
  });

  it('contains no skipped, focused, or placeholder certification tests', () => {
    expect(readFiles(CERTIFICATION_ROOT, 'architecture.test.ts')).not.toMatch(
      /\b(?:describe|it|test)\.(?:skip|only|todo)\s*\(/,
    );
  });

  it('keeps every fuzz matrix deterministic and frozen', () => {
    for (const matrix of [
      PRINCIPAL_FAILURE_MATRIX,
      SCOPE_FAILURE_MATRIX,
      OBLIGATION_TYPE_MATRIX,
      REPOSITORY_RESULT_MATRIX,
      CANCELLATION_MATRIX,
    ]) {
      expect(Object.isFrozen(matrix)).toBe(true);
    }
  });

  it('adds no productive Functions consumer', () => {
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
