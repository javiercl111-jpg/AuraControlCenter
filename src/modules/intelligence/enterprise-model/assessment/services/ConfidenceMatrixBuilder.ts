import type { 
  ConfidenceMatrix, 
  AssessmentPolicy 
} from '../domain/types';
import type { ExecutiveFinding } from '../../reasoning/domain/types';

export class ConfidenceMatrixBuilder {
  private policy: AssessmentPolicy;

  constructor(policy: AssessmentPolicy) {
    this.policy = policy;
  }

  public build(findings: ExecutiveFinding[]): ConfidenceMatrix {
    if (findings.length === 0) {
      return this.policy.calculateConfidence({
        support: 0,
        directness: 0,
        consistency: 0,
        coverage: 0,
        causalConfidence: 0,
        dimensionConfidence: {}
      });
    }

    let supportTotal = 0;
    let directnessTotal = 0;
    let consistencyTotal = 0;
    let coverageTotal = 0;
    let causalTotal = 0;

    findings.forEach(f => {
      supportTotal += f.confidence.support;
      directnessTotal += f.confidence.directness;
      consistencyTotal += f.confidence.consistency;
      coverageTotal += f.confidence.coverage;
      causalTotal += f.confidence.causalConfidence;
    });

    const count = findings.length;

    // We don't have dimension mapping in finding right now natively, so we fallback to a default aggregate.
    // In a real implementation we would cross-reference finding source to diagnostic dimension.
    const dimensionConfidence = {
      'DEFAULT': supportTotal / count // Simplification
    };

    const baseMatrix: Omit<ConfidenceMatrix, 'overallConfidence'> = {
      support: supportTotal / count,
      directness: directnessTotal / count,
      consistency: consistencyTotal / count,
      coverage: coverageTotal / count,
      causalConfidence: causalTotal / count,
      dimensionConfidence
    };

    return this.policy.calculateConfidence(baseMatrix);
  }
}
