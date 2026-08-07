import { describe, expect, it } from 'vitest';

import {
  createBootstrapBoundaryBridgeAuthorityV1,
  createBootstrapBoundaryBridgeEnvelopeV1,
} from '../../bootstrapBoundaryBridge/validators';
import type {
  AuthoritativeExecutionContextV1,
} from '../../boundary/types';
import {
  mapBootstrapBoundaryEnvelopeToPipelineInputV1,
} from '../BootstrapBoundaryInputMapperV1';

const INITIATED_AT = '2026-07-28T12:00:00.000Z';
const DEADLINE_AT = '2026-07-28T12:00:30.000Z';

function createAuthoritativeContext(
  overrides: Partial<AuthoritativeExecutionContextV1> = {},
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

function createEnvelope(
  context: AuthoritativeExecutionContextV1 = createAuthoritativeContext(),
  payload: unknown = createBusinessPayload(),
) {
  const authority =
    createBootstrapBoundaryBridgeAuthorityV1(context);

  return createBootstrapBoundaryBridgeEnvelopeV1(
    authority,
    payload,
  );
}

describe('BootstrapBoundaryInputMapperV1', () => {
  it('1. maps a valid authoritative envelope to PipelineBootstrapInput', () => {
    const result =
      mapBootstrapBoundaryEnvelopeToPipelineInputV1(
        createEnvelope(),
      );

    expect(result).toMatchObject({
      bootstrapId: 'request-authoritative',
      tenantId: 'tenant-authoritative',
      correlationId: 'correlation-authoritative',
      targetScenario: {
        scenarioId: 'PAYROLL_AUDIT',
      },
      context: {
        requestedAt: Date.parse(INITIATED_AT),
        requestedBy: {
          requesterId: 'actor-authoritative',
          actorType: 'USER',
        },
        source: 'trusted-boundary',
      },
      schemaVersion: '1',
    });
  });

  it('2. maps SYSTEM authority to Bootstrap SYSTEM', () => {
    const result =
      mapBootstrapBoundaryEnvelopeToPipelineInputV1(
        createEnvelope(
          createAuthoritativeContext({
            actor: {
              actorType: 'SYSTEM',
              actorId: 'system-authoritative',
            },
          }),
        ),
      );

    expect(result.context.requestedBy).toEqual({
      requesterId: 'system-authoritative',
      actorType: 'SYSTEM',
    });
  });

  it('3. rejects SERVICE authority fail-closed', () => {
    expect(() =>
      mapBootstrapBoundaryEnvelopeToPipelineInputV1(
        createEnvelope(
          createAuthoritativeContext({
            actor: {
              actorType: 'SERVICE',
              actorId: 'service-authoritative',
            },
          }),
        ),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'INVALID_ACTOR_CONTEXT',
      }),
    );
  });

  it('4. derives tenant and correlation provenance only from authority', () => {
    const result =
      mapBootstrapBoundaryEnvelopeToPipelineInputV1(
        createEnvelope(),
      );

    expect(result.facts[0]).toMatchObject({
      provenance: {
        tenantId: 'tenant-authoritative',
        correlationId: 'correlation-authoritative',
      },
    });
  });

  it('5. rejects malformed business payload', () => {
    expect(() =>
      mapBootstrapBoundaryEnvelopeToPipelineInputV1(
        createEnvelope(
          createAuthoritativeContext(),
          {
            ...createBusinessPayload(),
            facts: [],
          },
        ),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'INVALID_REQUEST',
      }),
    );
  });

  it('6. rejects non-canonical initiatedAt', () => {
    expect(() =>
      mapBootstrapBoundaryEnvelopeToPipelineInputV1(
        createEnvelope(
          createAuthoritativeContext({
            initiatedAt: '2026-07-28T12:00:00Z',
          }),
        ),
      ),
    ).toThrow();
  });

  it('7. deeply freezes mapped bootstrap input', () => {
    const result =
      mapBootstrapBoundaryEnvelopeToPipelineInputV1(
        createEnvelope(),
      );

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.facts)).toBe(true);
    expect(Object.isFrozen(result.facts[0])).toBe(true);
    expect(Object.isFrozen(result.facts[0].provenance)).toBe(true);
    expect(Object.isFrozen(result.targetScenario)).toBe(true);
    expect(Object.isFrozen(result.context)).toBe(true);
  });

  it('8. isolates mapped input from later caller mutation', () => {
    const payload = createBusinessPayload();

    const result =
      mapBootstrapBoundaryEnvelopeToPipelineInputV1(
        createEnvelope(
          createAuthoritativeContext(),
          payload,
        ),
      );

    payload.facts[0].value = 'RETAIL';
    payload.targetScenario.scenarioId =
      'ORGANIZATION_RESTRUCTURE';

    expect(result.facts[0]).toMatchObject({
      value: 'HOSPITALITY',
      provenance: {
        tenantId: 'tenant-authoritative',
        correlationId: 'correlation-authoritative',
      },
    });

    expect(result.targetScenario.scenarioId).toBe(
      'PAYROLL_AUDIT',
    );
  });
});
