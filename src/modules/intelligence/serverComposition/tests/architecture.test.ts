import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as serverExports from '../../server';
import {
  TRUSTED_CONSUMER_REGISTRY_V1,
  TRUSTED_SOURCE_REGISTRY_V1,
} from '../registry';

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

describe('AI-02H1C trusted composition architecture', () => {
  const source = moduleSource();

  it('38. keeps resolver ports neutral and free of Firebase request types', () => {
    const ports = readFileSync(resolve(moduleRoot, 'ports.ts'), 'utf8');
    const types = readFileSync(resolve(moduleRoot, 'types.ts'), 'utf8');

    expect(ports).toContain('TrustedPrincipalResolutionInputV1');
    expect(ports).toContain(
      'TrustedTenantAuthorityResolutionInputV1'
    );
    expect(types).toContain('TrustedAuthenticationReferenceV1');
    expect(types).toContain('TrustedResourceScopeV1');
    expect(ports).not.toMatch(
      /firebase|CallableRequest|Request<|DecodedIdToken|AuthData/i
    );
    expect(types).not.toMatch(
      /CallableRequest|DecodedIdToken|AuthData|authorization|headers|cookies/i
    );
  });

  it('40. exposes the minimal trusted contracts from the closed server surface', () => {
    const names = new Set(Object.keys(serverExports));

    for (const name of [
      'TRUSTED_CONSUMER_REGISTRY_V1',
      'TRUSTED_SOURCE_REGISTRY_V1',
      'TrustedCompositionContractError',
      'createTrustedServerRequestContextV1',
      'createTrustedServerExecutionResponseV1',
      'createTrustedCompositionRootDependencies',
      'resolveTrustedRegistrySelectionV1',
    ]) {
      expect(names.has(name)).toBe(true);
    }
    expect(names.has('TrustedCompositionRoot')).toBe(false);
    expect(names.has('TrustedPrincipalResolver')).toBe(false);
    expect(names.has('TrustedTenantAuthorityResolver')).toBe(false);
  });

  it('41. remains inside the strict Node-only package build boundary', () => {
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

  it('42. has zero React, browser, UI, or asset dependencies', () => {
    expect(source).not.toMatch(
      /from\s+['"](?:react|react-dom|@vitejs\/|vite)(?:\/|['"])/
    );
    expect(source).not.toMatch(
      /\b(?:window|document|localStorage|sessionStorage)\b/
    );
    expect(source).not.toMatch(
      /\.(?:css|gif|jpe?g|png|scss|svg|webp)['"]/
    );
  });

  it('43. has zero Firebase infrastructure imports', () => {
    expect(source).not.toMatch(
      /from\s+['"](?:firebase|firebase-admin|firebase-functions)(?:\/|['"])/
    );
    expect(source).not.toMatch(
      /import\s+['"](?:firebase|firebase-admin|firebase-functions)(?:\/|['"])/
    );
  });

  it('44. has zero Discovery dependencies', () => {
    expect(source).not.toMatch(
      /from\s+['"][^'"]*discovery[^'"]*['"]/i
    );
    expect(source).not.toMatch(/DiscoveryShadow|DiscoveryAdapter/);
  });

  it('45. defines contracts only and no runtime composition', () => {
    expect(source).not.toMatch(/new\s+GovernedExecutionBoundary/);
    expect(source).not.toMatch(/new\s+BootstrapBoundaryAdapter/);
    expect(source).not.toMatch(/new\s+PipelineBootstrapper/);
    expect(source).not.toMatch(/class\s+TrustedCompositionRoot/);
    expect(source).not.toMatch(
      /function\s+createTrustedCompositionRoot\s*\(/
    );
    expect(source).not.toMatch(
      /\b(?:Date\.now|Math\.random|randomUUID)\s*\(/
    );
    expect(source).not.toMatch(/new\s+Date\s*\(\s*\)/);
    expect(source).not.toMatch(/\bconsole\.log\s*\(/);
    expect(source).not.toMatch(/\bTODO\b/);
  });

  it('46. registers no productive consumer or source', () => {
    const consumers = Object.values(
      TRUSTED_CONSUMER_REGISTRY_V1.entries
    );
    const sources = Object.values(
      TRUSTED_SOURCE_REGISTRY_V1.entries
    );

    expect(consumers).toHaveLength(1);
    expect(sources).toHaveLength(1);
    expect(consumers[0]?.id).toBe('INTELLIGENCE_OS_CONTRACT_TEST');
    expect(sources[0]?.id).toBe(
      'TRUSTED_COMPOSITION_CONTRACT_TEST'
    );
    expect(consumers[0]?.allowedTransports).toEqual([
      'INTERNAL_TEST',
    ]);
    expect(sources[0]?.allowedTransports).toEqual([
      'INTERNAL_TEST',
    ]);
    expect(JSON.stringify({ consumers, sources })).not.toMatch(
      /DISCOVERY|PRODUCTIVE/
    );
  });
});
