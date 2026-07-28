import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const productionFiles = [
  'src/modules/intelligence/os/scenarioContract.ts',
  'src/modules/intelligence/os/PipelineContextBuilder.ts',
  'src/modules/intelligence/os/AuraIntelligenceOrchestrator.ts',
  'src/modules/intelligence/os/dependencyComposition.ts',
  'src/modules/intelligence/enterprise-model/coverage/domain/types.ts',
  'src/modules/intelligence/enterprise-model/coverage/domain/validation.ts',
  'src/modules/intelligence/enterprise-model/coverage/services/CoverageCalculator.ts',
  'src/modules/intelligence/enterprise-model/coverage/services/CoverageDecisionEngine.ts',
  'src/modules/intelligence/enterprise-model/planning/services/AdaptiveQuestionPlanner.ts',
] as const;

const enterpriseModelFiles = productionFiles.filter((file) =>
  file.includes('/enterprise-model/')
);

function readSources(files: readonly string[]): string {
  return files
    .map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))
    .join('\n');
}

describe('AI-02C.2B nominal coverage architecture', () => {
  it('does not introduce Discovery imports', () => {
    const sources = readSources(productionFiles);
    expect(sources).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*discovery/i
    );
  });

  it('does not introduce Firebase or Firestore imports', () => {
    const sources = readSources(productionFiles);
    expect(sources).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*(?:firebase|firestore)/i
    );
  });

  it('keeps enterprise-model independent from OS and bootstrap contracts', () => {
    const sources = readSources(enterpriseModelFiles);
    expect(sources).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*(?:\/os\/|bootstrap|scenarioContract)/i
    );
  });
});
