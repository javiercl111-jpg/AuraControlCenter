import type {
  AssessmentPolicy,
  ConfidenceMatrix,
  MaturityProfile,
  TransformationConstraint,
  TransformationDependency,
  TransformationReadiness,
  AssessmentStatus,
  AssessmentAudit
} from '../domain/types';
import type { EnterpriseRisk } from '../../reasoning/domain/types';

export class DefaultAssessmentPolicy implements AssessmentPolicy {
  public version = '1.0.0';
  
  public confidenceWeights = {
    support: 0.4,
    directness: 0.2,
    consistency: 0.2,
    coverage: 0.1,
    causalConfidence: 0.1
  };
  
  public dimensionThresholds: Record<string, number> = {
    'CORE_OPERATIONS': 0.8,
    'TECHNOLOGY': 0.8,
    'FINANCE': 0.7,
    'PEOPLE': 0.7,
    'DEFAULT': 0.6
  };
  
  public globalConfidenceThreshold = 0.7;

  public evaluateReadiness(
    profile: MaturityProfile,
    risks: EnterpriseRisk[],
    constraints: TransformationConstraint[],
    dependencies: TransformationDependency[]
  ): TransformationReadiness {
    const criticalGaps: string[] = [];
    
    // Evaluate risks considering exposure, existing controls (simplified here since we don't have full structure for risk controls, but policy can extend this)
    const unmitigatedCriticalRisks = risks.filter(r => r.severity === 'CRITICAL');
    criticalGaps.push(...unmitigatedCriticalRisks.map(r => r.findingId));
    
    // Evaluate constraints
    const criticalConstraints = constraints.filter(c => c.impactLevel === 'CRITICAL');
    
    // Evaluate dependencies (e.g. BLOCKS)
    const blockingDependencies = dependencies.filter(d => d.type === 'BLOCKS');

    // Evaluate maturity
    const coreDimensions = profile.dimensions.filter(d => ['CORE_OPERATIONS', 'TECHNOLOGY'].includes(d.dimension));
    const lowMaturityCore = coreDimensions.filter(d => d.maturity === 'INITIAL' || d.maturity === 'EMERGING');

    let status: 'READY' | 'NEEDS_PREPARATION' | 'NOT_READY';
    let score: number;
    
    if (unmitigatedCriticalRisks.length > 2 || criticalConstraints.length > 1) {
      status = 'NOT_READY';
      score = 20;
    } else if (unmitigatedCriticalRisks.length > 0 || criticalConstraints.length > 0 || blockingDependencies.length > 0 || lowMaturityCore.length > 0) {
      status = 'NEEDS_PREPARATION';
      score = 60;
    } else {
      status = 'READY';
      score = 90;
    }

    return {
      status,
      score,
      criticalGaps,
      constraints,
      dependencies
    };
  }

  public calculateConfidence(matrix: Omit<ConfidenceMatrix, 'overallConfidence'>): ConfidenceMatrix {
    const overallConfidence = 
      (matrix.support * this.confidenceWeights.support) +
      (matrix.directness * this.confidenceWeights.directness) +
      (matrix.consistency * this.confidenceWeights.consistency) +
      (matrix.coverage * this.confidenceWeights.coverage) +
      (matrix.causalConfidence * this.confidenceWeights.causalConfidence);

    return {
      ...matrix,
      overallConfidence
    };
  }

  public determineAssessmentStatus(
    readiness: TransformationReadiness,
    confidence: ConfidenceMatrix,
    audit: AssessmentAudit
  ): AssessmentStatus {
    if (audit.invalidReferences.length > 0) {
      return 'NOT_DEFENDABLE';
    }

    if (confidence.overallConfidence < this.globalConfidenceThreshold || audit.insufficientEvidenceRefs.length > 0) {
      return 'INSUFFICIENT_EVIDENCE';
    }

    if (audit.unresolvedContradictions.length > 0) {
      return 'CONTRADICTED';
    }

    if (readiness.status === 'NOT_READY' || audit.limitations.length > 0) {
      return 'COMPLETE_WITH_LIMITATIONS';
    }

    return 'COMPLETE';
  }
}
