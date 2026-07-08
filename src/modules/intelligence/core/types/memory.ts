export type MemoryEventType =
  | "PROSPECT_CREATED"
  | "ASSESSMENT_COMPLETED"
  | "DISCOVERY_COMPLETED"
  | "PROPOSAL_GENERATED"
  | "PROPOSAL_SENT"
  | "OBJECTION_RECORDED"
  | "FOLLOW_UP_SCHEDULED"
  | "CUSTOMER_CONVERTED"
  | "IMPLEMENTATION_STARTED"
  | "SUCCESS_REVIEW"
  | "RENEWAL_RISK"
  | "EXPANSION_OPPORTUNITY";

export type MemoryImportance = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface BusinessMemoryEvent {
  id: string;
  dossierId: string;
  companyId?: string;
  type: MemoryEventType;
  title: string;
  description: string;
  createdAt: string;
  createdBy: string; // "user" | "system" | "advisor_id"
  sourceModule: string; // "crm" | "market-intelligence" | "billing" | "success"
  importance: MemoryImportance;
  tags: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface IMemoryEngine {
  addMemoryEvent(event: Omit<BusinessMemoryEvent, "id" | "createdAt">): Promise<BusinessMemoryEvent>;
  getTimeline(dossierId: string): Promise<BusinessMemoryEvent[]>;
  getImportantMemories(dossierId: string, minImportance?: MemoryImportance): Promise<BusinessMemoryEvent[]>;
  summarizeMemory(dossierId: string): Promise<string>;
  getRecentActivity(dossierId: string, limit?: number): Promise<BusinessMemoryEvent[]>;
  getCommercialContext(dossierId: string): Promise<BusinessMemoryEvent[]>;
  getCustomerSuccessContext(dossierId: string): Promise<BusinessMemoryEvent[]>;
}

const Memory = {};
export default Memory;
