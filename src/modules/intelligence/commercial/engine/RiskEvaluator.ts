import type { CommercialDecisionInput, CommercialRisk } from '../types';
import { CommercialRiskCode } from '../types';

export class RiskEvaluator {
  static evaluate(input: CommercialDecisionInput): CommercialRisk[] {
    const risks: CommercialRisk[] = [];

    // Rule 1: Unknown decision maker
    if (!input.advisorContext?.notes.toLowerCase().includes('decision maker') && !input.briefingDraft?.keyFindings.some(f => f.toLowerCase().includes('decision'))) {
      risks.push({
        code: CommercialRiskCode.UNKNOWN_DECISION_MAKER,
        severity: 'HIGH',
        confidence: 80,
        evidence: ['No explicit mention of decision maker in advisor notes or briefing findings.'],
        mitigation: 'Ask directly who is involved in the final purchasing decision.',
        impactOnScore: 0.05
      });
    }

    // Rule 2: Low Urgency
    if (input.dossier?.urgencyLevel !== undefined && input.dossier.urgencyLevel < 40) {
      risks.push({
        code: CommercialRiskCode.LOW_URGENCY,
        severity: 'MEDIUM',
        confidence: 90,
        evidence: [`Urgency level recorded at ${input.dossier.urgencyLevel}.`],
        mitigation: 'Focus on quantifying the cost of inaction during the next meeting.',
        impactOnScore: 0.03
      });
    }

    // Rule 3: Insufficient Information
    if (input.confidenceMatrix.dataCompleteness < 50) {
      risks.push({
        code: CommercialRiskCode.INSUFFICIENT_INFORMATION,
        severity: 'HIGH',
        confidence: 100,
        evidence: [`Data completeness is only ${input.confidenceMatrix.dataCompleteness}%.`],
        mitigation: 'Schedule a follow-up discovery session to fill information gaps.',
        impactOnScore: 0.08
      });
    }

    // Rule 4: Existing ERP
    if (input.conversationSummary?.topicsDiscussed.some(t => t.toLowerCase().includes('sap') || t.toLowerCase().includes('oracle') || t.toLowerCase().includes('erp'))) {
      risks.push({
        code: CommercialRiskCode.EXISTING_ERP,
        severity: 'MEDIUM',
        confidence: 70,
        evidence: ['Conversation topics suggest presence of an existing ERP system.'],
        mitigation: 'Identify integration capabilities and gaps in their current ERP.',
        impactOnScore: 0.02
      });
    }

    return risks;
  }
}
