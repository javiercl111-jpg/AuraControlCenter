import type { OrchestratorInput, OrchestratorOutput, PendingSummary } from "../types/orchestrator.types";
import { ReflectionEngine } from "./ReflectionEngine";
import { ConversationEngine } from "./ConversationEngine";
import { AuraPersonality } from "./AuraPersonality";
import { AuraLLMGateway } from "../../core/services/AuraLLMGateway";

export class ConversationOrchestrator {
  private reflectionEngine = new ReflectionEngine();
  private conversationEngine = new ConversationEngine();
  private personality = new AuraPersonality();
  private llmGateway = new AuraLLMGateway();

  public async processTurn(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const { engineInput, conversationStateSnapshot } = input;
    const currentPhase = conversationStateSnapshot.conversationPhase;

    // --- PHASE: SUMMARY_REVIEW ---
    if (currentPhase === "SUMMARY_REVIEW") {
      return this.handleSummaryReviewPhase(input);
    }

    // --- PHASE: DISCOVERY ---
    const isInitialTurn = engineInput.conversationHistory.length === 0 && engineInput.currentResponse.trim() === "";

    if (isInitialTurn) {
      const initialState = this.reflectionEngine.createInitialState();
      const conversationOutput = this.conversationEngine.processTurn(engineInput);
      const personalityDecision = this.personality.evaluateContext(0, engineInput.confidenceLevel, engineInput.hypotheses.length);

      return {
        finalMessage: conversationOutput.nextQuestion,
        finalIntent: conversationOutput.nextIntent,
        reflectionOutput: {
          contradictionDetails: [],
          evidenceExtracted: [],
          dimensionsUpdated: [],
          responseRelevance: 0,
          coherenceScore: 100,
          ambiguityReasons: [],
          omittedTopics: [],
          isTooShort: false,
          isAmbiguous: false,
          hasContradiction: false,
          recommendedAction: "ACCEPT",
          suggestedClarification: null,
          shouldDeepen: false,
          hasEnoughEvidence: false,
          internalReflection: "Initial turn, starting conversation."
        },
        conversationOutput,
        personalityDecision,
        shouldAdvance: false,
        shouldPersistEvidence: false,
        shouldComplete: false,
        updatedConversationPhase: currentPhase,
        updatedReflectionState: initialState,
        updatedConfidenceMatrix: initialState.matrix,
        pendingSummary: conversationStateSnapshot.pendingSummary,
        updatedFallbackCount: 0,
      };
    }

    // 1. Reflect on the user's input
    const { output: reflectionOutput, newState: updatedReflectionState } = 
      this.reflectionEngine.analyzeResponse({
        currentResponse: engineInput.currentResponse,
        conversationHistory: engineInput.conversationHistory,
        activeHypotheses: engineInput.hypotheses,
        partialDossier: engineInput.partialDossier,
        previousReflectionState: input.reflectionState,
        currentIntent: "DISCOVER_PROBLEM",
      });

    const recommendedAction = reflectionOutput.recommendedAction;
    
    // Default outputs
    let finalMessage = "";
    let finalIntent = "DISCOVER_PROBLEM";
    let conversationOutput = undefined;
    let shouldAdvance = false;
    let shouldPersistEvidence = false;
    let shouldComplete = false;
    let updatedConversationPhase = currentPhase;
    let updatedConfidenceMatrix = updatedReflectionState.matrix;
    let pendingSummary: PendingSummary | undefined = conversationStateSnapshot.pendingSummary;

    let fallbackCount = conversationStateSnapshot.fallbackConsecutiveCount || 0;
    
    if (recommendedAction === "CLARIFY" || recommendedAction === "CHALLENGE") {
      fallbackCount++;
      shouldAdvance = false;
      shouldPersistEvidence = false;
      
      if (fallbackCount === 1) {
        finalMessage = reflectionOutput.suggestedClarification || "Por favor, ¿podrías aclarar tu última respuesta?";
        finalIntent = recommendedAction;
      } else if (fallbackCount === 2) {
        finalMessage = "Parece que no logro procesar bien tu respuesta anterior. Intentémoslo de otra forma: ¿Qué procesos de tu área te generan más dolores de cabeza?";
        finalIntent = "CLARIFY";
      } else {
        finalMessage = "He tenido dificultades continuas para comprender la información proporcionada. ¿Cómo te gustaría proceder?";
        finalIntent = "FALLBACK_OPTIONS";
      }
    } 
    else if (recommendedAction === "DEEPEN" || recommendedAction === "ACCEPT") {
      fallbackCount = 0;
      // Pass the updated inputs (e.g. valid useful responses count)
      const historyQuestions = engineInput.conversationHistory
        .filter(m => m.role === "aura")
        .map(m => m.content);

      const modifiedEngineInput = {
        ...engineInput,
        askedQuestions: Array.from(new Set([...engineInput.askedQuestions, ...historyQuestions])),
        partialDossier: { ...engineInput.partialDossier, ...reflectionOutput.dimensionsUpdated.reduce((acc, dim) => ({...acc, [dim]: true}), {}) },
      };
      
      conversationOutput = this.conversationEngine.processTurn(modifiedEngineInput);
      finalMessage = conversationOutput.nextQuestion;
      finalIntent = conversationOutput.nextIntent;
      
      shouldAdvance = true;
      shouldPersistEvidence = true;

      // The Conversation Engine might also decide to Summarize/Close based on its internal limits
      if (conversationOutput.nextIntent === "SUMMARIZE") {
        return this.generateSummaryTransition(reflectionOutput, updatedReflectionState, fallbackCount);
      }
    } 
    else if (recommendedAction === "SUMMARIZE") {
      fallbackCount = 0;
      return this.generateSummaryTransition(reflectionOutput, updatedReflectionState, fallbackCount);
    } 
    else if (recommendedAction === "STOP") {
      fallbackCount = 0;
      finalMessage = "He recopilado toda la información necesaria. Muchas gracias por tu tiempo.";
      finalIntent = "STOP";
      shouldComplete = true;
      updatedConversationPhase = "COMPLETED";
    }

    // Apply Aura Personality touch to final message if not closed and not in fallback options
    const personalityDecision = finalIntent !== "FALLBACK_OPTIONS" ? this.personality.evaluateContext(
      engineInput.conversationHistory.length,
      engineInput.confidenceLevel,
      engineInput.hypotheses.length
    ) : {};

    const heuristicOutput: OrchestratorOutput = {
      finalMessage,
      finalIntent,
      reflectionOutput,
      conversationOutput,
      personalityDecision,
      shouldAdvance,
      shouldPersistEvidence,
      shouldComplete,
      updatedConversationPhase,
      updatedReflectionState,
      updatedConfidenceMatrix,
      pendingSummary,
      updatedFallbackCount: fallbackCount,
    };

    // --- SHADOW MODE EVALUATION (Parallel / Background) ---
    if (conversationStateSnapshot.llmModeForSession !== "HEURISTIC_ONLY") {
      this.llmGateway.evaluateTurn(input).then(llmResult => {
        this.compareAndLogShadowEvaluation(heuristicOutput, llmResult);
      }).catch(err => {
        console.warn("Background LLM evaluation failed:", err);
      });
    }

    return heuristicOutput;
  }

