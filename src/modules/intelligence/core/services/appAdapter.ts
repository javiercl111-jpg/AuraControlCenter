import type { InegiCompany } from "../../../market-intelligence/types/inegi";
import type { AuraSalesAdvice } from "../../../market-intelligence/services/auraSalesAdvisorService";
import type { ExecutiveIntelligenceDashboard } from "../types/brains";
import SmartBusinessDossier from "../domain/SmartBusinessDossier";
import ContextEngine from "./contextEngine";
import KnowledgeEngine from "./knowledgeEngine";
import CommercialBrain from "./commercialBrain";
import BusinessAssessmentBrain from "./businessAssessmentBrain";
import ProposalBrain from "./proposalBrain";
import CustomerSuccessBrain from "./customerSuccessBrain";
import RecommendationEngine from "./recommendationEngine";
import LLMProviderFactory from "./llmProviders";

export class AppAdapter {
  /**
   * Temporary bridge mapping InegiCompany properties into the SmartBusinessDossier domain model.
   */
  public static mapCompanyToDossier(company: InegiCompany): SmartBusinessDossier {
    // Standard headcount parsing from DENUE range string
    let employeeCount = 10;
    const cleanRange = (company.rangoPersonal || "").toLowerCase();

    if (cleanRange.includes("0 a 5") || cleanRange.includes("1 a 5")) {
      employeeCount = 3;
    } else if (cleanRange.includes("6 a 10")) {
      employeeCount = 8;
    } else if (cleanRange.includes("11 a 30")) {
      employeeCount = 20;
    } else if (cleanRange.includes("31 a 50")) {
      employeeCount = 40;
    } else if (cleanRange.includes("51 a 100")) {
      employeeCount = 75;
    } else if (cleanRange.includes("101 a 250")) {
      employeeCount = 175;
    } else if (cleanRange.includes("251") || cleanRange.includes("mas") || cleanRange.includes("más")) {
      employeeCount = 300;
    }

    // Proxy indicators
    const estimatedMrr = (company.opportunityScore || 50) * 150; // Simple linear pricing estimate
    const isLarge = employeeCount > 30;

    return new SmartBusinessDossier({
      id: company.id,
      businessName: company.nombreComercial || company.razonSocial,
      taxId: company.razonSocial ? "RFC-" + company.razonSocial.substring(0, 4).toUpperCase() + "990101-XX9" : undefined,
      industry: company.sector,
      employeeCount,
      annualRevenues: employeeCount * 180000, // Est. revenue per head
      locationsCount: isLarge ? 3 : 1,
      criticalAssetsCount: isLarge ? 4 : 0,
      payrollSystem: isLarge ? "Excel" : undefined, // Will trigger compliance gap for >30 employees
      hasElectronicSignature: false, // Triggers signature cross-sell opportunity
      hasTimeAndAttendance: false, // Triggers attendance tracking gap
      estimatedMrr,
      healthScoreCS: 85, // Default CS score
      complianceRisks: [],
    });
  }

  /**
   * Queries the core brains and maps responses to the legacy AuraSalesAdvice interface.
   */
  public static async getSalesAdvice(company: InegiCompany): Promise<AuraSalesAdvice> {
    const dossier = this.mapCompanyToDossier(company);
    
    // Resolve providers and engines
    const provider = LLMProviderFactory.getProvider("gemini");
    const knowledge = new KnowledgeEngine();
    const contextEngine = new ContextEngine(knowledge);
    
    const commBrain = new CommercialBrain(provider);
    const assessBrain = new BusinessAssessmentBrain(provider);
    const propBrain = new ProposalBrain(provider);

    // Build context
    const context = await contextEngine.buildContext(dossier, "Sales advice for company " + dossier.businessName);

    // Run evaluations
    const [qualification, assessment] = await Promise.all([
      commBrain.qualifyLead(context),
      assessBrain.performDiagnostic(context),
    ]);

    const [pitch, terms, roi] = await Promise.all([
      commBrain.generateOutreachPitch(context, "email"),
      propBrain.generateProposalTerms(context, assessment),
      propBrain.projectROI(context, {
        currency: "MXN",
        items: [],
        subtotal: 0,
        discounts: 0,
        taxes: 0,
        totalMrr: qualification.estimatedValue.mrr,
        totalOneTime: qualification.estimatedValue.oneTimeFee,
        contractDurationMonths: 12,
        paymentTerms: "Mensual",
        validUntil: "",
      }),
    ]);

    // Map outputs to legacy AuraSalesAdvice structure
    return {
      conversionProbability: qualification.conversionProbability,
      confidenceLevel: qualification.conversionProbability > 75 ? "Alta" : qualification.conversionProbability > 45 ? "Media" : "Baja",
      priorityLabel: qualification.score >= 80 ? "CRITICAL" : qualification.score >= 60 ? "HIGH" : qualification.score >= 40 ? "MEDIUM" : "LOW",
      whyContact: qualification.qualificationReason,
      recommendedSolutions: qualification.suggestedSolutions.map((sol) => ({
        product: sol.productName,
        suite: sol.suiteName,
        description: `Recomendado con prioridad ${sol.priority} según el análisis del core.`,
      })),
      openingSpeech: pitch.body,
      discoveryQuestions: [
        "¿Cómo administran las incidencias de asistencia de su personal actualmente?",
        "¿Utilizan firmas electrónicas para contratos individuales de trabajo?",
        "¿Qué software o herramienta de nómina emplean hoy en día?",
      ],
      possibleObjections: pitch.objectionsToAnticipate,
      objectionResponses: pitch.suggestedResponses,
      nextRecommendedAction: `Enviar cotización de $${terms.totalMrr.toLocaleString()} MXN/mes con retorno de inversión proyectado del ${roi.fiveYearRoiPercentage}%.`,
      estimatedMrr: terms.totalMrr,
      estimatedArr: terms.totalMrr * 12,
      recommendedFirstProduct: qualification.suggestedSolutions[0]?.productName || "Aura HCM",
    };
  }

  /**
   * Runs the core RecommendationEngine over the current list of companies.
   */
  public static async generateDashboard(companies: InegiCompany[]): Promise<ExecutiveIntelligenceDashboard> {
    if (companies.length === 0) {
      return {
        dossierId: "aggregated_empty",
        overallHealthScore: 100,
        estimatedPotentialValue: 0,
        primaryGapsCount: 0,
        prioritizedActions: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Determine the highest priority company in the collection to focus on,
    // and run the core recommendation engine on its dossier.
    const sorted = [...companies].sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0));
    const primaryCompany = sorted[0];

    const dossier = this.mapCompanyToDossier(primaryCompany);
    
    const provider = LLMProviderFactory.getProvider("gemini");
    const knowledge = new KnowledgeEngine();
    const contextEngine = new ContextEngine(knowledge);

    const commBrain = new CommercialBrain(provider);
    const assessBrain = new BusinessAssessmentBrain(provider);
    const propBrain = new ProposalBrain(provider);
    const csBrain = new CustomerSuccessBrain(provider);

    const orchestrator = new RecommendationEngine(
      commBrain,
      assessBrain,
      propBrain,
      csBrain,
      provider
    );

    const context = await contextEngine.buildContext(dossier, "Orchestrate executive recommendations");
    return orchestrator.generateActionDashboard(context);
  }
}

export default AppAdapter;
