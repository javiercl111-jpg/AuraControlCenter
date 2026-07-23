import type { ConversationMessage, SmartBusinessDossierPartial, EngineInput, EngineOutput } from "./conversation.types";
import type { ReflectionState, ReflectionOutput, ConfidenceMatrix } from "./reflection.types";
import type { PersonalityDecision } from "./personality.types";

export type ConversationPhase = "DISCOVERY" | "SUMMARY_REVIEW" | "COMPLETED";

export interface PendingSummary {
  text: string;
  generatedAt: string;
  awaitingConfirmation: boolean;
}

export interface ConversationStateSnapshot {
  sessionId: string;
  companyName: string;
  industry: string;
  history: ConversationMessage[];
  hypotheses: string[];
  confidenceLevel: number;
  partialDossier: SmartBusinessDossierPartial;
  usefulResponsesCount: number;
  turnCount: number;
  askedIntents: string[];
  askedQuestions: string[];
  conversationPhase: ConversationPhase;
  pendingSummary?: PendingSummary;
  fallbackConsecutiveCount: number;
  lastFallbackCode?: string;
  lastFallbackMessage?: string;
  llmModeForSession: "SHADOW" | "HEURISTIC_ONLY";
  partialCompletionReason?: string;
}

export interface OrchestratorInput {
  engineInput: EngineInput;
  conversationStateSnapshot: ConversationStateSnapshot;
  reflectionState: ReflectionState;
  confidenceMatrix: ConfidenceMatrix;
}

export type DraftableConversationIntent = Extract<
  EngineOutput["nextIntent"],
  "DISCOVER_PROBLEM" | "CONFIRM_HYPOTHESIS"
>;

export interface ConversationDraftRequest {
  engineInput: Pick<
    EngineInput,
    | "companyName"
    | "industry"
    | "currentResponse"
    | "conversationHistory"
    | "partialDossier"
    | "confidenceLevel"
    | "askedQuestions"
  > & {
    confirmedFacts: string[];
    pendingHypotheses: string[];
    criticalMissingInformation: string[];
    discoveryObjective: string;
  };
  conversationPhase: "DISCOVERY";
  authoritativeIntent: DraftableConversationIntent;
  authoritativeQuestion: string;
}

export interface ConversationProposal {
  nextQuestion: string;
}

export interface ConversationEvaluationResult {
  ok: boolean;
  validationPassed: boolean;
  safetyPassed: boolean;
  intentCompatible: boolean;
  fallbackUsed: boolean;
  proposalSource?: "LLM" | "CONSULTATIVE_FALLBACK";
  authoritativeIntent?: string;
  conversationProposal?: ConversationProposal;
  safeErrorCode?: string;
  telemetry?: {
    provider?: string;
    model?: string;
    latencyMs?: number;
    promptVersion?: string;
    personalityVersion?: string;
    attempts?: number;
    hypothesisSimilarity?: number;
  };
}

export type FinalMessageSource =
  | "CONVERSATION_ENGINE"
  | "LLM_NEXT_QUESTION"
  | "CONSULTATIVE_FALLBACK";

export interface OrchestratorOutput {
  finalMessage: string;
  finalIntent: string;
  messageSource: FinalMessageSource;
  llmFallbackCode?: string;
  reflectionOutput: ReflectionOutput;
  conversationOutput?: EngineOutput;
  personalityDecision: Partial<PersonalityDecision>;
  shouldAdvance: boolean;
  shouldPersistEvidence: boolean;
  shouldComplete: boolean;
  updatedConversationPhase: ConversationPhase;
  updatedReflectionState: ReflectionState;
  updatedConfidenceMatrix: ConfidenceMatrix;
  pendingSummary?: PendingSummary;
  updatedFallbackCount?: number;
  updatedFallbackCode?: string;
  updatedFallbackMessage?: string;
  updatedLlmMode?: "SHADOW" | "HEURISTIC_ONLY";
  partialCompletionReason?: string;
}

const OrchestratorTypes = {};
export default OrchestratorTypes;