  private compareAndLogShadowEvaluation(heuristicOutput: OrchestratorOutput, llmResult: any) {
    if (llmResult.fallbackUsed) {
      console.log("[SHADOW] LLM Fallback Used. No comparison made.");
      return;
    }

    const heuristicAction = heuristicOutput.reflectionOutput.recommendedAction;
    const llmAction = llmResult.reflectionProposal?.recommendedAction;
    
    const agreement = heuristicAction === llmAction;
    const relevanceDifference = Math.abs(heuristicOutput.reflectionOutput.responseRelevance - (llmResult.reflectionProposal?.responseRelevance || 0));
    const coherenceDifference = Math.abs(heuristicOutput.reflectionOutput.coherenceScore - (llmResult.reflectionProposal?.coherenceScore || 0));
    
    console.log("================ SHADOW EVALUATION ================");
    console.log(`Agreement: ${agreement ? "✅ YES" : "❌ NO"}`);
    console.log(`Heuristic Action: ${heuristicAction} | LLM Action: ${llmAction}`);
    console.log(`Relevance Diff: ${relevanceDifference} | Coherence Diff: ${coherenceDifference}`);
    console.log(`Safety Passed: ${llmResult.validationPassed}`);
    console.log(`Latency: ${llmResult.telemetry?.latencyMs}ms`);
    console.log("===================================================");
    
    // In a real production scenario, this would write to Firestore's discovery_llm_usage telemetry collection.
  }

