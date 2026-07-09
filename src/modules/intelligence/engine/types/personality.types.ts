export interface PersonalityConfig {
  tone: "professional" | "consultative" | "empathetic" | "direct";
  principles: string[];
  maxFollowUpQuestions: number;
  confidenceThresholdForSummary: number;
}

export interface PersonalityDecision {
  shouldSummarize: boolean;
  shouldDeepen: boolean;
  shouldStop: boolean;
  shouldConfirmHypothesis: boolean;
  recommendedTone: string;
  pacingAdvice: string;
}

const PersonalityTypes = {};
export default PersonalityTypes;
