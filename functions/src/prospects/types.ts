import * as admin from "firebase-admin";

export const PROSPECT_RESOLUTION_VERSION = "1.0";
export const PROSPECT_LIFECYCLE_VERSION = "1.0";

// --- Const Objects & Union Types ---

export const MatchClassification = {
  EXACT_MATCH: "EXACT_MATCH",
  HIGH_CONFIDENCE: "HIGH_CONFIDENCE",
  POSSIBLE_DUPLICATE: "POSSIBLE_DUPLICATE",
  NEW_COMPANY: "NEW_COMPANY",
} as const;
export type MatchClassification = typeof MatchClassification[keyof typeof MatchClassification];

export const ProspectOrigin = {
  CONTROL_CENTER: "CONTROL_CENTER",
  ADVISOR_SHARE: "ADVISOR_SHARE",
  WEBSITE: "WEBSITE",
  QR: "QR",
  EMAIL: "EMAIL",
  LINKEDIN: "LINKEDIN",
  REFERRAL: "REFERRAL",
  CAMPAIGN: "CAMPAIGN",
  EVENT: "EVENT",
  API: "API",
  UNKNOWN: "UNKNOWN",
} as const;
export type ProspectOrigin = typeof ProspectOrigin[keyof typeof ProspectOrigin];

export const AcquisitionSource = {
  GOOGLE: "GOOGLE",
  LINKEDIN: "LINKEDIN",
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  QR: "QR",
  EVENT: "EVENT",
  REFERRAL: "REFERRAL",
  DIRECT: "DIRECT",
  OTHER: "OTHER",
  UNKNOWN: "UNKNOWN",
} as const;
export type AcquisitionSource = typeof AcquisitionSource[keyof typeof AcquisitionSource];

export const ProspectLifecycleStatus = {
  NEW: "NEW",
  QUALIFIED: "QUALIFIED",
  CONTACT_PENDING: "CONTACT_PENDING",
  CONTACTED: "CONTACTED",
  DISCOVERY_SENT: "DISCOVERY_SENT",
  DISCOVERY_IN_PROGRESS: "DISCOVERY_IN_PROGRESS",
  DISCOVERY_COMPLETED: "DISCOVERY_COMPLETED",
  FOLLOW_UP: "FOLLOW_UP",
  PROPOSAL_PENDING: "PROPOSAL_PENDING",
  NEGOTIATION: "NEGOTIATION",
  CUSTOMER: "CUSTOMER",
  NO_RESPONSE: "NO_RESPONSE",
  NURTURE: "NURTURE",
  ARCHIVED: "ARCHIVED",
  DISQUALIFIED: "DISQUALIFIED"
} as const;
export type ProspectLifecycleStatus = typeof ProspectLifecycleStatus[keyof typeof ProspectLifecycleStatus];

export const LifecycleEventType = {
  PROSPECT_CREATED: "PROSPECT_CREATED",
  PROSPECT_UPDATED: "PROSPECT_UPDATED",
  PROSPECT_MERGED: "PROSPECT_MERGED",
  POSSIBLE_DUPLICATE_DETECTED: "POSSIBLE_DUPLICATE_DETECTED",
  DISCOVERY_ATTACHED: "DISCOVERY_ATTACHED",
  DOSSIER_ATTACHED: "DOSSIER_ATTACHED",
  ADVISOR_ASSIGNED: "ADVISOR_ASSIGNED",
  ADVISOR_REASSIGNED: "ADVISOR_REASSIGNED",
  ADVISOR_ATTRIBUTION_CONFLICT: "ADVISOR_ATTRIBUTION_CONFLICT",
  UNASSIGNED_CREATED: "UNASSIGNED_CREATED",
  
  DISCOVERY_SENT: "DISCOVERY_SENT",
  DISCOVERY_STARTED: "DISCOVERY_STARTED",
  DISCOVERY_COMPLETED: "DISCOVERY_COMPLETED",
  PROSPECT_REPLIED: "PROSPECT_REPLIED",
  
  PROSPECT_STATUS_CHANGED: "PROSPECT_STATUS_CHANGED",
  CONTACT_ATTEMPT_RECORDED: "CONTACT_ATTEMPT_RECORDED",
  FOLLOW_UP_SCHEDULED: "FOLLOW_UP_SCHEDULED",
  FOLLOW_UP_OVERDUE: "FOLLOW_UP_OVERDUE",
  NO_RESPONSE_ENTERED: "NO_RESPONSE_ENTERED",
  NURTURE_ENTERED: "NURTURE_ENTERED",
  PROSPECT_ARCHIVED: "PROSPECT_ARCHIVED",
  PROSPECT_REACTIVATED: "PROSPECT_REACTIVATED"
} as const;
export type LifecycleEventType = typeof LifecycleEventType[keyof typeof LifecycleEventType];

