import type {
  ConversationDraftRequest,
  DraftableConversationIntent,
  OrchestratorInput,
  OrchestratorOutput,
  PendingSummary,
} from "../types/orchestrator.types";
import type {
  ReflectionOutput,
  ReflectionState,
} from "../types/reflection.types";
import { ReflectionEngine } from "./ReflectionEngine";
import { ConversationEngine } from "./ConversationEngine";
import { AuraPersonality } from "./AuraPersonality";
import { AuraLLMGateway } from "../../core/services/AuraLLMGateway";

export class ConversationOrchestrator {
  private readonly reflectionEngine: ReflectionEngine;
  private readonly conversationEngine: ConversationEngine;
  private readonly personality: AuraPersonality;
  private readonly llmGateway: Pick<AuraLLMGateway, "evaluateTurn">;
  private readonly authoritativeQuestionByDraft = new Map<string, string>();

  public constructor(dependencies: {
    reflectionEngine?: ReflectionEngine;
    conversationEngine?: ConversationEngine;
    personality?: AuraPersonality;
    llmGateway?: Pick<AuraLLMGateway, "evaluateTurn">;
  } = {}) {
    this.reflectionEngine = dependencies.reflectionEngine ?? new ReflectionEngine();
    this.conversationEngine = dependencies.conversationEngine ?? new ConversationEngine();
    this.personality = dependencies.personality ?? new AuraPersonality();
    this.llmGateway = dependencies.llmGateway ?? new AuraLLMGateway();
  }

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
        messageSource: "CONVERSATION_ENGINE",
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
    const updatedConfidenceMatrix = updatedReflectionState.matrix;
    const pendingSummary: PendingSummary | undefined = conversationStateSnapshot.pendingSummary;

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
        .flatMap(m => {
          const authoritativeQuestion = this.authoritativeQuestionByDraft.get(m.content);
          return authoritativeQuestion
            ? [m.content, authoritativeQuestion]
            : [m.content];
        });

      const modifiedEngineInput = {
        ...engineInput,
        askedQuestions: Array.from(new Set([...engineInput.askedQuestions, ...historyQuestions])),
        partialDossier: { ...engineInput.partialDossier, ...reflectionOutput.dimensionsUpdated.reduce((acc, dim) => ({...acc, [dim]: true}), {}) },
      };
      
      conversationOutput = this.conversationEngine.processTurn(modifiedEngineInput);
      
      if (!conversationOutput.isValidResponse) {
        fallbackCount++;
        shouldAdvance = false;
        shouldPersistEvidence = false;
        
        if (fallbackCount === 1) {
          finalMessage = conversationOutput.nextQuestion;
          finalIntent = conversationOutput.nextIntent;
        } else if (fallbackCount === 2) {
          finalMessage = "Parece que no logro procesar bien tu respuesta anterior. Intentémoslo de otra forma: ¿Qué procesos de tu área te generan más dolores de cabeza?";
          finalIntent = "CLARIFY";
        } else {
          finalMessage = "He tenido dificultades continuas para comprender la información proporcionada. ¿Cómo te gustaría proceder?";
          finalIntent = "FALLBACK_OPTIONS";
        }
      } else {
        finalMessage = conversationOutput.nextQuestion;
        finalIntent = conversationOutput.nextIntent;
        shouldAdvance = true;
        shouldPersistEvidence = true;
        fallbackCount = 0;

        // The Conversation Engine might also decide to Summarize/Close based on its internal limits
        if (conversationOutput.nextIntent === "CLOSING") {
          shouldComplete = true;
          updatedConversationPhase = "COMPLETED";
          shouldAdvance = false;
          fallbackCount = 0;
        } else if (conversationOutput.nextIntent === "SUMMARIZE") {
          return this.generateSummaryTransition(reflectionOutput, updatedReflectionState, fallbackCount);
        }
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
      messageSource: "CONVERSATION_ENGINE",
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

    if (!this.shouldRequestConversationDraft(heuristicOutput, input)) {
      return heuristicOutput;
    }

    return this.applyConversationDraft(heuristicOutput, input);
  }

  private shouldRequestConversationDraft(
    heuristicOutput: OrchestratorOutput,
    input: OrchestratorInput,
  ): boolean {
    return (
      input.conversationStateSnapshot.llmModeForSession !== "HEURISTIC_ONLY" &&
      input.conversationStateSnapshot.conversationPhase === "DISCOVERY" &&
      input.engineInput.currentResponse.trim().length > 0 &&
      heuristicOutput.shouldAdvance &&
      !heuristicOutput.shouldComplete &&
      heuristicOutput.updatedConversationPhase === "DISCOVERY" &&
      heuristicOutput.conversationOutput?.isValidResponse === true &&
      this.isDraftableIntent(heuristicOutput.finalIntent) &&
      heuristicOutput.conversationOutput.nextIntent === heuristicOutput.finalIntent
    );
  }

