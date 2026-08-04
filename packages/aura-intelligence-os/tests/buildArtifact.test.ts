import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AUTHORIZED_SERVER_RUNTIME_EXPORTS } from './authorizedExports';

type ServerRuntimeExports = Readonly<Record<string, unknown>>;

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = resolve(packageRoot, '..', '..');
const distRoot = resolve(packageRoot, 'dist');

function listFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const absolutePath = resolve(directory, entry);
    if (statSync(absolutePath).isDirectory()) {
      files.push(...listFiles(absolutePath));
    } else {
      files.push(relative(distRoot, absolutePath).replaceAll('\\', '/'));
    }
  }

  return files.sort();
}

function fingerprintDist(): string {
  const hash = createHash('sha256');

  for (const file of listFiles(distRoot)) {
    hash.update(file);
    hash.update('\0');
    hash.update(readFileSync(resolve(distRoot, file)));
    hash.update('\0');
  }

  return hash.digest('hex');
}

function buildPackage(): void {
  const cleanResult = spawnSync(
    process.execPath,
    [resolve(packageRoot, 'scripts/clean.cjs')],
    {
      cwd: packageRoot,
      encoding: 'utf8',
    }
  );
  expect(
    cleanResult.status,
    `${cleanResult.stdout}\n${cleanResult.stderr}`
  ).toBe(0);

  const buildResult = spawnSync(
    process.execPath,
    [
      resolve(repositoryRoot, 'node_modules/typescript/bin/tsc'),
      '-p',
      resolve(packageRoot, 'tsconfig.build.json'),
    ],
    {
      cwd: packageRoot,
      encoding: 'utf8',
    }
  );

  expect(
    buildResult.status,
    `${buildResult.stdout}\n${buildResult.stderr}`
  ).toBe(0);
}

describe('Aura Intelligence OS CommonJS build artifact', () => {
  it('contains only authorized JavaScript and declaration outputs', () => {
    expect(existsSync(resolve(distRoot, 'server.js'))).toBe(true);
    expect(existsSync(resolve(distRoot, 'server.d.ts'))).toBe(true);

    const inventory = listFiles(distRoot);
    expect(inventory.length).toBeGreaterThan(2);
    expect(
      inventory.every((file) => file.endsWith('.js') || file.endsWith('.d.ts'))
    ).toBe(true);
    expect(inventory.join('\n')).not.toMatch(
      /(?:^|\/)(?:tests?|__tests__|components?|pages?|ui)(?:\/|$)/i
    );
    expect(inventory.join('\n')).not.toMatch(
      /\.(?:css|gif|jpeg|jpg|json|less|png|sass|scss|svg|webp)$/
    );
    expect(inventory).not.toContain('package-lock.json');
  });

  it('emits CommonJS and can be required with the exact export allowlist', () => {
    const serverOutput = readFileSync(
      resolve(distRoot, 'server.js'),
      'utf8'
    );
    expect(serverOutput.startsWith('"use strict";')).toBe(true);
    expect(serverOutput).toContain('require(');
    expect(serverOutput).not.toMatch(/^\s*import\s/m);

    const requireFromTest = createRequire(import.meta.url);
    const exports = requireFromTest(
      resolve(distRoot, 'server.js')
    ) as ServerRuntimeExports;

    expect(Object.keys(exports).sort()).toEqual(
      [...AUTHORIZED_SERVER_RUNTIME_EXPORTS].sort()
    );
    expect(typeof exports.GovernedExecutionBoundary).toBe('function');
    expect(typeof exports.BootstrapBoundaryAdapter).toBe('function');
    expect(typeof exports.PipelineBootstrapper).toBe('function');
    expect(typeof exports.PipelineBootstrapEvidenceFactory).toBe('function');
  });

  it('includes the required enterprise-model runtime and nothing from frontend domains', () => {
    const inventory = listFiles(distRoot);

    expect(inventory).toContain(
      'enterprise-model/extraction/domain/utils.js'
    );
    expect(inventory).toContain(
      'enterprise-model/graph/domain/identity.js'
    );
    expect(inventory).toContain(
      'enterprise-model/seeds/industrySeeder.js'
    );
    expect(inventory.join('\n')).not.toMatch(/(?:^|\/)(?:core|engine)\//);
    expect(inventory.join('\n')).not.toMatch(/discovery/i);
  });

  it('rebuilds to the same inventory and content fingerprint', () => {
    const firstInventory = listFiles(distRoot);
    const firstFingerprint = fingerprintDist();

    buildPackage();

    expect(listFiles(distRoot)).toEqual(firstInventory);
    expect(fingerprintDist()).toBe(firstFingerprint);
  }, 15_000);
});
