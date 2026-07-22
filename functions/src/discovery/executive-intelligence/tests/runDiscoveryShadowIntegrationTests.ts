import { deepStrictEqual, ok, strictEqual } from "assert";
import type {
  ExecutiveDiscoveryAdapter,
  ExecutiveDiscoveryEvaluationInput,
} from "../contracts/ExecutiveDiscoveryAdapter";
import {
  DiscoveryEvidenceClassification,
  ExecutiveConfidenceLevel,
  ExecutiveDiagnosisStatus,
  ExecutiveDiscoveryTransportError,
  ExecutiveDiscoveryTransportErrorCode,
  ExecutiveMaturityLevel,
  ExecutiveOpportunityHorizon,
  ExecutivePriority,
  ExecutiveRiskLikelihood,
  ExecutiveRiskSeverity,
  type ExecutiveDiagnosis,
} from "../contracts";
import {
  DiscoveryDiagnosisComparisonCategory,
  DiscoveryComparisonStatus,
  DiscoveryShadowAdapterStage,
  DiscoveryShadowStatus,
  buildExecutiveDiscoveryEvaluationInput,
  buildLegacyDiscoveryDiagnosis,
  compareDiscoveryDiagnoses,
  resolveDiscoveryEvaluationFeatureFlags,
  runDiscoveryShadowEvaluation,
  type DiscoveryShadowClock,
  type DiscoveryShadowPersistenceRecord,
  type DiscoveryShadowSafeLog,
  type DiscoveryShadowEvaluationContext,
} from "../integration";

type TestBody = () => void | Promise<void>;

interface TestCase {
  readonly name: string;
  readonly run: TestBody;
}

const FLAGS_ON = {
  shadowEvaluation: true,
  primaryEvaluation: false,
} as const;

const FLAGS_OFF = {
  shadowEvaluation: false,
  primaryEvaluation: false,
} as const;

const baseSession: Readonly<Record<string, unknown>> = {
  companyName: "Private Company Name",
  contactName: "Private Contact Name",
  conversationHistory: [
    { role: "user", content: "Private complete response that must not be logged." },
  ],
  dossier: {
    industry: "Manufacturing",
    employees: 80,
    schedulingMethod: "Excel",
    payrollIncidents: true,
    priority: "Reduce errors",
  },
  businessAssessmentDraft: {
    score: 70,
    painPointsIdentified: ["Risk A"],
    processGaps: ["Risk B"],
  },
  executiveBriefingDraft: {
    suggestedNextSteps: ["Recommendation A"],
  },
  radiografiaEmpresarialDraft: {
    recommendedModules: ["Recommendation B"],
    potentialSavings: "Opportunity A",
  },
  salesAdvisorContext: {
    alertFlags: ["Risk C"],
  },
  conversationStateSnapshot: {
    confidenceLevel: 80,
    partialCompletionReason: "Warning A",
    lastFallbackCode: "Warning B",
  },
};

function createContext(): DiscoveryShadowEvaluationContext {
  return {
    sessionId: "session-001",
    linkId: "link-001",
    tenantId: "tenant-001",
    organizationId: "organization-001",
    companyId: "company-001",
    locale: "es-MX",
    trustDecision: "ALLOW_FULL",
    capturedAt: "2026-07-22T18:00:00.000Z",
    session: baseSession,
    consents: {
      privacy: {
        value: true,
        policyVersion: "privacy-v1",
        capturedAt: "2026-07-22T17:00:00.000Z",
      },
      diagnosticDelivery: { value: true },
      marketing: { value: false },
    },
    legacyDiagnosis: buildLegacyDiscoveryDiagnosis(baseSession),
  };
}

