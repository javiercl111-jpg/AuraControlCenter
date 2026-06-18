export type LeadStage =
  | "NEW_LEAD"
  | "CONTACTED"
  | "DEMO_SCHEDULED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export interface PlatformLead {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  source: string;
  interestedModules: string[];
  estimatedValue: number;
  stage: LeadStage;
  notes: string;
  nextFollowUpDate?: string;
  convertedClientId?: string;
  convertedTenantId?: string;
  convertedAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}