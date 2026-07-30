import {
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as serverExports from '../../server';
import {
  TRUSTED_CONSUMER_REGISTRY_V1,
  TRUSTED_SOURCE_REGISTRY_V1,
} from '../../server';

const testsRoot = resolve(__dirname);
const moduleRoot = resolve(testsRoot, '..');
const intelligenceRoot = resolve(moduleRoot, '..');
const repositoryRoot = resolve(
  intelligenceRoot,
  '..',
  '..',
  '..'
);
const fixturePath = resolve(testsRoot, 'fixtures.ts');
const fixtureSource = readFileSync(fixturePath, 'utf8');
const productionFunctionsRoot = resolve(
  repositoryRoot,
  'functions',
  'src'
);

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory).sort()) {
    const path = resolve(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (stats.isFile() && path.endsWith('.ts')) {
      files.push(path);
    }
  }
  return files;
}

describe('AI-02H1D.4 integration architecture', () => {
  it('54. keeps the integration harness under tests only', () => {
    expect(relative(moduleRoot, fixturePath).replaceAll('\\', '/')).toBe(
      'tests/fixtures.ts'
    );
    expect(Object.keys(serverExports)).not.toContain(
      'createBoundaryIntegrationFixture'
    );
  });

  it('55. consumes only the closed server entrypoint', () => {
    const imports = [
      ...fixtureSource.matchAll(/from\s+['"]([^'"]+)['"]/g),
    ].map((match) => match[1]);

    expect(imports).toEqual(['../../server', '../../server']);
    expect(fixtureSource).not.toMatch(
      /from\s+['"][^'"]*(?:\/os\/|serverPolicy\/|serverComposition\/)[^'"]*['"]/
    );
  });

  it('56. introduces no Firebase, Discovery, Functions, React, or UI dependency', () => {
    expect(fixtureSource).not.toMatch(
      /firebase|firestore|discovery|functions(?:\/|['"])|react|\/ui\//i
    );
  });

  it('57. introduces no network, filesystem, timer, or environment authority', () => {
    expect(fixtureSource).not.toMatch(
      /from\s+['"](?:node:)?(?:fs|http|https|net|tls|dns)|fetch\s*\(|XMLHttpRequest|WebSocket/
    );
    expect(fixtureSource).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|queueMicrotask\s*\(/
    );
    expect(fixtureSource).not.toMatch(
      /process\.env|import\.meta\.env|Deno\.env/
    );
  });

  it('58. uses no ambient time or random identifier authority', () => {
    expect(fixtureSource).not.toMatch(
      /Date\.now\s*\(|new\s+Date\s*\(\s*\)|Math\.random\s*\(|randomUUID\s*\(/
    );
    expect(fixtureSource).toContain(
      'DeterministicBoundaryClock'
    );
  });

  it('59. retains only the contract-test registry entries', () => {
    expect(
      Object.keys(TRUSTED_CONSUMER_REGISTRY_V1.entries)
    ).toEqual(['INTELLIGENCE_OS_CONTRACT_TEST']);
    expect(
      Object.keys(TRUSTED_SOURCE_REGISTRY_V1.entries)
    ).toEqual(['TRUSTED_COMPOSITION_CONTRACT_TEST']);
    expect(
      JSON.stringify({
        consumers: TRUSTED_CONSUMER_REGISTRY_V1,
        sources: TRUSTED_SOURCE_REGISTRY_V1,
      })
    ).not.toMatch(/PRODUCTIVE|DISCOVERY|FIREBASE_CALLABLE/);
  });

  it('60. adds no productive Functions consumer', () => {
    const violations = sourceFiles(productionFunctionsRoot)
      .map((path) => ({
        path,
        source: readFileSync(path, 'utf8'),
      }))
      .filter(
        ({ path, source }) =>
          ![
            'composition/authorityDarkComposition/authorityDarkCompositionTypes.ts',
          ].includes(
            relative(productionFunctionsRoot, path).replaceAll(
              '\\',
              '/'
            )
          ) &&
          !relative(productionFunctionsRoot, path)
            .replaceAll('\\', '/')
            .startsWith(
              'infrastructure/firestore/authorityPersistence/'
            ) &&
          /@aura\/intelligence-os|src\/modules\/intelligence/.test(
            source
          )
      )
      .map(({ path }) =>
        relative(productionFunctionsRoot, path).replaceAll(
          '\\',
          '/'
        )
      );

    expect(violations).toEqual([]);
  });

  it('61. creates no production composition root', () => {
    const productionFiles = sourceFiles(intelligenceRoot).filter(
      (path) =>
        !relative(intelligenceRoot, path)
          .split(/[\\/]/)
          .includes('tests')
    );
    const productionSource = productionFiles
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(productionSource).not.toMatch(
      /class\s+BoundaryIntegrationCompositionRoot/
    );
    expect(productionSource).not.toMatch(
      /function\s+createBoundaryIntegrationFixture\s*\(/
    );
  });

  it('62. keeps the integration fixture free of audit and persistence adapters', () => {
    expect(fixtureSource).not.toMatch(
      /auditPort|logEvent|repository|database|persist|writeFile|readFile/i
    );
  });
});
