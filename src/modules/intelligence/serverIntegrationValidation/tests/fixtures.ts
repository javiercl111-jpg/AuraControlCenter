import {
  AUTHORITATIVE_POLICY_ENTRY_VERSION,
  AUTHORITATIVE_POLICY_PRODUCER_VERSION,
  AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
  AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
  AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1,
  BootstrapBoundaryAdapter,
  GovernedExecutionBoundary,
  InMemoryAuthoritativeFeaturePolicyProducer,
  PipelineBootstrapEvidenceFactory,
  PipelineBootstrapper,
  TRUSTED_COMPOSITION_REGISTRY_VERSION,
  createTrustedServerExecutionResponseV1,
  createTrustedServerRequestContextV1,
  resolveTrustedRegistrySelectionV1,
} from '../../server';
import type {
  AuthoritativeBoundaryPolicyDecisionV1,
  AuthoritativeBoundaryPolicyQueryV1,
  AuthoritativeFeaturePolicyPort,
  BoundaryClockPort,
  BoundaryExecutionPort,
  BoundaryInvocationContextV1,
  GovernedExecutionRequest,
  GovernedExecutionResponse,
  InternalExecutionInput,
  InternalExecutionResult,
  PipelineBootstrapInput,
  PipelineBootstrapPort,
  PipelineBootstrapState,
  TrustedRegistrySelectionV1,
  TrustedServerExecutionResponseV1,
  TrustedServerExecutionStatus,
  TrustedServerRequestContextV1,
} from '../../server';

export const INTEGRATION_NOW =
  '2026-07-29T12:00:00.000Z';
export const INTEGRATION_DEADLINE =
  '2026-07-29T12:00:30.000Z';
export const INTEGRATION_TRANSPORT_DEADLINE =
  '2026-07-29T12:01:00.000Z';
export const INTEGRATION_TENANT_ID =
  'tenant-policy-contract-test';
export const INTEGRATION_ACTOR_ID =
  'actor-policy-contract-test';
export const INTEGRATION_ACTOR_TYPE = 'SYSTEM' as const;
export const INTEGRATION_CONSUMER_ID =
  'INTELLIGENCE_OS_CONTRACT_TEST' as const;
export const INTEGRATION_SOURCE =
  'TRUSTED_COMPOSITION_CONTRACT_TEST' as const;
export const INTEGRATION_REQUEST_ID =
  'request-boundary-integration';
export const INTEGRATION_CORRELATION_ID =
  'correlation-boundary-integration';

const AUTHENTICATED_AT = '2026-07-29T11:58:00.000Z';
const RESOLVED_AT = '2026-07-29T11:59:00.000Z';
const GENERATED_AT = '2026-07-29T11:59:30.000Z';

export class DeterministicBoundaryClock
  implements BoundaryClockPort
{
  readonly #timestamps: readonly string[];
  #cursor = 0;

  public constructor(
    timestamps: readonly string[] = [INTEGRATION_NOW]
  ) {
    if (timestamps.length === 0) {
      throw new Error(
        'Deterministic clock requires at least one timestamp'
      );
    }
    this.#timestamps = Object.freeze([...timestamps]);
  }

  public now(): string {
    const index = Math.min(
      this.#cursor,
      this.#timestamps.length - 1
    );
    const timestamp = this.#timestamps[index];
    this.#cursor += 1;
    if (timestamp === undefined) {
      throw new Error('Deterministic clock is empty');
    }
    return timestamp;
  }

  public get calls(): number {
    return this.#cursor;
  }
}

export function createIntegrationBusinessPayload(): Readonly<
  Record<string, unknown>
> {
  return {
    schemaVersion: '1',
    targetScenario: {
      scenarioId: 'PAYROLL_AUDIT',
      scenarioVersion: '1',
      objectiveKey: 'ASSESS_PAYROLL_AUDIT_READINESS',
      requestedStages: [
        'EVIDENCE_EXTRACTION',
        'MENTAL_MODEL',
        'KNOWLEDGE_GRAPH',
        'KNOWLEDGE_COVERAGE',
      ],
      source: 'AUTHORIZED_SYSTEM_CONFIGURATION',
      explicitSelection: true,
    },
    facts: [
      {
        factId: 'fact-boundary-integration-industry',
        category: 'BUSINESS_INDUSTRY',
        value: 'HOSPITALITY',
        valueType: 'ENUM',
        provenance: {
          sourceType: 'INTEGRATION',
          sourceId: 'boundary-integration-fixture',
          collectionMethod: 'SYSTEM_EVENT',
          capturedAt: 200,
          reliability: 'HIGH',
          directness: 'DIRECT',
          actorType: INTEGRATION_ACTOR_TYPE,
        },
        reliability: 'HIGH',
        directness: 'DIRECT',
        polarity: 'AFFIRMED',
        observedAt: 100,
        schemaVersion: '1',
      },
    ],
    policy: {
      allowedTaxonomyVersion: '1',
      allowedScenarioVersion: '1',
      allowUnknownReliability: false,
      allowUncertainPolarity: false,
      allowInferredDirectness: false,
      allowedInferenceRuleIds: [],
      maxFacts: 10,
      maxFactValueSize: 256,
      maxTotalPayloadSize: 8192,
      duplicateFactPolicy: 'REJECT',
      conflictPolicy: 'REJECT',
      failClosed: true,
      requireExplicitScenario: true,
    },
    locale: 'es-MX',
    timezone: 'America/Mexico_City',
  };
}