function createDiagnosis(
  input: ExecutiveDiscoveryEvaluationInput,
  overrides: Partial<ExecutiveDiagnosis> = {},
): ExecutiveDiagnosis {
  const evidenceId = input.evidence[0]?.evidenceId ?? "legacy-discovery.status";
  const confidence = {
    level: ExecutiveConfidenceLevel.HIGH,
    score: 0.8,
    basis: ["Structured evidence is available."],
    evidenceCount: input.evidence.length,
    missingEvidenceCount: 0,
  } as const;

  return {
    diagnosisId: "diagnosis-001",
    schemaVersion: "1.0",
    capabilityVersion: "1.0.0",
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    companyId: input.companyId,
    sessionId: input.sessionId,
    status: ExecutiveDiagnosisStatus.COMPLETE,
    executiveSummary: "Shadow diagnosis.",
    businessSnapshot: {
      confirmedFacts: [
        {
          label: "Industry",
          value: "Manufacturing",
          classification: DiscoveryEvidenceClassification.USER_CONFIRMED,
          evidenceIds: [evidenceId],
        },
      ],
      inferredFacts: [],
      systemObservations: [],
      missingInformation: [],
    },
    maturity: {
      overallScore: 70,
      level: ExecutiveMaturityLevel.STRUCTURED,
      dimensions: [],
      rationale: "Exact shadow score.",
      evidenceIds: [evidenceId],
      confidence,
    },
    risks: ["Risk A", "Risk B", "Risk C"].map((title, index) => ({
      riskId: `risk-${index}`,
      category: "OPERATIONS",
      title,
      description: title,
      severity: ExecutiveRiskSeverity.MEDIUM,
      likelihood: ExecutiveRiskLikelihood.MEDIUM,
      impact: "Operational impact.",
      confidence,
      evidenceIds: [evidenceId],
    })),
    opportunities: [
      {
        opportunityId: "opportunity-001",
        category: "EFFICIENCY",
        title: "Opportunity A",
        description: "Opportunity A",
        expectedValue: "Efficiency",
        feasibility: 0.8,
        horizon: ExecutiveOpportunityHorizon.NEAR_TERM,
        confidence,
        evidenceIds: [evidenceId],
      },
    ],
    recommendations: ["Recommendation A", "Recommendation B"].map(
      (title, index) => ({
        recommendationId: `recommendation-${index}`,
        title,
        description: title,
        rationale: "Grounded in evidence.",
        priority: ExecutivePriority.MEDIUM,
        confidence,
        evidenceIds: [evidenceId],
        expectedImpact: "Operational improvement.",
        timeframe: "Near term",
        linkedActionIds: [],
      }),
    ),
    actions: [],
    confidence,
    evidenceIds: [evidenceId],
    warnings: ["Warning A", "Warning B"],
    generatedAt: "2026-07-22T18:00:01.000Z",
    generationMetadata: {
      requestId: input.requestId ?? "request-001",
      correlationId: input.correlationId ?? "correlation-001",
      providerId: "TEST_PROVIDER",
      providerVersion: "1.0.0",
      deterministic: true,
    },
    ...overrides,
  };
}

class StubAdapter implements ExecutiveDiscoveryAdapter {
  public readonly inputs: ExecutiveDiscoveryEvaluationInput[] = [];

  public constructor(
    private readonly handler: (
      input: ExecutiveDiscoveryEvaluationInput,
    ) => Promise<ExecutiveDiagnosis>,
  ) {}

  public async evaluate(
    input: ExecutiveDiscoveryEvaluationInput,
  ): Promise<ExecutiveDiagnosis> {
    this.inputs.push(input);
    return this.handler(input);
  }
}

function sequenceClock(...timestamps: readonly string[]): DiscoveryShadowClock {
  let index = 0;
  return {
    now: () => {
      const timestamp = timestamps[Math.min(index, timestamps.length - 1)];
      index += 1;
      return new Date(timestamp);
    },
  };
}

