import type { IBusinessAssessmentBrain, AssessmentResult, DiagnosticGap, IntelligenceContext } from "../types/brains";
import type { ILLMProvider } from "../types/llm";

export class BusinessAssessmentBrain implements IBusinessAssessmentBrain {
  private llmProvider: ILLMProvider;

  constructor(llmProvider: ILLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * Diagnoses compliance issues, digital maturity level, and software recommendation.
   */
  public async performDiagnostic(context: IntelligenceContext): Promise<AssessmentResult> {
    const systemPrompt = `You are the Business Assessment Brain of Aura HCM.
Analyze the customer context and perform a detailed diagnostic audit.
Assess compliance health, digital maturity index (0-100), identify explicit gap vectors, and outline opportunities.`;

    const userPrompt = `Context details:
${context.dossierSummary}
Facts gathered:
${context.relevantFacts.join("\n")}
Employee headcount: ${context.hrSnapshot.employeeCount}
Locations: ${context.operationalSnapshot.locationsCount}`;

    const schema = {
      digitalMaturityScore: "number (0 to 100)",
      complianceHealthScore: "number (0 to 100)",
      gapsIdentified: "array of objects { area: string, severity: string, gapDescription: string, regulatoryImpact: string, estimatedFineCost: number, remediationAction: string }",
      strengths: "array of strings",
      opportunities: "array of strings",
      recommendedModules: "array of strings",
      executiveSummary: "string",
    };

    try {
      const response = await this.llmProvider.generateStructuredOutput<AssessmentResult>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        schema
      );

      return {
        digitalMaturityScore: typeof response.digitalMaturityScore === "number" ? response.digitalMaturityScore : this.calculateMaturityScore(context),
        complianceHealthScore: typeof response.complianceHealthScore === "number" ? response.complianceHealthScore : this.calculateComplianceScore(context),
        gapsIdentified: Array.isArray(response.gapsIdentified) ? response.gapsIdentified : this.generateLocalGaps(context),
        strengths: Array.isArray(response.strengths) ? response.strengths : ["Interested in process optimization", "Has structure"],
        opportunities: Array.isArray(response.opportunities) ? response.opportunities : ["Migrate spreadsheets to database", "Implement electronic contract signature NOM-151"],
        recommendedModules: Array.isArray(response.recommendedModules) ? response.recommendedModules : ["Aura HCM", "Aura Signature"],
        executiveSummary: response.executiveSummary || "Lead presents structural gaps in attendance control and document authorization that can be remedied via Aura Core modules.",
      };
    } catch (err) {
      console.warn("LLM diagnostic execution failed, fallback triggered:", err);
      return this.getLocalDiagnosticFallback(context);
    }
  }

  private calculateMaturityScore(context: IntelligenceContext): number {
    let score = 20; // baseline
    if (context.relevantFacts.some((f) => f.includes("Medium"))) score += 30;
    if (context.relevantFacts.some((f) => f.includes("High"))) score += 60;
    return Math.min(score, 100);
  }

  private calculateComplianceScore(context: IntelligenceContext): number {
    const gapsCount = context.relevantFacts.filter((f) => f.includes("Compliance Gap")).length;
    return Math.max(100 - gapsCount * 25, 10);
  }

  private generateLocalGaps(context: IntelligenceContext): DiagnosticGap[] {
    const gaps: DiagnosticGap[] = [];

    context.relevantFacts.forEach((fact) => {
      if (fact.includes("Lack of automated time-and-attendance")) {
        gaps.push({
          area: "attendance",
          severity: "HIGH",
          gapDescription: "Falta de registro confiable de asistencia laboral.",
          regulatoryImpact: "Art. 804 LFT exige conservar registros de asistencia. Riesgo de multas en auditorías de la STPS.",
          estimatedFineCost: 4500,
          remediationAction: "Implementar módulo de Reloj Checador Digital en Aura.",
        });
      }
      if (fact.includes("Manual contract signatures")) {
        gaps.push({
          area: "contracts",
          severity: "MEDIUM",
          gapDescription: "Firmas de contratos hechas en papel de forma física.",
          regulatoryImpact: "Sobrecosto en logística física y falta de validez NOM-151 para auditorías descentralizadas.",
          estimatedFineCost: 1200,
          remediationAction: "Activar Aura Signature con NOM-151 para expedientes electrónicos.",
        });
      }
      if (fact.includes("Payroll managed in spreadsheets")) {
        gaps.push({
          area: "payroll",
          severity: "CRITICAL",
          gapDescription: "Procesamiento de nómina en plantillas Excel.",
          regulatoryImpact: "Riesgo extremo de discrepancia fiscal con el SAT por falta de timbrado de nómina automatizado.",
          estimatedFineCost: 15000,
          remediationAction: "Integrar el core de nómina Aura HCM.",
        });
      }
    });

    // Fallback default gap if none were triggered
    if (gaps.length === 0) {
      gaps.push({
        area: "compliance",
        severity: "LOW",
        gapDescription: "Expediente de empleados incompleto.",
        regulatoryImpact: "Dificultad de defensa legal ante demandas por carecer de contratos accesibles.",
        estimatedFineCost: 800,
        remediationAction: "Estandarizar expedientes en la nube.",
      });
    }

    return gaps;
  }

  private getLocalDiagnosticFallback(context: IntelligenceContext): AssessmentResult {
    return {
      digitalMaturityScore: this.calculateMaturityScore(context),
      complianceHealthScore: this.calculateComplianceScore(context),
      gapsIdentified: this.generateLocalGaps(context),
      strengths: ["Disposición para digitalizar expedientes"],
      opportunities: ["Centralización en la nube", "Reducción de carga administrativa"],
      recommendedModules: ["Aura HCM Core", "Aura Signature"],
      executiveSummary: "Evaluación local determinó fallas de cumplimiento que reducen la productividad operativa.",
    };
  }
}

export default BusinessAssessmentBrain;
