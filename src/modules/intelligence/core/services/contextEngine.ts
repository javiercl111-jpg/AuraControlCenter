import type SmartBusinessDossier from "../domain/SmartBusinessDossier";
import type { IContextEngine, IntelligenceContext, IKnowledgeEngine, KnowledgeDocument } from "../types/brains";

export class ContextEngine implements IContextEngine {
  private knowledgeEngine?: IKnowledgeEngine;

  constructor(knowledgeEngine?: IKnowledgeEngine) {
    this.knowledgeEngine = knowledgeEngine;
  }

  /**
   * Builds the comprehensive IntelligenceContext by aggregating and synthesising the dossier
   * state and performing RAG query matches from the Knowledge Engine.
   */
  public async buildContext(
    dossier: SmartBusinessDossier,
    query: string,
    category?: string
  ): Promise<IntelligenceContext> {
    const dossierSummary = dossier.summarizeState();

    // Collect derived metrics from domain behaviors
    const hrGaps = dossier.getHRComplianceGaps();
    const financialRisks = dossier.getFinancialRiskIndicators();
    const digitalMaturity = dossier.getDigitalMaturityLevel();

    const relevantFacts: string[] = [
      `Digital Maturity Level: ${digitalMaturity}`,
      `Dossier data completeness score: ${dossier.getCompletenessScore()}%`,
    ];

    hrGaps.forEach((gap) => relevantFacts.push(`Compliance Gap: ${gap}`));
    financialRisks.forEach((risk) => relevantFacts.push(`Financial Warning: ${risk}`));

    // Fetch related internal documents via Knowledge Engine (RAG matching)
    let retrievedKnowledge: KnowledgeDocument[] = [];
    if (this.knowledgeEngine) {
      try {
        const queryRes = await this.knowledgeEngine.queryKnowledge(query, category, 3);
        retrievedKnowledge = queryRes.documents;
      } catch (err) {
        console.error("ContextEngine failed to retrieve semantic knowledge:", err);
      }
    }

    // Build snaps
    const financialSnapshot = {
      estimatedMrr: dossier.estimatedMrr,
      estimatedArr: dossier.estimatedArr,
      annualRevenues: dossier.annualRevenues,
      financialHealthIndex: dossier.healthScoreCS, // CS health acts as proxy indicator
    };

    const hrSnapshot = {
      employeeCount: dossier.employeeCount,
      activePayrollCost: dossier.employeeCount * 12500, // Derived fallback estimate
      regulatoryRiskScore: hrGaps.length * 20, // Proxy score
    };

    const operationalSnapshot = {
      locationsCount: dossier.locationsCount,
      criticalAssetsCount: dossier.criticalAssetsCount,
      operationalInefficiencyScore:
        (!dossier.hasTimeAndAttendance ? 40 : 0) + (dossier.locationsCount > 2 ? 20 : 0),
    };

    return {
      dossierId: dossier.id,
      businessName: dossier.businessName,
      taxId: dossier.taxId,
      industry: dossier.industry,
      sizeGroup: dossier.sizeGroup,
      dossierSummary,
      relevantFacts,
      financialSnapshot,
      hrSnapshot,
      operationalSnapshot,
      retrievedKnowledge,
      timestamp: new Date().toISOString(),
    };
  }
}

export default ContextEngine;
