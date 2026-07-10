import type { CommercialDecisionInput, CommercialRisk, OpportunityScore, ScoreComponent } from '../types';
import { COMMERCIAL_SCORING_VERSION, SCORING_WEIGHTS, MAX_COMMERCIAL_RISK_PENALTY } from '../config';

export class OpportunityScoreCalculator {
  static calculate(input: CommercialDecisionInput, risks: CommercialRisk[]): OpportunityScore {
    const components: ScoreComponent[] = [];
    let missingEvidence: string[] = [];

    // Helper to add component
    const addComponent = (
      code: string,
      rawValue: number,
      weight: number,
      evidence: string[]
    ) => {
      const normalizedValue = Math.min(Math.max(rawValue, 0), 100);
      const contribution = (normalizedValue * weight);
      components.push({
        code,
        rawValue,
        normalizedValue,
        weight,
        contribution,
        evidence,
      });
      if (evidence.length === 0) {
        missingEvidence.push(code);
      }
    };

    // 1. Pain Intensity
    let painIntensity = 0;
    let painEvidence: string[] = [];
    if (input.dossier?.painPoints && input.dossier.painPoints.length > 0) {
      painIntensity = Math.max(...input.dossier.painPoints.map((p) => p.intensity));
      painEvidence.push(`Highest pain intensity is ${painIntensity}`);
    }
    addComponent('painIntensity', painIntensity, SCORING_WEIGHTS.painIntensity, painEvidence);

    // 2. Urgency
    addComponent(
      'urgency',
      input.dossier?.urgencyLevel ?? 0,
      SCORING_WEIGHTS.urgency,
      input.dossier ? [`Urgency level recorded at ${input.dossier.urgencyLevel}`] : []
    );

    // 3. Aura Fit (Transformation Opportunity)
    addComponent(
      'auraFit',
      input.dossier?.transformationOpportunity ?? 0,
      SCORING_WEIGHTS.auraFit,
      input.dossier ? [`Transformation opportunity score: ${input.dossier.transformationOpportunity}`] : []
    );

    // 4. Economic Potential
    let economicScore = 0;
    let economicEvidence: string[] = [];
    if (input.prospectMetadata.economicPotential.amount) {
      // Very naive normalization just for structure
      economicScore = Math.min(input.prospectMetadata.economicPotential.confidence, 100);
      economicEvidence.push(`Economic potential confidence is ${economicScore}% based on ${input.prospectMetadata.economicPotential.source}`);
    }
    addComponent('economicPotential', economicScore, SCORING_WEIGHTS.economicPotential, economicEvidence);

    // 5. Diagnostic Confidence
    addComponent(
      'diagnosticConfidence',
      input.confidenceMatrix.diagnosticConfidence,
      SCORING_WEIGHTS.diagnosticConfidence,
      [`Matrix diagnostic confidence: ${input.confidenceMatrix.diagnosticConfidence}`]
    );

    // 6. Discovery Quality
    addComponent(
      'discoveryQuality',
      input.confidenceMatrix.discoveryQuality,
      SCORING_WEIGHTS.discoveryQuality,
      [`Matrix discovery quality: ${input.confidenceMatrix.discoveryQuality}`]
    );

    // 7. Digital Readiness (Digital Maturity)
    addComponent(
      'digitalReadiness',
      input.dossier?.digitalMaturity ?? 0,
      SCORING_WEIGHTS.digitalReadiness,
      input.dossier ? [`Digital maturity: ${input.dossier.digitalMaturity}`] : []
    );

    // 8. Implementation Feasibility (Readiness)
    addComponent(
      'implementationFeasibility',
      input.dossier?.implementationReadiness ?? 0,
      SCORING_WEIGHTS.implementationFeasibility,
      input.dossier ? [`Implementation readiness: ${input.dossier.implementationReadiness}`] : []
    );

    let baseTotal = components.reduce((sum, c) => sum + c.contribution, 0);

    // Penalties from Risks
    const penalties: ScoreComponent[] = [];
    let totalRiskPenaltyRatio = 0;

    risks.forEach(risk => {
      if (risk.impactOnScore > 0) {
        totalRiskPenaltyRatio += risk.impactOnScore;
        penalties.push({
          code: `RISK_PENALTY_${risk.code}`,
          rawValue: risk.impactOnScore,
          normalizedValue: risk.impactOnScore,
          weight: 0,
          contribution: -(baseTotal * risk.impactOnScore),
          evidence: risk.evidence
        });
      }
    });

    // Cap total penalty
    const effectivePenaltyRatio = Math.min(totalRiskPenaltyRatio, MAX_COMMERCIAL_RISK_PENALTY);
    const finalPenalty = baseTotal * effectivePenaltyRatio;
    const finalTotal = Math.max(baseTotal - finalPenalty, 0);

    // Overall confidence is minimum of diagnostic and discovery quality, scaled by missing evidence
    let overallConfidence = Math.min(
      input.confidenceMatrix.diagnosticConfidence,
      input.confidenceMatrix.discoveryQuality
    );
    if (missingEvidence.length > 0) {
      overallConfidence = Math.max(overallConfidence - (missingEvidence.length * 5), 0);
    }

    return {
      total: Math.round(finalTotal),
      confidence: Math.round(overallConfidence),
      components,
      missingEvidence,
      penalties,
      explanation: `Opportunity Score of ${Math.round(finalTotal)} derived from base score ${Math.round(baseTotal)} with a penalty of -${Math.round(finalPenalty)} due to commercial risks.`,
      version: COMMERCIAL_SCORING_VERSION
    };
  }
}
