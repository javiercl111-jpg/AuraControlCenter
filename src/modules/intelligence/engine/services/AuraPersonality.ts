import type { PersonalityConfig, PersonalityDecision } from "../types/personality.types";

export class AuraPersonality {
  private config: PersonalityConfig;

  constructor(config?: Partial<PersonalityConfig>) {
    this.config = {
      tone: "consultative",
      principles: [
        "Be empathetic to business challenges",
        "Maintain a professional yet approachable tone",
        "Guide the user towards discovering process gaps",
      ],
      maxFollowUpQuestions: 4,
      confidenceThresholdForSummary: 85,
      ...config,
    };
  }

  public evaluateContext(
    historyLength: number,
    currentConfidence: number,
    hypothesesCount: number
  ): PersonalityDecision {
    // Basic heuristics for personality-driven conversation control
    const isConfident = currentConfidence >= this.config.confidenceThresholdForSummary;
    const isGettingLong = historyLength >= this.config.maxFollowUpQuestions * 2; // user + aura messages

    const shouldSummarize = isConfident || (isGettingLong && currentConfidence >= 60);
    const shouldStop = isConfident && isGettingLong;
    const shouldConfirmHypothesis = !isConfident && hypothesesCount > 0 && historyLength > 2;
    const shouldDeepen = !shouldSummarize && !shouldStop && !shouldConfirmHypothesis;

    let recommendedTone = "investigative";
    let pacingAdvice = "continue querying";

    if (shouldSummarize) {
      recommendedTone = "authoritative-consultative";
      pacingAdvice = "prepare to present findings";
    } else if (shouldConfirmHypothesis) {
      recommendedTone = "validating";
      pacingAdvice = "ask direct confirmation questions";
    } else if (shouldDeepen) {
      recommendedTone = "empathetic-curious";
      pacingAdvice = "explore pain points further";
    }

    // Override based on base config tone
    if (this.config.tone === "professional") {
      recommendedTone = "objective and clear";
    }

    return {
      shouldSummarize,
      shouldDeepen,
      shouldStop,
      shouldConfirmHypothesis,
      recommendedTone,
      pacingAdvice,
    };
  }

  public getConfig(): PersonalityConfig {
    return this.config;
  }
}

export default AuraPersonality;
