import { deepStrictEqual, ok, strictEqual } from "assert";
import { DefaultExecutiveDiscoveryAdapter } from "../adapter";
import {
  DevelopmentExecutiveDiscoveryRequestSigner,
  HttpExecutiveDiscoveryApiClient,
  type ExecutiveDiscoveryHttpRequestInit,
  type ExecutiveDiscoveryHttpResponse,
} from "../client";
import type {
  ExecutiveDiscoveryApiClient,
  ExecutiveDiscoveryEvaluationInput,
} from "../contracts";
import {
  DiscoveryEvidenceClassification,
  DiscoveryEvidenceSourceType,
  type ExecutiveDiscoveryApiRequest,
  type ExecutiveDiscoveryApiResponse,
  type ExecutiveDiagnosis,
  ExecutiveConfidenceLevel,
  ExecutiveDiagnosisStatus,
  ExecutiveDiscoveryTransportError,
  ExecutiveDiscoveryTransportErrorCode,
  ExecutiveMaturityLevel,
} from "../contracts";

const FIXED_TIME = "2026-07-22T18:00:00.000Z";
const DEVELOPMENT_TOKEN = "development-service-token";

type TestBody = () => void | Promise<void>;

interface TestCase {
  readonly name: string;
  readonly run: TestBody;
}

class StubExecutiveDiscoveryApiClient implements ExecutiveDiscoveryApiClient {
  public readonly requests: ExecutiveDiscoveryApiRequest[] = [];

  public constructor(
    private readonly handler: (
      request: ExecutiveDiscoveryApiRequest,
    ) => ExecutiveDiscoveryApiResponse | Promise<ExecutiveDiscoveryApiResponse>,
  ) {}

  public async evaluate(
    request: ExecutiveDiscoveryApiRequest,
  ): Promise<ExecutiveDiscoveryApiResponse> {
    this.requests.push(request);
    return this.handler(request);
  }
}

function createValidInput(
  overrides: Partial<ExecutiveDiscoveryEvaluationInput> = {},
): ExecutiveDiscoveryEvaluationInput {
  return {
    requestId: "request-001",
    correlationId: "correlation-001",
    idempotencyKey: "idempotency-001",
    organizationId: "organization-001",
    tenantId: "tenant-001",
    companyId: "company-001",
    sessionId: "session-001",
    discoveryDefinitionVersion: "definition-001",
    locale: "es-MX",
    evidence: [
      {
        evidenceId: "evidence-confirmed",
        sourceType: DiscoveryEvidenceSourceType.USER_RESPONSE,
        sourceReference: "question-revenue-model",
        questionId: "revenue-model",
        value: "Subscription revenue",
        capturedAt: "2026-07-22T17:00:00.000Z",
        classification: DiscoveryEvidenceClassification.USER_CONFIRMED,
        consentScope: "executive-diagnosis",
        confidence: 0.95,
      },
    ],
    consentAssertion: {
      receiptId: "receipt-001",
      privacyConsent: true,
      diagnosticProcessingConsent: true,
      marketingConsent: false,
      consentVersion: "privacy-v1",
      capturedAt: "2026-07-22T16:55:00.000Z",
    },
    metadata: { channel: "control-center" },
    ...overrides,
  };
}

function createValidRequest(): ExecutiveDiscoveryApiRequest {
  return {
    schemaVersion: "1.0",
    capabilityVersion: "1.0.0",
    requestedAt: FIXED_TIME,
    ...createValidInput(),
    requestId: "request-001",
    correlationId: "correlation-001",
  };
}

