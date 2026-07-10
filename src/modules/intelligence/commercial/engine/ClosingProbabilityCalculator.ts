import type { CommercialDecisionInput, ProbabilityOfClosing } from '../types';
import { toFiniteNumber } from '../utils/numbers';

export class ClosingProbabilityCalculator {
  static calculate(input: CommercialDecisionInput): ProbabilityOfClosing {
    const positiveSignals: string[] = [];
    const negativeSignals: string[] = [];
    const missingSignals: string[] = [];

    let baseProbability = 50; // Starting point

    // Evaluate signals
    if (input.dossier?.urgencyLevel != null) {
      const urgency = toFiniteNumber(input.dossier.urgencyLevel, 0);
      if (urgency > 75) {
        baseProbability += 15;
        positiveSignals.push('High urgency detected');
      } else if (urgency < 30) {
        baseProbability -= 15;
        negativeSignals.push('Low urgency detected');
      } else {
        missingSignals.push('Clear urgency not established');
      }
    } else {
      missingSignals.push('Clear urgency not established');
    }

    if (input.dossier?.painPoints && input.dossier.painPoints.some(p => toFiniteNumber(p.intensity, 0) > 80)) {
      baseProbability += 20;
      positiveSignals.push('Critical pain point identified');
    } else {
      missingSignals.push('No critical pain points explicitly defined');
    }

    const economicConf = toFiniteNumber(input.prospectMetadata?.economicPotential?.confidence, 0);
    if (economicConf > 70) {
      baseProbability += 10;
      positiveSignals.push('Economic potential is validated');
    } else {
      missingSignals.push('Economic potential is uncertain');
    }

    // Confidence
    const diagConf = toFiniteNumber(input.confidenceMatrix?.diagnosticConfidence, 0);
    const discQual = toFiniteNumber(input.confidenceMatrix?.discoveryQuality, 0);
    
    const confidence = Math.min(discQual, diagConf);

    // If confidence is low, the probability shouldn't be high precision.
    // Also, if there's insufficient evidence, drop confidence.
    let finalConfidence = toFiniteNumber(confidence);
    if (missingSignals.length > 1) {
      finalConfidence -= 20;
    }
    finalConfidence = Math.min(Math.max(toFiniteNumber(finalConfidence), 0), 100);

    // Adjust probability based on confidence. If confidence is very low, probability is extremely uncertain.
    let probability = finalConfidence < 40 ? 0 : Math.min(Math.max(toFiniteNumber(baseProbability), 0), 100);
    probability = toFiniteNumber(probability, 0);

    return {
      probability: Math.round(probability),
      confidence: Math.round(finalConfidence),
      positiveSignals,
      negativeSignals,
      missingSignals,
      explanation: finalConfidence < 40 
        ? 'Insufficient commercial evidence to calculate a reliable closing probability.' 
        : `Calculated ${Math.round(probability)}% probability based on ${positiveSignals.length} positive signals and ${negativeSignals.length} negative signals.`
    };
  }
}
