import type { EnterpriseMentalModel, EnterpriseEvidence, PainPoint, Risk, KnowledgeGap, OperationalDomain, EnterpriseHypothesis } from '../domain/types';

export function getConfirmedFacts(model: EnterpriseMentalModel): { type: string; id: string; entity: unknown }[] {
  const confirmed: { type: string; id: string; entity: unknown }[] = [];
  const entityTypes: (keyof EnterpriseMentalModel)[] = [
    'domains', 'processes', 'painPoints', 'risks', 'capabilities', 'objectives', 'constraints'
  ];

  for (const type of entityTypes) {
    const collection = model[type] as Record<string, { status: string }>;
    for (const [id, entity] of Object.entries(collection)) {
      if (entity.status === 'CONFIRMED') {
        confirmed.push({ type, id, entity });
      }
    }
  }

  return confirmed;
}

export function getCandidateDomains(model: EnterpriseMentalModel): OperationalDomain[] {
  return Object.values(model.domains).filter(d => d.status === 'CANDIDATE');
}

export function getHighestPriorityPainPoints(model: EnterpriseMentalModel): PainPoint[] {
  // Assuming urgency is 'HIGH', 'MEDIUM', 'LOW'
  return Object.values(model.painPoints)
    .filter(p => p.urgency === 'HIGH' && (p.status === 'CONFIRMED' || p.status === 'PARTIALLY_SUPPORTED'))
    .sort((a, b) => b.confidence - a.confidence);
}

export function getHighestSeverityRisks(model: EnterpriseMentalModel): Risk[] {
  return Object.values(model.risks)
    .filter(r => r.severity === 'HIGH' && (r.status === 'CONFIRMED' || r.status === 'PARTIALLY_SUPPORTED'))
    .sort((a, b) => b.confidence - a.confidence);
}

export function getUnresolvedKnowledgeGaps(model: EnterpriseMentalModel): KnowledgeGap[] {
  return Object.values(model.knowledgeGaps).filter(g => g.status === 'OPEN');
}

export function getWeakestKnowledgeAreas(model: EnterpriseMentalModel): OperationalDomain[] {
  // Returns CONFIRMED or CANDIDATE domains with the lowest confidence
  return Object.values(model.domains)
    .filter(d => d.status !== 'REJECTED' && d.status !== 'CONTRADICTED')
    .sort((a, b) => a.confidence - b.confidence);
}

export function getEvidenceForEntity(model: EnterpriseMentalModel, entityId: string): EnterpriseEvidence[] {
  // Find the entity across collections to get its evidenceRefs
  const entityTypes: (keyof EnterpriseMentalModel)[] = [
    'domains', 'processes', 'painPoints', 'risks', 'capabilities', 'objectives', 'constraints'
  ];

  for (const type of entityTypes) {
    const collection = model[type] as Record<string, { evidenceRefs?: string[] }>;
    if (collection[entityId]) {
      const refs = collection[entityId].evidenceRefs || [];
      return refs.map((ref: string) => model.evidences[ref]).filter(Boolean);
    }
  }
  return [];
}

/**
 * Calculates a basic coverage score based on the number of confirmed facts
 * vs candidate or partially supported areas, and whether we have basic identity info.
 */
export function getModelCoverage(model: EnterpriseMentalModel): { score: number; description: string } {
  let score = 0;
  
  if (model.identity.industry) score += 10;
  if (model.identity.size) score += 10;
  if (model.identity.businessModel) score += 10;
  
  const confirmed = getConfirmedFacts(model).length;
  
  // Cap at 100
  score = Math.min(100, score + (confirmed * 5));

  let description = 'Low';
  if (score > 40) description = 'Medium';
  if (score > 70) description = 'High';

  return { score, description };
}

export function getContradictedHypotheses(model: EnterpriseMentalModel): EnterpriseHypothesis[] {
  return Object.values(model.hypotheses).filter(h => h.status === 'CONTRADICTED');
}
