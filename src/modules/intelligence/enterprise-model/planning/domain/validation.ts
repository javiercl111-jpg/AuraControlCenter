import type {
  PlannerExecutionContext,
  PlannerPolicy,
  PlanningTraceability,
} from './types';

export class PlanningValidationError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'INVALID_PLANNING_STATE') {
    super(message);
    this.name = 'PlanningValidationError';
    this.code = code;
  }
}

/**
 * Calculates normalized Jaccard lexical similarity between two text strings.
 * Normalized by lowercasing, stripping punctuation, and building unique word sets.
 */
export function calculateJaccardSimilarity(textA: string, textB: string): number {
  if (!textA || !textB) return 0;

  const tokenize = (text: string): Set<string> => {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
    const tokens = normalized.split(/\s+/).filter((w) => w.length > 1);
    return new Set(tokens);
  };

  const setA = tokenize(textA);
  const setB = tokenize(textB);

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersectionCount = 0;
  setA.forEach((word) => {
    if (setB.has(word)) {
      intersectionCount++;
    }
  });

  const unionSize = setA.size + setB.size - intersectionCount;
  return unionSize === 0 ? 0 : intersectionCount / unionSize;
}

export function validatePlannerExecutionContext(
  ctx?: PlannerExecutionContext
): PlannerExecutionContext {
  if (!ctx || !ctx.executionId || !ctx.timestamp) {
    throw new PlanningValidationError(
      'PlannerExecutionContext must contain executionId and timestamp.',
      'INVALID_EXECUTION_CONTEXT'
    );
  }
  return ctx;
}

export function validatePlannerPolicy(policy?: PlannerPolicy): PlannerPolicy {
  const defaultPolicy: PlannerPolicy = {
    maxQuestionsPerPlan: 5,
    minConfidenceThreshold: 0.5,
    jaccardThreshold: 0.6,
    allowClosedQuestions: false,
  };

  if (!policy) return defaultPolicy;

  if (policy.maxQuestionsPerPlan <= 0) {
    throw new PlanningValidationError(
      'maxQuestionsPerPlan must be greater than 0.',
      'INVALID_POLICY'
    );
  }

  if (policy.jaccardThreshold < 0 || policy.jaccardThreshold > 1) {
    throw new PlanningValidationError(
      'jaccardThreshold must be between 0 and 1.',
      'INVALID_POLICY'
    );
  }

  return policy;
}

export function validatePlanningTraceability(
  traceability?: PlanningTraceability
): boolean {
  if (!traceability || !traceability.domainId) {
    return false;
  }
  const hasRef = Boolean(
    traceability.coverageDecisionRef ||
      traceability.researchQueueRef ||
      traceability.sourceGapId
  );
  return hasRef;
}

const PlanningValidationModule = {
  PlanningValidationError,
  calculateJaccardSimilarity,
  validatePlannerExecutionContext,
  validatePlannerPolicy,
  validatePlanningTraceability,
};

export default PlanningValidationModule;
