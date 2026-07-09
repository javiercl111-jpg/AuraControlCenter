import type { ConversationMessage, SmartBusinessDossierPartial, EngineInput, EngineOutput } from "./conversation.types";
import type { ReflectionState, ReflectionOutput, ConfidenceMatrix } from "./reflection.types";

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
}

export interface OrchestratorInput {
  engineInput: EngineInput;
  conversationStateSnapshot: ConversationStateSnapshot;
  reflectionState: ReflectionState;
  confidenceMatrix: ConfidenceMatrix;
}

export interface OrchestratorOutput {
  finalMessage: string;
  finalIntent: string;
  reflectionOutput: ReflectionOutput;
  conversationOutput?: EngineOutput;
  personalityDecision: any; // Type handled by AuraPersonality implicitly or explicitly
  shouldAdvance: boolean;
  shouldPersistEvidence: boolean;
  shouldComplete: boolean;
  updatedConversationPhase: ConversationPhase;
  updatedReflectionState: ReflectionState;
  updatedConfidenceMatrix: ConfidenceMatrix;
  pendingSummary?: PendingSummary;
}

const OrchestratorTypes = {};
export default OrchestratorTypes;