  private handleSummaryReviewPhase(input: OrchestratorInput): OrchestratorOutput {
    const text = input.engineInput.currentResponse.toLowerCase().trim();
    const confirmations = ["si", "sí", "correcto", "así es", "esta bien", "está bien", "refleja", "de acuerdo", "es correcto"];
    
    const isConfirmed = confirmations.some(c => text === c || text.startsWith(c));

    if (isConfirmed) {
      return {
        finalMessage: "Perfecto. He guardado el expediente consolidado y preparado la Radiografía Empresarial Aura™. Un consultor se pondrá en contacto pronto.",
        finalIntent: "STOP",
        reflectionOutput: this.createEmptyReflection(),
        personalityDecision: {},
        shouldAdvance: false,
        shouldPersistEvidence: false,
        shouldComplete: true,
        updatedConversationPhase: "COMPLETED",
        updatedReflectionState: input.reflectionState,
        updatedConfidenceMatrix: input.confidenceMatrix,
        pendingSummary: undefined,
        updatedFallbackCount: 0
      };
    } else {
      // It's a correction
      const { output: reflectionOutput, newState: updatedReflectionState } = this.reflectionEngine.analyzeResponse({
        currentResponse: input.engineInput.currentResponse,
        conversationHistory: input.engineInput.conversationHistory,
        activeHypotheses: input.engineInput.hypotheses,
        partialDossier: input.engineInput.partialDossier,
        previousReflectionState: input.reflectionState,
        currentIntent: "SUMMARY_REVIEW",
      });

      const newSummaryText = "Entendido, he actualizado el expediente con esta corrección. " + this.buildSummaryText(updatedReflectionState);

      return {
        finalMessage: `${newSummaryText} ¿Es correcto ahora?`,
        finalIntent: "SUMMARIZE",
        reflectionOutput,
        personalityDecision: {},
        shouldAdvance: false, // Don't count as standard discovery turn
        shouldPersistEvidence: true, // We did get new evidence
        shouldComplete: false,
        updatedConversationPhase: "SUMMARY_REVIEW",
        updatedReflectionState,
        updatedConfidenceMatrix: updatedReflectionState.matrix,
        pendingSummary: {
          text: newSummaryText,
          generatedAt: new Date().toISOString(),
          awaitingConfirmation: true
        }
      };
    }
  }

  private generateSummaryTransition(reflectionOutput: any, updatedReflectionState: any, fallbackCount: number): OrchestratorOutput {
    const summaryText = this.buildSummaryText(updatedReflectionState);
    const finalMessage = `Antes de concluir, quiero confirmar que comprendí correctamente tu organización:\n\n${summaryText}\n\n¿Esto refleja adecuadamente tu situación o te gustaría corregir algún punto?`;

    return {
      finalMessage,
      finalIntent: "SUMMARIZE",
      reflectionOutput,
      personalityDecision: {},
      shouldAdvance: false,
      shouldPersistEvidence: true,
      shouldComplete: false,
      updatedConversationPhase: "SUMMARY_REVIEW",
      updatedReflectionState,
      updatedConfidenceMatrix: updatedReflectionState.matrix,
      pendingSummary: {
        text: summaryText,
        generatedAt: new Date().toISOString(),
        awaitingConfirmation: true
      },
      updatedFallbackCount: fallbackCount,
    };
  }

  private buildSummaryText(state: any): string {
    const evidence = state.extractedEvidenceTotal;
    if (evidence.length === 0) return "Tu organización está evaluando mejoras operativas.";
    return evidence.slice(0, 3).map((e: string) => `- ${e}`).join("\n");
  }

  private createEmptyReflection(): any {
    return {
      hasContradiction: false,
      isAmbiguous: false,
      isTooShort: false,
      responseRelevance: 0,
      contradictionDetails: [],
      ambiguityReasons: [],
      omittedTopics: [],
      coherenceScore: 100,
      evidenceExtracted: [],
      dimensionsUpdated: [],
      suggestedClarification: null,
      recommendedAction: "ACCEPT",
      shouldDeepen: false,
      hasEnoughEvidence: true,
      internalReflection: "Processing summary review phase."
    };
  }
}

export default ConversationOrchestrator;
