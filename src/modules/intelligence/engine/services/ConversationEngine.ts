import type { EngineInput, EngineOutput } from "../types/conversation.types";
import { AuraPersonality } from "./AuraPersonality";

export class ConversationEngine {
  private personality: AuraPersonality;

  constructor(personality?: AuraPersonality) {
    this.personality = personality || new AuraPersonality();
  }

  private isResponseValid(response: string, input?: EngineInput): boolean {
    const text = response.toLowerCase().trim();
    if (!text) return false;

    if (input && input.conversationHistory && input.conversationHistory.length > 0) {
      const lastAuraMsg = input.conversationHistory.filter(m => m.role === "aura").pop();
      const lastQuestion = lastAuraMsg ? lastAuraMsg.content.toLowerCase() : "";

      const isIndustryQuestion = lastQuestion.includes("giro de tu empresa") || lastQuestion.includes("a qué se dedica");
      const isBinaryQuestion = lastQuestion.includes("experimentado alguna queja") ||
                               lastQuestion.includes("están listos para") ||
                               lastQuestion.includes("han tenido");

      if (isBinaryQuestion) {
        const binaryAnswers = ["si", "sí", "no", "correcto", "así es", "no hemos tenido", "sí hemos tenido"];
        const normalized = text.replace(/[.,!¡¿?]/g, '');
        if (binaryAnswers.includes(normalized) || text.includes("si ") || text.includes("no ")) {
          return true;
        }
      }

      if (isIndustryQuestion) {
        if (text.length >= 4 && !/^([a-z])\1+$/.test(text) && !/asdf|qwer/.test(text)) {
          return true;
        }
      }
    }

    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;

    if (wordCount < 3 && charCount < 12) {
      return false;
    }

    const keywords = [
      "empresa", "operacion", "operación", "personas", "procesos", "proceso", 
      "sistemas", "sistema", "ventas", "venta", "administracion", "administración", 
      "rh", "recursos humanos", "clientes", "cliente", "inventario", "inventarios",
      "mantenimiento", "prioridades", "prioridad", "excel", "papel", "manual",
      "si", "sí", "no", "nunca", "siempre", "queja", "frecuente", "problema", 
      "error", "pago", "nomina", "nómina", "tiempo", "dinero", "hospedaje", "logistica",
      "logística", "construccion", "construcción", "transporte", "consultoria", "consultoría",
      "comercio", "manufactura", "administrativo", "administrativos", "administrativa", "administrativas", "digital", "digitales"
    ];

    return keywords.some(kw => text.includes(kw));
  }

