import type { IProposalBrain, ProposalTerms, ROIProjection, AssessmentResult, IntelligenceContext, ProposalItem } from "../types/brains";
import type { ILLMProvider } from "../types/llm";

export class ProposalBrain implements IProposalBrain {
  private llmProvider: ILLMProvider;

  constructor(llmProvider: ILLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * Generates custom commercial pricing lines based on the assessment diagnostic gaps.
   */
  public async generateProposalTerms(
    context: IntelligenceContext,
    assessment: AssessmentResult
  ): Promise<ProposalTerms> {
    const systemPrompt = `You are the Proposal Brain of Aura HCM.
Analyze the diagnostic results and create a structured quotation.
Define product modules, quantities, prices, discounts, and payment terms.`;

    const userPrompt = `Client: ${context.businessName}
Employee Count: ${context.hrSnapshot.employeeCount}
Recommended Modules: ${assessment.recommendedModules.join(", ")}
Digital Maturity: ${assessment.digitalMaturityScore}/100`;

    const schema = {
      currency: "string (e.g. 'MXN' or 'USD')",
      items: "array of objects { id: string, productName: string, suiteName: string, quantity: number, unitPrice: number, discountPercentage: number, totalPrice: number, billingFrequency: string }",
      subtotal: "number",
      discounts: "number",
      taxes: "number",
      totalMrr: "number",
      totalOneTime: "number",
      contractDurationMonths: "number",
      paymentTerms: "string",
      validUntil: "string",
    };

    try {
      const response = await this.llmProvider.generateStructuredOutput<ProposalTerms>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        schema
      );

      // Sanitize response array and math
      const items = Array.isArray(response.items) ? response.items : this.generateLocalItems(context, assessment);
      const subtotal = items.reduce((acc, item) => acc + (item.billingFrequency === "monthly" ? item.totalPrice : 0), 0);
      const totalOneTime = items.reduce((acc, item) => acc + (item.billingFrequency === "one-time" ? item.totalPrice : 0), 0);

      return {
        currency: response.currency || "MXN",
        items,
        subtotal: typeof response.subtotal === "number" ? response.subtotal : subtotal,
        discounts: typeof response.discounts === "number" ? response.discounts : Math.round(subtotal * 0.1),
        taxes: typeof response.taxes === "number" ? response.taxes : Math.round((subtotal - subtotal * 0.1) * 0.16),
        totalMrr: typeof response.totalMrr === "number" ? response.totalMrr : Math.round(subtotal * 0.9),
        totalOneTime: typeof response.totalOneTime === "number" ? response.totalOneTime : totalOneTime,
        contractDurationMonths: response.contractDurationMonths || 12,
        paymentTerms: response.paymentTerms || "Facturación mensual adelantada. 30 días de plazo.",
        validUntil: response.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      };
    } catch (err) {
      console.warn("LLM proposal generation failed, using local pricing model:", err);
      return this.getLocalProposalFallback(context, assessment);
    }
  }

