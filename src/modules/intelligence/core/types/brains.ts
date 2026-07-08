import type SmartBusinessDossier from "../domain/SmartBusinessDossier";

// ----------------------------------------------------
// Core Intelligence Context Types
// ----------------------------------------------------

export interface IntelligenceContext {
  dossierId: string;
  businessName: string;
  taxId?: string;
  industry: string;
  sizeGroup: string;
  dossierSummary: string;
  relevantFacts: string[];
  financialSnapshot: {
    estimatedMrr: number;
    estimatedArr: number;
    annualRevenues?: number;
    financialHealthIndex: number;
  };
  hrSnapshot: {
    employeeCount: number;
    activePayrollCost?: number;
    regulatoryRiskScore: number;
  };
  operationalSnapshot: {
    locationsCount: number;
    criticalAssetsCount: number;
    operationalInefficiencyScore: number;
  };
  retrievedKnowledge: KnowledgeDocument[];
  timestamp: string;
}

// ----------------------------------------------------
// Knowledge Engine Contracts
// ----------------------------------------------------

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  source: string; // "pdf" | "manual" | "regulation" | "web" | "history"
  category: "hr" | "finance" | "legal" | "operations" | "general";
  tags: string[];
  indexedAt: string;
  score?: number;
}

export interface KnowledgeQueryResult {
  query: string;
  documents: KnowledgeDocument[];
  latencyMs: number;
}

export interface IKnowledgeEngine {
  queryKnowledge(query: string, category?: string, limit?: number): Promise<KnowledgeQueryResult>;
  indexDocument(doc: Omit<KnowledgeDocument, "id" | "indexedAt">): Promise<KnowledgeDocument>;
}

// ----------------------------------------------------
// Context Engine Contracts
// ----------------------------------------------------

export interface IContextEngine {
  buildContext(
    dossier: SmartBusinessDossier,
    query: string,
    category?: string
  ): Promise<IntelligenceContext>;
}

// ----------------------------------------------------
// Commercial Brain Contracts
// ----------------------------------------------------

export interface CommercialLeadQualification {
  score: number; // 0-100
  qualificationLabel: "MQL" | "SQL" | "DISQUALIFIED" | "NURTURE";
  conversionProbability: number; // 0-100
  estimatedValue: {
    oneTimeFee: number;
    mrr: number;
    arr: number;
  };
  qualificationReason: string;
  keyPainPoints: string[];
  suggestedSolutions: Array<{
    productName: string;
    suiteName: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }>;
}

export interface OutreachPitch {
  channel: "email" | "whatsapp" | "phone";
  subject?: string;
  body: string;
  callToAction: string;
  keySellingPoints: string[];
  objectionsToAnticipate: string[];
  suggestedResponses: string[];
}

export interface ICommercialBrain {
  qualifyLead(context: IntelligenceContext): Promise<CommercialLeadQualification>;
  generateOutreachPitch(
    context: IntelligenceContext,
    channel: "email" | "whatsapp" | "phone"
  ): Promise<OutreachPitch>;
}

// ----------------------------------------------------
// Business Assessment Brain Contracts
// ----------------------------------------------------

export interface DiagnosticGap {
  area: "payroll" | "compliance" | "benefits" | "attendance" | "operations" | "contracts";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  gapDescription: string;
  regulatoryImpact: string;
  estimatedFineCost?: number;
  remediationAction: string;
}

export interface AssessmentResult {
  digitalMaturityScore: number; // 0-100
  complianceHealthScore: number; // 0-100
  gapsIdentified: DiagnosticGap[];
  strengths: string[];
  opportunities: string[];
  recommendedModules: string[];
  executiveSummary: string;
}

export interface IBusinessAssessmentBrain {
  performDiagnostic(context: IntelligenceContext): Promise<AssessmentResult>;
}

// ----------------------------------------------------
// Proposal Brain Contracts
// ----------------------------------------------------

export interface ProposalItem {
  id: string;
  productName: string;
  suiteName: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  totalPrice: number;
  billingFrequency: "monthly" | "annually" | "one-time";
}

export interface ProposalTerms {
  currency: string;
  items: ProposalItem[];
  subtotal: number;
  discounts: number;
  taxes: number;
  totalMrr: number;
  totalOneTime: number;
  contractDurationMonths: number;
  paymentTerms: string;
  validUntil: string;
}

export interface ROIProjection {
  estimatedSavingsFirstYear: number;
  estimatedInefficiencyReductionPercentage: number;
  paybackPeriodMonths: number;
  fiveYearRoiPercentage: number;
  justifications: string[];
}

export interface IProposalBrain {
  generateProposalTerms(
    context: IntelligenceContext,
    assessment: AssessmentResult
  ): Promise<ProposalTerms>;
  projectROI(context: IntelligenceContext, terms: ProposalTerms): Promise<ROIProjection>;
}

// ----------------------------------------------------
// Customer Success Brain Contracts
// ----------------------------------------------------

export interface ChurnRiskFactor {
  indicator: string;
  impactScore: number; // 1-10
  details: string;
}

export interface RetentionAnalysis {
  customerHealthScore: number; // 0-100
  churnProbability: number; // 0-100
  riskCategory: "RED" | "YELLOW" | "GREEN";
  riskFactors: ChurnRiskFactor[];
  recommendedActionPlan: string[];
}

export interface ExpansionOpportunity {
  type: "CROSS_SELL" | "UP_SELL" | "ADDON";
  productName: string;
  suiteName: string;
  estimatedAdditionalMrr: number;
  triggerEvent: string;
  conversionStrategy: string;
}

export interface ICustomerSuccessBrain {
  evaluateRetention(context: IntelligenceContext): Promise<RetentionAnalysis>;
  identifyExpansionOpportunities(context: IntelligenceContext): Promise<ExpansionOpportunity[]>;
}

// ----------------------------------------------------
// Recommendation Engine Contracts
// ----------------------------------------------------

export interface RecommendationAction {
  id: string;
  priorityScore: number; // 0-100
  priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "sales" | "compliance" | "operations" | "success" | "billing";
  title: string;
  description: string;
  suggestedAction: string;
  associatedBrain: "commercial" | "assessment" | "proposal" | "success";
  metadata?: Record<string, unknown>;
}

export interface ExecutiveIntelligenceDashboard {
  dossierId: string;
  overallHealthScore: number; // 0-100
  estimatedPotentialValue: number; // estimated financial MRR impact
  primaryGapsCount: number;
  prioritizedActions: RecommendationAction[];
  lastUpdated: string;
}

export interface IRecommendationEngine {
  generateActionDashboard(context: IntelligenceContext): Promise<ExecutiveIntelligenceDashboard>;
}

const Brains = {};
export default Brains;
