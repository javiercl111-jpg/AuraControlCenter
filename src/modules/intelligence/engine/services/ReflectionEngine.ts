import type { 
  ReflectionEngineInput, 
  ReflectionOutput, 
  ReflectionState, 
  ConfidenceMatrix,
  DimensionAssessment,
  ContradictionDetail,
  RecommendedAction
} from "../types/reflection.types";

export class ReflectionEngine {

  public createInitialState(): ReflectionState {
    const emptyDimension = (): DimensionAssessment => ({
      score: 0,
      evidenceCount: 0,
      missingEvidence: ["Baselines no establecidos"],
      lastUpdatedAt: new Date(),
    });

    return {
      matrix: {
        people: emptyDimension(),
        operations: emptyDimension(),
        compliance: emptyDimension(),
        digitalization: emptyDimension(),
        technology: emptyDimension(),
        sales: emptyDimension(),
        finance: emptyDimension(),
        maintenance: emptyDimension(),
      },
      extractedEvidenceTotal: [],
      detectedContradictionsTotal: [],
      topicsCovered: [],
    };
  }

  public analyzeResponse(input: ReflectionEngineInput): { output: ReflectionOutput, newState: ReflectionState } {
    const text = input.currentResponse.toLowerCase().trim();
    const currentState = input.previousReflectionState || this.createInitialState();
    
    // Default outputs
    let isTooShort = false;
    let isAmbiguous = false;
    let hasContradiction = false;
    let responseRelevance = 0;
    let coherenceScore = 100;
    let recommendedAction: RecommendedAction = "ACCEPT";
    let suggestedClarification: string | null = null;
    
    const ambiguityReasons: string[] = [];
    const contradictionDetails: ContradictionDetail[] = [];
    const evidenceExtracted: string[] = [];
    const dimensionsUpdated: string[] = [];
    const omittedTopics: string[] = [];
    let internalReflection = "";

    // 0. Edge Case: Conversational Confirmations during clarification
    const isConfirmation = this.isConversationalConfirmation(text);

    // Check if we are waiting for a clarification
    const lastAuraMsg = input.conversationHistory.filter(m => m.role === "aura").pop();
    const isWaitingForClarification = lastAuraMsg && (
      lastAuraMsg.content.includes("Quiero asegurarme de comprender") ||
      lastAuraMsg.content.includes("aclarar tu última respuesta") ||
      lastAuraMsg.content.includes("no logro procesar bien")
    );

    const words = text.split(/\s+/);

    if (isConfirmation && isWaitingForClarification) {
      isTooShort = true;
      responseRelevance = 0;
      coherenceScore = 10;
      recommendedAction = "CLARIFY";
      suggestedClarification = "Gracias. Para orientarnos mejor, cuéntame cómo realizan actualmente ese proceso en tu empresa y qué parte suele generar más dificultades.";
      ambiguityReasons.push("Conversational confirmation instead of business answer.");
      internalReflection = "User replied with a conversational confirmation during clarify flow.";
    }
    // 1. Edge Case: Gibberish (e.g. "asdf")
    else if (words.length === 1 && text.length < 5 && !this.isKnownShortValid(text)) {
      isTooShort = true;
      responseRelevance = 0;
      coherenceScore = 10;
      recommendedAction = "CLARIFY";
      suggestedClarification = "No logré relacionar esa respuesta con la operación de tu empresa. Para continuar, cuéntame algo sobre tus procesos, equipo, clientes, sistemas o prioridades actuales.";
      ambiguityReasons.push("Respuesta demasiado corta sin significado claro.");
      internalReflection = "User provided gibberish or extremely short invalid response.";
    } 
    // 2. Short but Valid (e.g. "Usamos SAP")
    else if (words.length <= 3 && this.isKnownShortValid(text)) {
      responseRelevance = 80;
      evidenceExtracted.push(`Mencionó tecnología/sistema: ${text}`);
      dimensionsUpdated.push("technology", "digitalization");
      internalReflection = "User provided a short but highly relevant categorical answer.";
    }
    else if (words.length <= 2 && this.isAmbiguousTopic(text)) {
      isAmbiguous = true;
      responseRelevance = 30;
      recommendedAction = "CLARIFY";
      if (text === "recursos humanos" || text === "rh") {
        suggestedClarification = "Recursos Humanos puede abarcar varios temas. ¿Tu prioridad está relacionada principalmente con contratación, rotación, asistencia, nómina, capacitación o administración del personal?";
      } else {
        suggestedClarification = `Mencionas ${text}. ¿Qué proceso exacto dentro de esa área te está generando más fricción?`;
      }
      ambiguityReasons.push("Mencionó un área general sin acción o proceso específico.");
      internalReflection = "User named a broad department but no specific pain point.";
    }
    // 4. Relevant, longer response
    else if (words.length >= 3) {
      responseRelevance = 90;
      evidenceExtracted.push(`Descripción detallada de procesos: ${text.substring(0, 30)}...`);
      if (text.includes("excel") || text.includes("manual")) dimensionsUpdated.push("operations", "digitalization");
      if (text.includes("error") || text.includes("dinero")) dimensionsUpdated.push("finance", "compliance");
      internalReflection = "User provided a substantial and relevant response.";
    }

    // 5. Contradiction Detection
    // Example rule: User history implies "excel" or "manual", but now says "automatización total"
    const historyText = input.conversationHistory.map(m => m.content.toLowerCase()).join(" ");
    if (
      (historyText.includes("excel") || historyText.includes("manual") || historyText.includes("papel")) &&
      (text.includes("automatización total") || text.includes("todo automático"))
    ) {
      hasContradiction = true;
      coherenceScore = 40;
      recommendedAction = "CHALLENGE";
      suggestedClarification = "Me comentaste antes que utilizaban métodos manuales o Excel, pero ahora mencionas automatización total. ¿Podrías ayudarme a entender cómo conviven ambos escenarios en tu día a día?";
      contradictionDetails.push({
        previousStatement: "Uso de Excel/Métodos manuales",
        currentStatement: "Automatización total",
        topic: "digitalization",
        severity: "HIGH",
        suggestedClarification: "Resolver discrepancia entre manualidad y automatización."
      });
      internalReflection += " Detected contradiction regarding digitalization maturity.";
    }

    // 6. Evidence Thresholds & Deepen Logic
    let shouldDeepen = false;
    let hasEnoughEvidence = false;
    
    // Simulate dimension updates based on extracted evidence
    const newMatrix = { ...currentState.matrix };
    dimensionsUpdated.forEach(dim => {
      const key = dim as keyof ConfidenceMatrix;
      newMatrix[key] = {
        ...newMatrix[key],
        score: Math.min(100, newMatrix[key].score + 25),
        evidenceCount: newMatrix[key].evidenceCount + 1,
        lastUpdatedAt: new Date()
      };
    });

    const totalEvidence = Object.values(newMatrix).reduce((acc, dim) => acc + dim.evidenceCount, 0);
    
    if (totalEvidence >= 5) {
      hasEnoughEvidence = true;
      if (recommendedAction === "ACCEPT") {
        recommendedAction = "SUMMARIZE";
      }
    } else if (recommendedAction === "ACCEPT" && responseRelevance > 70) {
      shouldDeepen = true;
      recommendedAction = "DEEPEN";
    }

    // Build the updated state
    const newState: ReflectionState = {
      matrix: newMatrix,
      extractedEvidenceTotal: [...currentState.extractedEvidenceTotal, ...evidenceExtracted],
      detectedContradictionsTotal: [...currentState.detectedContradictionsTotal, ...contradictionDetails],
      topicsCovered: Array.from(new Set([...currentState.topicsCovered, ...dimensionsUpdated]))
    };

    const output: ReflectionOutput = {
      hasContradiction,
      isAmbiguous,
      isTooShort,
      responseRelevance,
      contradictionDetails,
      ambiguityReasons,
      omittedTopics,
      coherenceScore,
      evidenceExtracted,
      dimensionsUpdated,
      suggestedClarification,
      recommendedAction,
      shouldDeepen,
      hasEnoughEvidence,
      internalReflection
    };

    return { output, newState };
  }

  // --- Heuristics Helpers ---

  private isConversationalConfirmation(text: string): boolean {
    const confirmations = [
      "claro", "si", "sí", "de acuerdo", "por supuesto", "adelante", "correcto", "esta bien", "está bien"
    ];
    const normalized = text.toLowerCase().trim().replace(/[.,!¡¿?]/g, '');
    return confirmations.includes(normalized);
  }

  private isKnownShortValid(text: string): boolean {
    const validTerms = ["sap", "oracle", "salesforce", "excel", "si", "sí", "no", "nunca", "hubspot", "jira"];
    return validTerms.some(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      return regex.test(text);
    });
  }

  private isAmbiguousTopic(text: string): boolean {
    const broadTopics = ["recursos humanos", "rh", "ventas", "operaciones", "tecnología", "ti", "sistemas", "marketing"];
    return broadTopics.some(topic => text === topic);
  }
}

export default ReflectionEngine;