  /**
   * Projects Return on Investment based on pricing terms and compliance fine avoidance.
   */
  public async projectROI(context: IntelligenceContext, terms: ProposalTerms): Promise<ROIProjection> {
    const systemPrompt = `You are the ROI Projector of Aura HCM.
Compare proposed pricing terms against business inefficiencies and potential compliance fine costs.
Calculate payback period, yearly savings, and percentage ROI.`;

    const userPrompt = `Client Name: ${context.businessName}
Critical Headcount: ${context.hrSnapshot.employeeCount}
Proposal Cost (MRR): ${terms.totalMrr}
Fines Threat (Compliance Risks): ${context.hrSnapshot.regulatoryRiskScore}`;

    const schema = {
      estimatedSavingsFirstYear: "number",
      estimatedInefficiencyReductionPercentage: "number",
      paybackPeriodMonths: "number",
      fiveYearRoiPercentage: "number",
      justifications: "array of strings",
    };

    try {
      const response = await this.llmProvider.generateStructuredOutput<ROIProjection>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        schema
      );

      return {
        estimatedSavingsFirstYear: typeof response.estimatedSavingsFirstYear === "number" ? response.estimatedSavingsFirstYear : this.calculateSavings(context, terms),
        estimatedInefficiencyReductionPercentage: typeof response.estimatedInefficiencyReductionPercentage === "number" ? response.estimatedInefficiencyReductionPercentage : 35,
        paybackPeriodMonths: typeof response.paybackPeriodMonths === "number" ? response.paybackPeriodMonths : 4,
        fiveYearRoiPercentage: typeof response.fiveYearRoiPercentage === "number" ? response.fiveYearRoiPercentage : 350,
        justifications: Array.isArray(response.justifications) ? response.justifications : [
          "Reducción drástica del tiempo operativo de cálculo de incidencias.",
          "Evita multas por incumplimiento en bitácoras de asistencia de la STPS.",
        ],
      };
    } catch (err) {
      console.warn("LLM ROI projection failed, returning fallback evaluation:", err);
      return {
        estimatedSavingsFirstYear: this.calculateSavings(context, terms),
        estimatedInefficiencyReductionPercentage: 30,
        paybackPeriodMonths: 5,
        fiveYearRoiPercentage: 280,
        justifications: [
          "Ahorro directo en la automatización del proceso de nómina.",
          "Protección de multas por el SAT y la STPS debido al timbrado e incidencias correctas.",
        ],
      };
    }
  }

  private generateLocalItems(context: IntelligenceContext, assessment: AssessmentResult): ProposalItem[] {
    const qty = context.hrSnapshot.employeeCount || 10;
    const items: ProposalItem[] = [];

    if (assessment.recommendedModules.includes("Aura HCM") || assessment.recommendedModules.includes("Aura HCM Core") || assessment.recommendedModules.includes("Aura HCM Básico")) {
      items.push({
        id: "item_hcm",
        productName: "Aura HCM core",
        suiteName: "People Suite",
        quantity: qty,
        unitPrice: 120, // MXN per user
        discountPercentage: qty > 100 ? 15 : 0,
        totalPrice: Math.round(qty * 120 * (qty > 100 ? 0.85 : 1)),
        billingFrequency: "monthly",
      });
    }

    if (assessment.recommendedModules.includes("Aura Signature") || qty > 30) {
      items.push({
        id: "item_sig",
        productName: "Aura Signature standard",
        suiteName: "Digital Trust",
        quantity: qty,
        unitPrice: 35, // MXN per user
        discountPercentage: 0,
        totalPrice: Math.round(qty * 35),
        billingFrequency: "monthly",
      });
    }

    // Always append implementation setup setup
    items.push({
      id: "item_setup",
      productName: "Aura Implementation & Setup",
      suiteName: "Professional Services",
      quantity: 1,
      unitPrice: qty > 100 ? 15000 : 5000,
      discountPercentage: 0,
      totalPrice: qty > 100 ? 15000 : 5000,
      billingFrequency: "one-time",
    });

    return items;
  }

  private calculateSavings(context: IntelligenceContext, terms: ProposalTerms): number {
    const fineRisks = context.hrSnapshot.regulatoryRiskScore * 1000; // proxy calculation
    const efficiencySavings = context.hrSnapshot.employeeCount * 12500 * 0.05 * 12; // 5% efficiency on salary costs
    return Math.round(fineRisks + efficiencySavings - (terms.totalMrr * 12));
  }

  private getLocalProposalFallback(context: IntelligenceContext, assessment: AssessmentResult): ProposalTerms {
    const items = this.generateLocalItems(context, assessment);
    const subtotal = items.reduce((acc, item) => acc + (item.billingFrequency === "monthly" ? item.totalPrice : 0), 0);
    const totalOneTime = items.reduce((acc, item) => acc + (item.billingFrequency === "one-time" ? item.totalPrice : 0), 0);

    return {
      currency: "MXN",
      items,
      subtotal,
      discounts: Math.round(subtotal * 0.05),
      taxes: Math.round((subtotal * 0.95) * 0.16),
      totalMrr: Math.round(subtotal * 0.95),
      totalOneTime,
      contractDurationMonths: 12,
      paymentTerms: "Facturación mensual adelantada. 30 días de plazo.",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    };
  }
}

export default ProposalBrain;
