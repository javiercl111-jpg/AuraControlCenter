import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  BoundaryClockPort,
  InternalExecutionInput,
  InternalPayloadValue,
} from '../../boundary/ports';
import type {
  AuthoritativeExecutionContextV1,
} from '../../boundary/types';
import {
  GovernedBoundaryError,
} from '../../boundary/errors';
import {
  createBootstrapBoundaryBridgeAuthorityV1,
} from '../../bootstrapBoundaryBridge/validators';
import { PipelineBootstrapEvidenceFactory } from '../../bootstrap/PipelineBootstrapEvidenceFactory';
import { PipelineBootstrapper } from '../../bootstrap/PipelineBootstrapper';
import type { PipelineBootstrapPort } from '../../bootstrap/ports';
import type {
  PipelineBootstrapInput,
  PipelineBootstrapState,
} from '../../bootstrap/types';
import { BootstrapBoundaryAdapter } from '../BootstrapBoundaryAdapter';

const INITIATED_AT = '2026-07-28T12:00:00.000Z';
const CURRENT_AT = '2026-07-28T12:00:10.000Z';
const DEADLINE_AT = '2026-07-28T12:00:30.000Z';
const BOOTSTRAP_CREATED_AT = 300;

function createAuthoritativeContext(
  overrides: Partial<AuthoritativeExecutionContextV1> = {}
): AuthoritativeExecutionContextV1 {
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
    ...overrides,
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

function createInternalInput(
  payload: InternalPayloadValue = createBusinessPayload(),
  overrides: Partial<InternalExecutionInput> = {}
): InternalExecutionInput {
  return {
    sessionId: 'correlation-authoritative',
    payload,
    authoritativeContext: createAuthoritativeContext(),
    ...overrides,
  };
}

function createProductionBootstrapper(): PipelineBootstrapper {
  return new PipelineBootstrapper({
    clock: {
      now: () => BOOTSTRAP_CREATED_AT,
    },
    evidenceFactory: new PipelineBootstrapEvidenceFactory(),
  });
}

interface AdapterHarnessOptions {
  readonly clock?: BoundaryClockPort;
  readonly bootstrap?: (
    input: PipelineBootstrapInput,
    signal?: AbortSignal
  ) => Promise<PipelineBootstrapState>;
}

function createAdapterHarness(
  options: AdapterHarnessOptions = {}
) {
  const calls: PipelineBootstrapInput[] = [];
  const signals: Array<AbortSignal | undefined> = [];
  const productionBootstrapper = createProductionBootstrapper();
  const bootstrapper: PipelineBootstrapPort = {
    async bootstrap(input, signal) {
      calls.push(input);
      signals.push(signal);
      if (options.bootstrap) {
        return options.bootstrap(input, signal);
      }
      return productionBootstrapper.bootstrap(input, signal);
    },
  };
  const adapter = new BootstrapBoundaryAdapter({
    bootstrapper,
    clock: options.clock ?? {
      now: () => CURRENT_AT,
    },
  });
  return {
    adapter,
    calls,
    signals,
  };
}

function createSequenceClock(
  values: readonly string[]
): BoundaryClockPort {
  let index = 0;
  return {
    now() {
      const value = values[Math.min(index, values.length - 1)];
      index += 1;
      if (value === undefined) {
        throw new Error('Clock sequence is empty');
      }
      return value;
    },
  };
}

function expectGovernedCode(
  error: unknown,
  code: GovernedBoundaryError['code']
): void {
  expect(error).toBeInstanceOf(GovernedBoundaryError);
  if (!(error instanceof GovernedBoundaryError)) {
    throw new Error('Expected GovernedBoundaryError');
  }
  expect(error.code).toBe(code);
}

function readAdapterSource(): string {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/modules/intelligence/os/bootstrapBoundaryAdapter/BootstrapBoundaryAdapter.ts'
    ),
    'utf8'
  );
}