function createHarness(adapter: ExecutiveDiscoveryAdapter, persistFails = false) {
  const records: DiscoveryShadowPersistenceRecord[] = [];
  const logs: DiscoveryShadowSafeLog[] = [];
  return {
    records,
    logs,
    options: {
      context: createContext(),
      correlationId: "shadow-correlation-001",
      flags: FLAGS_ON,
      endpointConfigured: true,
      authenticationMode: "DEVELOPMENT_BEARER" as const,
      adapter,
      persistence: {
        persist: async (record: DiscoveryShadowPersistenceRecord) => {
          if (persistFails) throw new Error("private persistence detail");
          records.push(record);
        },
      },
      logger: {
        log: (entry: DiscoveryShadowSafeLog) => logs.push(entry),
      },
      clock: sequenceClock(
        "2026-07-22T18:00:00.000Z",
        "2026-07-22T18:00:00.125Z",
        "2026-07-22T18:00:00.250Z",
      ),
    },
  };
}

const tests: readonly TestCase[] = [
  {
    name: "Legacy PASS",
    run: () => {
      const before = JSON.stringify(baseSession);
      const legacy = buildLegacyDiscoveryDiagnosis(baseSession);
      strictEqual(legacy.maturity, 70);
      strictEqual(legacy.confidence, 0.8);
      deepStrictEqual(legacy.recommendations, [
        "Recommendation A",
        "Recommendation B",
      ]);
      strictEqual(JSON.stringify(baseSession), before);
    },
  },
  {
    name: "Shadow PASS and feature flag ON",
    run: async () => {
      const adapter = new StubAdapter(async (input) => createDiagnosis(input));
      const harness = createHarness(adapter);
      const outcome = await runDiscoveryShadowEvaluation(harness.options);

      strictEqual(outcome.status, DiscoveryShadowStatus.SUCCEEDED);
      strictEqual(adapter.inputs.length, 1);
      strictEqual(harness.records.length, 1);
      strictEqual(harness.records[0].shadowStatus, DiscoveryShadowStatus.SUCCEEDED);
      strictEqual(harness.records[0].shadowExecution.durationMs, 125);
      strictEqual(harness.records[0].shadowMetadata.comparison?.differences.length, 0);
      strictEqual(
        harness.records[0].shadowMetadata.comparisonStatus,
        DiscoveryComparisonStatus.COMPLETED,
      );
      strictEqual(harness.records[0].shadowExecution.persisted, true);
      strictEqual("legacyDiagnosis" in harness.records[0], false);
      strictEqual(harness.logs[0].status, DiscoveryShadowStatus.SUCCEEDED);

      const requestText = JSON.stringify(adapter.inputs[0]);
      ok(!requestText.includes("Private complete response"));
      ok(!requestText.includes("Private Contact Name"));
      ok(!JSON.stringify(harness.logs[0]).includes("Private"));
    },
  },
  {
    name: "Shadow FAIL",
    run: async () => {
      const adapter = new StubAdapter(async () => {
        throw new Error("private provider failure");
      });
      const harness = createHarness(adapter);
      const outcome = await runDiscoveryShadowEvaluation(harness.options);

      strictEqual(outcome.status, DiscoveryShadowStatus.FAILED);
      strictEqual(outcome.errorCode, "SHADOW_EVALUATION_FAILED");
      strictEqual(harness.records[0].shadowDiagnosis, null);
      strictEqual(harness.records[0].shadowStatus, DiscoveryShadowStatus.FAILED);
      ok(!JSON.stringify(harness.logs).includes("private provider failure"));
    },
  },
  {
    name: "Endpoint ausente",
    run: async () => {
      const adapter = new StubAdapter(async (input) => createDiagnosis(input));
      const harness = createHarness(adapter);
      const outcome = await runDiscoveryShadowEvaluation({
        ...harness.options,
        endpointConfigured: false,
      });

      strictEqual(adapter.inputs.length, 0);
      strictEqual(
        outcome.safeErrorCode,
        ExecutiveDiscoveryTransportErrorCode.ENDPOINT_NOT_CONFIGURED,
      );
      strictEqual(outcome.comparisonStatus, DiscoveryComparisonStatus.NOT_REQUESTED);
      strictEqual(harness.records[0].shadowExecution.endpointConfigured, false);
      strictEqual(
        harness.records[0].shadowExecution.adapterStage,
        DiscoveryShadowAdapterStage.CONFIGURATION,
      );
    },
  },
  {
    name: "401 authentication",
    run: async () => {
      const adapter = new StubAdapter(async () => {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.AUTHENTICATION_REQUIRED,
          message: "Safe authentication failure.",
          retryable: false,
          httpStatus: 401,
        });
      });
      const harness = createHarness(adapter);
      const outcome = await runDiscoveryShadowEvaluation(harness.options);

      strictEqual(
        outcome.comparisonStatus,
        DiscoveryComparisonStatus.FAILED_AUTHENTICATION,
      );
      strictEqual(harness.logs[0].httpStatus, 401);
      strictEqual(
        harness.logs[0].adapterStage,
        DiscoveryShadowAdapterStage.AUTHENTICATION,
      );
    },
  },
  {
    name: "403 authorization",
    run: async () => {
      const adapter = new StubAdapter(async () => {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.ACCESS_FORBIDDEN,
          message: "Safe authorization failure.",
          retryable: false,
          httpStatus: 403,
        });
      });
      const harness = createHarness(adapter);
      const outcome = await runDiscoveryShadowEvaluation(harness.options);

      strictEqual(
        outcome.comparisonStatus,
        DiscoveryComparisonStatus.FAILED_AUTHORIZATION,
      );
      strictEqual(harness.logs[0].httpStatus, 403);
    },
  },
  {
    name: "500 transport",
    run: async () => {
      const adapter = new StubAdapter(async () => {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.SERVICE_FAILURE,
          message: "Safe service failure.",
          retryable: true,
          httpStatus: 500,
        });
      });
      const harness = createHarness(adapter);
      const outcome = await runDiscoveryShadowEvaluation(harness.options);

      strictEqual(
        outcome.comparisonStatus,
        DiscoveryComparisonStatus.FAILED_TRANSPORT,
      );
      strictEqual(harness.logs[0].httpStatus, 500);
    },
  },
  {
    name: "Invalid response",
    run: async () => {
      const adapter = new StubAdapter(async () => {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.INVALID_RESPONSE,
          message: "Safe invalid response.",
          retryable: false,
          httpStatus: 200,
        });
      });
      const harness = createHarness(adapter);
      const outcome = await runDiscoveryShadowEvaluation(harness.options);

      strictEqual(
        outcome.comparisonStatus,
        DiscoveryComparisonStatus.FAILED_INVALID_RESPONSE,
      );
      strictEqual(
        harness.logs[0].adapterStage,
        DiscoveryShadowAdapterStage.VALIDATION,
      );
    },
  },
  {
    name: "Timeout",
    run: async () => {
      const adapter = new StubAdapter(async () => {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.TIMEOUT,
          message: "Aura Intelligence did not respond before the timeout.",
          retryable: true,
          correlationId: "shadow-correlation-001",
        });
      });
      const harness = createHarness(adapter);
      const outcome = await runDiscoveryShadowEvaluation(harness.options);

      strictEqual(outcome.status, DiscoveryShadowStatus.FAILED);
      strictEqual(outcome.errorCode, ExecutiveDiscoveryTransportErrorCode.TIMEOUT);
      strictEqual(
        outcome.comparisonStatus,
        DiscoveryComparisonStatus.FAILED_TIMEOUT,
      );
      strictEqual(
        harness.records[0].shadowExecution.status === DiscoveryShadowStatus.FAILED
          ? harness.records[0].shadowExecution.safeErrorCode
          : undefined,
        ExecutiveDiscoveryTransportErrorCode.TIMEOUT,
      );
    },
  },
  {
    name: "Diagnosis invalido",
    run: async () => {
      const adapter = new StubAdapter(async () => {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.INVALID_DIAGNOSIS,
          message: "Aura Intelligence returned an invalid Executive Diagnosis.",
          retryable: false,
          correlationId: "shadow-correlation-001",
        });
      });
      const harness = createHarness(adapter);
      const outcome = await runDiscoveryShadowEvaluation(harness.options);

      strictEqual(
        outcome.errorCode,
        ExecutiveDiscoveryTransportErrorCode.INVALID_DIAGNOSIS,
      );
      strictEqual(harness.records[0].shadowStatus, DiscoveryShadowStatus.FAILED);
    },
  },
  {
    name: "Comparison",
    run: () => {
      const context = createContext();
      const input = buildExecutiveDiscoveryEvaluationInput(
        context,
        "shadow-correlation-001",
      );
      const diagnosis = createDiagnosis(input, {
        maturity: {
          ...createDiagnosis(input).maturity,
          overallScore: 50,
        },
        recommendations: [],
        risks: [],
        opportunities: [],
        confidence: {
          ...createDiagnosis(input).confidence,
          score: 0.4,
        },
        businessSnapshot: {
          ...createDiagnosis(input).businessSnapshot,
          missingInformation: [{ label: "Missing A", evidenceIds: [] }],
        },
        warnings: ["Different warning"],
      });
      const comparison = compareDiscoveryDiagnoses(
        context.legacyDiagnosis,
        diagnosis,
      );

      deepStrictEqual(comparison.differences, [
        DiscoveryDiagnosisComparisonCategory.MATURITY,
        DiscoveryDiagnosisComparisonCategory.RECOMMENDATIONS,
        DiscoveryDiagnosisComparisonCategory.RISKS,
        DiscoveryDiagnosisComparisonCategory.OPPORTUNITIES,
        DiscoveryDiagnosisComparisonCategory.CONFIDENCE,
        DiscoveryDiagnosisComparisonCategory.MISSING_EVIDENCE,
        DiscoveryDiagnosisComparisonCategory.WARNINGS,
      ]);
    },
  },
  {
    name: "Feature Flag OFF",
    run: async () => {
      const adapter = new StubAdapter(async (input) => createDiagnosis(input));
      const harness = createHarness(adapter);
      const outcome = await runDiscoveryShadowEvaluation({
        ...harness.options,
        flags: FLAGS_OFF,
      });

      strictEqual(outcome.status, DiscoveryShadowStatus.SKIPPED);
      strictEqual(adapter.inputs.length, 0);
      strictEqual(harness.records[0].shadowStatus, DiscoveryShadowStatus.SKIPPED);
      strictEqual(
        harness.records[0].shadowMetadata.comparisonStatus,
        DiscoveryComparisonStatus.SKIPPED_DISABLED,
      );
    },
  },
  {
    name: "Primary flag remains disabled",
    run: () => {
      deepStrictEqual(
        resolveDiscoveryEvaluationFeatureFlags({
          shadowEvaluation: true,
          primaryEvaluation: true,
        }),
        FLAGS_ON,
      );
    },
  },
  {
    name: "No perdida de sesion",
    run: async () => {
      const legacyBefore = JSON.stringify(baseSession);
      const adapter = new StubAdapter(async (input) => createDiagnosis(input));
      const harness = createHarness(adapter, true);
      const outcome = await runDiscoveryShadowEvaluation(harness.options);

      strictEqual(outcome.status, DiscoveryShadowStatus.FAILED);
      strictEqual(outcome.errorCode, "SHADOW_PERSISTENCE_FAILED");
      strictEqual(JSON.stringify(baseSession), legacyBefore);
      strictEqual(harness.records.length, 0);
      strictEqual(harness.logs[0].safeErrorCode, "SHADOW_PERSISTENCE_FAILED");
      strictEqual(harness.logs[0].persisted, false);
      strictEqual(
        harness.logs[0].adapterStage,
        DiscoveryShadowAdapterStage.PERSISTENCE,
      );
    },
  },
];

async function runTests(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];

  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`PASS ${test.name}`);
    } catch (error: unknown) {
      failures.push(test.name);
      console.error(`FAIL ${test.name}`, error);
    }
  }

  console.log(`${passed}/${tests.length} tests passed`);
  if (failures.length > 0) {
    throw new Error(
      `Discovery Shadow Integration tests failed: ${failures.join(", ")}`,
    );
  }
}

void runTests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
