import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type JsonRecord = Readonly<Record<string, unknown>>;

type StagedManifest = {
  readonly name: string;
  readonly version: string;
  readonly private: boolean;
  readonly type: string;
  readonly engines: Readonly<Record<string, string>>;
  readonly sideEffects: boolean;
  readonly main: string;
  readonly types: string;
  readonly exports: JsonRecord;
  readonly files: readonly string[];
  readonly scripts?: JsonRecord;
  readonly dependencies?: JsonRecord;
  readonly devDependencies?: JsonRecord;
  readonly auraDistribution: {
    readonly schemaVersion: string;
    readonly distFileCount: number;
    readonly distSha256: string;
  };
};

type FunctionsManifest = {
  readonly scripts: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
};

type FunctionsLockfile = {
  readonly lockfileVersion: number;
  readonly packages: Readonly<
    Record<
      string,
      {
        readonly name?: string;
        readonly version?: string;
        readonly resolved?: string;
        readonly link?: boolean;
        readonly dependencies?: Readonly<Record<string, string>>;
      }
    >
  >;
};

type FirebaseConfiguration = {
  readonly functions: {
    readonly source: string;
    readonly runtime: string;
    readonly ignore: readonly string[];
    readonly predeploy: readonly string[];
  };
};

function compareLexically(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const packageRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const repositoryRoot = resolve(packageRoot, '..', '..');
const functionsRoot = resolve(repositoryRoot, 'functions');
const distRoot = resolve(packageRoot, 'dist');
const stagingParent = resolve(functionsRoot, '.generated');
const stagingRoot = resolve(stagingParent, 'aura-intelligence-os');
const stagedDistRoot = resolve(stagingRoot, 'dist');
const verifierPath = resolve(
  functionsRoot,
  'scripts/verifyIntelligenceOsDistribution.cjs'
);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function listFilesFrom(base: string, current: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(current)) {
    const absolutePath = resolve(current, entry);
    const stats = lstatSync(absolutePath);

    if (stats.isSymbolicLink()) {
      throw new Error(`Unexpected symlink in generated artifact: ${absolutePath}`);
    }

    if (stats.isDirectory()) {
      files.push(...listFilesFrom(base, absolutePath));
    } else {
      files.push(relative(base, absolutePath).replaceAll('\\', '/'));
    }
  }

  return files.sort(compareLexically);
}

function fingerprint(root: string, inventory: readonly string[]): string {
  const hash = createHash('sha256');

  for (const file of inventory) {
    hash.update(file);
    hash.update('\0');
    hash.update(readFileSync(resolve(root, file)));
    hash.update('\0');
  }

  return hash.digest('hex');
}

function runNodeScript(path: string) {
  return spawnSync(process.execPath, [path], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

function runCanonicalStaging() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error('npm_execpath is required for the distribution test');
  }

  return spawnSync(
    process.execPath,
    [npmCli, 'run', 'stage:intelligence-os:functions'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }
  );
}

function removeGeneratedDirectory(path: string, authorizedParent: string): void {
  if (resolve(dirname(path)) !== resolve(authorizedParent)) {
    throw new Error(`Refusing to remove unsafe generated path: ${path}`);
  }

  if (existsSync(path)) {
    const stats = lstatSync(path);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`Generated path is not a real directory: ${path}`);
    }
  }

  rmSync(path, { recursive: true, force: true });
}

