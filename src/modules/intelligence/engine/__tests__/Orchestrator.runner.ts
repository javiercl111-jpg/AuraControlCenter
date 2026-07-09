import { ConversationOrchestrator } from "../services/ConversationOrchestrator";
import { ReflectionEngine } from "../services/ReflectionEngine";
import type { OrchestratorInput } from "../types/orchestrator.types";

const orchestrator = new ConversationOrchestrator();
const reflectionEngine = new ReflectionEngine();

console.log("=================================================");
console.log("🎻 Aura Conversation Orchestrator™ - Fixture Runner");
console.log("=================================================\n");

// Helper to create fresh state
function createBaseInput(input: string, phase: "DISCOVERY" | "SUMMARY_REVIEW" = "DISCOVERY"): OrchestratorInput {
  return {
    engineInput: {
      companyName: "Test Corp",
      industry: "Tech",
      context: {},
      currentResponse: input,
      conversationHistory: [],
      hypotheses: [],
      confidenceLevel: 50,
      partialDossier: {},
      usefulResponsesCount: 0,
      turnCount: 0,
      askedIntents: [],
      askedQuestions: []
    },
    conversationStateSnapshot: {
      sessionId: "123",
      companyName: "Test Corp",
      industry: "Tech",
      history: [],
      hypotheses: [],
      confidenceLevel: 50,
      partialDossier: {},
      usefulResponsesCount: 0,
      turnCount: 0,
      askedIntents: [],
      askedQuestions: [],
      conversationPhase: phase
    },
    reflectionState: reflectionEngine.createInitialState(),
    confidenceMatrix: reflectionEngine.createInitialState().matrix
  };
}

async function run() {
// F. DEEPEN persiste evidencia parcial sin cambiar tema
console.log("▶ SCENARIO F: DEEPEN persiste evidencia");
const deepenOutput = await orchestrator.processTurn(createBaseInput("Usamos SAP"));
console.log(`Action: ${deepenOutput.reflectionOutput.recommendedAction}`);
console.log(`Should Advance: ${deepenOutput.shouldAdvance}`);
console.log(`Should Persist: ${deepenOutput.shouldPersistEvidence}`);
console.log("-----------------------------------------");

// G. CHALLENGE no avanza
console.log("▶ SCENARIO G: CHALLENGE no avanza");
const challengeInput = createBaseInput("Tenemos automatización total.");
challengeInput.engineInput.conversationHistory = [{ id: "1", role: "user", content: "Llevamos nómina en excel", timestamp: new Date() }];
const challengeOutput = await orchestrator.processTurn(challengeInput);
console.log(`Action: ${challengeOutput.reflectionOutput.recommendedAction}`);
console.log(`Should Advance (UsefulCount): ${challengeOutput.shouldAdvance}`);
console.log(`Clarification: ${challengeOutput.finalMessage}`);
console.log("-----------------------------------------");

// A. SUMMARIZE genera SUMMARY_REVIEW y no completa
console.log("▶ SCENARIO A: SUMMARIZE -> SUMMARY_REVIEW");
const summarizeInput = createBaseInput("Todo nuestro equipo registra manualmente");
summarizeInput.engineInput.turnCount = 8;
const summarizeOutput = await orchestrator.processTurn(summarizeInput);
console.log(`Final Intent: ${summarizeOutput.finalIntent}`);
console.log(`Phase: ${summarizeOutput.updatedConversationPhase}`);
console.log(`Should Complete: ${summarizeOutput.shouldComplete}`);
console.log("-----------------------------------------");

// B. Confirmación “Sí, es correcto” genera STOP
console.log("▶ SCENARIO B: Confirmación en SUMMARY_REVIEW -> STOP");
const confirmInput = createBaseInput("Sí, es correcto", "SUMMARY_REVIEW");
const confirmOutput = await orchestrator.processTurn(confirmInput);
console.log(`Final Intent: ${confirmOutput.finalIntent}`);
console.log(`Phase: ${confirmOutput.updatedConversationPhase}`);
console.log(`Should Complete: ${confirmOutput.shouldComplete}`);
console.log("-----------------------------------------");

// C & D. Corrección del resumen no genera STOP y vuelve a resumir
console.log("▶ SCENARIO C & D: Corrección del resumen");
const correctionInput = createBaseInput("No, de hecho ya compramos Oracle.", "SUMMARY_REVIEW");
const correctionOutput = await orchestrator.processTurn(correctionInput);
console.log(`Final Intent: ${correctionOutput.finalIntent}`);
console.log(`Phase: ${correctionOutput.updatedConversationPhase}`);
console.log(`Should Complete: ${correctionOutput.shouldComplete}`);
console.log(`Final Message: ${correctionOutput.finalMessage}`);
console.log("-----------------------------------------");

console.log("\n✅ Orchestrator scenarios executed successfully.");
}

run().catch(console.error);
