import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type PackageManifest = {
  readonly scripts: Readonly<Record<string, string>>;
  readonly engines?: Readonly<Record<string, string>>;
};

const packageRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const repositoryRoot = resolve(packageRoot, '..', '..');
const functionsRoot = resolve(repositoryRoot, 'functions');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('Aura Intelligence OS Node 20 validation contract', () => {
  it('uses a dedicated official-actions workflow with an exact Node 20 gate', () => {
    const workflow = readFileSync(
      resolve(
        repositoryRoot,
        '.github/workflows/intelligence-os-node20.yml'
      ),
      'utf8'
    ).replace(/\r\n/g, '\n');
    const cleanCheckoutIndex = workflow.indexOf('Verify clean checkout');
    const rootInstallIndex = workflow.indexOf('npm ci\n');
    const stagingIndex = workflow.indexOf(
      'npm run stage:intelligence-os:functions'
    );
    const functionsInstallIndex = workflow.indexOf(
      'npm ci --prefix functions'
    );
    const validationIndex = workflow.indexOf(
      'npm run validate:intelligence-os:node20'
    );

    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('push:');
    expect(workflow).toContain('- main');
    expect(workflow).toContain('runs-on: ubuntu-latest');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain('uses: actions/checkout@v4');
    expect(workflow).toContain('uses: actions/setup-node@v4');
    expect(workflow).toContain('node-version: 20');
    expect(workflow).toContain('cache: npm');
    expect(workflow).toContain('package-lock.json');
    expect(workflow).toContain('functions/package-lock.json');
    expect(cleanCheckoutIndex).toBeGreaterThan(-1);
    expect(rootInstallIndex).toBeGreaterThan(cleanCheckoutIndex);
    expect(stagingIndex).toBeGreaterThan(rootInstallIndex);
    expect(functionsInstallIndex).toBeGreaterThan(stagingIndex);
    expect(validationIndex).toBeGreaterThan(functionsInstallIndex);
    expect(workflow).not.toMatch(
      /firebase\s+(?:deploy|emulators)|secrets\.|credentials/i
    );
  });

  it('pins both runtime manifests and the executable assertion to Node 20', () => {
    const rootManifest = readJson<PackageManifest>(
      resolve(repositoryRoot, 'package.json')
    );
    const functionsManifest = readJson<PackageManifest>(
      resolve(functionsRoot, 'package.json')
    );
    const packageManifest = readJson<PackageManifest>(
      resolve(packageRoot, 'package.json')
    );
    const assertion = readFileSync(
      resolve(repositoryRoot, 'scripts/assert-node20.cjs'),
      'utf8'
    );

    expect(rootManifest.scripts['assert:node20']).toBe(
      'node scripts/assert-node20.cjs'
    );
    expect(functionsManifest.engines).toEqual({ node: '20' });
    expect(packageManifest.engines).toEqual({ node: '20' });
    expect(assertion).toContain('process.version.startsWith');
    expect(assertion).toContain('"v20."');
  });

  it('keeps executable consumption outside production Functions source', () => {
    const rootManifest = readJson<PackageManifest>(
      resolve(repositoryRoot, 'package.json')
    );
    const functionsManifest = readJson<PackageManifest>(
      resolve(functionsRoot, 'package.json')
    );
    const consumptionTest = readFileSync(
      resolve(functionsRoot, 'tests/intelligenceOsConsumption.cjs'),
      'utf8'
    );

    expect(
      functionsManifest.scripts['test:intelligence-os-consumption']
    ).toBe('node tests/intelligenceOsConsumption.cjs');
    expect(rootManifest.scripts['test:intelligence-os:consumption']).toBe(
      'npm run test:intelligence-os-consumption --prefix functions'
    );
    expect(
      rootManifest.scripts['validate:intelligence-os:node20']
    ).toContain('npm run test:intelligence-os:integration');
    expect(consumptionTest).toContain(
      'require("@aura/intelligence-os/server")'
    );
    expect(consumptionTest).toContain('assertNoProductionConsumer');
    expect(consumptionTest).toContain(
      'new runtime.GovernedExecutionBoundary'
    );
    expect(consumptionTest).toContain(
      'new runtime.BootstrapBoundaryAdapter'
    );
    expect(consumptionTest).toContain(
      'new runtime.PipelineBootstrapper'
    );
  });
});
