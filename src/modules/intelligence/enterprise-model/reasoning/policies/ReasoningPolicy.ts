export interface ReasoningPolicy {
  minimumSupportThreshold: number;
  minimumCausalConfidence: number;
  requireDirectEvidenceForRisks: boolean;
  allowInferenceForOpportunities: boolean;
  failClosedOnCoverageScore: number;
  failClosedOnMissingEntities: boolean;
  contradictionDemotionWeight: number;
  maxInferenceSteps: number;
}

export const createStrictPolicy = (): ReasoningPolicy => ({
  minimumSupportThreshold: 0.7,
  minimumCausalConfidence: 0.85,
  requireDirectEvidenceForRisks: true,
  allowInferenceForOpportunities: true,
  failClosedOnCoverageScore: 0.6,
  failClosedOnMissingEntities: true,
  contradictionDemotionWeight: 0.5,
  maxInferenceSteps: 2,
});

export const createLenientPolicy = (): ReasoningPolicy => ({
  minimumSupportThreshold: 0.5,
  minimumCausalConfidence: 0.6,
  requireDirectEvidenceForRisks: false,
  allowInferenceForOpportunities: true,
  failClosedOnCoverageScore: 0.3,
  failClosedOnMissingEntities: false,
  contradictionDemotionWeight: 0.2,
  maxInferenceSteps: 4,
});

const PolicyModule = {
  createStrictPolicy,
  createLenientPolicy,
};

export default PolicyModule;
