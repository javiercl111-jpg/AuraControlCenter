import type { 
  CommercialDecisionInput, 
  CommercialTimeline,
  CommercialTimelineStage
} from '../types';
import {
  CommercialJourneyState,
  TimelineStage,
  TimelineStageStatus
} from '../types';

export class TimelineEngine {
  static generate(input: CommercialDecisionInput, currentDate: string = new Date().toISOString()): CommercialTimeline {
    const stages: CommercialTimelineStage[] = [];

    // Helper to determine status based on JourneyState
    const getStatusForStage = (targetStage: TimelineStage): TimelineStageStatus => {
      const state = input.journeyState;
      
      if (state === CommercialJourneyState.WON || state === CommercialJourneyState.LOST) {
        return TimelineStageStatus.COMPLETED;
      }

      // Simplified progression map
      const progression = [
        TimelineStage.DISCOVERY,
        TimelineStage.ASSESSMENT,
        TimelineStage.RADIOGRAPHY,
        TimelineStage.EXECUTIVE_BRIEFING,
        TimelineStage.MEETING,
        TimelineStage.DEMO,
        TimelineStage.PROPOSAL,
        TimelineStage.NEGOTIATION,
        TimelineStage.CLIENT
      ];

      // Define current stage index based on JourneyState
      let currentIndex = 0;
      switch (state) {
        case CommercialJourneyState.DISCOVERY_NOT_SENT:
        case CommercialJourneyState.DISCOVERY_SENT:
          currentIndex = 0; // DISCOVERY
          break;
        case CommercialJourneyState.DISCOVERY_IN_PROGRESS:
          currentIndex = 0;
          break;
        case CommercialJourneyState.DISCOVERY_COMPLETED:
          currentIndex = 1; // ASSESSMENT READY
          break;
        case CommercialJourneyState.ASSESSMENT_READY:
          currentIndex = 2; // RADIOGRAPHY READY
          break;
        case CommercialJourneyState.RADIOGRAPHY_READY:
          currentIndex = 3; // BRIEFING READY
          break;
        case CommercialJourneyState.BRIEFING_READY:
          currentIndex = 4; // MEETING PENDING
          break;
        case CommercialJourneyState.MEETING_PENDING:
          currentIndex = 4;
          break;
        case CommercialJourneyState.DEMO_PENDING:
          currentIndex = 5;
          break;
        case CommercialJourneyState.PROPOSAL_PENDING:
          currentIndex = 6;
          break;
        case CommercialJourneyState.NEGOTIATION:
          currentIndex = 7;
          break;
      }

      const targetIndex = progression.indexOf(targetStage);
      
      if (targetIndex < currentIndex) return TimelineStageStatus.COMPLETED;
      if (targetIndex === currentIndex) return TimelineStageStatus.READY;
      return TimelineStageStatus.NOT_STARTED;
    };

    const progression = [
      TimelineStage.DISCOVERY,
      TimelineStage.ASSESSMENT,
      TimelineStage.RADIOGRAPHY,
      TimelineStage.EXECUTIVE_BRIEFING,
      TimelineStage.MEETING,
      TimelineStage.DEMO,
      TimelineStage.PROPOSAL,
      TimelineStage.NEGOTIATION,
      TimelineStage.CLIENT
    ];

    progression.forEach(stage => {
      const status = getStatusForStage(stage);
      stages.push({
        stage,
        status,
        completedAt: status === TimelineStageStatus.COMPLETED ? currentDate : undefined, // simplified for stateless design
        recommendedAt: status === TimelineStageStatus.READY ? currentDate : undefined,
        blockingReasons: status === TimelineStageStatus.BLOCKED ? ['Waiting on preceding stage completion'] : [],
        nextRequiredEvidence: status === TimelineStageStatus.READY ? ['Proceed with current action'] : [],
        source: 'Aura Commercial Decision Engine'
      });
    });

    return { stages };
  }
}
