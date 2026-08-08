import { describe, expect, it, vi } from 'vitest';

import type { InternalExecutionInput } from '../../os/boundary/ports';
import type { AuthoritativeExecutionContextV1 } from '../../os/boundary/types';
import type {
  PipelineBootstrapExecutionResult,
} from '../../os/bootstrap/PipelineBootstrapExecutionComposer';
import type { PipelineBootstrapInput } from '../../os/bootstrap/types';
import type {
  PipelineResult,
  PipelineStatus,
} from '../../os/types';
import {
  ProductionBoundaryExecutionAdapterV1,
} from '../ProductionBoundaryExecutionAdapterV1';

const INITIATED_AT = '2026-07-28T12:00:00.000Z';
const DEADLINE_AT = '2026-07-28T12:00:30.000Z';

function createAuthoritativeContext(): AuthoritativeExecutionContextV1 {
  return {
    schemaVersion: '1',
    tenantId: 'tenant-authoritative',
    actor: {
      actorType: 'USER',
      actorId: 'actor-authoritative',
    },
    consumerId: 'consumer-authoritative',
    source: 'trusted-boundary',
    requestId: 'request-authoritative',
    correlationId: 'correlation-authoritative',
    executionMode: 'SHADOW_ONLY',
    initiatedAt: INITIATED_AT,
    authoritativeDeadlineAt: DEADLINE_AT,
    authorizationPolicyVersion: 'policy:authoritative:v1',
  };
}

function createBusinessPayload() {
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
        factId: 'fact-industry-1',
        category: 'BUSINESS_INDUSTRY',
        value: 'HOSPITALITY',
        valueType: 'ENUM',
        provenance: {
          sourceType: 'INTEGRATION',
          sourceId: 'source-event-1',
          collectionMethod: 'SYSTEM_EVENT',
          capturedAt: 200,
          reliability: 'HIGH',
          directness: 'DIRECT',
          actorType: 'SYSTEM',
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
      maxTotalPayloadSize: 8_192,
      duplicateFactPolicy: 'REJECT',
      conflictPolicy: 'REJECT',
      failClosed: true,
      requireExplicitScenario: true,
    },
    locale: 'es-MX',
    timezone: 'America/Mexico_City',
  };
}

function createInternalInput(): InternalExecutionInput {
  return {
    sessionId: 'session-boundary-1',
    payload: createBusinessPayload(),
    authoritativeContext: createAuthoritativeContext(),
  };
}

function createPipelineResult(
  status: PipelineStatus,
): PipelineResult {
  return {
    contractVersion: '1',
    pipelineVersion: '1',
    executionId: 'execution-pipeline-1',
    sessionId: 'session-pipeline-1',
    status,
    startedAt: '2026-07-28T12:00:00.000Z',
    completedAt: '2026-07-28T12:00:01.000Z',
    durationMs: 1_000,
    stageResults: {},
    partialFailures: status === 'PARTIAL_SUCCESS',
    skippedStages: [],
    errors: [],
    warnings: ['pipeline-warning'],
    auditTrail: [],
  };
}

function createComposerResult(
  status: PipelineStatus,
): PipelineBootstrapExecutionResult {
  const pipelineResult = createPipelineResult(status);

  return {
    status:
      status === 'SUCCESS'
        ? 'EXECUTION_COMPLETED'
        : 'EXECUTION_FAILED',
    bootstrapState: {
      status: 'ACCEPTED',
    },
    handoff: {},
    pipelineResult,
  } as PipelineBootstrapExecutionResult;
}

function createHarness(status: PipelineStatus) {
  const composer = {
    execute: vi.fn(
      async (
        _input: PipelineBootstrapInput,
        _signal?: AbortSignal,
      ) => {
        void _input;
        void _signal;

        return createComposerResult(status);
      },
    ),
  };

  return {
    adapter: new ProductionBoundaryExecutionAdapterV1(composer),
    composer,
  };
}