  private async applyConversationDraft(
    heuristicOutput: OrchestratorOutput,
    input: OrchestratorInput,
  ): Promise<OrchestratorOutput> {
    if (!this.isDraftableIntent(heuristicOutput.finalIntent)) {
      return heuristicOutput;
    }

    const request: ConversationDraftRequest = {
      engineInput: {
        companyName: input.engineInput.companyName,
        industry: input.engineInput.industry,
        currentResponse: input.engineInput.currentResponse,
        conversationHistory: input.engineInput.conversationHistory.slice(-8),
      },
      conversationPhase: "DISCOVERY",
      authoritativeIntent: heuristicOutput.finalIntent,
      authoritativeQuestion: heuristicOutput.finalMessage,
    };

    let llmResult: unknown;
    try {
      llmResult = await this.llmGateway.evaluateTurn(request);
    } catch {
      return {
        ...heuristicOutput,
        llmFallbackCode: "LLM_GATEWAY_ERROR",
      };
    }

    const validation = this.validateConversationDraft(
      llmResult,
      request.authoritativeIntent,
      request.authoritativeQuestion,
    );

    if (!validation.accepted) {
      console.warn(`[EXECUTIVE_CONVERSATION] ${validation.fallbackCode}`);
      return {
        ...heuristicOutput,
        llmFallbackCode: validation.fallbackCode,
      };
    }

    this.authoritativeQuestionByDraft.set(
      validation.nextQuestion,
      request.authoritativeQuestion,
    );

    return {
      ...heuristicOutput,
      finalMessage: validation.nextQuestion,
      messageSource: "LLM_NEXT_QUESTION",
      llmFallbackCode: undefined,
    };
  }

  private validateConversationDraft(
    result: unknown,
    authoritativeIntent: DraftableConversationIntent,
    authoritativeQuestion: string,
  ):
    | { accepted: true; nextQuestion: string }
    | { accepted: false; fallbackCode: string } {
    const resultRecord = this.asRecord(result);
    if (!resultRecord) {
      return { accepted: false, fallbackCode: "LLM_SCHEMA_INVALID" };
    }

    if (resultRecord.fallbackUsed === true) {
      return {
        accepted: false,
        fallbackCode: this.readSafeErrorCode(resultRecord) ?? "LLM_FALLBACK",
      };
    }

    if (resultRecord.ok !== true) {
      return { accepted: false, fallbackCode: "LLM_RESULT_NOT_OK" };
    }

    if (resultRecord.validationPassed !== true) {
      return { accepted: false, fallbackCode: "LLM_VALIDATION_FAILED" };
    }

    if (resultRecord.safetyPassed !== true) {
      return { accepted: false, fallbackCode: "LLM_SAFETY_REJECTED" };
    }

    if (
      resultRecord.intentCompatible !== true ||
      resultRecord.authoritativeIntent !== authoritativeIntent
    ) {
      return { accepted: false, fallbackCode: "LLM_INTENT_MISMATCH" };
    }

    const proposal = this.asRecord(resultRecord.conversationProposal);
    if (
      !proposal ||
      Object.keys(proposal).some(key => key !== "nextQuestion") ||
      typeof proposal.nextQuestion !== "string"
    ) {
      return { accepted: false, fallbackCode: "LLM_SCHEMA_INVALID" };
    }

    const nextQuestion = proposal.nextQuestion.trim().replace(/\s+/g, " ");
    if (nextQuestion.length === 0) {
      return { accepted: false, fallbackCode: "LLM_QUESTION_EMPTY" };
    }

    if (nextQuestion.length < 8 || nextQuestion.length > 360) {
      return { accepted: false, fallbackCode: "LLM_QUESTION_LENGTH_INVALID" };
    }

    if (/\b(?:STOP|CLOSING)\b/i.test(nextQuestion)) {
      return { accepted: false, fallbackCode: "LLM_CONTROL_TOKEN_REJECTED" };
    }

    if (this.containsUnsafeInstruction(nextQuestion)) {
      return { accepted: false, fallbackCode: "LLM_UNSAFE_INSTRUCTION" };
    }

    if (
      !this.isQuestionIntentCompatible(
        nextQuestion,
        authoritativeIntent,
        authoritativeQuestion,
      )
    ) {
      return { accepted: false, fallbackCode: "LLM_INTENT_MISMATCH" };
    }

    return { accepted: true, nextQuestion };
  }

