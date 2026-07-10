import type { CommercialDecisionInput } from '../types';
import { NextBestAction } from '../types';

export class QualityGates {
  static evaluate(
    input: CommercialDecisionInput, 
    proposedAction: NextBestAction
  ): { action: NextBestAction, rationale: string, confidence: number } {
    
    const minDiagnosticConfidence = 50;
    const minDiscoveryQuality = 60;

    // Gate 1: Insufficient Diagnostic Confidence
    if (input.confidenceMatrix.diagnosticConfidence < minDiagnosticConfidence) {
      if (proposedAction === NextBestAction.PRESENT_HCM || proposedAction === NextBestAction.PRESENT_MAINTENANCE || proposedAction === NextBestAction.PRESENT_SUITE) {
        return {
          action: NextBestAction.REQUEST_MORE_INFORMATION,
          rationale: `Diagnostic confidence (${input.confidenceMatrix.diagnosticConfidence}) is below the minimum threshold (${minDiagnosticConfidence}) to recommend a presentation.`,
          confidence: 80
        };
      }
    }

    // Gate 2: Insufficient Discovery Quality
    if (input.confidenceMatrix.discoveryQuality < minDiscoveryQuality) {
       if (proposedAction !== NextBestAction.REQUEST_MORE_INFORMATION && proposedAction !== NextBestAction.SCHEDULE_TECHNICAL_DISCOVERY && proposedAction !== NextBestAction.HOLD) {
         return {
           action: NextBestAction.SCHEDULE_TECHNICAL_DISCOVERY,
           rationale: `Discovery quality (${input.confidenceMatrix.discoveryQuality}) is too low to proceed with the proposed action. A technical discovery is required.`,
           confidence: 85
         };
       }
    }

    // Gate 3: Unresolved Contradictions
    if (input.reflectionSummary?.contradictions && input.reflectionSummary.contradictions.length > 0) {
      if (proposedAction === NextBestAction.PRESENT_HCM || proposedAction === NextBestAction.PRESENT_SUITE) {
        return {
          action: NextBestAction.REQUEST_MORE_INFORMATION,
          rationale: 'There are unresolved contradictions in the reflection summary that must be clarified before presenting a solution.',
          confidence: 90
        };
      }
    }

    // Default: Approved by gates
    return {
      action: proposedAction,
      rationale: 'Passed all quality gates.',
      confidence: 95
    };
  }
}
