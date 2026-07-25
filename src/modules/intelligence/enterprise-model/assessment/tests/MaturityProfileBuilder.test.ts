// @ts-expect-error Vitest ambient module types
import { describe, it, expect } from 'vitest';
import { MaturityProfileBuilder } from '../services/MaturityProfileBuilder';
import { AssessmentContextBuilder } from '../services/AssessmentContextBuilder';

describe('MaturityProfileBuilder', () => {
  const context = new AssessmentContextBuilder('exec-1', '1.0', '2026-07-25T10:00:00Z').build();
  const builder = new MaturityProfileBuilder();

  it('should build a maturity profile from a business diagnosis', () => {
    const diagnosis = {
      overallMaturity: 'MANAGED' as const,
      dimensionAssessments: [
        { dimension: 'TECHNOLOGY', level: 'MANAGED' as const, score: 75, evidenceRefs: [], justification: '' }
      ],
      strengths: [
        { id: 's-1', dimension: 'TECHNOLOGY', description: '', impact: 'HIGH' as const, supportingFindings: [] }
      ],
      weaknesses: []
    };

    const profile = builder.build(diagnosis, context);

    expect(profile.overallMaturity).toBe('MANAGED');
    expect(profile.dimensions).toHaveLength(1);
    expect(profile.dimensions[0].dimension).toBe('TECHNOLOGY');
    expect(profile.dimensions[0].strengths).toContain('s-1');
    expect(profile.dimensions[0].weaknesses).toHaveLength(0);
  });

  it('should correctly link weaknesses to the right dimension', () => {
    const diagnosis = {
      overallMaturity: 'INITIAL' as const,
      dimensionAssessments: [
        { dimension: 'PEOPLE', level: 'INITIAL' as const, score: 20, evidenceRefs: [], justification: '' },
        { dimension: 'TECHNOLOGY', level: 'EMERGING' as const, score: 40, evidenceRefs: [], justification: '' }
      ],
      strengths: [],
      weaknesses: [
        { id: 'w-1', dimension: 'PEOPLE', description: '', severity: 'HIGH' as const, relatedRisks: [], rootCauses: [] }
      ]
    };

    const profile = builder.build(diagnosis, context);

    const peopleDim = profile.dimensions.find(d => d.dimension === 'PEOPLE');
    expect(peopleDim?.weaknesses).toContain('w-1');
    
    const techDim = profile.dimensions.find(d => d.dimension === 'TECHNOLOGY');
    expect(techDim?.weaknesses).not.toContain('w-1');
  });

  it('should handle diagnosis with empty assessments gracefully', () => {
    const profile = builder.build({
      overallMaturity: 'INITIAL',
      dimensionAssessments: [],
      strengths: [],
      weaknesses: []
    }, context);

    expect(profile.dimensions).toHaveLength(0);
    expect(profile.overallMaturity).toBe('INITIAL');
  });

  it('should correctly transfer score and maturity level for each dimension', () => {
    const profile = builder.build({
      overallMaturity: 'OPTIMIZING',
      dimensionAssessments: [
        { dimension: 'FINANCE', level: 'OPTIMIZING', score: 95, evidenceRefs: [], justification: '' }
      ],
      strengths: [],
      weaknesses: []
    }, context);

    expect(profile.dimensions[0].score).toBe(95);
    expect(profile.dimensions[0].maturity).toBe('OPTIMIZING');
  });
});