function createValidDiagnosis(
  request: ExecutiveDiscoveryApiRequest,
): ExecutiveDiagnosis {
  const confidence = {
    level: ExecutiveConfidenceLevel.HIGH,
    score: 0.9,
    basis: ["Confirmed evidence is available."],
    evidenceCount: 1,
    missingEvidenceCount: 0,
  } as const;

  return {
    diagnosisId: "diagnosis-001",
    schemaVersion: "1.0",
    capabilityVersion: request.capabilityVersion,
    organizationId: request.organizationId,
    tenantId: request.tenantId,
    companyId: request.companyId,
    sessionId: request.sessionId,
    status: ExecutiveDiagnosisStatus.PARTIAL,
    executiveSummary: "A diagnosis grounded in the supplied evidence.",
    businessSnapshot: {
      confirmedFacts: [
        {
          label: "revenue-model",
          value: "Subscription revenue",
          classification: DiscoveryEvidenceClassification.USER_CONFIRMED,
          evidenceIds: ["evidence-confirmed"],
        },
      ],
      inferredFacts: [],
      systemObservations: [],
      missingInformation: [],
    },
    maturity: {
      overallScore: 0,
      level: ExecutiveMaturityLevel.INITIAL,
      dimensions: [],
      rationale: "Maturity was not assessed from the available evidence.",
      evidenceIds: [],
      confidence,
    },
    risks: [],
    opportunities: [],
    recommendations: [],
    actions: [],
    confidence,
    evidenceIds: ["evidence-confirmed"],
    warnings: [],
    generatedAt: "2026-07-22T18:00:01.000Z",
    generationMetadata: {
      requestId: request.requestId,
      correlationId: request.correlationId,
      providerId: "DETERMINISTIC_PROVIDER",
      providerVersion: "1.0.0",
      deterministic: true,
    },
  };
}

function successResponse(
  request: ExecutiveDiscoveryApiRequest,
  diagnosis: ExecutiveDiagnosis = createValidDiagnosis(request),
): ExecutiveDiscoveryApiResponse {
  return {
    status: 200,
    body: {
      success: true,
      data: diagnosis,
      meta: { correlationId: request.correlationId, warnings: [] },
    },
  };
}

function errorResponse(
  status: number,
  code: string,
  message = "private upstream detail",
): ExecutiveDiscoveryApiResponse {
  return {
    status,
    body: {
      success: false,
      error: { code, message },
      correlationId: "correlation-001",
    },
  };
}

function createAdapter(apiClient: ExecutiveDiscoveryApiClient) {
  return new DefaultExecutiveDiscoveryAdapter({
    apiClient,
    clock: { now: () => FIXED_TIME },
    idFactory: { createId: (scope) => `${scope}-generated` },
  });
}

async function expectTransportError(
  action: () => Promise<unknown>,
  code: string,
): Promise<ExecutiveDiscoveryTransportError> {
  try {
    await action();
  } catch (error: unknown) {
    ok(error instanceof ExecutiveDiscoveryTransportError);
    strictEqual(error.code, code);
    return error;
  }
  throw new Error(`Expected ExecutiveDiscoveryTransportError ${code}.`);
}

function httpResponse(status: number, body: unknown): ExecutiveDiscoveryHttpResponse {
  return {
    status,
    text: async () => JSON.stringify(body),
  };
}

