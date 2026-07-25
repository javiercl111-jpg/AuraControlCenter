import type { 
  DossierPolicy, 
  MaturityAssessment, 
  DiagnosticDimension 
} from '../domain/types';
import type { DiagnosticContext } from './DiagnosticContextBuilder';
import type { ExecutiveFinding } from '../../reasoning/domain/types';

export class MaturityEvaluator {
  private policy: DossierPolicy;

  constructor(policy: DossierPolicy) {
    this.policy = policy;
  }

  public evaluate(context: DiagnosticContext): MaturityAssessment[] {
    const dimensionMap = new Map<DiagnosticDimension, ExecutiveFinding[]>();

    for (const finding of context.findings) {
      const dimension = this.extractDimension(finding);
      if (!dimensionMap.has(dimension)) {
        dimensionMap.set(dimension, []);
      }
      dimensionMap.get(dimension)!.push(finding);
    }

    const assessments: MaturityAssessment[] = [];

    for (const [dimension, findings] of dimensionMap.entries()) {
      assessments.push(this.evaluateDimension(dimension, findings));
    }

    if (assessments.length === 0) {
      assessments.push({
        dimension: 'GENERAL',
        level: this.policy.getLevels()[0],
        score: 0,
        evidenceRefs: [],
        justification: 'No sufficient evidence found to assess maturity.'
      });
    }

    return assessments;
  }

  private evaluateDimension(dimension: DiagnosticDimension, findings: ExecutiveFinding[]): MaturityAssessment {
    let totalScore = 0;
    let validFindings = 0;
    const evidenceRefs: string[] = [];

    for (const f of findings) {
      evidenceRefs.push(f.findingId);
      
      let findingScore: number;
      if (f.status === 'SUPPORTED_FINDING') {
        findingScore = f.confidence.aggregate;
        if (f.type === 'RISK' || f.type === 'ROOT_CAUSE') {
           findingScore = 0.2 * (1 - f.confidence.aggregate);
        }
      } else if (f.status === 'PARTIALLY_SUPPORTED') {
        findingScore = f.confidence.aggregate * 0.5;
        if (f.type === 'RISK' || f.type === 'ROOT_CAUSE') {
           findingScore = 0.5 * (1 - f.confidence.aggregate);
        }
      } else {
        findingScore = 0;
      }

      totalScore += findingScore;
      validFindings++;
    }

    const averageScore = validFindings > 0 ? totalScore / validFindings : 0;
    const level = this.policy.evaluateScore(averageScore);

    return {
      dimension,
      level,
      score: averageScore,
      evidenceRefs,
      justification: `Assessed based on ${validFindings} findings. Average score: ${averageScore.toFixed(2)}`
    };
  }

  public extractDimension(item: { impactArea?: string; chain?: { claims?: Array<{ sourceNodes?: string[] }> } }): string {
    if (item.impactArea && typeof item.impactArea === 'string') {
      return item.impactArea.toUpperCase();
    }
    
    if (item.chain && typeof item.chain === 'object') {
      const chain = item.chain as { claims?: Array<{ sourceNodes?: string[] }> };
      if (Array.isArray(chain.claims)) {
        for (const claim of chain.claims) {
          if (Array.isArray(claim.sourceNodes)) {
            for (const node of claim.sourceNodes) {
              const parts = node.split(/[:_]/);
              if (parts.length > 1) {
                 return parts[0].toUpperCase();
              }
            }
          }
        }
      }
    }
    return 'GENERAL';
  }
}

export default MaturityEvaluator;
