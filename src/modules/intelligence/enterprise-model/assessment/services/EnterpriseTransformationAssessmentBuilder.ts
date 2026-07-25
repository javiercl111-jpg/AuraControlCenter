import type {
  EnterpriseTransformationAssessment,
  AssessmentPolicy,
  TransformationConstraint,
  TransformationDependency,
  AssessmentAudit,
  AssessmentMetadata,
  EvidenceMap
} from '../domain/types';
import type { ExecutiveDossier } from '../../dossier/domain/types';
import type { ExecutiveReasoningReport } from '../../reasoning/domain/types';
import { AssessmentContextBuilder } from './AssessmentContextBuilder';
import { MaturityProfileBuilder } from './MaturityProfileBuilder';
import { EvidenceMapBuilder } from './EvidenceMapBuilder';
import { ConfidenceMatrixBuilder } from './ConfidenceMatrixBuilder';
import { TransformationReadinessEvaluator } from './TransformationReadinessEvaluator';
import { TransformationPriorityBuilder } from './TransformationPriorityBuilder';
import { ExecutiveInsightBuilder } from './ExecutiveInsightBuilder';

export class EnterpriseTransformationAssessmentBuilder {
  private policy: AssessmentPolicy;

  private maturityBuilder = new MaturityProfileBuilder();
  private evidenceBuilder = new EvidenceMapBuilder();
  private readinessEvaluator: TransformationReadinessEvaluator;
  private priorityBuilder = new TransformationPriorityBuilder();
  private insightBuilder = new ExecutiveInsightBuilder();
  private confidenceBuilder: ConfidenceMatrixBuilder;

  constructor(policy: AssessmentPolicy) {
    this.policy = policy;
    this.readinessEvaluator = new TransformationReadinessEvaluator(policy);
    this.confidenceBuilder = new ConfidenceMatrixBuilder(policy);
  }

  public build(
    executionId: string,
    timestamp: string,
    dossier: ExecutiveDossier,
    reasoning: ExecutiveReasoningReport,
    constraints: TransformationConstraint[] = [],
    dependencies: TransformationDependency[] = []
  ): EnterpriseTransformationAssessment {
    const contextBuilder = new AssessmentContextBuilder(executionId, this.policy.version, timestamp);
    const context = contextBuilder.build();

    const audit: AssessmentAudit = {
      rejectedClaims: reasoning.rejectedClaims ? [...reasoning.rejectedClaims] : [],
      diagnosticAudit: dossier.diagnosticAudit ? { ...dossier.diagnosticAudit } : { rejectedClaims: [] },
      limitations: [],
      invalidReferences: [],
      unresolvedContradictions: [],
      insufficientEvidenceRefs: []
    };

    // 1. Build profile
    const maturityProfile = this.maturityBuilder.build(dossier.businessDiagnosis, context);
    
    // 2. Build Evidence Map
    const evidenceMap = this.evidenceBuilder.build(
      reasoning.findings || [],
      reasoning.risks || [],
      reasoning.opportunities || [],
      reasoning.rootCauses || [],
      context
    );

    // 3. Build Confidence
    const confidenceMatrix = this.confidenceBuilder.build(reasoning.findings || []);

    // 4. Build Readiness
    const transformationReadiness = this.readinessEvaluator.evaluate(
      maturityProfile,
      reasoning.risks || [],
      constraints,
      dependencies
    );

    // 5. Build Priorities
    const transformationPriorities = this.priorityBuilder.build(
      dossier.priorities || [],
      dependencies
    );

    // 6. Build Insights
    const executiveInsight = this.insightBuilder.build(
      dossier.executiveSummary,
      dossier.narrative
    );

    // 7. Perform Integrity Check
    this.performIntegrityCheck(evidenceMap, audit);

    // 8. Determine Status
    const status = this.policy.determineAssessmentStatus(transformationReadiness, confidenceMatrix, audit);

    const assessmentId = context.generateDeterministicId({
      executionId: context.executionId,
      policyVersion: context.policyVersion,
      references: [dossier.dossierId, reasoning.reportId],
      content: 'EnterpriseTransformationAssessment'
    });

    const metadata: AssessmentMetadata = {
      version: '1.0.0',
      schema: 'EnterpriseTransformationAssessment',
      generator: 'EnterpriseTransformationAssessmentBuilder',
      policyVersion: this.policy.version,
      timestamp: context.timestamp
    };

    return {
      assessmentId,
      dossierRef: dossier.dossierId,
      reasoningReportRef: reasoning.reportId,
      executionId: context.executionId,
      status,
      maturityProfile,
      findings: reasoning.findings || [],
      risks: reasoning.risks || [],
      opportunities: reasoning.opportunities || [],
      rootCauses: reasoning.rootCauses || [],
      transformationPriorities,
      recommendationCandidates: dossier.recommendationCandidates ? [...dossier.recommendationCandidates] : [],
      transformationReadiness,
      confidenceMatrix,
      evidenceMap,
      executiveInsight,
      audit,
      metadata
    };
  }

  private performIntegrityCheck(evidenceMap: EvidenceMap, audit: AssessmentAudit) {
    const evidenceLinks = evidenceMap.links;
    if (!evidenceLinks || evidenceLinks.length === 0) {
      audit.insufficientEvidenceRefs.push('EVIDENCE_MAP_EMPTY');
    }
  }
}
