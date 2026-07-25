/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-expect-error Vitest ambient module types
import { describe, it, expect } from 'vitest';
import { EnterpriseTransformationAssessmentBuilder } from '../services/EnterpriseTransformationAssessmentBuilder';
import { DefaultAssessmentPolicy } from '../policies/AssessmentPolicy';

describe('EnterpriseTransformationAssessmentBuilder', () => {
  const policy = new DefaultAssessmentPolicy();
  const builder = new EnterpriseTransformationAssessmentBuilder(policy);

  const mockDossier = {
    dossierId: 'dossier-1',
    reportRef: 'report-1',
    timestamp: '',
    diagnosticStatus: 'VALID' as const,
    blocks: [],
    executiveSummary: { headline: '', keyInsights: [], criticalRisksSummary: '' },
    businessDiagnosis: { overallMaturity: 'MANAGED' as const, dimensionAssessments: [], strengths: [], weaknesses: [] },
    priorities: [],
    recommendationCandidates: [],
    narrative: { executiveSummary: '', currentState: '', burningIssues: '', opportunitiesForGrowth: '' },
    diagnosticAudit: { rejectedClaims: [] }
  };

  const mockReasoning = {
    reportId: 'report-1',
    timestamp: '',
    overallStatus: 'SUPPORTED_FINDING' as const,
    findings: [],
    risks: [],
    opportunities: [],
    rootCauses: [],
    rejectedClaims: [],
    readinessGaps: []
  };

  it('should successfully build a complete assessment', () => {
    const assessment = builder.build(
      'exec-1',
      '2026-07-25T10:00:00Z',
      mockDossier,
      mockReasoning,
      [],
      []
    );

    expect(assessment.status).toBe('INSUFFICIENT_EVIDENCE'); // Because confidence is 0 (empty findings)
    expect(assessment.executionId).toBe('exec-1');
    expect(assessment.dossierRef).toBe('dossier-1');
    expect(assessment.reasoningReportRef).toBe('report-1');
    expect(assessment.metadata.policyVersion).toBe(policy.version);
    expect(assessment.metadata.timestamp).toBe('2026-07-25T10:00:00Z');
  });

  it('should degrade status if constraints are critical (NOT_READY)', () => {
    // Add dummy finding with high confidence to bypass INSUFFICIENT_EVIDENCE
    const mockReasoningWithFindings = {
      ...mockReasoning,
      findings: [{
        findingId: 'f-1',
        statement: '',
        type: 'FINDING' as const,
        chain: {
          chainId: 'c-1',
          claims: [{
            claimId: 'claim-1',
            statement: 'Test claim',
            sourceNodes: [],
            sourceRelationships: [],
            evidenceSupports: [{
              supportId: 'sup-1',
              evidenceRef: 'ev-1',
              correlationType: 'DIRECT' as const,
              weight: 1,
              rationale: 'Direct support'
            }],
            confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 1 },
            status: 'SUPPORTED_FINDING' as const,
            createdAt: '2026-07-25T10:00:00Z'
          }],
          logicDescription: 'Test logic'
        },
        status: 'SUPPORTED_FINDING' as const,
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 1 }
      }]
    };

    const assessment = builder.build(
      'exec-1',
      '2026-07-25T10:00:00Z',
      mockDossier,
      mockReasoningWithFindings,
      [
        { id: 'c-1', type: 'BUDGET' as const, description: '', impactLevel: 'CRITICAL' as const },
        { id: 'c-2', type: 'TIME' as const, description: '', impactLevel: 'CRITICAL' as const }
      ],
      []
    );

    expect(assessment.transformationReadiness.status).toBe('NOT_READY');
    expect(assessment.status).toBe('COMPLETE_WITH_LIMITATIONS');
  });

  it('should preserve diagnostic audit from dossier and rejected claims', () => {
    const customDossier = {
      ...mockDossier,
      diagnosticAudit: {
        rejectedClaims: [{ claim: { claimId: 'claim-x', statement: '', sourceNodes: [], sourceRelationships: [], evidenceSupports: [], confidence: {} as any, status: 'NOT_DEFENDABLE' as const, createdAt: '' }, reason: 'Test reason' }]
      }
    };
    
    const customReasoning = {
      ...mockReasoning,
      rejectedClaims: [{ claimId: 'claim-y', statement: '', sourceNodes: [], sourceRelationships: [], evidenceSupports: [], confidence: {} as any, status: 'NOT_DEFENDABLE' as const, createdAt: '' }]
    };

    const assessment = builder.build(
      'exec-1',
      '2026-07-25T10:00:00Z',
      customDossier,
      customReasoning,
      [],
      []
    );

    expect(assessment.audit.diagnosticAudit.rejectedClaims).toHaveLength(1);
    expect(assessment.audit.rejectedClaims).toHaveLength(1);
  });

  it('should not mutate the original dossier or reasoning arrays', () => {
    const originalPriorities = [...mockDossier.priorities];
    const originalRecommendations = [...mockDossier.recommendationCandidates];

    const assessment = builder.build(
      'exec-1',
      '2026-07-25T10:00:00Z',
      mockDossier,
      mockReasoning,
      [],
      []
    );

    expect(assessment.transformationPriorities).not.toBe(mockDossier.priorities);
    expect(assessment.recommendationCandidates).not.toBe(mockDossier.recommendationCandidates);
    expect(mockDossier.priorities).toEqual(originalPriorities);
    expect(mockDossier.recommendationCandidates).toEqual(originalRecommendations);
  });
});
