import type { EnterpriseMentalModel, EnterpriseHypothesis, KnowledgeGap, ConfidenceStatus } from '../domain/types';
import type { EnterpriseEvidence } from '../domain/evidence';
import { calculateConfidenceScore, determineConfidenceStatus } from '../policies/confidencePolicy';

export function createEmptyEnterpriseMentalModel(): EnterpriseMentalModel {
  return {
    identity: {
      organizationName: null,
      industry: null,
      subindustry: null,
      size: null,
      employeeRange: null,
      locations: null,
      operatingRegions: null,
      businessModel: null,
    },
    strategicContext: {
      transformationObjectives: [],
      growthObjectives: [],
      executivePriorities: [],
      constraints: [],
      urgency: null,
      timeHorizon: null,
    },
    evidences: {},
    domains: {},
    processes: {},
    painPoints: {},
    risks: {},
    capabilities: {},
    objectives: {},
    constraints: {},
    hypotheses: {},
    knowledgeGaps: {},
    productApplicability: {},
  };
}

/**
 * Recalculates confidence for a given entity type and ID.
 * Returns a new model instance if changes occurred.
 */
export function recalculateEntityConfidence(model: EnterpriseMentalModel, entityType: keyof EnterpriseMentalModel, entityId: string): EnterpriseMentalModel {
  const collection = model[entityType] as Record<string, { confidence: number; status: ConfidenceStatus; evidenceRefs: string[] }>;
  const entity = collection[entityId];
  if (!entity || !('confidence' in entity) || !('status' in entity) || !('evidenceRefs' in entity)) {
    return model; // Cannot calculate for this entity type or doesn't exist
  }

  const evidences = entity.evidenceRefs.map((ref: string) => model.evidences[ref]).filter(Boolean);
  const newConfidence = calculateConfidenceScore(evidences);
  const newStatus = determineConfidenceStatus(evidences, entity.status);

  if (entity.confidence === newConfidence && entity.status === newStatus) {
    return model;
  }

  return {
    ...model,
    [entityType]: {
      ...collection,
      [entityId]: {
        ...entity,
        confidence: newConfidence,
        status: newStatus,
      },
    },
  };
}

/**
 * Deterministically applies a single piece of evidence.
 * Idempotent: If evidenceId already exists, it ignores it.
 */
export function applyEnterpriseEvidence(model: EnterpriseMentalModel, evidence: EnterpriseEvidence): EnterpriseMentalModel {
  if (model.evidences[evidence.evidenceId]) {
    return model; // Idempotency
  }

  let nextModel = {
    ...model,
    evidences: {
      ...model.evidences,
      [evidence.evidenceId]: evidence,
    },
  };

  // Add evidenceRef to all related entities and recalculate
  const entityTypes: (keyof EnterpriseMentalModel)[] = [
    'domains', 'processes', 'painPoints', 'risks', 'capabilities', 'objectives', 'constraints'
  ];

  for (const ref of evidence.entityRefs) {
    for (const type of entityTypes) {
      const collection = nextModel[type] as Record<string, { evidenceRefs: string[] }>;
      if (collection[ref]) {
        const entity = collection[ref];
        if (!entity.evidenceRefs.includes(evidence.evidenceId)) {
          nextModel = {
            ...nextModel,
            [type]: {
              ...collection,
              [ref]: {
                ...entity,
                evidenceRefs: [...entity.evidenceRefs, evidence.evidenceId],
              }
            }
          };
        }
        nextModel = recalculateEntityConfidence(nextModel, type, ref);
        break; // Assume IDs are globally unique across these collections for simplicity
      }
    }
  }

  return nextModel;
}

export function applyEvidenceBatch(model: EnterpriseMentalModel, evidences: EnterpriseEvidence[]): EnterpriseMentalModel {
  return evidences.reduce((currentModel, ev) => applyEnterpriseEvidence(currentModel, ev), model);
}

export function registerHypothesis(model: EnterpriseMentalModel, hypothesis: EnterpriseHypothesis): EnterpriseMentalModel {
  if (model.hypotheses[hypothesis.hypothesisId]) {
    return model;
  }
  return {
    ...model,
    hypotheses: {
      ...model.hypotheses,
      [hypothesis.hypothesisId]: hypothesis,
    },
  };
}

export function confirmHypothesis(model: EnterpriseMentalModel, hypothesisId: string, evidenceRefs: string[] = []): EnterpriseMentalModel {
  const hypothesis = model.hypotheses[hypothesisId];
  if (!hypothesis) return model;

  const newRefs = Array.from(new Set([...hypothesis.supportingEvidenceRefs, ...evidenceRefs]));

  return {
    ...model,
    hypotheses: {
      ...model.hypotheses,
      [hypothesisId]: {
        ...hypothesis,
        status: 'CONFIRMED',
        supportingEvidenceRefs: newRefs,
        updatedAt: Date.now(),
      },
    },
  };
}

export function contradictHypothesis(model: EnterpriseMentalModel, hypothesisId: string, evidenceRefs: string[] = []): EnterpriseMentalModel {
  const hypothesis = model.hypotheses[hypothesisId];
  if (!hypothesis) return model;

  const newRefs = Array.from(new Set([...hypothesis.contradictingEvidenceRefs, ...evidenceRefs]));

  return {
    ...model,
    hypotheses: {
      ...model.hypotheses,
      [hypothesisId]: {
        ...hypothesis,
        status: 'CONTRADICTED',
        contradictingEvidenceRefs: newRefs,
        updatedAt: Date.now(),
      },
    },
  };
}

export function rejectHypothesis(model: EnterpriseMentalModel, hypothesisId: string, evidenceRefs: string[] = []): EnterpriseMentalModel {
  const hypothesis = model.hypotheses[hypothesisId];
  if (!hypothesis) return model;

  const newRefs = Array.from(new Set([...hypothesis.contradictingEvidenceRefs, ...evidenceRefs]));

  return {
    ...model,
    hypotheses: {
      ...model.hypotheses,
      [hypothesisId]: {
        ...hypothesis,
        status: 'REJECTED',
        contradictingEvidenceRefs: newRefs,
        updatedAt: Date.now(),
      },
    },
  };
}

export function registerKnowledgeGap(model: EnterpriseMentalModel, gap: KnowledgeGap): EnterpriseMentalModel {
  if (model.knowledgeGaps[gap.gapId]) {
    return model;
  }
  return {
    ...model,
    knowledgeGaps: {
      ...model.knowledgeGaps,
      [gap.gapId]: gap,
    },
  };
}

export function resolveKnowledgeGap(model: EnterpriseMentalModel, gapId: string): EnterpriseMentalModel {
  const gap = model.knowledgeGaps[gapId];
  if (!gap) return model;

  return {
    ...model,
    knowledgeGaps: {
      ...model.knowledgeGaps,
      [gapId]: {
        ...gap,
        status: 'RESOLVED',
      },
    },
  };
}
