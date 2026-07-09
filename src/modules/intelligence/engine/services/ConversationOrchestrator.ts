import type { OrchestratorInput, OrchestratorOutput, PendingSummary } from "../types/orchestrator.types";
import { ReflectionEngine } from "./ReflectionEngine";
import { ConversationEngine } from "./ConversationEngine";
import { AuraPersonality } from "./AuraPersonality";

export class ConversationOrchestrator {
  private reflectionEngine = new ReflectionEngine();
  private conversationEngine = new ConversationEngine();
  private personality = new AuraPersonality();

  public processTurn(input: OrchestratorInput): OrchestratorOutput {
    const { engineInput, conversationStateSnapshot } = input;
    const currentPhase = conversationStateSnapshot.conversationPhase;

    // --- PHASE: SUMMARY_REVIEW ---
    if (currentPhase === "SUMMARY_REVIEW") {
      return this.handleSummaryReviewPhase(input);
    }

    // --- PHASE: DISCOVERY ---
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

    if (recommendedAction === "CLARIFY" || recommendedAction === "CHALLENGE") {
      finalMessage = reflectionOutput.suggestedClarification || "Por favor, ¿podrías aclarar tu última respuesta?";
      finalIntent = recommendedAction;
      shouldAdvance = false;
      shouldPersistEvidence = false;
    } 
    else if (recommendedAction === "DEEPEN" || recommendedAction === "ACCEPT") {
      // Pass the updated inputs (e.g. valid useful responses count)
      const modifiedEngineInput = {
        ...engineInput,
        partialDossier: { ...engineInput.partialDossier, ...reflectionOutput.dimensionsUpdated.reduce((acc, dim) => ({...acc, [dim]: true}), {}) },
      };
      
      conversationOutput = this.conversationEngine.processTurn(modifiedEngineInput);
      finalMessage = conversationOutput.nextQuestion;
      finalIntent = conversationOutput.nextIntent;
      
      shouldAdvance = true;
      shouldPersistEvidence = true;

      // The Conversation Engine might also decide to Summarize/Close based on its internal limits
      if (conversationOutput.nextIntent === "SUMMARIZE") {
        return this.generateSummaryTransition(reflectionOutput, updatedReflectionState);
      }
    } 
    else if (recommendedAction === "SUMMARIZE") {
      return this.generateSummaryTransition(reflectionOutput, updatedReflectionState);
    } 
    else if (recommendedAction === "STOP") {
      finalMessage = "He recopilado toda la información necesaria. Muchas gracias por tu tiempo.";
      finalIntent = "STOP";
      shouldComplete = true;
      updatedConversationPhase = "COMPLETED";
    }

    // Apply Aura Personality touch to final message if not closed
    const personalityDecision = this.personality.evaluateContext(
      engineInput.conversationHistory.length,
      engineInput.confidenceLevel,
      engineInput.hypotheses.length
    );

    return {
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
      pendingSummary
    };
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
        pendingSummary: undefined
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

  private generateSummaryTransition(reflectionOutput: any, updatedReflectionState: any): OrchestratorOutput {
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
      }
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
