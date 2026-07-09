import type { EngineInput, EngineOutput } from "../types/conversation.types";
import { AuraPersonality } from "./AuraPersonality";

export class ConversationEngine {
  private personality: AuraPersonality;

  constructor(personality?: AuraPersonality) {
    this.personality = personality || new AuraPersonality();
  }

  public processTurn(input: EngineInput): EngineOutput {
    // 1. Evaluate Context with Personality Layer
    const historyLength = input.conversationHistory.length;
    const currentConfidence = input.confidenceLevel;
    const hypothesesCount = input.hypotheses.length;

    const personalityDecision = this.personality.evaluateContext(
      historyLength,
      currentConfidence,
      hypothesesCount
    );

    // 2. Simulated Reasoning Logic (V1 without LLM)
    const currentResponse = input.currentResponse.toLowerCase();
    
    let nextIntent: EngineOutput["nextIntent"] = "DISCOVER_PROBLEM";
    let nextQuestion = "";
    let reason = "";
    let newHypotheses: string[] = [];
    let discardedHypotheses: string[] = [];
    let updatedConfidence = currentConfidence;
    let internalSummary = "";
    const updatedDossier: any = { ...input.partialDossier };

    // Basic heuristic rules based on keywords
    if (historyLength === 0) {
      // First turn
      nextIntent = "GREETING";
      nextQuestion = `Entendido. En el sector de "${input.industry}", el cumplimiento y la gestión eficiente son claves. ¿Cuántos colaboradores activos tienen actualmente y qué método utilizan para programar sus turnos y horarios de trabajo?`;
      reason = "Establishing baseline metrics (size and method).";
      updatedConfidence += 20;
    } else if (personalityDecision.shouldSummarize || personalityDecision.shouldStop) {
      // Reached summary conditions
      nextIntent = "SUMMARIZE";
      nextQuestion = `Gracias. He comprendido bastante sobre ${input.companyName}. Estoy procesando tu Radiografía Empresarial Aura™ y el Executive Briefing™.`;
      reason = "Confidence threshold reached or conversation max length met.";
      internalSummary = "Ready to generate dossier.";
      updatedConfidence = 100;
      if (currentResponse.includes("error") || currentResponse.includes("pago")) {
        updatedDossier.priority = "Reducir errores en pre-nómina";
      }
    } else if (personalityDecision.shouldConfirmHypothesis) {
      nextIntent = "CONFIRM_HYPOTHESIS";
      nextQuestion = `Controlar procesos manualmente incrementa la probabilidad de inconsistencias. ¿Han experimentado alguna queja o incidencia en el pago de horas extras en los últimos meses?`;
      reason = "Confirming manual process issues.";
      if (currentResponse.includes("excel") || currentResponse.includes("papel")) {
        updatedDossier.schedulingMethod = "Excel y papel";
        newHypotheses.push("Alta probabilidad de errores en pagos");
      }
      updatedConfidence += 30;
    } else {
      // Deepen
      nextIntent = "DISCOVER_PROBLEM";
      nextQuestion = `Para concluir el expediente, ¿cuál es tu principal prioridad organizativa para los próximos 3 meses?`;
      reason = "Exploring business priorities based on personality advice: " + personalityDecision.pacingAdvice;
      updatedConfidence += 25;
      
      if (currentResponse.includes("si") || currentResponse.includes("queja") || currentResponse.includes("frecuente")) {
        updatedDossier.payrollIncidents = true;
      } else if (currentResponse.includes("no") || currentResponse.includes("nunca")) {
        discardedHypotheses.push("Alta probabilidad de errores en pagos");
        updatedDossier.payrollIncidents = false;
      }
    }

    // Wrap the response in the EngineOutput contract
    return {
      nextIntent,
      nextQuestion,
      reason: `${reason} | Tone used: ${personalityDecision.recommendedTone}`,
      newHypotheses,
      discardedHypotheses,
      updatedConfidence,
      internalSummary,
      updatedDossier,
    };
  }
}

export default ConversationEngine;
