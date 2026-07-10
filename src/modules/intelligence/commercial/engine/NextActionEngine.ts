import type { 
  CommercialDecisionInput, 
  OpportunityScore
} from '../types';
import {
  CommercialJourneyState,
  NextBestAction,
  CommercialPriority,
  RecommendedTiming,
  RecommendedChannel,
  RecommendedPresentation
} from '../types';
import { QualityGates } from './QualityGates';

export class NextActionEngine {
  static evaluate(
    input: CommercialDecisionInput,
    score: OpportunityScore
  ): {
    action: NextBestAction;
    rationale: string;
    confidence: number;
    priority: CommercialPriority;
    timing: RecommendedTiming;
    channel: RecommendedChannel;
    presentation: RecommendedPresentation;
  } {
    let proposedAction: NextBestAction = NextBestAction.HOLD;
    let rationale = '';
    let priority: CommercialPriority = CommercialPriority.LOW;
    let timing: RecommendedTiming = RecommendedTiming.WAIT;
    let channel: RecommendedChannel = RecommendedChannel.NONE;
    let presentation: RecommendedPresentation = RecommendedPresentation.ADDITIONAL_DISCOVERY;

    // Determine initial priority based on score total
    if (score.total >= 80) {
      priority = CommercialPriority.CRITICAL;
    } else if (score.total >= 60) {
      priority = CommercialPriority.HIGH;
    } else if (score.total >= 40) {
      priority = CommercialPriority.MEDIUM;
    } else {
      priority = CommercialPriority.LOW;
    }

    // Determine Base Action and Timing based on Journey State and Score
    switch (input.journeyState) {
      case CommercialJourneyState.DISCOVERY_COMPLETED:
        proposedAction = NextBestAction.SEND_RADIOGRAPHY;
        rationale = 'Discovery is complete, the next logical step is to send the radiography to validate findings.';
        timing = RecommendedTiming.TODAY;
        channel = RecommendedChannel.EMAIL;
        break;

      case CommercialJourneyState.RADIOGRAPHY_READY:
        if (score.total > 60) {
          proposedAction = NextBestAction.SCHEDULE_PRESENTATION;
          rationale = 'Radiography is ready and the opportunity score is high enough to present a solution.';
          timing = RecommendedTiming.WITHIN_48_HOURS;
          channel = RecommendedChannel.CALL;
        } else {
          proposedAction = NextBestAction.REQUEST_MORE_INFORMATION;
          rationale = 'Radiography is ready but opportunity score is low, need to clarify value before presenting.';
          timing = RecommendedTiming.THIS_WEEK;
          channel = RecommendedChannel.EMAIL;
        }
        break;

      case CommercialJourneyState.MEETING_PENDING:
      case CommercialJourneyState.BRIEFING_READY:
        proposedAction = NextBestAction.PRESENT_SUITE;
        rationale = 'Meeting is pending or briefing is ready, time to present the capabilities.';
        timing = RecommendedTiming.IMMEDIATE;
        channel = RecommendedChannel.VIDEO_MEETING;
        
        // Determine presentation focus
        if (input.dossier?.painPoints.some(p => p.description.toLowerCase().includes('nómina'))) {
          presentation = RecommendedPresentation.HCM_PLUS_INTELLIGENCE;
        } else if (input.prospectMetadata.industria.toLowerCase().includes('manufactura')) {
          presentation = RecommendedPresentation.MAINTENANCE_PLUS_INTELLIGENCE;
        } else {
          presentation = RecommendedPresentation.FULL_SUITE;
        }
        break;

      case CommercialJourneyState.WON:
      case CommercialJourneyState.LOST:
        proposedAction = NextBestAction.HOLD;
        rationale = 'The commercial journey has reached a terminal state.';
        timing = RecommendedTiming.NOT_READY;
        channel = RecommendedChannel.NONE;
        break;
        
      default:
        proposedAction = NextBestAction.REQUEST_MORE_INFORMATION;
        rationale = 'Insufficient state progression to recommend a closing action.';
        timing = RecommendedTiming.THIS_WEEK;
        channel = RecommendedChannel.EMAIL;
        break;
    }

    // Run through Quality Gates to adjust action if needed
    const gateResult = QualityGates.evaluate(input, proposedAction);
    if (gateResult.action !== proposedAction) {
      // The gate blocked or changed the action
      proposedAction = gateResult.action;
      rationale = gateResult.rationale;
      // Adjust timing/channel for fallback
      timing = RecommendedTiming.THIS_WEEK;
      channel = RecommendedChannel.EMAIL;
    }

    return {
      action: proposedAction,
      rationale,
      confidence: gateResult.confidence,
      priority,
      timing,
      channel,
      presentation
    };
  }
}
