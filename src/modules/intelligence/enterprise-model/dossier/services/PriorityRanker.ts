import type { 
  StrategicPriority, 
  EnterpriseStrength, 
  EnterpriseWeakness, 
  DossierExecutionContext,
  ExecutiveRecommendationCandidate
} from '../domain/types';

export class PriorityRanker {
  private contextProvider: DossierExecutionContext;

  constructor(contextProvider: DossierExecutionContext) {
    this.contextProvider = contextProvider;
  }

  public rank(
    strengths: EnterpriseStrength[],
    weaknesses: EnterpriseWeakness[]
  ): { priorities: StrategicPriority[], candidates: ExecutiveRecommendationCandidate[] } {
    const priorities: StrategicPriority[] = [];
    const candidates: ExecutiveRecommendationCandidate[] = [];

    const sortedWeaknesses = [...weaknesses].sort((a, b) => {
      const weight = { CRITICAL: 3, HIGH: 2, MODERATE: 1 };
      if (weight[a.severity] !== weight[b.severity]) {
        return weight[b.severity] - weight[a.severity];
      }
      if (a.relatedRisks.length !== b.relatedRisks.length) {
        return b.relatedRisks.length - a.relatedRisks.length;
      }
      return a.id.localeCompare(b.id);
    });

    let rank = 1;
    for (const w of sortedWeaknesses) {
      const urgency = w.severity === 'CRITICAL' ? 'IMMEDIATE' : 
                      w.severity === 'HIGH' ? 'SHORT_TERM' : 'MEDIUM_TERM';

      const leveragedStrengths = strengths
        .filter(s => s.dimension === w.dimension)
        .map(s => s.id);

      const title = `Address ${w.severity} weakness in ${w.dimension}`;
      const description = `This priority must be addressed because it involves ${w.relatedRisks.length} related risks. ${w.description}`;

      const priorityId = this.contextProvider.generateId('PRIORITY', w.id);

      priorities.push({
        id: priorityId,
        rank: rank++,
        title,
        description,
        dimension: w.dimension,
        addressedWeaknesses: [w.id],
        leveragedStrengths,
        urgency
      });

      const candidateId = this.contextProvider.generateId('CANDIDATE', priorityId);
      candidates.push({
        id: candidateId,
        priorityId,
        proposedAction: `Investigate and mitigate the root causes of the ${w.severity} weakness in ${w.dimension}`,
        expectedOutcome: `Reduction of risks associated with ${w.description}`,
        effortEstimate: w.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        evidenceRefs: [...w.relatedRisks, ...w.rootCauses]
      });
    }

    return { priorities, candidates };
  }
}

export default PriorityRanker;
