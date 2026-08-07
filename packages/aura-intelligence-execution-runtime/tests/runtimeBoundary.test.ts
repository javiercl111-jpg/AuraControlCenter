import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist');

function distFiles(): string[] {
  return fs
    .readdirSync(DIST_ROOT, { recursive: true })
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.replaceAll('\\', '/'))
    .sort();
}

describe('intelligence execution runtime boundary', () => {
  it('4 contains no tests in the runtime artifact', () => {
    expect(
      distFiles().some(
        (file) =>
          file.includes('/tests/') ||
          file.endsWith('.test.js') ||
          file.endsWith('.test.d.ts'),
      ),
    ).toBe(false);
  });

  it('5 contains no Firebase or Functions implementation', () => {
    const forbidden = [
      'firebase',
      'functions/src',
      'firestore',
    ];

    const source = distFiles()
      .filter((file) => file.endsWith('.js'))
      .map((file) =>
        fs.readFileSync(path.join(DIST_ROOT, file), 'utf8'),
      )
      .join('\n');

    for (const token of forbidden) {
      expect(source).not.toContain(token);
    }
  });

  it('6 keeps the existing server package outside this artifact', () => {
    expect(
      distFiles().some(
        (file) =>
          file === 'server.js' ||
          file === 'server.d.ts',
      ),
    ).toBe(false);
  });

  it('7 contains the execution graph explicitly', () => {
    const files = distFiles();

    expect(
      files.includes('os/AuraIntelligenceOrchestrator.js'),
    ).toBe(true);

    expect(
      files.includes(
        'os/bootstrap/PipelineBootstrapExecutionComposer.js',
      ),
    ).toBe(true);

    expect(
      files.includes(
        'serverComposition/ProductionBoundaryExecutionAdapterV1.js',
      ),
    ).toBe(true);
  });
});
