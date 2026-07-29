import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as serverExports from '../../server';
import {
  AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1,
} from '../table';

const moduleRoot = resolve(__dirname, '..');
const repositoryRoot = resolve(moduleRoot, '..', '..', '..', '..');
const packageRoot = resolve(
  repositoryRoot,
  'packages/aura-intelligence-os'
);

function productionFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory).sort()) {
    const absolutePath = resolve(directory, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      if (entry !== 'tests') {
        files.push(...productionFiles(absolutePath));
      }
    } else if (stats.isFile() && entry.endsWith('.ts')) {
      files.push(absolutePath);
    }
  }
  return files;
}

function moduleSource(): string {
  return productionFiles(moduleRoot)
    .map(
      (file) =>
        `// ${relative(moduleRoot, file)}\n${readFileSync(file, 'utf8')}`
    )
    .join('\n');
}

describe('AI-02H1D.2 server policy architecture', () => {
  const source = moduleSource();

  it('44. contains no wildcard or productive policy entry', () => {
    const serialized = JSON.stringify(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );

    expect(serialized).not.toContain('*');
    expect(serialized).not.toMatch(
      /PRODUCTIVE|EVALUATION|DISABLED/
    );
    expect(serialized).toContain('CONTRACT_TEST');
  });

  it('45. contains no Discovery dependency or registration', () => {
    expect(source).not.toMatch(
      /from\s+['"][^'"]*discovery[^'"]*['"]/i
    );
    expect(
      JSON.stringify(AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1)
    ).not.toMatch(/discovery|evaluateConversation/i);
  });

  it('46. contains no Firebase, React, UI, persistence, or network dependency', () => {
    expect(source).not.toMatch(
      /from\s+['"](?:firebase|firebase-admin|firebase-functions|react|react-dom)(?:\/|['"])/
    );
    expect(source).not.toMatch(
      /\b(?:fetch|XMLHttpRequest|localStorage|indexedDB)\b/
    );
    expect(source).not.toMatch(
      /from\s+['"](?:node:)?(?:fs|http|https|net|tls)['"]/
    );
  });

  it('47. contains no environment authority or nondeterministic generation', () => {
    expect(source).not.toMatch(
      /process\.env|import\.meta\.env|Date\.now\s*\(|new\s+Date\s*\(\s*\)|Math\.random\s*\(|randomUUID\s*\(/
    );
  });

  it('48. contains no Boundary execution integration', () => {
    expect(source).not.toMatch(/new\s+GovernedExecutionBoundary/);
    expect(source).not.toMatch(/BoundaryExecutionPort/);
  });

  it('49. exposes only snapshot contracts through the closed server surface', () => {
    const names = new Set(Object.keys(serverExports));

    for (const name of [
      'AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION',
      'AUTHORITATIVE_POLICY_ENTRY_VERSION',
      'AUTHORITATIVE_POLICY_PRODUCER_VERSION',
      'AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1',
      'AuthoritativePolicySnapshotContractError',
      'createAuthoritativePolicyLookupKeyV1',
      'createAuthoritativePolicySnapshotV1',
      'validateAuthoritativePolicyEntryV1',
      'validateAuthoritativePolicySnapshotV1',
      'InMemoryAuthoritativeFeaturePolicyProducer',
    ]) {
      expect(names.has(name)).toBe(true);
    }
  });

  it('50. remains in the strict Node-only package compile graph', () => {
    const configuration = JSON.parse(
      readFileSync(
        resolve(packageRoot, 'tsconfig.build.json'),
        'utf8'
      )
    ) as {
      readonly compilerOptions: Readonly<Record<string, unknown>>;
      readonly include: readonly string[];
    };

    expect(configuration.compilerOptions.lib).toEqual(['ES2022']);
    expect(configuration.compilerOptions.types).toEqual(['node']);
    expect(configuration.compilerOptions.strict).toBe(true);
    expect(configuration.include).toEqual([
      '../../src/modules/intelligence/server.ts',
    ]);
  });

  it('51. preserves the reproducible private distribution contract', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(packageRoot, 'package.json'), 'utf8')
    ) as {
      readonly private: boolean;
      readonly sideEffects: boolean;
      readonly scripts: Readonly<Record<string, string>>;
      readonly exports: Readonly<Record<string, unknown>>;
    };

    expect(manifest.private).toBe(true);
    expect(manifest.sideEffects).toBe(false);
    expect(Object.keys(manifest.exports)).toEqual(['./server']);
    expect(manifest.scripts['stage:functions']).toBe(
      'node ./scripts/stage-for-functions.cjs'
    );
  });

  it('52. preserves the Node 20 structural validation boundary', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(packageRoot, 'package.json'), 'utf8')
    ) as {
      readonly engines: Readonly<Record<string, string>>;
    };
    const validationTest = readFileSync(
      resolve(packageRoot, 'tests/node20Validation.test.ts'),
      'utf8'
    );

    expect(manifest.engines).toEqual({ node: '20' });
    expect(validationTest).toContain('Node 20 validation contract');
  });
});
