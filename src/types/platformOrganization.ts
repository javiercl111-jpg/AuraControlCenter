export type ConsultingStage =
  | "DISCOVERY"
  | "DIAGNOSIS"
  | "SOLUTION"
  | "DEMO"
  | "PROPOSAL"
  | "IMPLEMENTATION"
  | "SUCCESS"
  | "AMBASSADOR";

export type ConsultingPriority = "LOW" | "MEDIUM" | "HIGH";

export type DiscoveryRequestStatus =
  | "NEW"
  | "IN_REVIEW"
  | "CONVERTED"
  | "DISCARDED";

export type DiagnosisUrgency = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type OrganizationTimelineEventType =
  | "DISCOVERY_REQUEST_RECEIVED"
  | "ORGANIZATION_CREATED"
  | "DISCOVERY_STARTED"
  | "CONSULTANT_ASSIGNED"
  | "DIAGNOSIS_RECORDED"
  | "STAGE_UPDATED";

export interface OrganizationTimelineEvent {
  id: string;
  type: OrganizationTimelineEventType;
  title: string;
  description: string;
  createdAt: unknown;
}

export interface OrganizationDiagnosis {
  painPoints: string;
  recommendedModules: string[];
  urgency: DiagnosisUrgency;
  estimatedBudget: string;
  nextAction: string;
  recordedAt?: unknown;
}

export interface PlatformOrganization {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  companySize: string;
  mainChallenge: string;
  interestAreas: string[];
  stage: ConsultingStage;
  priority: ConsultingPriority;
  recommendedNextStep: string;
  notes: string;
  source?: string;
  discoveryRequestId?: string;
  assignedConsultantId?: string;
  assignedConsultantName?: string;
  assignedConsultantEmail?: string;
  assignedAt?: unknown;
  diagnosis?: OrganizationDiagnosis;
  timeline?: OrganizationTimelineEvent[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlatformDiscoveryRequest {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  companySize: string;
  mainChallenge: string;
  interestAreas: string[];
  status: DiscoveryRequestStatus;
  stage: ConsultingStage;
  priority: ConsultingPriority;
  recommendedNextStep: string;
  notes: string;
  source: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  convertedAt?: unknown;
  convertedOrganizationId?: string;
}