import type {
  IRecommendationEngine,
  ICommercialBrain,
  IBusinessAssessmentBrain,
  IProposalBrain,
  ICustomerSuccessBrain,
  IntelligenceContext,
  ExecutiveIntelligenceDashboard,
  RecommendationAction,
} from "../types/brains";
import type { ILLMProvider } from "../types/llm";

export class RecommendationEngine implements IRecommendationEngine {
  private commercialBrain: ICommercialBrain;
  private assessmentBrain: IBusinessAssessmentBrain;
  private proposalBrain: IProposalBrain;
  private csBrain: ICustomerSuccessBrain;
  private llmProvider?: ILLMProvider;

  constructor(
    commercialBrain: ICommercialBrain,
    assessmentBrain: IBusinessAssessmentBrain,
    proposalBrain: IProposalBrain,
    csBrain: ICustomerSuccessBrain,
    llmProvider?: ILLMProvider
  ) {
    this.commercialBrain = commercialBrain;
    this.assessmentBrain = assessmentBrain;
    this.proposalBrain = proposalBrain;
    this.csBrain = csBrain;
    this.llmProvider = llmProvider;
  }

  /**
   * Runs evaluations across all brain engines and orchestrates findings into an aligned priority dashboard.
   */
  public async generateActionDashboard(
    context: IntelligenceContext
  ): Promise<ExecutiveIntelligenceDashboard> {
    // 1. Gather insights from all specialized brains in parallel
    const [commercialInfo, diagnostic, csInfo] = await Promise.all([
      this.commercialBrain.qualifyLead(context),
      this.assessmentBrain.performDiagnostic(context),
      this.csBrain.evaluateRetention(context),
    ]);

    // Gather potential proposal and expansion data
    const proposal = await this.proposalBrain.generateProposalTerms(context, diagnostic);
    const expansions = await this.csBrain.identifyExpansionOpportunities(context);

    // 2. Synthesize prioritized action array
    const actions: RecommendationAction[] = [];

    // Critical Compliance Gap Actions (From Assessment)
    diagnostic.gapsIdentified.forEach((gap, idx) => {
      const priorityMap: Record<string, number> = { CRITICAL: 95, HIGH: 80, MEDIUM: 50, LOW: 20 };
      const score = priorityMap[gap.severity] ?? 30;

      actions.push({
        id: `act_compliance_${idx}`,
        priorityScore: score,
        priorityLevel: gap.severity,
        category: "compliance",
        title: `Oportunidad detectada: ${gap.gapDescription}`,
        description: `${gap.regulatoryImpact} Multa potencial estimada: $${gap.estimatedFineCost ?? 0} MXN.`,
        suggestedAction: gap.remediationAction,
        associatedBrain: "assessment",
        metadata: { area: gap.area },
      });
    });

    // Lead Qualification Actions (From Commercial)
    if (commercialInfo.qualificationLabel === "SQL" || commercialInfo.score > 75) {
      actions.push({
        id: "act_sales_qualify",
        priorityScore: Math.min(commercialInfo.score, 90),
        priorityLevel: commercialInfo.score >= 80 ? "HIGH" : "MEDIUM",
        category: "sales",
        title: "Oportunidad de Venta Calificada",
        description: `Lead calificado como ${commercialInfo.qualificationLabel} con score de ${commercialInfo.score}/100. Valor estimado MRR: $${commercialInfo.estimatedValue.mrr}.`,
        suggestedAction: "Presentar propuesta formal de suscripción.",
        associatedBrain: "commercial",
        metadata: { conversionProbability: commercialInfo.conversionProbability },
      });
    }

    // Customer Success Retention Actions (From CS)
    if (csInfo.riskCategory === "RED" || csInfo.customerHealthScore < 70) {
      actions.push({
        id: "act_cs_retention",
        priorityScore: 90,
        priorityLevel: "CRITICAL",
        category: "success",
        title: "Alerta Crítica de Retención - CS",
        description: `Riesgo de abandono elevado (${csInfo.churnProbability}%). Motivo principal: ${
          csInfo.riskFactors[0]?.indicator || "Bajo uso de la plataforma"
        }.`,
        suggestedAction: csInfo.recommendedActionPlan[0] || "Programar llamada de atención al cliente.",
        associatedBrain: "success",
        metadata: { healthScore: csInfo.customerHealthScore },
      });
    }

    // Expansion Upsells Actions (From CS)
    expansions.forEach((exp, idx) => {
      actions.push({
        id: `act_cs_expansion_${idx}`,
        priorityScore: 60,
        priorityLevel: "MEDIUM",
        category: "success",
        title: `Expansión: ${exp.productName} (${exp.type})`,
        description: `Oportunidad identificada en ${exp.suiteName}. MRR adicional estimado: $${exp.estimatedAdditionalMrr}.`,
        suggestedAction: exp.conversionStrategy,
        associatedBrain: "success",
        metadata: { type: exp.type },
      });
    });

    // Memory-Derived Actions
    const followUp = context.memoryTimeline.find((e) => e.type === "FOLLOW_UP_SCHEDULED");
    if (followUp) {
      actions.push({
        id: "act_memory_followup",
        priorityScore: 75,
        priorityLevel: "HIGH",
        category: "sales",
        title: `Llamada Programada: ${followUp.title}`,
        description: `Pendiente en historial: ${followUp.description}`,
        suggestedAction: "Realizar llamada de seguimiento",
        associatedBrain: "commercial",
        metadata: { eventId: followUp.id },
      });
    }

    const priceObjection = context.memoryTimeline.find(
      (e) => e.type === "OBJECTION_RECORDED" && e.metadata?.objectionReason === "pricing"
    );
    if (priceObjection) {
      actions.push({
        id: "act_memory_objection",
        priorityScore: 85,
        priorityLevel: "HIGH",
        category: "sales",
        title: "Resolver Objeción: " + priceObjection.title,
        description: `El cliente solicitó cotizar ${priceObjection.metadata?.targetProduct || "un plan menor"}.`,
        suggestedAction: "Presentar propuesta modular de entrada",
        associatedBrain: "proposal",
        metadata: { eventId: priceObjection.id },
      });
    }

    // 3. Sort actions by priority score descending
    const sortedActions = actions.sort((a, b) => b.priorityScore - a.priorityScore);

    // 4. Calculate a weighted overall health score (0-100)
    // 40% Compliance, 35% CS Health, 25% Digital Maturity
    const weightedHealth = Math.round(
      diagnostic.complianceHealthScore * 0.4 +
        csInfo.customerHealthScore * 0.35 +
        diagnostic.digitalMaturityScore * 0.25
    );

    // 5. Total MRR expansion + potential contract value
    const potentialValue = proposal.totalMrr + expansions.reduce((acc, exp) => acc + exp.estimatedAdditionalMrr, 0);

    const primaryGapsCount = diagnostic.gapsIdentified.filter(
      (g) => g.severity === "CRITICAL" || g.severity === "HIGH"
    ).length;

    // 6. Leverage LLM Provider for executive alignment if present
    if (this.llmProvider) {
      try {
        const prompt = `Synthesize these recommended actions for executive visualization. Make title and descriptions concise.
Actions: ${JSON.stringify(sortedActions.slice(0, 3))}`;
        const summaryResponse = await this.llmProvider.generateCompletion([
          { role: "system", content: "You are an executive operations advisor." },
          { role: "user", content: prompt },
        ]);
        console.log("[RecommendationEngine] Executive alignment synthesis:", summaryResponse.text);
      } catch (err) {
        console.warn("Could not leverage LLM for final dashboard alignment, using deterministic fallback.", err);
      }
    }

    return {
      dossierId: context.dossierId,
      overallHealthScore: weightedHealth,
      estimatedPotentialValue: potentialValue,
      primaryGapsCount,
      prioritizedActions: sortedActions,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export default RecommendationEngine;