export const ContactOutcome = {
  NO_ANSWER: "NO_ANSWER",
  LEFT_MESSAGE: "LEFT_MESSAGE",
  REJECTED: "REJECTED",
  INTERESTED: "INTERESTED",
  MEETING_BOOKED: "MEETING_BOOKED",
  CALL_BACK_LATER: "CALL_BACK_LATER",
  INVALID_NUMBER: "INVALID_NUMBER"
} as const;
export type ContactOutcome = typeof ContactOutcome[keyof typeof ContactOutcome];

export const WorkQueueCode = {
  ATTEND_TODAY: "ATTEND_TODAY",
  HIGH_PRIORITY: "HIGH_PRIORITY",
  UNASSIGNED: "UNASSIGNED",
  DISCOVERY_PENDING: "DISCOVERY_PENDING",
  DISCOVERY_IN_PROGRESS: "DISCOVERY_IN_PROGRESS",
  DISCOVERY_COMPLETED: "DISCOVERY_COMPLETED",
  FOLLOW_UP_DUE: "FOLLOW_UP_DUE",
  NO_RESPONSE: "NO_RESPONSE",
  NURTURE: "NURTURE",
  ARCHIVED: "ARCHIVED",
  POSSIBLE_DUPLICATES: "POSSIBLE_DUPLICATES",
  ATTRIBUTION_CONFLICTS: "ATTRIBUTION_CONFLICTS",
  CUSTOMERS: "CUSTOMERS"
} as const;
export type WorkQueueCode = typeof WorkQueueCode[keyof typeof WorkQueueCode];

// --- Interfaces ---

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
  type: LifecycleEventType;
  prospectId: string;
  linkId?: string;
  sessionId?: string;
  advisorId?: string;
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date;
  actorType: "SYSTEM" | "ADVISOR" | "PROSPECT";
  source: string;
  metadata: any;
  eventKey?: string; // idempotency
}

export interface ContactAttempt {
  attemptId: string;
  channel: "PHONE" | "EMAIL" | "WHATSAPP" | "LINKEDIN" | "IN_PERSON";
  attemptedAt: string | Date;
  advisorId: string;
  outcome: ContactOutcome;
  responseReceived: boolean;
  notes?: string;
  sourceEventId?: string;
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
  lastResolvedAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date | null;
  duplicateRisk: boolean;
  possibleDuplicateIds: string[];
  
  // Lifecycle
  lifecycleStatus: ProspectLifecycleStatus;
  lifecycleVersion: string;
  statusChangedAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date | null;
  statusChangedBy: string | null;
  statusChangeReason: string | null;
  
  lastContactAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date | null;
  nextContactAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date | null;
  lastResponseAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date | null;
  contactAttemptsCount: number;
  noResponseSince: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date | null;
  nurtureUntil: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date | null;
  archivedAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date | null;
  reactivatedAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date | null;
  
  // Dossier & Timeline
  smartBusinessDossierId?: string;
  timelineSummary?: string;
  lastActivityAt?: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date;
  lastActivityType?: string;
  currentStage: string;
  
  // Attribution (NEVER OVERWRITE original)
  originalAdvisorId: string;
  originalAdvisorUid: string;
  originalAttributionSource: string;
  originalAttributedAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date | null;
  
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
  
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date;
  updatedAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string | Date;
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
