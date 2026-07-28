import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

const ORCHESTRATOR =
  'src/modules/intelligence/os/AuraIntelligenceOrchestrator.ts';
const ADMISSION =
  'src/modules/intelligence/os/checkpoint/admission.ts';

describe('AI-02C.3C architecture boundaries', () => {
  it('43. keeps PipelineContextBuilder checkpoint-independent', () => {
    expect(
      read('src/modules/intelligence/os/PipelineContextBuilder.ts')
    ).not.toMatch(/checkpoint|precomputed|admissionReference/i);
  });

  it('44. keeps Coverage implementation checkpoint-independent', () => {
    expect(
      read(
        'src/modules/intelligence/enterprise-model/coverage/services/CoverageDecisionEngine.ts'
      )
    ).not.toMatch(/checkpoint|PRECOMPUTED|admissionReference/);
  });

  it('45. keeps Planning implementation checkpoint-independent', () => {
    expect(
      read(
        'src/modules/intelligence/enterprise-model/planning/services/AdaptiveQuestionPlanner.ts'
      )
    ).not.toMatch(/checkpoint|PRECOMPUTED|admissionReference/);
  });

  it('46. keeps Reasoning implementation checkpoint-independent', () => {
    expect(
      read(
        'src/modules/intelligence/enterprise-model/reasoning/services/ExecutiveReasoningEngine.ts'
      )
    ).not.toMatch(/checkpoint|PRECOMPUTED|admissionReference/);
  });

  it('47. introduces zero bootstrap imports', () => {
    expect(`${read(ORCHESTRATOR)}\n${read(ADMISSION)}`).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*bootstrap/i
    );
  });

  it('48. introduces zero Discovery imports', () => {
    expect(`${read(ORCHESTRATOR)}\n${read(ADMISSION)}`).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*discovery/i
    );
  });

  it('49. introduces zero Firebase imports', () => {
    expect(`${read(ORCHESTRATOR)}\n${read(ADMISSION)}`).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*(?:firebase|firestore)/i
    );
  });
});
