export const COMMERCIAL_SCORING_VERSION = '1.0';

export interface ScoringWeights {
  painIntensity: number;
  urgency: number;
  auraFit: number;
  economicPotential: number;
  diagnosticConfidence: number;
  discoveryQuality: number;
  digitalReadiness: number;
  implementationFeasibility: number;
}

export const SCORING_WEIGHTS: ScoringWeights = {
  painIntensity: 0.18,
  urgency: 0.15,
  auraFit: 0.15,
  economicPotential: 0.12,
  diagnosticConfidence: 0.12,
  discoveryQuality: 0.10,
  digitalReadiness: 0.08,
  implementationFeasibility: 0.05,
};

export const MAX_COMMERCIAL_RISK_PENALTY = 0.15; // up to -15%
