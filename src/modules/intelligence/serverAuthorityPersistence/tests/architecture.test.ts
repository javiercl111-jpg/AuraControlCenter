import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MODULE_ROOT = path.resolve(
  process.cwd(),
  'src/modules/intelligence/serverAuthorityPersistence',
);
const PRODUCTION_FILES = [
  'types.ts',
  'errors.ts',
  'helpers.ts',
  'ids.ts',
  'transitions.ts',
  'canonicalHash.ts',
  'fingerprints.ts',
  'versioning.ts',
  'ports.ts',
  'validators.ts',
  'factories.ts',
  'legacyTenantSources.ts',
  'runtimeTypes.ts',
  'snapshot.ts',
  'mutationPlan.ts',
  'planner.ts',
  'applyMutationPlan.ts',
  'InMemoryAuthorityMutationRepository.ts',
].map((file) => path.join(MODULE_ROOT, file));

function productionSource(): string {
  return PRODUCTION_FILES.map((file) => fs.readFileSync(file, 'utf8')).join(
    '\n',
  );
}

describe('serverAuthorityPersistence architecture', () => {
  it('1 remains a dedicated server-only module', () => {
    expect(PRODUCTION_FILES.every((file) => fs.existsSync(file))).toBe(true);
  });

  it('2 has no Firebase or Firestore imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"](?:firebase|firebase-admin|firebase-functions|[^'"]*firestore)/i,
    );
  });

  it('3 has no Functions, Discovery, React, UI, or rules imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:functions|discovery|react|components|pages|hooks|firestore\.rules)[^'"]*['"]/i,
    );
  });

  it('4 has no infrastructure repository, resolver, migration, or handler runtime', () => {
    expect(productionSource()).not.toMatch(
      /\bclass\s+(?:.*Firestore.*Repository|.*Firebase.*Repository|.*Resolver|.*Migration|.*Handler)\b/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:getFirestore|initializeApp|onCall|onRequest|setDoc|addDoc|runTransaction)\s*\(/,
    );
  });

  it('5 has no I/O, network, or ambient environment access', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:fetch|XMLHttpRequest|readFile|writeFile|process\.env|localStorage|sessionStorage)\b/,
    );
  });

  it('6 has no ambient clock or randomness', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:Date\.now|Math\.random|randomUUID)\s*\(/,
    );
    expect(productionSource()).not.toMatch(/\bnew\s+Date\s*\(\s*\)/);
  });

  it('7 has no unsafe TypeScript or lint escape hatches', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:as any|as unknown as|@ts-ignore|@ts-nocheck|eslint-disable)\b/,
    );
  });

  it('8 contains no console logging, TODO, mutable global state, or fallback', () => {
    expect(productionSource()).not.toMatch(
      /\bconsole\.log\b|\bTODO\b|\blet\s+[A-Za-z_$][\w$]*\s*=/,
    );
    expect(productionSource()).not.toMatch(/\bfallback\b/i);
  });

  it('9 imports only certified server contracts and local files', () => {
    const imports = [
      ...productionSource().matchAll(/from\s+['"]([^'"]+)['"]/g),
    ].map((match) => match[1]);
    expect(
      imports.every(
        (value) =>
          value.startsWith('./') ||
          value === 'node:crypto' ||
          value === '../os/boundary/types' ||
          value === '../serverComposition/types' ||
          value === '../serverComposition/validators',
      ),
    ).toBe(true);
  });

  it('10 is consumed only through the closed package subpath by certified Functions infrastructure', () => {
    const functionsRoot = path.resolve(process.cwd(), 'functions/src');
    const importers = fs
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
        /serverAuthorityPersistence|@aura\/intelligence-os/.test(source),
      );
    expect(
      importers.every(({ entry, source }) => {
        const isCertifiedAdapter = entry.startsWith(
          'infrastructure/firestore/authorityPersistence/',
        );
        const isCertifiedDarkCompositionTypes =
          entry ===
          'composition/authorityDarkComposition/authorityDarkCompositionTypes.ts';
        const isCertifiedDarkHandlerComposition = new Set([
          'composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionFactory.ts',
          'composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionTypes.ts',
        ]).has(entry);
        return (
          (isCertifiedAdapter ||
            isCertifiedDarkCompositionTypes ||
            isCertifiedDarkHandlerComposition) &&
          source.includes('@aura/intelligence-os/server') &&
          !source.includes('src/modules/intelligence')
        );
      }),
    ).toBe(true);
    expect(importers).toHaveLength(10);
  });

  it('11 does not modify or embed Firestore security rules', () => {
    expect(PRODUCTION_FILES.some((file) => file.endsWith('.rules'))).toBe(
      false,
    );
    expect(productionSource()).not.toMatch(/\ballow\s+(?:read|write)\s*:/);
  });

  it('12 exposes a neutral port and only its in-memory implementation', () => {
    const portSource = fs.readFileSync(
      path.join(MODULE_ROOT, 'ports.ts'),
      'utf8',
    );
    expect(portSource).toMatch(
      /interface\s+AuthorityMutationRepositoryPort/,
    );
    expect(portSource).toMatch(/interface\s+AuthorityClockPort/);
    expect(productionSource()).toMatch(
      /\bclass\s+InMemoryAuthorityMutationRepository\b/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:RepositoryAdapter|FirestoreAdapter|FirebaseAdapter)\b/,
    );
  });

  it('54 has zero Firebase imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"](?:firebase|firebase-admin|firebase-functions)/,
    );
  });

  it('55 has zero Firestore imports or types', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:Firestore|DocumentSnapshot|DocumentReference|Transaction)\b/,
    );
  });

  it('56 has zero Functions imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*functions[^'"]*['"]/,
    );
  });

  it('57 has no ambient time, randomness, environment, or unsafe escape', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:Date\.now|Math\.random|randomUUID|process\.env)\b/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:as any|@ts-ignore|@ts-nocheck|eslint-disable)\b/,
    );
  });

  it('58 updates the closed server export', () => {
    const entrypoint = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/intelligence/server.ts'),
      'utf8',
    );
    expect(entrypoint).toContain('planAuthorityMutationV1');
    expect(entrypoint).toContain('InMemoryAuthorityMutationRepository');
  });

  it('59 updates the runtime allowlist', () => {
    const allowlist = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'packages/aura-intelligence-os/tests/authorizedExports.ts',
      ),
      'utf8',
    );
    expect(allowlist).toContain('planAuthorityMutationV1');
    expect(allowlist).toContain('InMemoryAuthorityMutationRepository');
  });

  it('60 stays in the Node-only package compilation graph', () => {
    expect(productionSource()).toContain("from 'node:crypto'");
    expect(productionSource()).not.toMatch(
      /\b(?:window|localStorage|sessionStorage)\b/,
    );
  });

  it('61 retains structural Node 20 validation', () => {
    const workflow = fs.readFileSync(
      path.resolve(
        process.cwd(),
        '.github/workflows/intelligence-os-node20.yml',
      ),
      'utf8',
    );
    expect(workflow).toMatch(/node-version:\s*20/);
  });

  it('62 has zero Firestore adapter', () => {
    expect(PRODUCTION_FILES.map((file) => path.basename(file))).not.toContain(
      'FirestoreAuthorityMutationRepository.ts',
    );
    expect(productionSource()).not.toMatch(/\bFirestoreAdapter\b/);
  });

  it('63 has zero emulator runtime', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:emulator|FIRESTORE_EMULATOR_HOST)\b/i,
    );
  });

  it('64 has zero handlers', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:onCall|onRequest|https\.onCall|https\.onRequest)\b/,
    );
  });

  it('65 has no delivery worker or runtime I/O', () => {
    expect(productionSource()).not.toMatch(
      /\bclass\s+.*Delivery.*Worker\b|\b(?:fetch|readFile|writeFile)\s*\(/,
    );
  });

  it('66 has no global repository singleton', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:singleton|globalRepository|repositoryInstance)\b/i,
    );
  });

  it('67 uses closed collections instead of arbitrary paths', () => {
    const runtimeTypes = fs.readFileSync(
      path.join(MODULE_ROOT, 'runtimeTypes.ts'),
      'utf8',
    );
    expect(runtimeTypes).toContain('AUTHORITY_REPOSITORY_COLLECTIONS');
    expect(productionSource()).not.toMatch(
      /from\s+['"]node:path['"]|\bDocumentReference\b/,
    );
  });

  it('68 never emits the legacy generic tenant status event', () => {
    const planner = fs.readFileSync(
      path.join(MODULE_ROOT, 'planner.ts'),
      'utf8',
    );
    expect(planner).not.toContain('TENANT_STATUS_CHANGED');
  });
});