  private isQuestionIntentCompatible(
    nextQuestion: string,
    authoritativeIntent: DraftableConversationIntent,
    authoritativeQuestion: string,
  ): boolean {
    if (!nextQuestion.includes("?")) {
      return false;
    }

    const normalizedQuestion = this.normalizeForValidation(nextQuestion);
    const normalizedAuthority = this.normalizeForValidation(authoritativeQuestion);
    const authorityTerms = normalizedAuthority
      .split(/[^a-z0-9]+/)
      .filter(term => term.length >= 5 && !this.isIntentStopWord(term));
    const sharesAuthorityTerm = authorityTerms.some(term =>
      normalizedQuestion.includes(term)
    );
    const hasBusinessDiscoverySignal = /\b(proceso|procesos|operacion|operaciones|equipo|prioridad|sistema|sistemas|administracion|cliente|clientes|venta|ventas|tiempo|dificultad|dificultades|problema|problemas|impacto|incidencia|incidencias|empresa|organizacion|inventario|nomina|crecimiento)\b/.test(
      normalizedQuestion,
    );

    if (authoritativeIntent === "DISCOVER_PROBLEM") {
      return sharesAuthorityTerm || hasBusinessDiscoverySignal;
    }

    const hasConfirmationSignal = /\b(han|tienen|ocurre|sucede|existe|consideran|experimentado|confirman|siguen|usan|cuentan)\b/.test(
      normalizedQuestion,
    );
    return hasConfirmationSignal && (sharesAuthorityTerm || hasBusinessDiscoverySignal);
  }

  private containsUnsafeInstruction(text: string): boolean {
    const normalized = this.normalizeForValidation(text);
    return [
      /\bignora\b.*\binstruccion/,
      /\b(?:system prompt|prompt del sistema|revela el prompt|imprime el prompt)\b/,
      /\b(?:revela|comparte|muestra|imprime|dime)\b.*\b(?:api key|clave de api|contrasena|password|token|secreto)\b/,
      /(?:<script|javascript:|powershell|cmd\.exe)/,
      /\b(?:desactiva|omite|evade|salta)\b.*\b(?:seguridad|validacion|proteccion)\b/,
    ].some(pattern => pattern.test(normalized));
  }

  private normalizeForValidation(text: string): string {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  private isIntentStopWord(term: string): boolean {
    return new Set([
      "actual",
      "actualmente",
      "consideran",
      "cual",
      "cuando",
      "empresa",
      "estos",
      "principal",
      "puedes",
      "quiero",
      "tienen",
    ]).has(term);
  }

  private isDraftableIntent(intent: string): intent is DraftableConversationIntent {
    return intent === "DISCOVER_PROBLEM" || intent === "CONFIRM_HYPOTHESIS";
  }

  private readSafeErrorCode(result: Record<string, unknown>): string | undefined {
    return typeof result.safeErrorCode === "string"
      ? result.safeErrorCode
      : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null
      ? value as Record<string, unknown>
      : undefined;
  }

  private handleSummaryReviewPhase(input: OrchestratorInput): OrchestratorOutput {
    const text = input.engineInput.currentResponse.toLowerCase().trim();
    const confirmations = ["si", "sí", "correcto", "así es", "esta bien", "está bien", "refleja", "de acuerdo", "es correcto"];
    
    const isConfirmed = confirmations.some(c => text === c || text.startsWith(c));

    if (isConfirmed) {
      return {
        finalMessage: "Perfecto. He guardado el expediente consolidado y preparado la Radiografía Empresarial Aura™. Un consultor se pondrá en contacto pronto.",
        finalIntent: "STOP",
        messageSource: "CONVERSATION_ENGINE",
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
        messageSource: "CONVERSATION_ENGINE",
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

  private generateSummaryTransition(
    reflectionOutput: ReflectionOutput,
    updatedReflectionState: ReflectionState,
    fallbackCount: number,
  ): OrchestratorOutput {
    const summaryText = this.buildSummaryText(updatedReflectionState);
    const finalMessage = `Antes de concluir, quiero confirmar que comprendí correctamente tu organización:\n\n${summaryText}\n\n¿Esto refleja adecuadamente tu situación o te gustaría corregir algún punto?`;

    return {
      finalMessage,
      finalIntent: "SUMMARIZE",
      messageSource: "CONVERSATION_ENGINE",
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

  private buildSummaryText(state: ReflectionState): string {
    const evidence = state.extractedEvidenceTotal;
    if (evidence.length === 0) return "Tu organización está evaluando mejoras operativas.";
    return evidence.slice(0, 3).map((e: string) => `- ${e}`).join("\n");
  }

  private createEmptyReflection(): ReflectionOutput {
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
