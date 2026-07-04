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