export function createTrustedContextInput(
  signal?: AbortSignal,
  overrides: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    transport: 'INTERNAL_TEST',
    authenticatedPrincipal: {
      schemaVersion: '1',
      principalId: INTEGRATION_ACTOR_ID,
      principalType: INTEGRATION_ACTOR_TYPE,
      authenticationMethod: 'INTERNAL_TEST_ASSERTION',
      provider: 'AURA_INTERNAL_TEST',
      authenticatedAt: AUTHENTICATED_AT,
    },
    tenantMembership: {
      schemaVersion: '1',
      tenantId: INTEGRATION_TENANT_ID,
      principalId: INTEGRATION_ACTOR_ID,
      membershipId: 'membership-boundary-integration',
      roles: ['TENANT_SYSTEM'],
      status: 'ACTIVE',
      resolvedAt: RESOLVED_AT,
      resolverVersion: 'resolver:boundary-integration:v1',
    },
    consumer: INTEGRATION_CONSUMER_ID,
    source: INTEGRATION_SOURCE,
    requestIdentity: {
      schemaVersion: '1',
      requestId: INTEGRATION_REQUEST_ID,
      correlationId: INTEGRATION_CORRELATION_ID,
      generationStrategy: 'DETERMINISTIC_TEST',
      generatedAt: GENERATED_AT,
      generatorVersion: 'generator:boundary-integration:v1',
    },
    initiatedAt: INTEGRATION_NOW,
    requestedExecutionMode: 'SHADOW_ONLY',
    cancellation: {
      schemaVersion: '1',
      transportAborted: signal?.aborted ?? false,
      transportDeadlineAt: INTEGRATION_TRANSPORT_DEADLINE,
      ...(signal !== undefined
        ? { cancellationSignal: signal }
        : {}),
    },
    sanitizedTransportContext: {
      schemaVersion: '1',
      traceId: 'trace-boundary-integration',
      region: 'test-region',
      transportName: 'INTERNAL_TEST',
      invocationClass: 'TEST',
    },
    ...overrides,
  };
}

export function createPolicyEntryInput(
  overrides: Readonly<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    entryVersion: AUTHORITATIVE_POLICY_ENTRY_VERSION,
    policyId: 'policy-contract-test-shadow',
    enabled: true,
    tenantId: INTEGRATION_TENANT_ID,
    actorType: INTEGRATION_ACTOR_TYPE,
    actorId: INTEGRATION_ACTOR_ID,
    consumerId: INTEGRATION_CONSUMER_ID,
    source: INTEGRATION_SOURCE,
    requestedMode: 'SHADOW_ONLY',
    effectiveExecutionMode: 'SHADOW_ONLY',
    effectiveTimeoutMs: 30_000,
    authorizationPolicyVersion:
      AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
    description:
      'Test-only shadow authorization for integration validation',
    ...overrides,
  };
}

export function createPolicySnapshotInput(
  entries: readonly Readonly<Record<string, unknown>>[] = [
    createPolicyEntryInput(),
  ]
): Record<string, unknown> {
  return {
    schemaVersion: AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
    producerVersion: AUTHORITATIVE_POLICY_PRODUCER_VERSION,
    authorizationPolicyVersion:
      AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
    trustedRegistryVersion: TRUSTED_COMPOSITION_REGISTRY_VERSION,
    entries,
  };
}

export function createMissingPolicySnapshotInput(): Record<
  string,
  unknown
> {
  return createPolicySnapshotInput([
    createPolicyEntryInput({
      policyId: 'policy-known-tenant',
      actorId: 'actor-policy-alternate',
    }),
    createPolicyEntryInput({
      policyId: 'policy-known-actor',
      tenantId: 'tenant-policy-alternate',
    }),
  ]);
}

interface MutableIntegrationObservations {
  readonly policyQueries: AuthoritativeBoundaryPolicyQueryV1[];
  readonly policyDecisions: AuthoritativeBoundaryPolicyDecisionV1[];
  readonly internalInputs: InternalExecutionInput[];
  readonly internalResults: InternalExecutionResult[];
  readonly bootstrapInputs: PipelineBootstrapInput[];
  readonly bootstrapStates: PipelineBootstrapState[];
}

