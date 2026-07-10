import type { CommercialDecisionInput, ProbabilityOfClosing } from '../types';

export class ClosingProbabilityCalculator {
  static calculate(input: CommercialDecisionInput): ProbabilityOfClosing {
    const positiveSignals: string[] = [];
    const negativeSignals: string[] = [];
    const missingSignals: string[] = [];

    let baseProbability = 50; // Starting point

    // Evaluate signals
    if (input.dossier?.urgencyLevel && input.dossier.urgencyLevel > 75) {
      baseProbability += 15;
      positiveSignals.push('High urgency detected');
    } else if (input.dossier?.urgencyLevel && input.dossier.urgencyLevel < 30) {
      baseProbability -= 15;
      negativeSignals.push('Low urgency detected');
    } else {
      missingSignals.push('Clear urgency not established');
    }

    if (input.dossier?.painPoints && input.dossier.painPoints.some(p => p.intensity > 80)) {
      baseProbability += 20;
      positiveSignals.push('Critical pain point identified');
    } else {
      missingSignals.push('No critical pain points explicitly defined');
    }

    if (input.prospectMetadata.economicPotential.confidence > 70) {
      baseProbability += 10;
      positiveSignals.push('Economic potential is validated');
    } else {
      missingSignals.push('Economic potential is uncertain');
    }

    // Confidence
    const confidence = Math.min(
      input.confidenceMatrix.discoveryQuality,
      input.confidenceMatrix.diagnosticConfidence
    );

    // If confidence is low, the probability shouldn't be high precision.
    // Also, if there's insufficient evidence, drop confidence.
    let finalConfidence = confidence;
    if (missingSignals.length > 1) {
      finalConfidence -= 20;
    }
    finalConfidence = Math.max(finalConfidence, 0);

    // Adjust probability based on confidence. If confidence is very low, probability is extremely uncertain.
    const probability = finalConfidence < 40 ? 0 : Math.min(Math.max(baseProbability, 0), 100);

    return {
      probability,
      confidence: finalConfidence,
      positiveSignals,
      negativeSignals,
      missingSignals,
      explanation: finalConfidence < 40 
        ? 'Insufficient commercial evidence to calculate a reliable closing probability.' 
        : `Calculated ${probability}% probability based on ${positiveSignals.length} positive signals and ${negativeSignals.length} negative signals.`
    };
  }
}
