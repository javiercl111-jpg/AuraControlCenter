import { CommercialJourneyState } from './codes';

export interface EconomicPotential {
  amount: number | null;
  currency: 'MXN' | 'USD';
  period: 'MONTHLY' | 'ANNUAL' | 'UNKNOWN';
  source: string;
  confidence: number;
}

export interface ProspectMetadata {
  industria: string;
  tamaño: string; // e.g. "50-100", "Micro"
  estado: string; // e.g. "Ciudad de México"
  economicPotential: EconomicPotential;
  scoreProspectIntelligence?: number;
  origenDelProspecto: string;
}

// Stubs for external types to avoid coupling
export interface SmartBusinessDossier {
  businessName: string;
  description: string;
  digitalMaturity: number; // 0-100
  transformationOpportunity: number; // 0-100
  implementationReadiness: number; // 0-100
  painPoints: Array<{ description: string; intensity: number }>; // intensity 0-100
  urgencyLevel: number; // 0-100
}

export interface ExecutiveBriefingDraft {
  summary: string;
  keyFindings: string[];
}

export interface BusinessAssessmentDraft {
  areasOfImprovement: string[];
  readinessScore: number;
}

export interface RadiografiaEmpresarialDraft {
  financialHealth?: string;
  operationalEfficiency?: string;
}

export interface SalesAdvisorContext {
  advisorId: string;
  advisorName: string;
  notes: string;
}

export interface ConversationSummary {
  topicsDiscussed: string[];
  sentiment: string;
}

export interface ReflectionSummary {
  insights: string[];
  contradictions: string[];
}

export interface ConfidenceMatrix {
  diagnosticConfidence: number; // 0-100
  discoveryQuality: number; // 0-100
  dataCompleteness: number; // 0-100
}

export interface CommercialDecisionInput {
  dossier?: SmartBusinessDossier;
  briefingDraft?: ExecutiveBriefingDraft;
  assessmentDraft?: BusinessAssessmentDraft;
  radiografiaDraft?: RadiografiaEmpresarialDraft;
  advisorContext?: SalesAdvisorContext;
  conversationSummary?: ConversationSummary;
  reflectionSummary?: ReflectionSummary;
  confidenceMatrix: ConfidenceMatrix;
  prospectMetadata: ProspectMetadata;
  journeyState: CommercialJourneyState;
}
