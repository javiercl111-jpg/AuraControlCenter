import type { ICommercialBrain, CommercialLeadQualification, OutreachPitch, IntelligenceContext } from "../types/brains";
import type { ILLMProvider } from "../types/llm";

export class CommercialBrain implements ICommercialBrain {
  private llmProvider: ILLMProvider;

  constructor(llmProvider: ILLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * Qualifies a lead's conversion potential and estimated contract value using model-agnostic prompts.
   */
  public async qualifyLead(context: IntelligenceContext): Promise<CommercialLeadQualification> {
    const systemPrompt = `You are the Commercial Brain of Aura HCM. 
Analyze the customer's Smart Business Dossier context and qualify the lead.
Provide standard structures including qualification score, probability, estimated values, and target products.`;

    const userPrompt = `Dossier Context:
${context.dossierSummary}
Key Facts:
${context.relevantFacts.join("\n")}
Estimated MRR: ${context.financialSnapshot.estimatedMrr}`;

    const schema = {
      score: "number (0 to 100 lead score)",
      qualificationLabel: "string ('MQL' | 'SQL' | 'DISQUALIFIED' | 'NURTURE')",
      conversionProbability: "number (0 to 100 percentage)",
      estimatedValue: {
        oneTimeFee: "number",
        mrr: "number",
        arr: "number",
      },
      qualificationReason: "string (why did you qualify it this way?)",
      keyPainPoints: "array of strings",
      suggestedSolutions: "array of objects { productName: string, suiteName: string, priority: 'HIGH'|'MEDIUM'|'LOW' }",
    };

    try {
      const response = await this.llmProvider.generateStructuredOutput<CommercialLeadQualification>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        schema
      );

      // Enforce default fallbacks if LLM stub returns generic strings
      return {
        score: typeof response.score === "number" ? response.score : this.fallbackScore(context),
        qualificationLabel: this.fallbackLabel(context),
        conversionProbability: typeof response.conversionProbability === "number" ? response.conversionProbability : 65,
        estimatedValue: {
          oneTimeFee: typeof response.estimatedValue?.oneTimeFee === "number" ? response.estimatedValue.oneTimeFee : 1500,
          mrr: typeof response.estimatedValue?.mrr === "number" ? response.estimatedValue.mrr : context.financialSnapshot.estimatedMrr || 250,
          arr: typeof response.estimatedValue?.arr === "number" ? response.estimatedValue.arr : (context.financialSnapshot.estimatedMrr || 250) * 12,
        },
        qualificationReason: response.qualificationReason || "Qualified based on employee count and operational gaps.",
        keyPainPoints: Array.isArray(response.keyPainPoints) ? response.keyPainPoints : ["Manual processes", "Compliance tracking"],
        suggestedSolutions: Array.isArray(response.suggestedSolutions) ? response.suggestedSolutions : [
          { productName: "Aura HCM", suiteName: "People Suite", priority: "HIGH" }
        ],
      };
    } catch (err) {
      console.warn("LLM qualification failed, using local rule fallback:", err);
      return this.getLocalQualificationFallback(context);
    }
  }

  /**
   * Generates a channels-specific outreach copywriting script using model-agnostic prompts.
   */
  public async generateOutreachPitch(
    context: IntelligenceContext,
    channel: "email" | "whatsapp" | "phone"
  ): Promise<OutreachPitch> {
    const systemPrompt = `You are a high-performing Sales Copywriter at Aura HCM.
Write a personalized ${channel} outreach pitch based on the client's business context.`;

    const userPrompt = `Client Name: ${context.businessName}
Industry: ${context.industry}
Employee Count: ${context.hrSnapshot.employeeCount}
Primary Gaps: ${context.relevantFacts.filter((f) => f.includes("Gap")).join("; ")}`;

    const schema = {
      subject: "string (optional, only for email)",
      body: "string (full message script)",
      callToAction: "string (cta line)",
      keySellingPoints: "array of strings",
      objectionsToAnticipate: "array of strings",
      suggestedResponses: "array of strings",
    };

    try {
      const response = await this.llmProvider.generateStructuredOutput<OutreachPitch>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        schema
      );

      return {
        channel,
        subject: channel === "email" ? (response.subject || `Optimiza tu gestión de RRHH en ${context.businessName}`) : undefined,
        body: response.body || `Hola equipo de ${context.businessName}, notamos oportunidades para digitalizar su nómina y control de asistencia...`,
        callToAction: response.callToAction || "Programar demo de 15 minutos.",
        keySellingPoints: Array.isArray(response.keySellingPoints) ? response.keySellingPoints : ["Ahorro en multas", "Reloj checador digital"],
        objectionsToAnticipate: Array.isArray(response.objectionsToAnticipate) ? response.objectionsToAnticipate : ["Costo de licencia"],
        suggestedResponses: Array.isArray(response.suggestedResponses) ? response.suggestedResponses : ["El ROI se paga en 3 meses"],
      };
    } catch (err) {
      console.warn("LLM copy generation failed, returning fallback script:", err);
      return {
        channel,
        subject: channel === "email" ? `Propuesta de Mejora de Procesos - ${context.businessName}` : undefined,
        body: `Hola, me pongo en contacto con ${context.businessName} porque vemos un gran potencial para automatizar sus procesos de asistencia y cumplimiento laboral.`,
        callToAction: "Agendar llamada breve de diagnóstico.",
        keySellingPoints: ["Cumplimiento con LFT", "Cero hojas de Excel"],
        objectionsToAnticipate: ["Ya tenemos otro software"],
        suggestedResponses: ["Aura se integra directamente con su software actual"],
      };
    }
  }

  private fallbackScore(context: IntelligenceContext): number {
    if (context.sizeGroup === "250+") return 90;
    if (context.sizeGroup === "101-250") return 80;
    if (context.sizeGroup === "31-100") return 65;
    return 40;
  }

  private fallbackLabel(context: IntelligenceContext): "MQL" | "SQL" | "DISQUALIFIED" | "NURTURE" {
    if (context.sizeGroup === "250+" || context.sizeGroup === "101-250") return "SQL";
    if (context.sizeGroup === "31-100") return "MQL";
    if (context.hrSnapshot.employeeCount === 0) return "DISQUALIFIED";
    return "NURTURE";
  }

  private getLocalQualificationFallback(context: IntelligenceContext): CommercialLeadQualification {
    const size = context.hrSnapshot.employeeCount;
    const isBig = size > 100;
    return {
      score: this.fallbackScore(context),
      qualificationLabel: this.fallbackLabel(context),
      conversionProbability: isBig ? 85 : 55,
      estimatedValue: {
        oneTimeFee: isBig ? 3000 : 800,
        mrr: isBig ? 1200 : 250,
        arr: isBig ? 14400 : 3000,
      },
      qualificationReason: "Rule-based deterministic qualification.",
      keyPainPoints: ["Falta de control de asistencia", "Cálculo manual de incidencias"],
      suggestedSolutions: [
        { productName: "Aura HCM", suiteName: "People Suite", priority: "HIGH" },
        { productName: "Aura Signature", suiteName: "Digital Trust", priority: "MEDIUM" },
      ],
    };
  }
}

export default CommercialBrain;