const tests: readonly TestCase[] = [
  {
    name: "request valido",
    run: async () => {
      const client = new StubExecutiveDiscoveryApiClient((request) =>
        successResponse(request),
      );
      const adapter = createAdapter(client);
      const diagnosis = await adapter.evaluate(
        createValidInput({ requestId: undefined, correlationId: undefined }),
      );

      strictEqual(diagnosis.diagnosisId, "diagnosis-001");
      strictEqual(client.requests.length, 1);
      strictEqual(client.requests[0].schemaVersion, "1.0");
      strictEqual(client.requests[0].capabilityVersion, "1.0.0");
      strictEqual(client.requests[0].requestId, "request-generated");
      strictEqual(client.requests[0].correlationId, "correlation-generated");
      strictEqual(client.requests[0].requestedAt, FIXED_TIME);
    },
  },
  {
    name: "request invalido",
    run: async () => {
      const client = new StubExecutiveDiscoveryApiClient((request) =>
        successResponse(request),
      );
      const adapter = createAdapter(client);
      await expectTransportError(
        () => adapter.evaluate(createValidInput({ evidence: [] })),
        ExecutiveDiscoveryTransportErrorCode.INVALID_REQUEST,
      );
      strictEqual(client.requests.length, 0);
    },
  },
  {
    name: "timeout",
    run: async () => {
      const client = new HttpExecutiveDiscoveryApiClient({
        endpoint: "https://aura-intelligence.example.test/evaluateExecutiveDiscoveryV1",
        signer: new DevelopmentExecutiveDiscoveryRequestSigner({
          token: DEVELOPMENT_TOKEN,
        }),
        timeoutMs: 5,
        transport: (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener(
              "abort",
              () => reject(new Error("private abort detail")),
              { once: true },
            );
          }),
      });

      const error = await expectTransportError(
        () => client.evaluate(createValidRequest()),
        ExecutiveDiscoveryTransportErrorCode.TIMEOUT,
      );
      strictEqual(error.retryable, true);
      ok(!error.message.includes("private abort detail"));
    },
  },
  {
    name: "500",
    run: async () => {
      const adapter = createAdapter(
        new StubExecutiveDiscoveryApiClient(() =>
          errorResponse(500, "EXECUTIVE_DISCOVERY_FAILED"),
        ),
      );
      const error = await expectTransportError(
        () => adapter.evaluate(createValidInput()),
        ExecutiveDiscoveryTransportErrorCode.SERVICE_FAILURE,
      );
      strictEqual(error.httpStatus, 500);
      strictEqual(error.retryable, true);
      ok(!error.message.includes("private upstream detail"));
    },
  },
  {
    name: "401",
    run: async () => {
      const adapter = createAdapter(
        new StubExecutiveDiscoveryApiClient(() =>
          errorResponse(401, "AUTHENTICATION_REQUIRED"),
        ),
      );
      await expectTransportError(
        () => adapter.evaluate(createValidInput()),
        ExecutiveDiscoveryTransportErrorCode.AUTHENTICATION_REQUIRED,
      );
    },
  },
  {
    name: "403",
    run: async () => {
      const adapter = createAdapter(
        new StubExecutiveDiscoveryApiClient(() =>
          errorResponse(403, "ACCESS_FORBIDDEN"),
        ),
      );
      await expectTransportError(
        () => adapter.evaluate(createValidInput()),
        ExecutiveDiscoveryTransportErrorCode.ACCESS_FORBIDDEN,
      );
    },
  },
  {
    name: "422",
    run: async () => {
      const adapter = createAdapter(
        new StubExecutiveDiscoveryApiClient(() =>
          errorResponse(422, "INVALID_DISCOVERY_EVIDENCE"),
        ),
      );
      await expectTransportError(
        () => adapter.evaluate(createValidInput()),
        ExecutiveDiscoveryTransportErrorCode.INVALID_EVIDENCE,
      );
    },
  },
  {
    name: "respuesta invalida",
    run: async () => {
      const client = new HttpExecutiveDiscoveryApiClient({
        endpoint: "https://aura-intelligence.example.test/evaluateExecutiveDiscoveryV1",
        signer: new DevelopmentExecutiveDiscoveryRequestSigner({
          token: DEVELOPMENT_TOKEN,
        }),
        transport: async () => httpResponse(200, { unexpected: true }),
      });
      await expectTransportError(
        () => client.evaluate(createValidRequest()),
        ExecutiveDiscoveryTransportErrorCode.INVALID_RESPONSE,
      );
    },
  },
  {
    name: "diagnosis invalido",
    run: async () => {
      const client = new StubExecutiveDiscoveryApiClient((request) => {
        const diagnosis = createValidDiagnosis(request);
        const invalidDiagnosis = {
          ...diagnosis,
          maturity: { ...diagnosis.maturity, overallScore: 101 },
        } as ExecutiveDiagnosis;
        return successResponse(request, invalidDiagnosis);
      });
      await expectTransportError(
        () => createAdapter(client).evaluate(createValidInput()),
        ExecutiveDiscoveryTransportErrorCode.INVALID_DIAGNOSIS,
      );
    },
  },
  {
    name: "serializacion",
    run: async () => {
      let captured: ExecutiveDiscoveryHttpRequestInit | undefined;
      const request = createValidRequest();
      const response = successResponse(request);
      const client = new HttpExecutiveDiscoveryApiClient({
        endpoint: "https://aura-intelligence.example.test/evaluateExecutiveDiscoveryV1",
        signer: new DevelopmentExecutiveDiscoveryRequestSigner({
          token: DEVELOPMENT_TOKEN,
        }),
        transport: async (_url, init) => {
          captured = init;
          return httpResponse(response.status, response.body);
        },
      });

      await client.evaluate(request);
      ok(captured !== undefined);
      deepStrictEqual(JSON.parse(captured.body), request);
      strictEqual(captured.method, "POST");
      strictEqual(captured.headers.Authorization, `Bearer ${DEVELOPMENT_TOKEN}`);
      strictEqual(captured.headers["X-Correlation-Id"], request.correlationId);
      strictEqual(captured.headers["Idempotency-Key"], request.idempotencyKey);
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
    throw new Error(`Executive Intelligence Adapter tests failed: ${failures.join(", ")}`);
  }
}

void runTests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

