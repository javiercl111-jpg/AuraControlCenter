import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as serverExports from '../../../src/modules/intelligence/server';
import { AUTHORIZED_SERVER_RUNTIME_EXPORTS } from './authorizedExports';

type PackageManifest = {
  readonly name: string;
  readonly version: string;
  readonly private: boolean;
  readonly type: string;
  readonly engines: Readonly<Record<string, string>>;
  readonly sideEffects: boolean;
  readonly main: string;
  readonly types: string;
  readonly exports: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
  readonly files: readonly string[];
};

type BuildCompilerOptions = {
  readonly target?: string;
  readonly module?: string;
  readonly moduleResolution?: string;
  readonly lib?: readonly string[];
  readonly types?: readonly string[];
  readonly strict?: boolean;
  readonly noEmitOnError?: boolean;
  readonly declaration?: boolean;
  readonly outDir?: string;
  readonly rootDir?: string;
};

type BuildConfiguration = {
  readonly compilerOptions: BuildCompilerOptions;
  readonly include: readonly string[];
};

const packageRoot = resolve(__dirname, '..');
const repositoryRoot = resolve(packageRoot, '..', '..');
const entrypointPath = resolve(
  repositoryRoot,
  'src/modules/intelligence/server.ts'
);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('Aura Intelligence OS server export surface', () => {
  it('exposes exactly the authorized runtime allowlist', () => {
    expect(Object.keys(serverExports).sort()).toEqual(
      [...AUTHORIZED_SERVER_RUNTIME_EXPORTS].sort()
    );
  });

  it('does not re-export the general OS index or use wildcard exports', () => {
    const source = readFileSync(entrypointPath, 'utf8');

    expect(source).not.toMatch(/export\s+\*\s+from/);
    expect(source).not.toMatch(/(?:\/|')index(?:'|")/);
  });

  it('does not expose excluded runtime components', () => {
    const publicNames = new Set(Object.keys(serverExports));

    expect(publicNames.has('AuraIntelligenceOrchestrator')).toBe(false);
    expect(publicNames.has('PipelineContextBuilder')).toBe(false);
    expect(publicNames.has('PipelineBootstrapCheckpointMapper')).toBe(false);
    expect(publicNames.has('ShadowExecutionGuard')).toBe(false);
    expect(publicNames.has('ShadowComparator')).toBe(false);
  });

  it('defines a private CommonJS package with one closed subpath', () => {
    const manifest = readJson<PackageManifest>(
      resolve(packageRoot, 'package.json')
    );

    expect(manifest.name).toBe('@aura/intelligence-os');
    expect(manifest.version).toBe('0.0.0-internal');
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe('commonjs');
    expect(manifest.engines).toEqual({ node: '20' });
    expect(manifest.sideEffects).toBe(false);
    expect(manifest.main).toBe('./dist/server.js');
    expect(manifest.types).toBe('./dist/server.d.ts');
    expect(Object.keys(manifest.exports)).toEqual(['./server']);
    expect(manifest.exports['./server']).toEqual({
      types: './dist/server.d.ts',
      import: './dist/server.js',
      require: './dist/server.js',
    });
    expect(manifest.files).toEqual(['dist', 'README.md']);
  });

  it('uses a strict Node-only compiler configuration', () => {
    const configuration = readJson<BuildConfiguration>(
      resolve(packageRoot, 'tsconfig.build.json')
    );
    const options = configuration.compilerOptions;

    expect(options.target).toBe('ES2022');
    expect(options.module).toBe('Node16');
    expect(options.moduleResolution).toBe('Node16');
    expect(options.lib).toEqual(['ES2022']);
    expect(options.types).toEqual(['node']);
    expect(options.strict).toBe(true);
    expect(options.noEmitOnError).toBe(true);
    expect(options.declaration).toBe(true);
    expect(options.outDir).toBe('./dist');
    expect(options.rootDir).toBe('../../src/modules/intelligence');
    expect(configuration.include).toEqual([
      '../../src/modules/intelligence/server.ts',
    ]);
  });

  it('marks generated output as ignored without ignoring package sources', () => {
    const gitignore = readFileSync(
      resolve(packageRoot, '.gitignore'),
      'utf8'
    );

    expect(gitignore.trim()).toBe('dist/');
  });
});
