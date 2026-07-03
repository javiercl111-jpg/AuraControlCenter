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
  createdAt?: unknown;
  updatedAt?: unknown;
}