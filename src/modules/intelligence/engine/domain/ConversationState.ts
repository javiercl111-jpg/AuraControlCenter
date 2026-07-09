import type { ConversationMessage, SmartBusinessDossierPartial } from "../types/conversation.types";

export class ConversationState {
  public history: ConversationMessage[] = [];
  public currentConfidence: number = 0;
  public activeHypotheses: Set<string> = new Set();
  public dossier: SmartBusinessDossierPartial = {};
  public usefulResponsesCount: number = 0;
  public turnCount: number = 0;
  public askedIntents: Set<string> = new Set();
  public askedQuestions: Set<string> = new Set();

  public readonly sessionId: string;
  public readonly companyName: string;
  public readonly industry: string;

  constructor(
    sessionId: string,
    companyName: string,
    industry: string
  ) {
    this.sessionId = sessionId;
    this.companyName = companyName;
    this.industry = industry;
  }

  public addMessage(role: "user" | "aura" | "system", content: string): void {
    this.history.push({
      id: `${this.sessionId}-${Date.now()}-${this.history.length}`,
      role,
      content,
      timestamp: new Date(),
    });
  }

  public getHistory(): ConversationMessage[] {
    return [...this.history];
  }

  public updateConfidence(newConfidence: number): void {
    // Ensure confidence stays between 0 and 100
    this.currentConfidence = Math.max(0, Math.min(100, newConfidence));
  }

  public addHypothesis(hypothesis: string): void {
    this.activeHypotheses.add(hypothesis);
  }

  public removeHypothesis(hypothesis: string): void {
    this.activeHypotheses.delete(hypothesis);
  }

  public getHypotheses(): string[] {
    return Array.from(this.activeHypotheses);
  }

  public updateDossier(partialUpdate: SmartBusinessDossierPartial): void {
    this.dossier = {
      ...this.dossier,
      ...partialUpdate,
    };
  }

  public getSnapshot() {
    return {
      sessionId: this.sessionId,
      companyName: this.companyName,
      industry: this.industry,
      confidence: this.currentConfidence,
      hypotheses: this.getHypotheses(),
      dossier: { ...this.dossier },
      messageCount: this.history.length,
      usefulResponsesCount: this.usefulResponsesCount,
      turnCount: this.turnCount,
      askedIntents: Array.from(this.askedIntents),
    };
  }
}

export default ConversationState;
