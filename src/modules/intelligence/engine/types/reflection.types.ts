import type { ConversationMessage, SmartBusinessDossierPartial } from "./conversation.types";

export interface ReflectionEngineInput {
  currentResponse: string;
  conversationHistory: ConversationMessage[];
  activeHypotheses: string[];
  partialDossier: SmartBusinessDossierPartial;
  previousReflectionState: ReflectionState | null;
  currentIntent: string;
}

export interface ContradictionDetail {
  previousStatement: string;
  currentStatement: string;
  topic: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  suggestedClarification: string;
}

export interface DimensionAssessment {
  score: number; // 0-100
  evidenceCount: number;
  missingEvidence: string[];
  lastUpdatedAt: Date;
}

export interface ConfidenceMatrix {
  people: DimensionAssessment;
  operations: DimensionAssessment;
  compliance: DimensionAssessment;
  digitalization: DimensionAssessment;
  technology: DimensionAssessment;
  sales: DimensionAssessment;
  finance: DimensionAssessment;
  maintenance: DimensionAssessment;
}

export type RecommendedAction = "ACCEPT" | "CLARIFY" | "CHALLENGE" | "DEEPEN" | "SUMMARIZE" | "STOP";

export interface ReflectionOutput {
  hasContradiction: boolean;
  isAmbiguous: boolean;
  isTooShort: boolean;
  responseRelevance: number; // 0-100
  contradictionDetails: ContradictionDetail[];
  ambiguityReasons: string[];
  omittedTopics: string[];
  coherenceScore: number; // 0-100
  evidenceExtracted: string[];
  dimensionsUpdated: string[]; // e.g. ["operations", "technology"]
  suggestedClarification: string | null;
  recommendedAction: RecommendedAction;
  shouldDeepen: boolean;
  hasEnoughEvidence: boolean;
  internalReflection: string;
}

export interface ReflectionState {
  matrix: ConfidenceMatrix;
  extractedEvidenceTotal: string[];
  detectedContradictionsTotal: ContradictionDetail[];
  topicsCovered: string[];
}

export interface ReflectionSummary {
  overallCoherence: number;
  readinessScore: number;
  primaryGaps: string[];
  keyStrengths: string[];
  summaryText: string;
}

const ReflectionTypes = {};
export default ReflectionTypes;
