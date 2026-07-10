import type { CommercialDecisionInput, CommercialRisk, OpportunityScore, ScoreComponent } from '../types';
import { COMMERCIAL_SCORING_VERSION, SCORING_WEIGHTS, MAX_COMMERCIAL_RISK_PENALTY } from '../config';
import { toFiniteNumber } from '../utils/numbers';

export class OpportunityScoreCalculator {
  static calculate(input: CommercialDecisionInput, risks: CommercialRisk[]): OpportunityScore {
    const components: ScoreComponent[] = [];
    let missingEvidence: string[] = [];

    // Helper to add component
    const addComponent = (
      code: string,
      rawValue: unknown,
      weight: number,
      evidence: string[]
    ) => {
      const finiteRawValue = toFiniteNumber(rawValue, 0);
      const finiteWeight = toFiniteNumber(weight, 0);
      const normalizedValue = Math.min(Math.max(finiteRawValue, 0), 100);
      const contribution = toFiniteNumber(normalizedValue * finiteWeight, 0);
      components.push({
        code,
        rawValue: finiteRawValue,
        normalizedValue,
        weight: finiteWeight,
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
      const intensities = input.dossier.painPoints.map((p) => toFiniteNumber(p.intensity, 0));
      if (intensities.length > 0) {
        painIntensity = Math.max(...intensities);
      }
      painEvidence.push(`Highest pain intensity is ${painIntensity}`);
    }
    addComponent('painIntensity', painIntensity, SCORING_WEIGHTS.painIntensity, painEvidence);

    // 2. Urgency
    addComponent(
      'urgency',
      input.dossier?.urgencyLevel,
      SCORING_WEIGHTS.urgency,
      input.dossier?.urgencyLevel != null ? [`Urgency level recorded at ${input.dossier.urgencyLevel}`] : []
    );

    // 3. Aura Fit (Transformation Opportunity)
    addComponent(
      'auraFit',
      input.dossier?.transformationOpportunity,
      SCORING_WEIGHTS.auraFit,
      input.dossier?.transformationOpportunity != null ? [`Transformation opportunity score: ${input.dossier.transformationOpportunity}`] : []
    );

    // 4. Economic Potential
    let economicScore = 0;
    let economicEvidence: string[] = [];
    if (input.prospectMetadata.economicPotential.amount === null || input.prospectMetadata.economicPotential.amount === undefined) {
      missingEvidence.push('ECONOMIC_POTENTIAL_MISSING');
      addComponent('economicPotential', 0, 0, economicEvidence);
    } else {
      economicScore = Math.min(toFiniteNumber(input.prospectMetadata.economicPotential.confidence, 0), 100);
      economicEvidence.push(`Economic potential confidence is ${economicScore}% based on ${input.prospectMetadata.economicPotential.source}`);
      addComponent('economicPotential', economicScore, SCORING_WEIGHTS.economicPotential, economicEvidence);
    }

    // 5. Diagnostic Confidence
    addComponent(
      'diagnosticConfidence',
      input.confidenceMatrix?.diagnosticConfidence,
      SCORING_WEIGHTS.diagnosticConfidence,
      input.confidenceMatrix?.diagnosticConfidence != null ? [`Matrix diagnostic confidence: ${input.confidenceMatrix.diagnosticConfidence}`] : []
    );

    // 6. Discovery Quality
    addComponent(
      'discoveryQuality',
      input.confidenceMatrix?.discoveryQuality,
      SCORING_WEIGHTS.discoveryQuality,
      input.confidenceMatrix?.discoveryQuality != null ? [`Matrix discovery quality: ${input.confidenceMatrix.discoveryQuality}`] : []
    );

    // 7. Digital Readiness (Digital Maturity)
    addComponent(
      'digitalReadiness',
      input.dossier?.digitalMaturity,
      SCORING_WEIGHTS.digitalReadiness,
      input.dossier?.digitalMaturity != null ? [`Digital maturity: ${input.dossier.digitalMaturity}`] : []
    );

    // 8. Implementation Feasibility (Readiness)
    addComponent(
      'implementationFeasibility',
      input.dossier?.implementationReadiness,
      SCORING_WEIGHTS.implementationFeasibility,
      input.dossier?.implementationReadiness != null ? [`Implementation readiness: ${input.dossier.implementationReadiness}`] : []
    );

    let baseTotal = toFiniteNumber(components.reduce((sum, c) => sum + c.contribution, 0));

    // Penalties from Risks
    const penalties: ScoreComponent[] = [];
    let totalRiskPenaltyRatio = 0;

    risks.forEach(risk => {
      const impact = toFiniteNumber(risk.impactOnScore, 0);
      if (impact > 0) {
        totalRiskPenaltyRatio += impact;
        penalties.push({
          code: `RISK_PENALTY_${risk.code}`,
          rawValue: impact,
          normalizedValue: impact,
          weight: 0,
          contribution: toFiniteNumber(-(baseTotal * impact)),
          evidence: risk.evidence
        });
      }
    });

    // Cap total penalty
    const finiteMaxPenalty = toFiniteNumber(MAX_COMMERCIAL_RISK_PENALTY, 0);
    const effectivePenaltyRatio = Math.min(toFiniteNumber(totalRiskPenaltyRatio), finiteMaxPenalty);
    const finalPenalty = toFiniteNumber(baseTotal * effectivePenaltyRatio);
    let finalTotal = Math.max(baseTotal - finalPenalty, 0);
    finalTotal = Math.min(toFiniteNumber(finalTotal), 100);

    // Overall confidence is minimum of diagnostic and discovery quality, scaled by missing evidence
    const diagConf = toFiniteNumber(input.confidenceMatrix?.diagnosticConfidence, 0);
    const discQual = toFiniteNumber(input.confidenceMatrix?.discoveryQuality, 0);
    let overallConfidence = Math.min(diagConf, discQual);
    
    if (missingEvidence.length > 0) {
      overallConfidence = Math.max(overallConfidence - (missingEvidence.length * 5), 0);
    }
    overallConfidence = Math.min(toFiniteNumber(overallConfidence), 100);

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
