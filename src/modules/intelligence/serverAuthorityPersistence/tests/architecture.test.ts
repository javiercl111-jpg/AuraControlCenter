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
  'validators.ts',
  'factories.ts',
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

  it('4 has no repository, resolver, migration, or handler runtime', () => {
    expect(productionSource()).not.toMatch(
      /\bclass\s+(?:.*Repository|.*Resolver|.*Migration|.*Handler)\b/,
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
          value === '../os/boundary/types' ||
          value === '../serverComposition/types',
      ),
    ).toBe(true);
  });

  it('10 is not imported by production Functions', () => {
    const functionsRoot = path.resolve(process.cwd(), 'functions/src');
    const sources = fs
      .readdirSync(functionsRoot, { recursive: true })
      .filter(
        (entry): entry is string =>
          typeof entry === 'string' && /\.(?:ts|js)$/.test(entry),
      )
      .map((entry) =>
        fs.readFileSync(path.join(functionsRoot, entry), 'utf8'),
      )
      .join('\n');
    expect(sources).not.toMatch(
      /serverAuthorityPersistence|@aura\/intelligence-os/,
    );
  });

  it('11 does not modify or embed Firestore security rules', () => {
    expect(PRODUCTION_FILES.some((file) => file.endsWith('.rules'))).toBe(
      false,
    );
    expect(productionSource()).not.toMatch(/\ballow\s+(?:read|write)\s*:/);
  });

  it('12 exposes contracts without a runtime repository port or adapter', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:RepositoryPort|RepositoryAdapter|FirestoreAdapter|FirebaseAdapter)\b/,
    );
  });
});
