import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const EXPECTED_EXPORTS = Object.freeze([
  'AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_V1',
  'PipelineBootstrapEvidenceFactory',
  'PipelineBootstrapExecutionComposer',
  'PipelineBootstrapper',
  'ProductionBoundaryExecutionAdapterV1',
  'SystemPipelineClockV1',
  'createAuraIntelligenceOrchestratorV1',
  'mapBootstrapAcceptedStateToCheckpointHandoff',
] as const);

describe('intelligence execution runtime export surface', () => {
  it('1 exposes exactly the certified runtime entrypoint', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
    ) as {
      exports: Record<
        string,
        {
          types: string;
          import: string;
          require: string;
        }
      >;
    };

    expect(Object.keys(manifest.exports)).toEqual(['.']);

    expect(manifest.exports['.']).toEqual({
      types: './dist/execution.d.ts',
      import: './dist/execution.js',
      require: './dist/execution.js',
    });
  });

  it('2 exposes exactly eight runtime symbols', () => {
    const runtime = require(
      path.join(PACKAGE_ROOT, 'dist', 'execution.js'),
    ) as Record<string, unknown>;

    expect(Object.keys(runtime).sort()).toEqual(
      [...EXPECTED_EXPORTS].sort(),
    );
  });

  it('3 keeps the execution entry artifacts present', () => {
    expect(
      fs.existsSync(path.join(PACKAGE_ROOT, 'dist', 'execution.js')),
    ).toBe(true);

    expect(
      fs.existsSync(path.join(PACKAGE_ROOT, 'dist', 'execution.d.ts')),
    ).toBe(true);
  });
});
