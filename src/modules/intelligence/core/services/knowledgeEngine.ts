import type { IKnowledgeEngine, KnowledgeDocument, KnowledgeQueryResult } from "../types/brains";

export class KnowledgeEngine implements IKnowledgeEngine {
  private documents: KnowledgeDocument[] = [];

  constructor() {
    this.seedDefaultKnowledge();
  }

  /**
   * Retrieves relevant internal guidelines, regulations, and templates using a simulated
   * vector search score indexer.
   */
  public async queryKnowledge(
    query: string,
    category?: string,
    limit = 3
  ): Promise<KnowledgeQueryResult> {
    const start = Date.now();
    const cleanQuery = query.toLowerCase().trim();

    // Calculate simulated semantic search relevance score
    const results = this.documents
      .filter((doc) => {
        if (category && doc.category !== category) return false;
        return true;
      })
      .map((doc) => {
        let score = 0.1; // Baseline match
        const titleWords = doc.title.toLowerCase().split(/\s+/);
        const contentWords = doc.content.toLowerCase().split(/\s+/);

        // Simple scoring based on word intersection (surrogate for TF-IDF / embeddings)
        titleWords.forEach((word) => {
          if (word.length > 3 && cleanQuery.includes(word)) score += 0.35;
        });
        contentWords.forEach((word) => {
          if (word.length > 3 && cleanQuery.includes(word)) score += 0.08;
        });

        doc.tags.forEach((tag) => {
          if (cleanQuery.includes(tag.toLowerCase())) score += 0.25;
        });

        return { ...doc, score: Math.min(score, 1.0) };
      })
      .filter((doc) => doc.score && doc.score > 0.15)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);

    return {
      query,
      documents: results,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Adds new reference knowledge to the index repository.
   */
  public async indexDocument(
    doc: Omit<KnowledgeDocument, "id" | "indexedAt">
  ): Promise<KnowledgeDocument> {
    const newDoc: KnowledgeDocument = {
      ...doc,
      id: `doc_${Math.random().toString(36).substring(2, 9)}`,
      indexedAt: new Date().toISOString(),
    };
    this.documents.push(newDoc);
    return newDoc;
  }

  /**
   * Seed standard financial, compliance, and platform information.
   */
  private seedDefaultKnowledge(): void {
    const seeds: Array<Omit<KnowledgeDocument, "id" | "indexedAt">> = [
      {
        title: "Aura HCM - Pricing Plan and Suite Options",
        content: "Aura HCM offers three primary tiers. Base Suite is priced at $5 USD/user/month (sales pipeline, basic directory). People Suite is priced at $12 USD/user/month (payroll integrations, advanced HR directory, performance metrics). Operations Suite is $8 USD/user/month (asset maintenance, time logs, location tracking). Custom discount of 15% applicable on >100 user agreements.",
        source: "internal_catalog",
        category: "finance",
        tags: ["pricing", "hcm", "modules", "discount"],
      },
      {
        title: "Mexican Federal Labor Law (LFT) - Holiday and Attendance Rules",
        content: "Under Mexican Federal Labor Law (LFT), employers must track overtime hours and pay double rates for standard overtime limits. Automated clock-ins are highly recommended for digital audit trials. Employees are entitled to 12 days of paid vacation in the first year (since reforms).",
        source: "government_regulation",
        category: "legal",
        tags: ["compliance", "lft", "attendance", "vacations"],
      },
      {
        title: "Electronic Contracts and NOM-151 Digital Signatures",
        content: "To guarantee legal compliance under Mexican commercial law, any online digital contract or HR document must contain a NOM-151 certificate seal. This guarantees data integrity, making contracts fully enforceable in administrative court audits.",
        source: "government_regulation",
        category: "legal",
        tags: ["signature", "nom-151", "contracts", "compliance"],
      },
      {
        title: "Customer Retention Protocols and Churn Defense Playbooks",
        content: "A customer with a health score lower than 70 points must trigger a CS priority task. A custom intervention roadmap must be generated, detailing training sessions for managers and automated payroll system health checkups.",
        source: "internal_sop",
        category: "general",
        tags: ["cs", "retention", "healthscore", "churn"],
      },
    ];

    seeds.forEach((seed) => {
      this.indexDocument(seed);
    });
  }
}

export default KnowledgeEngine;
