process.env.VITE_FIREBASE_API_KEY = "mock-api-key";
process.env.VITE_FIREBASE_AUTH_DOMAIN = "mock.firebaseapp.com";
process.env.VITE_FIREBASE_PROJECT_ID = "mock-project";
process.env.VITE_FIREBASE_STORAGE_BUCKET = "mock.appspot.com";
process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = "123456";
process.env.VITE_FIREBASE_APP_ID = "1:123456:web:abcd";

async function runE2E() {
  const { ReflectionEngine } = await import("./intelligence/engine/services/ReflectionEngine");
  const { ConversationOrchestrator } = await import("./intelligence/engine/services/ConversationOrchestrator");
  const { CommercialDecisionEngine } = await import("./intelligence/commercial/engine/CommercialDecisionEngine");
  const { ConversationState } = await import("./intelligence/engine/domain/ConversationState");

  console.log("=== RUNNING E2E DOMAIN TESTS ===\n");

  let hasErrors = false;

  // 1. ReflectionEngine
  console.log("--- 1. ReflectionEngine Tests ---");
  const reflectionEngine = new ReflectionEngine();
  const state1 = reflectionEngine.createInitialState();
  
  const res1 = reflectionEngine.analyzeResponse({
    currentResponse: "asdf",
    conversationHistory: [],
    activeHypotheses: [],
    partialDossier: {},
    previousReflectionState: state1,
    currentIntent: "DISCOVER_PROBLEM",
  });
  if (res1.output.recommendedAction !== "CLARIFY" || !res1.output.isTooShort) {
    console.error("❌ Failed: 'asdf' should return CLARIFY and isTooShort.");
    hasErrors = true;
  } else {
    console.log("✅ Passed: 'asdf' returns CLARIFY");
  }

  const res2 = reflectionEngine.analyzeResponse({
    currentResponse: "Recursos Humanos",
    conversationHistory: [],
    activeHypotheses: [],
    partialDossier: {},
    previousReflectionState: state1,
    currentIntent: "DISCOVER_PROBLEM",
  });
  if (res2.output.recommendedAction !== "CLARIFY" || !res2.output.isAmbiguous) {
    console.error("❌ Failed: 'Recursos Humanos' should return CLARIFY and isAmbiguous. Action:", res2.output.recommendedAction);
    hasErrors = true;
  } else {
    console.log("✅ Passed: 'Recursos Humanos' returns CLARIFY");
  }

  // 2. Orchestrator
  console.log("\n--- 2. Orchestrator Tests ---");
  const orchestrator = new ConversationOrchestrator();
  const convState = new ConversationState("test-session", "Test Inc", "Tech");
  
  // Set up 2 previous fallbacks
  convState.fallbackConsecutiveCount = 2;
  
  const orchInput = {
    engineInput: {
      companyName: "Test Inc",
      industry: "Tech",
      context: {},
      currentResponse: "asdf",
      conversationHistory: [],
      hypotheses: [],
      confidenceLevel: 0,
      partialDossier: {},
      usefulResponsesCount: 0,
      turnCount: 0,
      askedIntents: [],
      askedQuestions: [],
    },
    conversationStateSnapshot: convState.getSnapshot(),
    reflectionState: state1,
    confidenceMatrix: state1.matrix,
  };

  const orchOutput = await orchestrator.processTurn(orchInput);
  if (orchOutput.finalIntent !== "FALLBACK_OPTIONS" || orchOutput.updatedFallbackCount !== 3) {
    console.error("❌ Failed: 3rd fallback should trigger FALLBACK_OPTIONS.", orchOutput.finalIntent, orchOutput.updatedFallbackCount);
    hasErrors = true;
  } else {
    console.log("✅ Passed: Fallback Loop correctly triggers FALLBACK_OPTIONS");
  }

  // 3. CommercialDecisionEngine
  console.log("\n--- 3. CommercialDecisionEngine Tests ---");
  const cdeInput1 = {
    confidenceMatrix: { discoveryQuality: NaN, diagnosticConfidence: Infinity },
    prospectMetadata: { 
      industria: "General", 
      empleadosTotales: NaN,
      decisionMaker: "Unknown", 
      economicPotential: { score: null as any, confidence: NaN as any } 
    },
    dossier: { 
      urgencyLevel: undefined as any, 
      digitalMaturity: "Low",
      painPoints: [] 
    },
    journeyState: {
      currentPhase: "DISCOVERY",
      daysSinceLastInteraction: 0,
      totalInteractions: 1
    } as any
  };
  const decision = CommercialDecisionEngine.evaluate(cdeInput1 as any);
  if (Number.isNaN(decision.opportunityScore.total) || Number.isNaN(decision.probabilityOfClosing.probability)) {
    console.error("❌ Failed: Math resulted in NaN!");
    console.error(decision.opportunityScore);
    hasErrors = true;
  } else {
    console.log("✅ Passed: NaN/Null/Infinity handled gracefully by toFiniteNumber.");
    console.log(`   Result Score: ${decision.opportunityScore.total}, Prob: ${decision.probabilityOfClosing.probability}`);
  }

  if (hasErrors) {
    console.error("\n❌ E2E RUN FAILED WITH ERRORS");
    process.exit(1);
  } else {
    console.log("\n✅ ALL DOMAIN E2E TESTS PASSED");
    process.exit(0);
  }
}

runE2E();