export interface BoundaryIntegrationObservations {
  readonly policyQueries:
    readonly AuthoritativeBoundaryPolicyQueryV1[];
  readonly policyDecisions:
    readonly AuthoritativeBoundaryPolicyDecisionV1[];
  readonly internalInputs: readonly InternalExecutionInput[];
  readonly internalResults: readonly InternalExecutionResult[];
  readonly bootstrapInputs: readonly PipelineBootstrapInput[];
  readonly bootstrapStates: readonly PipelineBootstrapState[];
}

export interface BoundaryIntegrationExecution {
  readonly boundaryResponse: GovernedExecutionResponse;
  readonly trustedResponse: TrustedServerExecutionResponseV1;
}

export interface BoundaryIntegrationFixture {
  readonly abortController: AbortController;
  readonly clock: DeterministicBoundaryClock;
  readonly trustedContext: TrustedServerRequestContextV1;
  readonly registrySelection: TrustedRegistrySelectionV1;
  readonly policySnapshot: unknown;
  readonly policyProducer: InMemoryAuthoritativeFeaturePolicyProducer;
  readonly boundary: GovernedExecutionBoundary;
  readonly request: GovernedExecutionRequest;
  readonly invocationContext: BoundaryInvocationContextV1;
  readonly observations: BoundaryIntegrationObservations;
  execute(
    options?: BoundaryExecutionOptions
  ): Promise<BoundaryIntegrationExecution>;
}

export interface BoundaryExecutionOptions {
  readonly request?: GovernedExecutionRequest;
  readonly invocationContext?: BoundaryInvocationContextV1 | null;
}

export interface BoundaryIntegrationFixtureOptions {
  readonly snapshot?: unknown;
  readonly producer?: InMemoryAuthoritativeFeaturePolicyProducer;
  readonly clockTimestamps?: readonly string[];
  readonly requestId?: string;
  readonly correlationId?: string;
}

function boundaryStatusToTrustedStatus(
  status: GovernedExecutionResponse['status']
): TrustedServerExecutionStatus {
  if (status === 'COMPLETED') {
    return 'COMPLETED';
  }
  if (status === 'REJECTED') {
    return 'REJECTED';
  }
  if (status === 'CANCELLED') {
    return 'CANCELLED';
  }
  if (status === 'TIMED_OUT') {
    return 'TIMED_OUT';
  }
  return 'INTERNAL_ERROR';
}

function createSanitizedResponse(
  boundaryResponse: GovernedExecutionResponse,
  currentInternalResult: InternalExecutionResult | undefined,
  snapshot: unknown,
  request: GovernedExecutionRequest
): TrustedServerExecutionResponseV1 {
  const status = boundaryStatusToTrustedStatus(
    boundaryResponse.status
  );
  const unsafeSource: Record<string, unknown> = {
    requestId: boundaryResponse.requestId,
    correlationId: boundaryResponse.correlationId,
    status,
    completedAt: boundaryResponse.completedAt,
    rawData: currentInternalResult?.rawData,
    policySnapshot: snapshot,
    policyTable: snapshot,
    tenantInternals: request.tenant,
    actorInternals: request.actor,
    payload: request.payload,
    metadata: request.metadata,
    bridgeResult: currentInternalResult?.rawData,
    audit: { secret: 'internal-audit' },
    stack: 'internal-stack',
  };
  if (
    status === 'COMPLETED' &&
    currentInternalResult !== undefined
  ) {
    unsafeSource.executionId = currentInternalResult.executionId;
    unsafeSource.resultSummary = {
      outcome: 'SUCCEEDED',
      warningCount: boundaryResponse.warnings.length,
      durationMs: boundaryResponse.durationMs,
      rawData: currentInternalResult.rawData,
      tenantId: request.tenant.tenantId,
    };
  }
  return createTrustedServerExecutionResponseV1(unsafeSource);
}

