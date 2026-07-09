export interface ConversationMessage {
  id: string;
  role: "user" | "aura" | "system";
  content: string;
  timestamp: Date;
}

export interface SmartBusinessDossierPartial {
  industry?: string;
  employees?: number;
  schedulingMethod?: string;
  payrollIncidents?: boolean;
  priority?: string;
  [key: string]: any;
}

export interface EngineInput {
  companyName: string;
  industry: string;
  context: Record<string, any>;
  currentResponse: string;
  conversationHistory: ConversationMessage[];
  hypotheses: string[];
  confidenceLevel: number;
  partialDossier: SmartBusinessDossierPartial;
}

export interface EngineOutput {
  nextIntent: "GREETING" | "DISCOVER_PROBLEM" | "CONFIRM_HYPOTHESIS" | "SUMMARIZE" | "CLOSING";
  nextQuestion: string;
  reason: string;
  newHypotheses: string[];
  discardedHypotheses: string[];
  updatedConfidence: number;
  internalSummary: string;
  updatedDossier: SmartBusinessDossierPartial;
}

const ConversationTypes = {};
export default ConversationTypes;
