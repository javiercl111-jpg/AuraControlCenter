export const CommercialPriority = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type CommercialPriority = typeof CommercialPriority[keyof typeof CommercialPriority];

export const NextBestAction = {
  CALL_NOW: 'CALL_NOW',
  SEND_RADIOGRAPHY: 'SEND_RADIOGRAPHY',
  SCHEDULE_TECHNICAL_DISCOVERY: 'SCHEDULE_TECHNICAL_DISCOVERY',
  SCHEDULE_PRESENTATION: 'SCHEDULE_PRESENTATION',
  REQUEST_MORE_INFORMATION: 'REQUEST_MORE_INFORMATION',
  WAIT_FOR_RESPONSE: 'WAIT_FOR_RESPONSE',
  PRESENT_HCM: 'PRESENT_HCM',
  PRESENT_MAINTENANCE: 'PRESENT_MAINTENANCE',
  PRESENT_SUITE: 'PRESENT_SUITE',
  HOLD: 'HOLD',
} as const;
export type NextBestAction = typeof NextBestAction[keyof typeof NextBestAction];

export const CommercialRiskCode = {
  EXISTING_ERP: 'EXISTING_ERP',
  LIMITED_BUDGET: 'LIMITED_BUDGET',
  INSUFFICIENT_INFORMATION: 'INSUFFICIENT_INFORMATION',
  UNKNOWN_DECISION_MAKER: 'UNKNOWN_DECISION_MAKER',
  IMMATURE_PROJECT: 'IMMATURE_PROJECT',
  LOW_URGENCY: 'LOW_URGENCY',
  COMPLEX_ORGANIZATION: 'COMPLEX_ORGANIZATION',
  STRONG_COMPETITION: 'STRONG_COMPETITION',
} as const;
export type CommercialRiskCode = typeof CommercialRiskCode[keyof typeof CommercialRiskCode];

export const CommercialOpportunityCode = {
  DIGITALIZATION: 'DIGITALIZATION',
  PEOPLE_OPERATIONS: 'PEOPLE_OPERATIONS',
  PAYROLL: 'PAYROLL',
  OPERATIONS: 'OPERATIONS',
  MAINTENANCE: 'MAINTENANCE',
  ELECTRONIC_SIGNATURE: 'ELECTRONIC_SIGNATURE',
  AUTOMATION: 'AUTOMATION',
  AI: 'AI',
  BUSINESS_INTELLIGENCE: 'BUSINESS_INTELLIGENCE',
  AURA_SUITES: 'AURA_SUITES',
} as const;
export type CommercialOpportunityCode = typeof CommercialOpportunityCode[keyof typeof CommercialOpportunityCode];

export const RecommendedPresentation = {
  HCM_ONLY: 'HCM_ONLY',
  MAINTENANCE_ONLY: 'MAINTENANCE_ONLY',
  SIGNATURE_ONLY: 'SIGNATURE_ONLY',
  HCM_PLUS_INTELLIGENCE: 'HCM_PLUS_INTELLIGENCE',
  MAINTENANCE_PLUS_INTELLIGENCE: 'MAINTENANCE_PLUS_INTELLIGENCE',
  FULL_SUITE: 'FULL_SUITE',
  ADDITIONAL_DISCOVERY: 'ADDITIONAL_DISCOVERY',
} as const;
export type RecommendedPresentation = typeof RecommendedPresentation[keyof typeof RecommendedPresentation];

export const RecommendedTiming = {
  IMMEDIATE: 'IMMEDIATE',
  TODAY: 'TODAY',
  WITHIN_48_HOURS: 'WITHIN_48_HOURS',
  THIS_WEEK: 'THIS_WEEK',
  WAIT: 'WAIT',
  NOT_READY: 'NOT_READY',
} as const;
export type RecommendedTiming = typeof RecommendedTiming[keyof typeof RecommendedTiming];

export const RecommendedChannel = {
  CALL: 'CALL',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  VIDEO_MEETING: 'VIDEO_MEETING',
  IN_PERSON: 'IN_PERSON',
  NONE: 'NONE',
} as const;
export type RecommendedChannel = typeof RecommendedChannel[keyof typeof RecommendedChannel];

export const CommercialJourneyState = {
  DISCOVERY_NOT_SENT: 'DISCOVERY_NOT_SENT',
  DISCOVERY_SENT: 'DISCOVERY_SENT',
  DISCOVERY_IN_PROGRESS: 'DISCOVERY_IN_PROGRESS',
  DISCOVERY_COMPLETED: 'DISCOVERY_COMPLETED',
  ASSESSMENT_READY: 'ASSESSMENT_READY',
  RADIOGRAPHY_READY: 'RADIOGRAPHY_READY',
  BRIEFING_READY: 'BRIEFING_READY',
  MEETING_PENDING: 'MEETING_PENDING',
  DEMO_PENDING: 'DEMO_PENDING',
  PROPOSAL_PENDING: 'PROPOSAL_PENDING',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
  ON_HOLD: 'ON_HOLD',
} as const;
export type CommercialJourneyState = typeof CommercialJourneyState[keyof typeof CommercialJourneyState];

export const TimelineStageStatus = {
  NOT_STARTED: 'NOT_STARTED',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
  SKIPPED: 'SKIPPED',
} as const;
export type TimelineStageStatus = typeof TimelineStageStatus[keyof typeof TimelineStageStatus];

export const TimelineStage = {
  DISCOVERY: 'DISCOVERY',
  ASSESSMENT: 'ASSESSMENT',
  RADIOGRAPHY: 'RADIOGRAPHY',
  EXECUTIVE_BRIEFING: 'EXECUTIVE_BRIEFING',
  MEETING: 'MEETING',
  DEMO: 'DEMO',
  PROPOSAL: 'PROPOSAL',
  NEGOTIATION: 'NEGOTIATION',
  CLIENT: 'CLIENT',
} as const;
export type TimelineStage = typeof TimelineStage[keyof typeof TimelineStage];
