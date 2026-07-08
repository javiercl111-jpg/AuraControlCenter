import type { ICustomerSuccessBrain, RetentionAnalysis, ExpansionOpportunity, IntelligenceContext, ChurnRiskFactor } from "../types/brains";
import type { ILLMProvider } from "../types/llm";

export class CustomerSuccessBrain implements ICustomerSuccessBrain {
  private llmProvider: ILLMProvider;

  constructor(llmProvider: ILLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * Evaluates active customer health and predicts potential churn vectors.
   */
  public async evaluateRetention(context: IntelligenceContext): Promise<RetentionAnalysis> {
    const systemPrompt = `You are the Customer Success Brain of Aura HCM.
Analyze the customer context telemetry.
Evaluate retention levels, identify churn threat vectors, and draft mitigation action plans.`;

    const userPrompt = `Client Name: ${context.businessName}
CS Health Rating: ${context.financialSnapshot.financialHealthIndex}/100
Primary warning indicators:
${context.relevantFacts.filter((f) => f.includes("Warning") || f.includes("Gap")).join("\n")}`;

    const schema = {
      customerHealthScore: "number (0 to 100)",
      churnProbability: "number (0 to 100)",
      riskCategory: "string ('RED' | 'YELLOW' | 'GREEN')",
      riskFactors: "array of objects { indicator: string, impactScore: number, details: string }",
      recommendedActionPlan: "array of strings",
    };

    try {
      const response = await this.llmProvider.generateStructuredOutput<RetentionAnalysis>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        schema
      );

      return {
        customerHealthScore: typeof response.customerHealthScore === "number" ? response.customerHealthScore : context.financialSnapshot.financialHealthIndex,
        churnProbability: typeof response.churnProbability === "number" ? response.churnProbability : this.calculateChurnProbability(context),
        riskCategory: response.riskCategory || this.calculateRiskCategory(context),
        riskFactors: Array.isArray(response.riskFactors) ? response.riskFactors : this.generateLocalCSFactors(context),
        recommendedActionPlan: Array.isArray(response.recommendedActionPlan) ? response.recommendedActionPlan : [
          "Coordinar capacitación avanzada para administradores de nómina.",
          "Establecer sesión de soporte y sincronizar reloj checador.",
        ],
      };
    } catch (err) {
      console.warn("LLM retention evaluation failed, running fallback diagnostic:", err);
      return this.getLocalCSFallback(context);
    }
  }

  /**
   * Scans client context to identify expansion triggers (cross-sell Operations/Signature modules).
   */
  public async identifyExpansionOpportunities(context: IntelligenceContext): Promise<ExpansionOpportunity[]> {
    const systemPrompt = `You are the Expansion Planner at Aura HCM.
Scan customer telemetry to identify upsell, cross-sell, or addon opportunities.`;

    const userPrompt = `Client: ${context.businessName}
Industry: ${context.industry}
Size Segment: ${context.sizeGroup} (Headcount: ${context.hrSnapshot.employeeCount})
Locations: ${context.operationalSnapshot.locationsCount}`;

    const schema = {
      opportunities: "array of objects { type: 'CROSS_SELL' | 'UP_SELL' | 'ADDON', productName: string, suiteName: string, estimatedAdditionalMrr: number, triggerEvent: string, conversionStrategy: string }",
    };

    try {
      const response = await this.llmProvider.generateStructuredOutput<{ opportunities: ExpansionOpportunity[] }>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        schema
      );

      return Array.isArray(response.opportunities) ? response.opportunities : this.generateLocalExpansions(context);
    } catch (err) {
      console.warn("LLM expansion lookup failed, generating rule-based expansions:", err);
      return this.generateLocalExpansions(context);
    }
  }

  private calculateChurnProbability(context: IntelligenceContext): number {
    const health = context.financialSnapshot.financialHealthIndex;
    return Math.max(100 - health, 0);
  }

  private calculateRiskCategory(context: IntelligenceContext): "RED" | "YELLOW" | "GREEN" {
    const health = context.financialSnapshot.financialHealthIndex;
    if (health < 70) return "RED";
    if (health < 85) return "YELLOW";
    return "GREEN";
  }

  private generateLocalCSFactors(context: IntelligenceContext): ChurnRiskFactor[] {
    const factors: ChurnRiskFactor[] = [];
    const health = context.financialSnapshot.financialHealthIndex;

    if (health < 70) {
      factors.push({
        indicator: "Bajo Health Score CS",
        impactScore: 8,
        details: `El cliente tiene una puntuación crítica de ${health}/100. Denota frustración de uso o baja adopción.`,
      });
    }

    if (context.relevantFacts.some((f) => f.includes("Lack of automated time-and-attendance"))) {
      factors.push({
        indicator: "Falta de control de asistencia automático",
        impactScore: 5,
        details: "Registrar incidencias de forma externa a Aura eleva la fricción operativa del administrador.",
      });
    }

    return factors;
  }

  private generateLocalExpansions(context: IntelligenceContext): ExpansionOpportunity[] {
    const opportunities: ExpansionOpportunity[] = [];
    const qty = context.hrSnapshot.employeeCount;

    // Cross sell signature if big and lacks signature
    if (qty > 30 && !context.relevantFacts.some((f) => f.includes("NOM-151"))) {
      opportunities.push({
        type: "CROSS_SELL",
        productName: "Aura Signature",
        suiteName: "Digital Trust",
        estimatedAdditionalMrr: Math.round(qty * 35),
        triggerEvent: "Empresa con plantilla relevante realizando firmas manuales.",
        conversionStrategy: "Demostración de flujo legal NOM-151 con carga masiva de contratos laborales.",
      });
    }

    // Cross sell operations maintenance if manufacturing/hospitability and has locations
    if (context.operationalSnapshot.locationsCount > 1 && (context.industry.includes("Manufactura") || context.industry.includes("Hospedaje") || context.industry.includes("Alimentos"))) {
      opportunities.push({
        type: "CROSS_SELL",
        productName: "Aura Maintenance",
        suiteName: "Operations Suite",
        estimatedAdditionalMrr: 600,
        triggerEvent: "Operación multi-sucursal que requiere control de activos.",
        conversionStrategy: "Presentar módulo de mantenimiento preventivo y control de instalaciones críticas.",
      });
    }

    return opportunities;
  }

  private getLocalCSFallback(context: IntelligenceContext): RetentionAnalysis {
    return {
      customerHealthScore: context.financialSnapshot.financialHealthIndex,
      churnProbability: this.calculateChurnProbability(context),
      riskCategory: this.calculateRiskCategory(context),
      riskFactors: this.generateLocalCSFactors(context),
      recommendedActionPlan: [
        "Llamada urgente de alineación por parte del Account Manager.",
        "Revisión de lints e incidencias de soporte pendientes.",
      ],
    };
  }
}

export default CustomerSuccessBrain;