export function createBoundaryIntegrationFixture(
  options: BoundaryIntegrationFixtureOptions = {}
): BoundaryIntegrationFixture {
  const abortController = new AbortController();
  const requestId =
    options.requestId ?? INTEGRATION_REQUEST_ID;
  const correlationId =
    options.correlationId ?? INTEGRATION_CORRELATION_ID;
  const contextInput = createTrustedContextInput(
    abortController.signal,
    {
      requestIdentity: {
        schemaVersion: '1',
        requestId,
        correlationId,
        generationStrategy: 'DETERMINISTIC_TEST',
        generatedAt: GENERATED_AT,
        generatorVersion: 'generator:boundary-integration:v1',
      },
    }
  );
  const trustedContext =
    createTrustedServerRequestContextV1(contextInput);
  const registrySelection = resolveTrustedRegistrySelectionV1({
    consumer: trustedContext.consumer,
    source: trustedContext.source,
    transport: trustedContext.transport,
    requestedExecutionMode:
      trustedContext.requestedExecutionMode,
  });
  const policySnapshot =
    options.snapshot ?? AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1;
  const policyProducer =
    options.producer ??
    new InMemoryAuthoritativeFeaturePolicyProducer(
      policySnapshot
    );
  const clock = new DeterministicBoundaryClock(
    options.clockTimestamps
  );
  const observations: MutableIntegrationObservations = {
    policyQueries: [],
    policyDecisions: [],
    internalInputs: [],
    internalResults: [],
    bootstrapInputs: [],
    bootstrapStates: [],
  };
  const featurePolicyPort: AuthoritativeFeaturePolicyPort = {
    getEffectivePolicy: (tenantId, source) =>
      policyProducer.getEffectivePolicy(tenantId, source),
    evaluateAuthoritativePolicy: async (query) => {
      observations.policyQueries.push(query);
      const decision =
        await policyProducer.evaluateAuthoritativePolicy(query);
      observations.policyDecisions.push(decision);
      return decision;
    },
  };
  const productionBootstrapper = new PipelineBootstrapper({
    clock: { now: () => 300 },
    evidenceFactory: new PipelineBootstrapEvidenceFactory(),
  });
  const observingBootstrapper: PipelineBootstrapPort = {
    bootstrap: async (input, signal) => {
      observations.bootstrapInputs.push(input);
      const state = await productionBootstrapper.bootstrap(
        input,
        signal
      );
      observations.bootstrapStates.push(state);
      return state;
    },
  };
  const bootstrapAdapter = new BootstrapBoundaryAdapter({
    bootstrapper: observingBootstrapper,
    clock,
  });
  const observingExecutionPort: BoundaryExecutionPort = {
    execute: async (input, signal) => {
      observations.internalInputs.push(input);
      const result = await bootstrapAdapter.execute(input, signal);
      observations.internalResults.push(result);
      return result;
    },
  };
  const boundary = new GovernedExecutionBoundary({
    clockPort: clock,
    featurePolicyPort,
    executionPort: observingExecutionPort,
  });
  const invocationContext: BoundaryInvocationContextV1 = {
    schemaVersion: '1',
    tenantId: trustedContext.tenantMembership.tenantId,
    actor: {
      actorType:
        trustedContext.authenticatedPrincipal.principalType,
      actorId:
        trustedContext.authenticatedPrincipal.principalId,
    },
    consumerId: trustedContext.consumer,
    source: trustedContext.source,
    requestId: trustedContext.requestIdentity.requestId,
    correlationId:
      trustedContext.requestIdentity.correlationId,
  };
  const request: GovernedExecutionRequest = {
    requestId: invocationContext.requestId,
    correlationId: invocationContext.correlationId,
    tenant: { tenantId: invocationContext.tenantId },
    actor: {
      actorType: invocationContext.actor.actorType,
      actorId: invocationContext.actor.actorId,
    },
    source: invocationContext.source,
    requestedMode: trustedContext.requestedExecutionMode,
    payload: createIntegrationBusinessPayload(),
    metadata: {
      operationalLabel: 'integration-validation',
      secret: 'must-not-propagate',
    },
    cancellationSignal:
      trustedContext.cancellation.cancellationSignal,
  };

  return {
    abortController,
    clock,
    trustedContext,
    registrySelection,
    policySnapshot,
    policyProducer,
    boundary,
    request,
    invocationContext,
    observations,
    async execute(
      executionOptions: BoundaryExecutionOptions = {}
    ): Promise<BoundaryIntegrationExecution> {
      const currentRequest =
        executionOptions.request ?? request;
      const internalResultCount =
        observations.internalResults.length;
      const boundaryResponse = await boundary.execute(
        currentRequest,
        executionOptions.invocationContext === null
          ? undefined
          : executionOptions.invocationContext ??
              invocationContext
      );
      const currentInternalResult =
        observations.internalResults.length > internalResultCount
          ? observations.internalResults.at(-1)
          : undefined;
      return {
        boundaryResponse,
        trustedResponse: createSanitizedResponse(
          boundaryResponse,
          currentInternalResult,
          policySnapshot,
          currentRequest
        ),
      };
    },
  };
}

export function withRequest(
  request: GovernedExecutionRequest,
  overrides: Partial<GovernedExecutionRequest>
): GovernedExecutionRequest {
  return { ...request, ...overrides };
}

export function withInvocationContext(
  context: BoundaryInvocationContextV1,
  overrides: Partial<BoundaryInvocationContextV1>
): BoundaryInvocationContextV1 {
  return { ...context, ...overrides };
}