describe('AI-02H0C BootstrapBoundaryAdapter', () => {
  it('1. rejects when authoritativeContext is absent', async () => {
    const harness = createAdapterHarness();
    await expect(
      harness.adapter.execute(
        createInternalInput(createBusinessPayload(), {
          authoritativeContext: undefined,
        })
      )
    ).rejects.toMatchObject({
      issue: 'BOUNDARY_CONTEXT_MISSING',
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('2. rejects invalid authoritativeContext', async () => {
    const harness = createAdapterHarness();
    await expect(
      harness.adapter.execute(
        createInternalInput(createBusinessPayload(), {
          authoritativeContext: createAuthoritativeContext({
            tenantId: '',
          }),
        })
      )
    ).rejects.toMatchObject({
      issue: 'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID',
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('3. derives execution authority only from authoritativeContext', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.execute(createInternalInput());

    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0]).toMatchObject({
      bootstrapId: 'request-authoritative',
      tenantId: 'tenant-authoritative',
      correlationId: 'correlation-authoritative',
      context: {
        requestedAt: Date.parse(INITIATED_AT),
        requestedBy: {
          requesterId: 'actor-authoritative',
          actorType: 'USER',
        },
        source: 'trusted-boundary',
      },
    });
  });

  it('4. rejects contradictory payload authority instead of substituting tenant', async () => {
    const harness = createAdapterHarness();
    const payload = {
      ...createBusinessPayload(),
      tenantId: 'tenant-payload',
    };

    await expect(
      harness.adapter.execute(createInternalInput(payload))
    ).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('5. never substitutes contradictory metadata for authority', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.execute(
      createInternalInput(createBusinessPayload(), {
        metadata: {
          tenantId: 'tenant-metadata',
          actorId: 'actor-metadata',
          correlationId: 'correlation-metadata',
        },
      })
    );

    expect(harness.calls[0]).toMatchObject({
      tenantId: 'tenant-authoritative',
      correlationId: 'correlation-authoritative',
      context: {
        requestedBy: {
          requesterId: 'actor-authoritative',
        },
      },
    });
  });

  it('6. rejects sessionId that contradicts authoritative correlationId', async () => {
    const harness = createAdapterHarness();
    await expect(
      harness.adapter.execute(
        createInternalInput(createBusinessPayload(), {
          sessionId: 'correlation-session-spoof',
        })
      )
    ).rejects.toMatchObject({
      issue: 'BOUNDARY_REQUEST_CONTEXT_MISMATCH',
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('7. preserves authoritative correlationId end to end', async () => {
    const harness = createAdapterHarness();
    const result = await harness.adapter.execute(
      createInternalInput()
    );

    expect(result.sessionId).toBe('correlation-authoritative');
    expect(harness.calls[0].correlationId).toBe(
      'correlation-authoritative'
    );
    expect(result.rawData).toMatchObject({
      authority: {
        correlationId: 'correlation-authoritative',
      },
      bootstrapState: {
        correlationId: 'correlation-authoritative',
      },
    });
  });

  it('8. preserves consumerId in the bridge result', async () => {
    const result = await createAdapterHarness().adapter.execute(
      createInternalInput()
    );
    expect(result.rawData).toMatchObject({
      authority: {
        consumerId: 'consumer-authoritative',
      },
    });
  });

  it('9. preserves authoritative executionMode in the bridge result', async () => {
    const result = await createAdapterHarness().adapter.execute(
      createInternalInput()
    );
    expect(result.rawData).toMatchObject({
      authority: {
        executionMode: 'SHADOW_ONLY',
      },
    });
  });

  it('10. preserves authorizationPolicyVersion in the bridge result', async () => {
    const result = await createAdapterHarness().adapter.execute(
      createInternalInput()
    );
    expect(result.rawData).toMatchObject({
      authority: {
        authorizationPolicyVersion: 'policy:authoritative:v1',
      },
    });
  });

  it('11. preserves the exact authoritative deadline', async () => {
    const result = await createAdapterHarness().adapter.execute(
      createInternalInput()
    );
    expect(result.rawData).toMatchObject({
      authority: {
        authoritativeDeadlineAt: DEADLINE_AT,
      },
    });
  });

  it('12. maps Boundary USER to bridge HUMAN explicitly', () => {
    const authority =
      createBootstrapBoundaryBridgeAuthorityV1(
        createAuthoritativeContext()
      );
    expect(authority.actor).toEqual({
      actorType: 'HUMAN',
      actorId: 'actor-authoritative',
    });
  });

  it('13. preserves Boundary SERVICE as bridge SERVICE', () => {
    const authority =
      createBootstrapBoundaryBridgeAuthorityV1(
        createAuthoritativeContext({
          actor: {
            actorType: 'SERVICE',
            actorId: 'service-authoritative',
          },
        })
      );
    expect(authority.actor).toEqual({
      actorType: 'SERVICE',
      actorId: 'service-authoritative',
    });
  });

  it('14. preserves SYSTEM in bridge and maps it to Bootstrap SYSTEM', async () => {
    const authority =
      createBootstrapBoundaryBridgeAuthorityV1(
        createAuthoritativeContext({
          actor: {
            actorType: 'SYSTEM',
            actorId: 'system-authoritative',
          },
        })
      );
    expect(authority.actor.actorType).toBe('SYSTEM');

    const harness = createAdapterHarness();
    await harness.adapter.execute(
      createInternalInput(createBusinessPayload(), {
        authoritativeContext: createAuthoritativeContext({
          actor: {
            actorType: 'SYSTEM',
            actorId: 'system-authoritative',
          },
        }),
      })
    );
    expect(harness.calls[0].context.requestedBy).toEqual({
      requesterId: 'system-authoritative',
      actorType: 'SYSTEM',
    });
  });

  it('15. rejects bridge SERVICE because Bootstrap has no equivalent actor', async () => {
    const harness = createAdapterHarness();
    await expect(
      harness.adapter.execute(
        createInternalInput(createBusinessPayload(), {
          authoritativeContext: createAuthoritativeContext({
            actor: {
              actorType: 'SERVICE',
              actorId: 'service-authoritative',
            },
          }),
        })
      )
    ).rejects.toMatchObject({
      code: 'INVALID_ACTOR_CONTEXT',
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('16. clones and freezes valid payload while preserving AbortSignal identity', async () => {
    const payload = createBusinessPayload();
    const controller = new AbortController();
    const harness = createAdapterHarness();

    await harness.adapter.execute(
      createInternalInput(payload),
      controller.signal
    );

    expect(harness.calls[0].facts).not.toBe(payload.facts);
    expect(harness.calls[0].targetScenario).not.toBe(
      payload.targetScenario
    );
    expect(Object.isFrozen(harness.calls[0])).toBe(true);
    expect(Object.isFrozen(harness.calls[0].facts)).toBe(true);
    expect(harness.signals[0]).toBe(controller.signal);
  });

  it('17. isolates Bootstrap input from caller mutation after dispatch', async () => {
    const payload = createBusinessPayload();
    const harness = createAdapterHarness();
    const execution = harness.adapter.execute(
      createInternalInput(payload)
    );

    payload.facts[0].value = 'RETAIL';
    payload.targetScenario.scenarioId =
      'ORGANIZATION_RESTRUCTURE';
    await execution;

    expect(harness.calls[0].facts[0]).toMatchObject({
      value: 'HOSPITALITY',
      provenance: {
        tenantId: 'tenant-authoritative',
        correlationId: 'correlation-authoritative',
      },
    });
    expect(harness.calls[0].targetScenario.scenarioId).toBe(
      'PAYROLL_AUDIT'
    );
  });

  it('18. prevents Bootstrap invocation when cancellation is already active', async () => {
    const controller = new AbortController();
    controller.abort();
    const harness = createAdapterHarness();

    await expect(
      harness.adapter.execute(
        createInternalInput(),
        controller.signal
      )
    ).rejects.toSatisfy((error: unknown) => {
      expectGovernedCode(error, 'CANCELLED');
      return true;
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('19. prevents Bootstrap invocation when deadline is already expired', async () => {
    const harness = createAdapterHarness({
      clock: {
        now: () => DEADLINE_AT,
      },
    });

    await expect(
      harness.adapter.execute(createInternalInput())
    ).rejects.toSatisfy((error: unknown) => {
      expectGovernedCode(error, 'TIMEOUT');
      return true;
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('20. rejects cancellation that becomes active after Bootstrap await', async () => {
    const controller = new AbortController();
    let release: (() => void) | undefined;
    let entered: (() => void) | undefined;
    const enteredBootstrap = new Promise<void>((resolveEntered) => {
      entered = resolveEntered;
    });
    const releaseBootstrap = new Promise<void>((resolveRelease) => {
      release = resolveRelease;
    });
    const production = createProductionBootstrapper();
    const harness = createAdapterHarness({
      async bootstrap(input, signal) {
        entered?.();
        await releaseBootstrap;
        return production.bootstrap(input, signal);
      },
    });

    const execution = harness.adapter.execute(
      createInternalInput(),
      controller.signal
    );
    await enteredBootstrap;
    controller.abort();
    release?.();

    await expect(execution).rejects.toSatisfy(
      (error: unknown) => {
        expectGovernedCode(error, 'CANCELLED');
        return true;
      }
    );
    expect(harness.calls).toHaveLength(1);
  });

  it('21. rejects a deadline that expires after Bootstrap await', async () => {
    const harness = createAdapterHarness({
      clock: createSequenceClock([
        CURRENT_AT,
        CURRENT_AT,
        DEADLINE_AT,
      ]),
    });

    await expect(
      harness.adapter.execute(createInternalInput())
    ).rejects.toSatisfy((error: unknown) => {
      expectGovernedCode(error, 'TIMEOUT');
      return true;
    });
    expect(harness.calls).toHaveLength(1);
  });

  it('22. invokes Bootstrapper exactly once for valid input', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.execute(createInternalInput());
    expect(harness.calls).toHaveLength(1);
  });

  it('23. never invokes Bootstrapper when business payload validation fails', async () => {
    const harness = createAdapterHarness();
    const payload = {
      ...createBusinessPayload(),
      facts: [],
    };

    await expect(
      harness.adapter.execute(createInternalInput(payload))
    ).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('24. turns an accepted Bootstrap state into bridge ACCEPTED', async () => {
    const result = await createAdapterHarness().adapter.execute(
      createInternalInput()
    );
    expect(result.rawData).toMatchObject({
      bridgeStatus: 'ACCEPTED',
      bootstrapState: {
        status: 'ACCEPTED',
      },
    });
  });

  it('25. turns a rejected Bootstrap state into bridge REJECTED', async () => {
    const payload = createBusinessPayload();
    payload.policy.allowUncertainPolarity = true;
    payload.facts[0].polarity = 'UNCERTAIN';

    const result = await createAdapterHarness().adapter.execute(
      createInternalInput(payload)
    );

    expect(result.rawData).toMatchObject({
      bridgeStatus: 'REJECTED',
      bootstrapState: {
        status: 'REJECTED',
      },
      publicError: {
        code: 'BOOTSTRAP_REJECTED',
      },
    });
  });

  it('26. represents accepted InternalExecutionResult honestly', async () => {
    const result = await createAdapterHarness().adapter.execute(
      createInternalInput()
    );
    expect(result).toMatchObject({
      executionId: 'request-authoritative',
      sessionId: 'correlation-authoritative',
      status: 'SUCCEEDED',
    });
    expect(result.errors).toBeUndefined();
  });

  it('27. represents rejected InternalExecutionResult with a safe public error', async () => {
    const payload = createBusinessPayload();
    payload.policy.allowUncertainPolarity = true;
    payload.facts[0].polarity = 'UNCERTAIN';

    const result = await createAdapterHarness().adapter.execute(
      createInternalInput(payload)
    );

    expect(result).toMatchObject({
      executionId: 'request-authoritative',
      sessionId: 'correlation-authoritative',
      status: 'FAILED',
      errors: [
        {
          code: 'BOOTSTRAP_REJECTED',
          message: 'Bootstrap request was rejected',
        },
      ],
    });
    expect(JSON.stringify(result.errors)).not.toContain(
      'tenant-authoritative'
    );
  });

  it('28. adapts explicitly without InternalExecutionResult casts or ambient values', () => {
    const source = readAdapterSource();
    expect(source).not.toMatch(
      /as\s+(?:unknown\s+as\s+)?InternalExecutionResult/
    );
    expect(source).not.toMatch(/Date\.now\s*\(/);
    expect(source).not.toMatch(/new Date\s*\(\s*\)/);
    expect(source).not.toMatch(/Math\.random\s*\(/);
    expect(source).not.toMatch(/randomUUID\s*\(/);
  });

  it('29. contains no Orchestrator call or import', () => {
    expect(readAdapterSource()).not.toMatch(
      /AuraIntelligenceOrchestrator|executePipeline/
    );
  });

  it('30. contains no checkpoint construction or mapping', () => {
    expect(readAdapterSource()).not.toMatch(
      /Checkpoint|checkpointMapper|precomputedCheckpoint/
    );
  });

  it('31. contains no Firebase or Firestore coupling', () => {
    const token = ['fire', 'base'].join('');
    expect(readAdapterSource()).not.toMatch(
      new RegExp(`${token}|firestore`, 'i')
    );
  });

  it('32. contains no Discovery coupling', () => {
    expect(readAdapterSource()).not.toMatch(/discovery/i);
  });

  it('33. completes the in-memory InternalInput to production Bootstrapper flow', async () => {
    const production = createProductionBootstrapper();
    const adapter = new BootstrapBoundaryAdapter({
      bootstrapper: production,
      clock: {
        now: () => CURRENT_AT,
      },
    });

    const result = await adapter.execute(createInternalInput());

    expect(result).toMatchObject({
      executionId: 'request-authoritative',
      sessionId: 'correlation-authoritative',
      status: 'SUCCEEDED',
      rawData: {
        bridgeStatus: 'ACCEPTED',
        authority: {
          requestId: 'request-authoritative',
          correlationId: 'correlation-authoritative',
          tenantId: 'tenant-authoritative',
        },
        bootstrapState: {
          status: 'ACCEPTED',
          initialDomainState: {
            bootstrapId: 'request-authoritative',
            tenantId: 'tenant-authoritative',
            correlationId: 'correlation-authoritative',
            scenario: {
              scenarioId: 'PAYROLL_AUDIT',
            },
          },
        },
      },
    });
  });
});
