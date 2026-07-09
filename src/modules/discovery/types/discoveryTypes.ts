export interface DiscoveryLink {
  id: string; // e.g. "8QF2L"
  companyName: string;
  contactName: string;
  createdAt: any;
  createdBy: string;
  status: "pending" | "completed";
  dossierId: string;
}

export interface SmartBusinessDossier {
  industry: string;
  employees: number;
  schedulingMethod: string;
  payrollIncidents: boolean;
  priority: string;
}

export interface ExecutiveBriefingDraft {
  summary: string;
  keyObservations: string[];
  suggestedNextSteps: string[];
}

export interface BusinessAssessmentDraft {
  score: number;
  painPointsIdentified: string[];
  processGaps: string[];
}

export interface RadiografiaEmpresarialDraft {
  overallStatus: string;
  recommendedModules: string[];
  potentialSavings: string;
}

export interface SalesAdvisorContext {
  recommendedOpeningLine: string;
  alertFlags: string[];
  qualificationStatus: string;
}

export interface DiscoverySession {
  id: string; // matches dossierId
  linkId: string;
  companyName: string;
  contactName: string;
  answers: Record<string, string>;
  dossier: SmartBusinessDossier;
  executiveBriefingDraft: ExecutiveBriefingDraft;
  businessAssessmentDraft: BusinessAssessmentDraft;
  radiografiaEmpresarialDraft: RadiografiaEmpresarialDraft;
  salesAdvisorContext: SalesAdvisorContext;
  createdAt: any;
  completedAt?: any;
}

export interface QuestionStep {
  id: string;
  text: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  inputType: "text" | "choice";
}

export interface AuraThoughtState {
  hypothesis: string;
  confidence: number; // 0 to 100
  nextSteps: string;
}

const DiscoveryTypes = {};
export default DiscoveryTypes;