describe('ProductionBoundaryExecutionAdapterV1', () => {
  it.each([
    ['SUCCESS', 'SUCCEEDED'],
    ['PARTIAL_SUCCESS', 'PARTIAL'],
    ['FAILED', 'FAILED'],
    ['CANCELLED', 'CANCELLED'],
    ['TIMED_OUT', 'TIMED_OUT'],
  ] as const)(
    'maps pipeline %s to internal %s',
    async (pipelineStatus, internalStatus) => {
      const { adapter } = createHarness(pipelineStatus);

      const result = await adapter.execute(
        createInternalInput(),
      );

      expect(result.status).toBe(internalStatus);
    },
  );

  it.each([
    'CREATED',
    'CONTEXT_READY',
    'RUNNING',
  ] as const)(
    'fails closed for non-terminal pipeline status %s',
    async (pipelineStatus) => {
      const { adapter } = createHarness(pipelineStatus);

      const result = await adapter.execute(
        createInternalInput(),
      );

      expect(result.status).toBe('FAILED');
    },
  );

  it('preserves executionId and sessionId from PipelineResult', async () => {
    const { adapter } = createHarness('SUCCESS');

    const result = await adapter.execute(
      createInternalInput(),
    );

    expect(result.executionId).toBe(
      'execution-pipeline-1',
    );
    expect(result.sessionId).toBe(
      'session-pipeline-1',
    );
  });

  it('preserves warnings and raw pipeline result', async () => {
    const { adapter } = createHarness('PARTIAL_SUCCESS');

    const result = await adapter.execute(
      createInternalInput(),
    );

    expect(result.warnings).toEqual([
      'pipeline-warning',
    ]);
    expect(result.rawData).toMatchObject({
      status: 'PARTIAL_SUCCESS',
      executionId: 'execution-pipeline-1',
    });
  });

  it('rejects execution without authoritative context', async () => {
    const { adapter, composer } = createHarness('SUCCESS');

    const input: InternalExecutionInput = {
      sessionId: 'session-boundary-1',
      payload: createBusinessPayload(),
    };

    await expect(
      adapter.execute(input),
    ).rejects.toThrow(
      'Authoritative execution context is required',
    );

    expect(composer.execute).not.toHaveBeenCalled();
  });

  it('maps BOOTSTRAP_REJECTED to FAILED fail-closed', async () => {
    const composer = {
      execute: vi.fn(
        async (
          _input: PipelineBootstrapInput,
          _signal?: AbortSignal,
        ) => {
          void _input;
          void _signal;

          return {
            status: 'BOOTSTRAP_REJECTED',
            bootstrapState: {
              status: 'REJECTED',
              bootstrapId: 'request-authoritative',
              tenantId: 'tenant-authoritative',
              correlationId: 'correlation-authoritative',
              errors: [
                {
                  code: 'EMPTY_FACT_SET',
                  message: 'Bootstrap facts are required',
                  retryable: false,
                },
              ],
              bootstrapVersion: '1',
              createdAt: 300,
            },
          } as PipelineBootstrapExecutionResult;
        },
      ),
    };

    const adapter =
      new ProductionBoundaryExecutionAdapterV1(composer);

    const result = await adapter.execute(
      createInternalInput(),
    );

    expect(result.status).toBe('FAILED');

    expect(result.executionId).toBe(
      'request-authoritative',
    );

    expect(result.sessionId).toBe(
      'session-boundary-1',
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);

    expect(result.rawData).toMatchObject({
      status: 'REJECTED',
      bootstrapId: 'request-authoritative',
      errors: [
        {
          code: 'EMPTY_FACT_SET',
          retryable: false,
        },
      ],
    });
  });
  it('forwards AbortSignal to the Composer', async () => {
    const { adapter, composer } = createHarness('SUCCESS');
    const controller = new AbortController();

    await adapter.execute(
      createInternalInput(),
      controller.signal,
    );

    expect(composer.execute).toHaveBeenCalledTimes(1);

    const call = composer.execute.mock.calls[0];

    expect(call?.[1]).toBe(controller.signal);
  });
});
