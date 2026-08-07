import { describe, it, expect } from 'vitest';
import { createAssessmentPolicyV1 } from '../createAssessmentPolicyV1';
import { DefaultAssessmentPolicy } from '../AssessmentPolicy';
import { EnterpriseTransformationAssessmentBuilder } from '../../services/EnterpriseTransformationAssessmentBuilder';
import type {
  ExecutiveDossier,
  DossierStatus,
  MaturityLevel
} from '../../../dossier/domain/types';
import type { ExecutiveReasoningReport } from '../../../reasoning/domain/types';

describe('AEA-05-R1C.2 createAssessmentPolicyV1', () => {
  it('returns a valid AssessmentPolicy, specifically an instance of DefaultAssessmentPolicy', () => {
    const policy = createAssessmentPolicyV1();

    expect(policy).toBeDefined();
    expect(policy).toBeInstanceOf(DefaultAssessmentPolicy);
    expect(policy.version).toBeDefined();
  });

  it('matches all canonical values without diverging copies', () => {
    const policy = createAssessmentPolicyV1();
    const reference = new DefaultAssessmentPolicy();

    expect(policy.version).toBe(reference.version);
    expect(policy.confidenceWeights).toEqual(reference.confidenceWeights);
    expect(policy.dimensionThresholds).toEqual(reference.dimensionThresholds);
    expect(policy.globalConfidenceThreshold).toBe(reference.globalConfidenceThreshold);
  });

  it('two instances present the same semantics without shared mutable state', () => {
    const policy1 = createAssessmentPolicyV1();
    const policy2 = createAssessmentPolicyV1();

    expect(policy1).not.toBe(policy2); // Different instances

    // If one is mutated, the other should remain untouched
    policy1.globalConfidenceThreshold = 0.99;
    expect(policy2.globalConfidenceThreshold).toBe(new DefaultAssessmentPolicy().globalConfidenceThreshold);
  });

  it('EnterpriseTransformationAssessmentBuilder accepts the generated policy and produces valid output', () => {
    const policy = createAssessmentPolicyV1();
    const builder = new EnterpriseTransformationAssessmentBuilder(policy);

    const dossier: ExecutiveDossier = {
      dossierId: 'test-dossier',
      reportRef: 'test-report',
      timestamp: '2026-08-01T00:00:00Z',
      diagnosticStatus: 'VALID' as DossierStatus,
      blocks: [],
      executiveSummary: { headline: '', keyInsights: [], criticalRisksSummary: '' },
      businessDiagnosis: {
        overallMaturity: 'MANAGED' as MaturityLevel,
        dimensionAssessments: [],
        strengths: [],
        weaknesses: []
      },
      priorities: [],
      recommendationCandidates: [],
      narrative: { executiveSummary: '', currentState: '', burningIssues: '', opportunitiesForGrowth: '' },
      diagnosticAudit: { rejectedClaims: [] }
    };

    const reasoningReport: ExecutiveReasoningReport = {
      reportId: 'test-report',
      timestamp: '2026-08-01T00:00:00Z',
      overallStatus: 'SUPPORTED_FINDING',
      findings: [],
      risks: [],
      opportunities: [],
      rootCauses: [],
      rejectedClaims: [],
      readinessGaps: []
    };

    const assessment = builder.build(
      'test-exec-id',
      '2026-08-01T00:00:00Z',
      dossier,
      reasoningReport,
      [],
      []
    );

    expect(assessment).toBeDefined();
    expect(assessment.assessmentId).toBeDefined();
    expect(assessment.status).toBeDefined();
  });
});