  public processTurn(input: EngineInput): EngineOutput {
    const historyLength = input.conversationHistory.length;
    let currentConfidence = input.confidenceLevel;
    const currentResponse = input.currentResponse;
    const turnCount = input.turnCount + 1; // Assuming we increment here
    const updatedDossier: any = { ...input.partialDossier };
    
    // 1. Validation
    if (historyLength > 0 && !this.isResponseValid(currentResponse, input)) {
      return {
        nextIntent: "CLARIFICATION",
        nextQuestion: "Quiero asegurarme de comprender correctamente tu empresa. ¿Podrías responderlo pensando en tus procesos, equipo, operación o administración?",
        reason: "Input validation failed. Requesting clarification.",
        newHypotheses: [],
        discardedHypotheses: [],
        updatedConfidence: currentConfidence,
        internalSummary: "Awaiting valid input.",
        updatedDossier,
        isValidResponse: false
      };
    }

    const usefulResponsesCount = input.usefulResponsesCount + (historyLength > 0 ? 1 : 0);

    // 2. Completion Check
    if (
      usefulResponsesCount >= 5 || 
      turnCount >= 8 || 
      (currentConfidence >= 85 && usefulResponsesCount >= 4)
    ) {
      return {
        nextIntent: "CLOSING",
        nextQuestion: `Gracias. He comprendido bastante sobre ${input.companyName}. Estoy procesando tu Radiografía Empresarial Aura™ y el Executive Briefing™.`,
        reason: "Completion criteria met.",
        newHypotheses: [],
        discardedHypotheses: [],
        updatedConfidence: 100,
        internalSummary: "Ready to generate dossier.",
        updatedDossier,
        isValidResponse: true
      };
    }

    // 3. Evaluate Context with Personality Layer
    const hypothesesCount = input.hypotheses.length;
    const personalityDecision = this.personality.evaluateContext(
      historyLength,
      currentConfidence,
      hypothesesCount
    );

    // 4. Simulated Reasoning Logic (V1 without LLM)
    let nextIntent: EngineOutput["nextIntent"] = "DISCOVER_PROBLEM";
    let nextQuestion = "";
    let reason = "";
    let newHypotheses: string[] = [];
    let discardedHypotheses: string[] = [];
    let internalSummary = "";

    const askedQuestions = input.askedQuestions;

    const availableQuestions = [
      {
        intent: "GREETING",
        q: "Gracias por tu tiempo. El objetivo de este diagnóstico es entender cómo opera tu organización para diseñar soluciones precisas que les aporten valor. No necesitas contar con información técnica; tendremos una charla sencilla sobre tu día a día. Para comenzar, me gustaría saber, ¿cuál es el giro de tu empresa y cuál consideras que es su reto administrativo u operativo más importante en este momento?",
        c: 20
      },
      {
        intent: "CONFIRM_HYPOTHESIS",
        q: `Controlar procesos manualmente incrementa la probabilidad de inconsistencias. ¿Han experimentado alguna queja o incidencia en el pago de horas extras en los últimos meses?`,
        c: 30
      },
      {
        intent: "DISCOVER_PROBLEM",
        q: `Para concluir el expediente, ¿cuál es tu principal prioridad organizativa para los próximos 3 meses?`,
        c: 25
      },
      {
        intent: "DISCOVER_PROBLEM",
        q: `¿Qué proceso administrativo actual consideran que les consume más tiempo operativo a ti o a tu equipo?`,
        c: 20
      },
      {
        intent: "DISCOVER_PROBLEM",
        q: `Hablando de crecimiento, ¿consideran que sus sistemas actuales están listos para soportar el doble de operaciones sin requerir más personal administrativo?`,
        c: 20
      }
    ];

    // Find the first question that hasn't been asked yet
    const nextQObj = availableQuestions.find(q => !askedQuestions.includes(q.q));

    if (nextQObj) {
      nextIntent = nextQObj.intent as any;
      nextQuestion = nextQObj.q;
      reason = "Asking next unasked question.";
      currentConfidence += nextQObj.c;
    } else {
      // If we run out of predefined questions, just close
      nextIntent = "CLOSING";
      nextQuestion = `Gracias. He comprendido bastante sobre ${input.companyName}. Estoy procesando tu Radiografía Empresarial Aura™ y el Executive Briefing™.`;
      reason = "Ran out of questions, closing.";
      currentConfidence = 100;
    }

    // Heuristics based on responses (simulated AI)
    const text = currentResponse.toLowerCase();
    if (text.includes("error") || text.includes("pago") || text.includes("nomina") || text.includes("nómina")) {
      updatedDossier.priority = "Reducir errores en pre-nómina";
    }
    if (text.includes("excel") || text.includes("papel") || text.includes("manual")) {
      updatedDossier.schedulingMethod = "Excel y papel";
      newHypotheses.push("Alta probabilidad de errores en pagos");
    }
    if (text.includes("si") || text.includes("queja") || text.includes("frecuente")) {
      updatedDossier.payrollIncidents = true;
    } else if (text.includes("no") || text.includes("nunca")) {
      discardedHypotheses.push("Alta probabilidad de errores en pagos");
      updatedDossier.payrollIncidents = false;
    }

    return {
      nextIntent,
      nextQuestion,
      reason: `${reason} | Tone used: ${personalityDecision.recommendedTone}`,
      newHypotheses,
      discardedHypotheses,
      updatedConfidence: Math.min(100, currentConfidence),
      internalSummary,
      updatedDossier,
      isValidResponse: true
    };
  }
}

export default ConversationEngine;
