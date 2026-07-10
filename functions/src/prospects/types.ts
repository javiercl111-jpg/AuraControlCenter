import * as admin from "firebase-admin";

export const PROSPECT_RESOLUTION_VERSION = "1.0";

export enum MatchClassification {
  EXACT_MATCH = "EXACT_MATCH",
  HIGH_CONFIDENCE = "HIGH_CONFIDENCE",
  POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE",
  NEW_COMPANY = "NEW_COMPANY",
}

export enum ProspectOrigin {
  CONTROL_CENTER = "CONTROL_CENTER",
  ADVISOR_SHARE = "ADVISOR_SHARE",
  WEBSITE = "WEBSITE",
  QR = "QR",
  EMAIL = "EMAIL",
  LINKEDIN = "LINKEDIN",
  REFERRAL = "REFERRAL",
  CAMPAIGN = "CAMPAIGN",
  EVENT = "EVENT",
  API = "API",
  UNKNOWN = "UNKNOWN",
}

export enum AcquisitionSource {
  GOOGLE = "GOOGLE",
  LINKEDIN = "LINKEDIN",
  WHATSAPP = "WHATSAPP",
  EMAIL = "EMAIL",
  QR = "QR",
  EVENT = "EVENT",
  REFERRAL = "REFERRAL",
  DIRECT = "DIRECT",
  OTHER = "OTHER",
  UNKNOWN = "UNKNOWN",
}

export enum DataConfidenceLevel {
  DISCOVERY_CONFIRMED = 100,
  ADVISOR_VALIDATED = 90,
  CRM = 80,
  DENUE = 70,
  INFERENCE = 60,
  LEGACY_IMPORT = 50,
}

export interface ProspectResolutionOutput {
  matchClassification: MatchClassification;
  matchScore: number;
  matchedProspectId?: string;
  matchedFields: string[];
  conflictingFields: string[];
  resolutionReason: string;
  matchStrategy: string;
  autoMergeAllowed: boolean;
  manualReviewRequired: boolean;
  duplicateRisk: boolean;
  possibleDuplicateIds?: string[];
  version: string;
}

export interface PlatformEvent {
  eventId: string;
  type: string; // PROSPECT_CREATED, PROSPECT_MERGED, POSSIBLE_DUPLICATE_DETECTED, etc.
  prospectId: string;
  linkId?: string;
  sessionId?: string;
  advisorId?: string;
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  actorType: "SYSTEM" | "ADVISOR" | "PROSPECT";
  source: string;
  metadata: any;
}

export interface PlatformLeadV2 {
  // Base
  id?: string;
  schemaVersion: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  rfc?: string;
  website?: string;
  location?: string;
  
  // Normalized for identity
  normalizedCompanyName: string;
  normalizedEmail: string;
  normalizedDomain: string;
  normalizedPhone: string;
  rfcNormalized: string;
  
  // Resolution Control
  resolutionStatus: "RESOLVED" | "REVIEW_REQUIRED";
  resolutionVersion: string;
  lastResolvedAt: admin.firestore.Timestamp | admin.firestore.FieldValue | null;
  duplicateRisk: boolean;
  possibleDuplicateIds: string[];
  
  // Dossier & Timeline
  smartBusinessDossierId?: string;
  timelineSummary?: string;
  lastActivityAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  lastActivityType?: string;
  currentStage: string;
  
  // Attribution (NEVER OVERWRITE original)
  originalAdvisorId: string;
  originalAdvisorUid: string;
  originalAttributionSource: string;
  originalAttributedAt: admin.firestore.Timestamp | admin.firestore.FieldValue | null;
  
  currentAdvisorId: string;
  currentAdvisorUid: string;
  ownerUid: string;
  ownerStatus: "ASSIGNED" | "UNASSIGNED";
  
  origin: ProspectOrigin;
  acquisitionSource: AcquisitionSource;
  
  // Auto assignment prep
  routingState?: string;
  routingCity?: string;
  routingIndustry?: string;
  routingSpecialty?: string;
  
  // Conflicts
  attributionConflict?: boolean;
  conflictingAdvisorId?: string;
  
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  updatedAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
}

export interface ProspectIdentityIndex {
  prospectId: string;
  identityType: "RFC" | "EMAIL" | "PHONE" | "DOMAIN_NAME";
  normalizedHash: string;
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  updatedAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
}

export interface MergePayload {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  rfc?: string;
  website?: string;
  location?: string;
  
  advisorId?: string;
  advisorUid?: string;
  
  origin?: ProspectOrigin;
  acquisitionSource?: AcquisitionSource;
  linkId?: string;
  sourceLeadId?: string;
}
