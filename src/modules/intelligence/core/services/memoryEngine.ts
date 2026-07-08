import type { BusinessMemoryEvent, IMemoryEngine, MemoryImportance } from "../types/memory";

export class MemoryEngine implements IMemoryEngine {
  private events: BusinessMemoryEvent[] = [];

  constructor() {
    this.seedMockActivity();
  }

  /**
   * Records a new history event for the customer dossier.
   */
  public async addMemoryEvent(
    event: Omit<BusinessMemoryEvent, "id" | "createdAt">
  ): Promise<BusinessMemoryEvent> {
    const newEvent: BusinessMemoryEvent = {
      ...event,
      id: `mem_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    this.events.push(newEvent);
    return newEvent;
  }

  /**
   * Retrieves the full chronology of events for a dossier.
   */
  public async getTimeline(dossierId: string): Promise<BusinessMemoryEvent[]> {
    return this.events
      .filter((e) => e.dossierId === dossierId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Filters memories by minimum level of importance.
   */
  public async getImportantMemories(
    dossierId: string,
    minImportance: MemoryImportance = "MEDIUM"
  ): Promise<BusinessMemoryEvent[]> {
    const priorityWeight: Record<MemoryImportance, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const threshold = priorityWeight[minImportance];

    return this.events.filter(
      (e) => e.dossierId === dossierId && priorityWeight[e.importance] >= threshold
    );
  }

  /**
   * Compiles a readable history summary to be fed into LLM prompts.
   */
  public async summarizeMemory(dossierId: string): Promise<string> {
    const timeline = await this.getTimeline(dossierId);
    if (timeline.length === 0) {
      return "No historical memory events recorded for this dossier.";
    }

    const summaryLines = timeline.map(
      (e) => `[${e.createdAt.substring(0, 10)}] [${e.type}] ${e.title}: ${e.description}`
    );

    return `Historical Memory Log (MOCK/DEMO):\n${summaryLines.join("\n")}`;
  }

  /**
   * Returns a limited list of the most recent events.
   */
  public async getRecentActivity(dossierId: string, limit = 5): Promise<BusinessMemoryEvent[]> {
    const timeline = await this.getTimeline(dossierId);
    return timeline.slice(0, limit);
  }

  /**
   * Extracts events relevant to commercial operations (Sales, Proposals, Objections).
   */
  public async getCommercialContext(dossierId: string): Promise<BusinessMemoryEvent[]> {
    const commercialTypes = [
      "PROSPECT_CREATED",
      "PROPOSAL_GENERATED",
      "PROPOSAL_SENT",
      "OBJECTION_RECORDED",
      "FOLLOW_UP_SCHEDULED",
    ];
    return this.events.filter((e) => e.dossierId === dossierId && commercialTypes.includes(e.type));
  }

  /**
   * Extracts events relevant to CS (Success Reviews, Renewal Risks, Expansions).
   */
  public async getCustomerSuccessContext(dossierId: string): Promise<BusinessMemoryEvent[]> {
    const csTypes = ["CUSTOMER_CONVERTED", "IMPLEMENTATION_STARTED", "SUCCESS_REVIEW", "RENEWAL_RISK", "EXPANSION_OPPORTUNITY"];
    return this.events.filter((e) => e.dossierId === dossierId && csTypes.includes(e.type));
  }

  /**
   * Seed minimal mock events to demonstrate Memory vs general Knowledge distinction.
   */
  private seedMockActivity(): void {
    // We add dummy events for a demonstration dossier ID "company_123" and any wildcard matching.
    const mockEvents: Array<Omit<BusinessMemoryEvent, "id" | "createdAt">> = [
      {
        dossierId: "company_123",
        type: "PROSPECT_CREATED",
        title: "MOCK/DEMO - Lead Registrado",
        description: "Prospecto registrado originalmente en la base piloto.",
        createdBy: "system",
        sourceModule: "market-intelligence",
        importance: "LOW",
        tags: ["demo", "seed"],
      },
      {
        dossierId: "company_123",
        type: "OBJECTION_RECORDED",
        title: "MOCK/DEMO - Objeción de Precio Registrada",
        description: "El contacto objetó que el precio del Core HCM era elevado para su presupuesto inicial y solicitó cotizar el HCM Básico.",
        createdBy: "advisor_user",
        sourceModule: "crm",
        importance: "HIGH",
        tags: ["objection", "pricing", "demo"],
        metadata: { objectionReason: "pricing", targetProduct: "Aura HCM Básico" },
      },
      {
        dossierId: "company_123",
        type: "FOLLOW_UP_SCHEDULED",
        title: "MOCK/DEMO - Siguiente Contacto Agendado",
        description: "Llamada de seguimiento comercial programada para presentar proyección de ROI.",
        createdBy: "advisor_user",
        sourceModule: "crm",
        importance: "MEDIUM",
        tags: ["followup", "demo"],
      },
    ];

    // We also push seed logs dynamically
    mockEvents.forEach((ev) => {
      // Simulate historical dates in past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3); // 3 days ago
      
      const newEvent: BusinessMemoryEvent = {
        ...ev,
        id: `mem_${Math.random().toString(36).substring(2, 9)}`,
        createdAt: pastDate.toISOString(),
      };
      this.events.push(newEvent);
    });
  }
}

export default MemoryEngine;
