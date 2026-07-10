import {
  CommercialPriority,
  NextBestAction,
  CommercialRiskCode,
  CommercialOpportunityCode,
  RecommendedPresentation,
  RecommendedTiming,
  RecommendedChannel,
  TimelineStage,
  TimelineStageStatus,
} from './codes';

export interface ScoreComponent {
  code: string;
  rawValue: number;
  normalizedValue: number;
  weight: number;
  contribution: number;
  evidence: string[];
}

export interface OpportunityScore {
  total: number;
  confidence: number;
  components: ScoreComponent[];
  missingEvidence: string[];
  penalties: ScoreComponent[];
  explanation: string;
  version: string;
}

export interface CommercialAction {
  code: NextBestAction;
  rationale: string;
  confidence: number;
}

export interface CommercialRisk {
  code: CommercialRiskCode;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  evidence: string[];
  mitigation: string;
  impactOnScore: number;
}

export interface CommercialOpportunity {
  code: CommercialOpportunityCode;
  confidence: number;
  evidence: string[];
  businessImpact: string;
  relevantAuraCapabilities: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MeetingAgendaItem {
  order: number;
  topic: string;
  description: string;
}

export interface ProbabilityOfClosing {
  probability: number;
  confidence: number;
  positiveSignals: string[];
  negativeSignals: string[];
  missingSignals: string[];
  explanation: string;
}

export interface CommercialTimelineStage {
  stage: TimelineStage;
  status: TimelineStageStatus;
  completedAt?: string;
  recommendedAt?: string;
  blockingReasons: string[];
  nextRequiredEvidence: string[];
  source: string;
}

export interface CommercialTimeline {
  stages: CommercialTimelineStage[];
}

export interface CommercialDecisionOutput {
  opportunityScore: OpportunityScore;
  priority: CommercialPriority;
  action: CommercialAction;
  timing: RecommendedTiming;
  channel: RecommendedChannel;
  risks: CommercialRisk[];
  opportunities: CommercialOpportunity[];
  meetingAgenda: MeetingAgendaItem[];
  recommendedPresentation: RecommendedPresentation;
  probabilityOfClosing: ProbabilityOfClosing;
  timeline: CommercialTimeline;
  justification: string;
}
