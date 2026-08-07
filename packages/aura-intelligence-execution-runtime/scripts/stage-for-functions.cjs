const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');

const sourceDist = path.join(packageRoot, 'dist');
const sourcePackage = path.join(packageRoot, 'package.json');

const targetRoot = path.join(
  repoRoot,
  'functions',
  '.generated',
  'aura-intelligence-execution-runtime',
);

const targetDist = path.join(targetRoot, 'dist');
const targetPackage = path.join(targetRoot, 'package.json');

if (!fs.existsSync(sourceDist)) {
  throw new Error(
    'Execution runtime dist is missing. Build the package before staging.',
  );
}

const manifest = JSON.parse(
  fs.readFileSync(sourcePackage, 'utf8'),
);

const expectedExport = {
  types: './dist/execution.d.ts',
  import: './dist/execution.js',
  require: './dist/execution.js',
};

if (
  JSON.stringify(manifest.exports?.['.']) !==
  JSON.stringify(expectedExport)
) {
  throw new Error(
    'Execution runtime package export contract does not match the certified surface.',
  );
}

fs.rmSync(targetRoot, {
  recursive: true,
  force: true,
});

fs.mkdirSync(targetRoot, {
  recursive: true,
});

fs.cpSync(sourceDist, targetDist, {
  recursive: true,
});

const stagedManifest = {
  name: manifest.name,
  version: manifest.version,
  private: true,
  type: manifest.type,
  main: manifest.main,
  types: manifest.types,
  exports: manifest.exports,
};

fs.writeFileSync(
  targetPackage,
  `${JSON.stringify(stagedManifest, null, 2)}\n`,
  'utf8',
);

for (const required of [
  'execution.js',
  'execution.d.ts',
]) {
  const candidate = path.join(targetDist, required);

  if (!fs.existsSync(candidate)) {
    throw new Error(
      `Missing staged execution runtime artifact: ${required}`,
    );
  }
}

console.log(
  'Aura Intelligence Execution Runtime staged for Functions.',
);
