import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MODULE_ROOT = path.resolve(
  process.cwd(),
  'src/modules/intelligence/serverIdentity',
);
const PRODUCTION_FILES = [
  'types.ts',
  'errors.ts',
  'helpers.ts',
  'validators.ts',
  'factories.ts',
].map((file) => path.join(MODULE_ROOT, file));

function productionSource(): string {
  return PRODUCTION_FILES.map((file) => fs.readFileSync(file, 'utf8')).join(
    '\n',
  );
}

describe('serverIdentity architecture', () => {
  it('1 remains a dedicated server-only module', () => {
    expect(PRODUCTION_FILES.every((file) => fs.existsSync(file))).toBe(true);
  });

  it('2 has no Firebase runtime imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"](?:firebase|firebase-admin|firebase-functions)/,
    );
  });

  it('3 has no Firestore, Auth, Functions, Discovery, or UI runtime imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*(?:firestore|functions|discovery|components|pages|hooks)[^'"]*['"]/i,
    );
  });

  it('4 has no persistence, network, or ambient environment access', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:fetch|XMLHttpRequest|process\.env|localStorage|sessionStorage)\b/,
    );
  });

  it('5 has no ambient clock or randomness', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:Date\.now|Math\.random|randomUUID)\s*\(/,
    );
  });

  it('6 has no unsafe TypeScript escape hatches', () => {
    expect(productionSource()).not.toMatch(
      /\b(?:as any|as unknown as|@ts-ignore|@ts-expect-error)\b/,
    );
  });

  it('7 does not import the server barrel from inside the module', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"](?:\.\.\/)+server['"]/,
    );
  });

  it('8 depends only on certified server contracts and local files', () => {
    const imports = [
      ...productionSource().matchAll(/from\s+['"]([^'"]+)['"]/g),
    ].map((match) => match[1]);
    expect(
      imports.every(
        (value) =>
          value.startsWith('./') ||
          value.startsWith('../serverComposition/') ||
          value === '../os/boundary/types',
      ),
    ).toBe(true);
  });

  it('9 is not imported directly by production Functions', () => {
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
      .filter(
        ({ entry, source }) =>
          !/^(?:infrastructure\/firestore\/(?:authorityPersistence|featurePolicy|authorityProvisioning)|composition\/authorityProvisioning)\//.test(entry) &&
          entry !==
            'composition/authorityDarkComposition/authorityDarkCompositionTypes.ts' &&
          ![
            'composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionFactory.ts',
            'composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionTypes.ts',
          ].includes(entry) &&
          /@aura\/intelligence-os|serverIdentity|modules\/intelligence/.test(
            source,
          ),
      );
    expect(violations).toEqual([]);
  });

  it('10 defines no resolver runtime class or composition root', () => {
    expect(productionSource()).not.toMatch(
      /\bclass\s+(?:.*Resolver|.*CompositionRoot)\b/,
    );
  });
});