describe('Aura Intelligence OS reproducible Functions distribution', () => {
  it('stages only the reduced package contract and canonical dist', () => {
    const manifest = readJson<StagedManifest>(
      resolve(stagingRoot, 'package.json')
    );
    const stagingInventory = listFilesFrom(stagingRoot, stagingRoot);
    const distInventory = listFilesFrom(stagedDistRoot, stagedDistRoot);

    expect(manifest.name).toBe('@aura/intelligence-os');
    expect(manifest.version).toBe('0.0.0-internal');
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe('commonjs');
    expect(manifest.engines).toEqual({ node: '20' });
    expect(manifest.sideEffects).toBe(false);
    expect(manifest.main).toBe('./dist/server.js');
    expect(manifest.types).toBe('./dist/server.d.ts');
    expect(Object.keys(manifest.exports)).toEqual(['./server']);
    expect(manifest.files).toEqual(['dist', 'README.md']);
    expect(manifest.scripts).toBeUndefined();
    expect(manifest.dependencies).toBeUndefined();
    expect(manifest.devDependencies).toBeUndefined();
    expect(manifest.auraDistribution.schemaVersion).toBe('1');
    expect(manifest.auraDistribution.distFileCount).toBe(distInventory.length);
    expect(manifest.auraDistribution.distSha256).toBe(
      fingerprint(stagedDistRoot, distInventory)
    );

    expect(stagingInventory).toContain('README.md');
    expect(stagingInventory).toContain('package.json');
    expect(stagingInventory).not.toContain('package-lock.json');
    expect(stagingInventory.join('\n')).not.toMatch(
      /(?:^|\/)(?:tests?|scripts|node_modules)(?:\/|$)/
    );
    expect(stagingInventory.join('\n')).not.toMatch(
      /(?:^|\/)(?:tsconfig[^/]*|\.gitignore)$/
    );
    expect(
      stagingInventory.every(
        (file) =>
          file === 'README.md' ||
          file === 'package.json' ||
          file.startsWith('dist/')
      )
    ).toBe(true);
  });

  it('pins the local dependency and lockfile to the staged directory', () => {
    const manifest = readJson<FunctionsManifest>(
      resolve(functionsRoot, 'package.json')
    );
    const lockfile = readJson<FunctionsLockfile>(
      resolve(functionsRoot, 'package-lock.json')
    );

    expect(manifest.dependencies['@aura/intelligence-os']).toBe(
      'file:.generated/aura-intelligence-os'
    );
    expect(lockfile.lockfileVersion).toBe(3);
    expect(
      lockfile.packages[''].dependencies?.['@aura/intelligence-os']
    ).toBe('file:.generated/aura-intelligence-os');
    expect(lockfile.packages['.generated/aura-intelligence-os']).toMatchObject({
      name: '@aura/intelligence-os',
      version: '0.0.0-internal',
    });
    expect(lockfile.packages['node_modules/@aura/intelligence-os']).toEqual({
      resolved: '.generated/aura-intelligence-os',
      link: true,
    });
  });

  it('stages before verified Functions build and remains included by Firebase', () => {
    const manifest = readJson<FunctionsManifest>(
      resolve(functionsRoot, 'package.json')
    );
    const firebase = readJson<FirebaseConfiguration>(
      resolve(repositoryRoot, 'firebase.json')
    );
    const functionsGitignore = readFileSync(
      resolve(functionsRoot, '.gitignore'),
      'utf8'
    );

    expect(manifest.scripts.prebuild).toBe(
      'npm run prepare:intelligence-os-distribution && npm run verify:intelligence-os-distribution'
    );
    expect(manifest.scripts['prepare:intelligence-os-distribution']).toBe(
      'npm --prefix .. run stage:intelligence-os:functions'
    );
    expect(manifest.scripts['verify:intelligence-os-distribution']).toBe(
      'node scripts/verifyIntelligenceOsDistribution.cjs'
    );
    expect(firebase.functions.source).toBe('functions');
    expect(firebase.functions.runtime).toBe('nodejs20');
    expect(firebase.functions.predeploy).toEqual([
      'npm --prefix "$PROJECT_DIR" run stage:intelligence-os:functions',
      'npm --prefix "$RESOURCE_DIR" run build',
    ]);
    expect(firebase.functions.ignore).toEqual([
      '.git',
      '.runtimeconfig.json',
      'firebase-debug.log',
      'firebase-debug.*.log',
      'node_modules',
    ]);
    expect(firebase.functions.ignore).not.toContain('**/.*');
    expect(functionsGitignore.trim()).toBe('.generated/');
  });

  it('allows only certified Functions infrastructure to import the server package', () => {
    const sourceRoot = resolve(functionsRoot, 'src');
    const sourceFiles = listFilesFrom(sourceRoot, sourceRoot).filter((file) =>
      file.endsWith('.ts')
    );
    const importers = sourceFiles.filter((file) =>
      readFileSync(resolve(sourceRoot, file), 'utf8').includes(
        '@aura/intelligence-os'
      )
    );

    expect(importers).toEqual([
      'composition/authorityDarkComposition/authorityDarkCompositionTypes.ts',
      'composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionFactory.ts',
      'composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionTypes.ts',
      'composition/authorityProvisioning/previewAuthorityProvisioningComposition.ts',
      'infrastructure/firestore/authorityPersistence/FirestoreAuthorityMutationRepository.ts',
      'infrastructure/firestore/authorityPersistence/firestoreAuthorityCollections.ts',
      'infrastructure/firestore/authorityPersistence/firestoreAuthorityErrors.ts',
      'infrastructure/firestore/authorityPersistence/firestoreAuthorityExpectedReads.ts',
      'infrastructure/firestore/authorityPersistence/firestoreAuthorityReadSet.ts',
      'infrastructure/firestore/authorityPersistence/firestoreAuthoritySnapshot.ts',
      'infrastructure/firestore/authorityPersistence/firestoreAuthorityWritePlan.ts',
      'infrastructure/firestore/authorityProvisioning/FirestoreAuthorityProvisioningAdapter.ts',
    ]);
    importers.forEach((file) => {
      const source = readFileSync(resolve(sourceRoot, file), 'utf8');
      expect(source).not.toContain(
        'from \'@aura/intelligence-os\''
      );
      expect(source).not.toContain(
        'from "@aura/intelligence-os"'
      );
      expect(source).toContain('@aura/intelligence-os/server');
    });
  });

  it('fails closed when the staged manifest is tampered', () => {
    const manifestPath = resolve(stagingRoot, 'package.json');
    const originalManifest = readFileSync(manifestPath, 'utf8');
    const tamperedManifest = {
      ...JSON.parse(originalManifest),
      scripts: {
        forbidden: 'node forbidden.cjs',
      },
    };

    try {
      writeFileSync(
        manifestPath,
        `${JSON.stringify(tamperedManifest, null, 2)}\n`,
        'utf8'
      );
      const rejected = runNodeScript(verifierPath);
      expect(rejected.status).not.toBe(0);
    } finally {
      writeFileSync(manifestPath, originalManifest, 'utf8');
    }

    const accepted = runNodeScript(verifierPath);
    expect(accepted.status, `${accepted.stdout}\n${accepted.stderr}`).toBe(0);
  });

  it('fails closed when staging contains a file outside the allowlist', () => {
    const unauthorizedPath = resolve(stagingRoot, 'unauthorized.js');

    try {
      writeFileSync(unauthorizedPath, '"use strict";\n', 'utf8');
      const rejected = runNodeScript(verifierPath);
      expect(rejected.status).not.toBe(0);
    } finally {
      rmSync(unauthorizedPath, { force: true });
    }

    const accepted = runNodeScript(verifierPath);
    expect(accepted.status, `${accepted.stdout}\n${accepted.stderr}`).toBe(0);
  });

  it(
    'reconstructs identical staging after generated outputs are removed',
    () => {
      const firstInventory = listFilesFrom(stagingRoot, stagingRoot);
      const firstFingerprint = fingerprint(stagingRoot, firstInventory);

      removeGeneratedDirectory(distRoot, packageRoot);
      removeGeneratedDirectory(stagingRoot, stagingParent);

      const result = runCanonicalStaging();
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

      const rebuiltInventory = listFilesFrom(stagingRoot, stagingRoot);
      expect(rebuiltInventory).toEqual(firstInventory);
      expect(fingerprint(stagingRoot, rebuiltInventory)).toBe(
        firstFingerprint
      );
    },
    15_000
  );
});
