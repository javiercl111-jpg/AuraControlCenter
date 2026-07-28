import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const checkpointProductionFiles = [
  'src/modules/intelligence/os/checkpoint/types.ts',
  'src/modules/intelligence/os/checkpoint/integrity.ts',
  'src/modules/intelligence/os/checkpoint/validators.ts',
  'src/modules/intelligence/os/checkpoint/index.ts',
] as const;

function readSources(files: readonly string[]): string {
  return files
    .map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))
    .join('\n');
}

describe('AI-02C.3B checkpoint architecture boundaries', () => {
  it('41. checkpoint production code does not import bootstrap', () => {
    expect(readSources(checkpointProductionFiles)).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*bootstrap/i
    );
  });

  it('42. checkpoint production code does not import Discovery', () => {
    expect(readSources(checkpointProductionFiles)).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*discovery/i
    );
  });

  it('43. checkpoint production code does not import Firebase or Firestore', () => {
    expect(readSources(checkpointProductionFiles)).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*(?:firebase|firestore)/i
    );
  });

  it('44. checkpoint production code does not import React', () => {
    expect(readSources(checkpointProductionFiles)).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*react/i
    );
  });

  it('45. StageStatus does not contain PRECOMPUTED', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/intelligence/os/types.ts'),
      'utf8'
    );
    const stageStatus = source.slice(
      source.indexOf('export type StageStatus'),
      source.indexOf('export const PIPELINE_STAGE_IDS')
    );

    expect(stageStatus).not.toContain('PRECOMPUTED');
  });

  it('46. TurnExtractionResult remains checkpoint-independent', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/intelligence/enterprise-model/extraction/domain/types.ts'
      ),
      'utf8'
    );
    expect(source).not.toMatch(/checkpoint|PRECOMPUTED|StageAdmission/i);
  });

  it('47. Orchestrator does not consume checkpoint contracts yet', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/intelligence/os/AuraIntelligenceOrchestrator.ts'
      ),
      'utf8'
    );
    expect(source).not.toMatch(
      /PrecomputedPipelineCheckpoint|PipelineStageAdmission|executionOrigin/
    );
  });

  it('48. PipelineContextBuilder remains checkpoint-independent', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/intelligence/os/PipelineContextBuilder.ts'
      ),
      'utf8'
    );
    expect(source).not.toMatch(
      /PrecomputedPipelineCheckpoint|PipelineStageAdmission|executionOrigin/
    );
  });
});
