import { ReflectionEngine } from "../services/ReflectionEngine";
import type { ReflectionEngineInput } from "../types/reflection.types";

const engine = new ReflectionEngine();
let state = engine.createInitialState();

const scenarios = [
  {
    name: "1. Respuesta demasiado corta e inútil",
    input: "asdf",
    history: []
  },
  {
    name: "2. Respuesta corta pero válida",
    input: "Usamos SAP",
    history: []
  },
  {
    name: "3. Respuesta ambigua",
    input: "Recursos humanos",
    history: []
  },
  {
    name: "4. Contradicción (Excel vs Automatización)",
    input: "Tenemos automatización total.",
    history: [
      { id: "1", role: "user", content: "Llevamos la nómina en Excel.", timestamp: new Date() }
    ]
  },
  {
    name: "5. Respuesta relevante y profunda",
    input: "Actualmente perdemos mucho dinero en la conciliación manual de los inventarios porque usamos papel en las bodegas.",
    history: []
  },
  {
    name: "6. Evidencia suficiente para avanzar",
    input: "Todo nuestro equipo de ventas registra oportunidades manualmente.",
    history: [],
    // Simulate that state already has accumulated evidence
    simulateState: true
  }
];

console.log("=========================================");
console.log("🧠 Aura Reflection Engine™ - Fixture Runner");
console.log("=========================================\n");

for (const scenario of scenarios) {
  console.log(`\n▶ SCENARIO: ${scenario.name}`);
  console.log(`Input: "${scenario.input}"`);
  
  if (scenario.simulateState) {
    // Add fake evidence to force SUMMARIZE
    state.matrix.technology.evidenceCount = 3;
    state.matrix.operations.evidenceCount = 3;
  }

  const payload: ReflectionEngineInput = {
    currentResponse: scenario.input,
    conversationHistory: scenario.history as any,
    activeHypotheses: [],
    partialDossier: {},
    previousReflectionState: state,
    currentIntent: "DISCOVER_PROBLEM"
  };

  const { output } = engine.analyzeResponse(payload);
  
  console.log(`Recommended Action: [${output.recommendedAction}]`);
  console.log(`Clarification Suggested: ${output.suggestedClarification || "None"}`);
  console.log(`Contradiction Detected: ${output.hasContradiction}`);
  if (output.hasContradiction) {
    console.log(` - Severity: ${output.contradictionDetails[0]?.severity}`);
  }
  console.log(`Ambiguous: ${output.isAmbiguous}`);
  console.log(`Too Short/Invalid: ${output.isTooShort}`);
  console.log(`Evidence Extracted: ${output.evidenceExtracted.length > 0 ? output.evidenceExtracted[0] : "None"}`);
  console.log(`Enough Evidence?: ${output.hasEnoughEvidence}`);
  console.log(`Internal Reflection: ${output.internalReflection}`);
  console.log("-----------------------------------------");

  // Keep state for next iteration (unless simulating specific boundaries, but we reset for clean tests)
  state = engine.createInitialState(); 
}

console.log("\n✅ All scenarios executed.");
