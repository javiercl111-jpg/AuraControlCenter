import { describe, it, expect } from 'vitest';
import { NarrativeBuilder } from '../services/NarrativeBuilder';
import type { BusinessDiagnosis, StrategicPriority } from '../domain/types';

describe('NarrativeBuilder', () => {
  const builder = new NarrativeBuilder();

  const createDiagnosis = (): BusinessDiagnosis => ({
    overallMaturity: 'MANAGED',
    dimensionAssessments: [
      { dimension: 'HR', level: 'MANAGED', score: 0.5, evidenceRefs: [], justification: '' },
      { dimension: 'TECH', level: 'OPTIMIZING', score: 0.9, evidenceRefs: [], justification: '' }
    ],
    strengths: [
      { id: 's1', dimension: 'TECH', description: '', impact: 'HIGH', supportingFindings: [] }
    ],
    weaknesses: [
      { id: 'w1', dimension: 'HR', description: '', severity: 'CRITICAL', relatedRisks: [], rootCauses: [] }
    ]
  });

  const createPriorities = (): StrategicPriority[] => [
    {
      id: 'p1',
      rank: 1,
      title: 'Fix HR',
      description: '',
      dimension: 'HR',
      addressedWeaknesses: ['w1'],
      leveragedStrengths: [],
      urgency: 'IMMEDIATE'
    }
  ];

  it('should generate a fallback narrative when INSUFFICIENT_EVIDENCE', () => {
    const narrative = builder.generateNarrative({
      diagnosis: createDiagnosis(),
      priorities: createPriorities(),
      status: 'INSUFFICIENT_EVIDENCE'
    });

    expect(narrative.executiveSummary).toContain('insufficient defendable evidence');
  });

  it('should generate a comprehensive narrative based on inputs', () => {
    const narrative = builder.generateNarrative({
      diagnosis: createDiagnosis(),
      priorities: createPriorities(),
      status: 'VALID'
    });

    expect(narrative.currentState).toContain('MANAGED maturity level across 2 key dimensions');
    expect(narrative.burningIssues).toContain('Immediate attention is required for: Fix HR');
    expect(narrative.opportunitiesForGrowth).toContain('TECH');
  });

  it('should generate executive summary accurately', () => {
    const summary = builder.generateExecutiveSummary({
      diagnosis: createDiagnosis(),
      priorities: createPriorities(),
      status: 'VALID'
    });

    expect(summary.headline).toBe('Business Diagnostic: MANAGED Maturity Level');
    expect(summary.keyInsights[0]).toBe('Identified 1 key strengths and 1 critical weaknesses.');
    expect(summary.criticalRisksSummary).toContain('Critical risks identified in HR');
  });

  it('should not contain any product pitches', () => {
    // Constraint 31
    const summary = builder.generateExecutiveSummary({
      diagnosis: createDiagnosis(),
      priorities: createPriorities(),
      status: 'VALID'
    });

    const narrative = builder.generateNarrative({
      diagnosis: createDiagnosis(),
      priorities: createPriorities(),
      status: 'VALID'
    });

    const fullText = JSON.stringify(summary) + JSON.stringify(narrative);
    expect(fullText.toLowerCase()).not.toContain('buy our product');
    expect(fullText.toLowerCase()).not.toContain('subscribe');
  });
});
