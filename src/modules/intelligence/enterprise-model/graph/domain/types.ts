export type NodeStatus =
  | 'UNKNOWN'
  | 'CANDIDATE'
  | 'CONFIRMED'
  | 'CONTRADICTED'
  | 'REJECTED'
  | 'ARCHIVED';

export type RelationshipStatus =
  | 'CANDIDATE'
  | 'PARTIALLY_SUPPORTED'
  | 'CONFIRMED'
  | 'CONTRADICTED'
  | 'REJECTED'
  | 'ARCHIVED';

export type RelationshipType =
  | 'AFFECTS'
  | 'CAUSES'
  | 'RELATED_TO'
  | 'DEPENDS_ON'
  | 'MITIGATES'
  | 'EXACERBATES'
  | 'CONTAINS'
  | 'IMPLEMENTS'
  | 'RESOLVES';

export interface GraphNode {
  id: string; // Deterministic ID
  type: string; // e.g., 'PROCESS', 'RISK', 'OBJECTIVE', 'CAPABILITY', 'PAIN_POINT'
  label: string; // Human readable name
  status: NodeStatus;
  mentalModelRef: string | null; // ID of the entity in the base EnterpriseMentalModel
  properties: Record<string, string | number | boolean>;
  createdAt: number;
  updatedAt: number;
}

export interface EnterpriseRelationship {
  id: string; // Deterministic ID
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  status: RelationshipStatus;
  confidence: number; // 0 to 1
  evidenceRefs: string[]; // References to EnterpriseEvidence
  properties: Record<string, string | number | boolean>;
  createdAt: number;
  updatedAt: number;
}

export interface EnterpriseKnowledgeGraph {
  nodes: Record<string, GraphNode>;
  relationships: Record<string, EnterpriseRelationship>;
}

export const EKG_DOMAIN_VERSION = '1.0.0';
export default EKG_DOMAIN_VERSION;
