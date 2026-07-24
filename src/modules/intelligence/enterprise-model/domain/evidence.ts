export type ConfidenceScore = number; // Normalizado entre 0 y 1

export const EvidenceSourceType = {
  USER_STATEMENT: 'USER_STATEMENT',
  USER_CONFIRMATION: 'USER_CONFIRMATION',
  USER_CORRECTION: 'USER_CORRECTION',
  SYSTEM_OBSERVATION: 'SYSTEM_OBSERVATION',
  DOCUMENT: 'DOCUMENT',
  INTEGRATION: 'INTEGRATION',
  DERIVED_INFERENCE: 'DERIVED_INFERENCE', // Mandatory canonical source
} as const;

export type EvidenceSourceType = typeof EvidenceSourceType[keyof typeof EvidenceSourceType];

export interface EnterpriseEvidence {
  evidenceId: string;
  sessionId: string;
  turnId: string;
  source: string; // e.g., 'executive-conversation', 'user-upload'
  sourceType: EvidenceSourceType;
  originalText: string | null;
  normalizedStatement: string;
  category: string;
  entityRefs: string[]; // IDs of entities this evidence supports/relates to
  capturedAt: number;
  reliability: number; // 0 to 1
  directness: number; // 0 to 1
  polarity: 'POSITIVE' | 'NEGATIVE'; // POSITIVE supports the entity, NEGATIVE contradicts it
  extractorVersion: string;
  metadata: Record<string, unknown>; // Segura
}
