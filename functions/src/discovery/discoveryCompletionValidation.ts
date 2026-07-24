import {
  DISCOVERY_CONVERSATION_DEFINITION_VERSION,
  DiscoveryHardRequirement,
  DiscoveryKnowledgeGap,
  DiscoveryRequiredField,
  calculateConversationMetrics,
  evaluateDiscoveryCompletionState,
  type ConversationMetrics,
  type DiscoveryCompletionState,
} from "./discoveryCompletionShared";

export {
  DISCOVERY_CONVERSATION_DEFINITION_VERSION,
  DiscoveryHardRequirement,
  DiscoveryKnowledgeGap,
  DiscoveryRequiredField,
  calculateConversationMetrics,
  evaluateDiscoveryCompletionState,
  type ConversationMetrics,
  type DiscoveryCompletionState,
};

export interface DiscoveryCompletionValidationInput {
  readonly dossierPayload: Readonly<Record<string, unknown>>;
  readonly linkData: Readonly<Record<string, unknown>>;
}

export interface DiscoveryCompletionValidationResult {
  readonly valid: boolean;
  readonly hardMissingFields: readonly string[];
  readonly evidenceGaps: readonly string[];
  readonly conversationMetrics: ConversationMetrics;
  readonly questionsAskedCount: number;
  readonly completionReason:
    | "REQUIRED_FIELDS_COMPLETE"
    | "BLOCKED_MISSING_REQUIRED_FIELDS";
  readonly missingRequiredFields: readonly string[];
  readonly conversationDefinitionVersion: typeof DISCOVERY_CONVERSATION_DEFINITION_VERSION;
}

export function validateDiscoveryCompletion(
  input: DiscoveryCompletionValidationInput,
): DiscoveryCompletionValidationResult {
  const dossierPayload = (input.dossierPayload as Record<string, unknown>) || {};
  const linkData = (input.linkData as Record<string, unknown>) || {};

  const state = evaluateDiscoveryCompletionState({
    dossierPayload,
    linkData,
  });

  const questionsAskedCount = Array.isArray(dossierPayload.conversationHistory)
    ? new Set(
        dossierPayload.conversationHistory
          .filter(
            (entry) =>
              entry &&
              typeof entry === "object" &&
              (entry as any).role === "aura" &&
              typeof (entry as any).content === "string" &&
              ((entry as any).content.includes("?") || (entry as any).content.includes("¿")),
          )
          .map((entry) => (entry as any).content.trim()),
      ).size
    : 0;

  return {
    valid: state.canComplete,
    hardMissingFields: state.hardMissingFields,
    evidenceGaps: state.optionalEvidenceGaps,
    conversationMetrics: state.conversationMetrics,
    questionsAskedCount,
    completionReason: state.canComplete
      ? "REQUIRED_FIELDS_COMPLETE"
      : "BLOCKED_MISSING_REQUIRED_FIELDS",
    missingRequiredFields: state.hardMissingFields,
    conversationDefinitionVersion: DISCOVERY_CONVERSATION_DEFINITION_VERSION,
  };
}
