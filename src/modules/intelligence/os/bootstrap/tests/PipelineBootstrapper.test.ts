import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EnterpriseEvidence } from '../../../enterprise-model/domain/evidence';
import {
  PIPELINE_BOOTSTRAP_DIRECTNESS_SCORES,
  PIPELINE_BOOTSTRAP_RELIABILITY_SCORES,
  PipelineBootstrapEvidenceFactory,
} from '../PipelineBootstrapEvidenceFactory';
import { PipelineBootstrapper } from '../PipelineBootstrapper';
import type {
  PipelineBootstrapFact,
  PipelineBootstrapInput,
  PipelineBootstrapPolicy,
  PipelineBootstrapTargetScenario,
} from '../types';
import {
  validateBootstrapAcceptedState,
  validatePipelineBootstrapState,
} from '../validators';

const CREATED_AT = 1_000;
const TENANT_ID = 'tenant-1';
const CORRELATION_ID = 'correlation-1';

function createPolicy(
  overrides: Partial<PipelineBootstrapPolicy> = {}
): PipelineBootstrapPolicy {
  return {
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
    ...overrides,
  };
}

interface EnumFactOverrides {
  readonly factId?: string;
  readonly category?: PipelineBootstrapFact['category'];
  readonly value?: string;
  readonly provenance?: Partial<PipelineBootstrapFact['provenance']>;
  readonly reliability?: PipelineBootstrapFact['reliability'];
  readonly directness?: PipelineBootstrapFact['directness'];
  readonly polarity?: PipelineBootstrapFact['polarity'];
  readonly observedAt?: number;
}

function createIndustryFact(
  overrides: EnumFactOverrides = {}
): PipelineBootstrapFact {
  const baseProvenance: PipelineBootstrapFact['provenance'] = {
    sourceType: 'INTEGRATION',
    sourceId: 'source-1',
    collectionMethod: 'SYSTEM_EVENT',
    capturedAt: 200,
    reliability: 'HIGH',
    directness: 'DIRECT',
    actorType: 'SYSTEM',
    tenantId: TENANT_ID,
    correlationId: CORRELATION_ID,
  };
  return {
    factId: overrides.factId ?? 'fact-industry-1',
    category: overrides.category ?? 'BUSINESS_INDUSTRY',
    value: overrides.value ?? 'HOSPITALITY',
    valueType: 'ENUM',
    provenance: {
      ...baseProvenance,
      ...(overrides.provenance ?? {}),
    },
    reliability: overrides.reliability ?? 'HIGH',
    directness: overrides.directness ?? 'DIRECT',
    polarity: overrides.polarity ?? 'AFFIRMED',
    observedAt: overrides.observedAt ?? 100,
    schemaVersion: '1',
  };
}

function createIncidentFact(factId: string): PipelineBootstrapFact {
  return createIndustryFact({
    factId,
    category: 'OPERATIONS_INCIDENT_SIGNAL',
    value: 'OBSERVED',
  });
}

function createScenario(): PipelineBootstrapTargetScenario {
  return {
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
  };
}

function createInput(
  options: {
    readonly facts?: readonly PipelineBootstrapFact[];
    readonly policy?: PipelineBootstrapPolicy;
    readonly targetScenario?: PipelineBootstrapTargetScenario;
  } = {}
): PipelineBootstrapInput {
  return {
    bootstrapId: 'bootstrap-1',
    tenantId: TENANT_ID,
    correlationId: CORRELATION_ID,
    targetScenario: options.targetScenario ?? createScenario(),
    facts: options.facts ?? [createIndustryFact()],
    context: {
      requestedAt: 300,
      requestedBy: {
        requesterId: 'system-bootstrapper',
        actorType: 'SYSTEM',
      },
      locale: 'es-MX',
      timezone: 'America/Mexico_City',
      source: 'governed-bootstrap-contract',
    },
    policy: options.policy ?? createPolicy(),
    schemaVersion: '1',
  };
}

function createBootstrapper(
  evidenceFactory: Pick<PipelineBootstrapEvidenceFactory, 'create'> =
    new PipelineBootstrapEvidenceFactory()
): PipelineBootstrapper {
  return new PipelineBootstrapper({
    clock: { now: () => CREATED_AT },
    evidenceFactory,
  });
}

async function accepted(
  input = createInput()
) {
  const state = await createBootstrapper().bootstrap(input);
  expect(state.status).toBe('ACCEPTED');
  if (state.status !== 'ACCEPTED') {
    throw new Error('Expected an accepted bootstrap state');
  }
  return state;
}

function asRuntimeInput(value: unknown): PipelineBootstrapInput {
  return value as PipelineBootstrapInput;
}

function readBootstrapSource(file: string): string {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/modules/intelligence/os/bootstrap',
      file
    ),
    'utf8'
  );
}

describe('AI-02G.2B PipelineBootstrapper', () => {
  it('1. produces ACCEPTED for a valid input', async () => {
    expect((await accepted()).status).toBe('ACCEPTED');
  });

  it('2. returns an accepted state that passes the existing validator', async () => {
    const input = createInput();
    const state = await accepted(input);
    expect(validateBootstrapAcceptedState(state, input.policy)).toEqual({
      valid: true,
      value: state,
      errors: [],
    });
  });

  it('3. resolves the exact nominal scenario from the registry', async () => {
    const state = await accepted();
    expect(state.initialDomainState.scenario).toMatchObject({
      scenarioId: 'PAYROLL_AUDIT',
      scenarioVersion: '1',
      objectiveKey: 'ASSESS_PAYROLL_AUDIT_READINESS',
      source: 'AUTHORIZED_SYSTEM_CONFIGURATION',
      explicitSelection: true,
    });
    expect(state.initialDomainState.scenario.requestedStages).toEqual(
      createScenario().requestedStages
    );
  });

  it('4. applies and preserves the caller policy as the validation authority', async () => {
    const policy = createPolicy({ maxFacts: 1 });
    const input = createInput({ policy });
    const state = await createBootstrapper().bootstrap(input);
    expect(validatePipelineBootstrapState(state, policy).valid).toBe(true);
    const overLimit = createInput({
      policy,
      facts: [createIndustryFact(), createIncidentFact('fact-2')],
    });
    expect((await createBootstrapper().bootstrap(overLimit)).status).toBe(
      'REJECTED'
    );
  });

  it('5. obtains createdAt exclusively from the injected clock', async () => {
    const state = await accepted();
    expect(state.createdAt).toBe(CREATED_AT);
    expect(state.initialDomainState.createdAt).toBe(CREATED_AT);
  });

  it('6. derives one applied evidence item from each source fact', async () => {
    const facts = [
      createIndustryFact(),
      createIncidentFact('fact-incident-1'),
    ];
    const state = await accepted(createInput({ facts }));
    expect(state.initialDomainState.evidence).toHaveLength(2);
    expect(
      state.initialDomainState.evidence.map(
        (item) => item.sourceFact.factId
      )
    ).toEqual(['fact-incident-1', 'fact-industry-1']);
  });

  it('7. creates deterministic evidence identifiers', () => {
    const factory = new PipelineBootstrapEvidenceFactory();
    const context = {
      bootstrapId: 'bootstrap-1',
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
    };
    expect(
      factory.create(createIndustryFact(), context).evidenceId
    ).toBe(factory.create(createIndustryFact(), context).evidenceId);
  });

  it('8. maps the same fact and identity to the same evidence ID', async () => {
    const first = await accepted();
    const second = await accepted();
    expect(
      first.initialDomainState.evidence[0].appliedEvidence.evidenceId
    ).toBe(
      second.initialDomainState.evidence[0].appliedEvidence.evidenceId
    );
  });

  it('9. changes the evidence ID when a relevant identity field changes', () => {
    const factory = new PipelineBootstrapEvidenceFactory();
    const context = {
      bootstrapId: 'bootstrap-1',
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
    };
    const first = factory.create(createIndustryFact(), context);
    const second = factory.create(
      createIndustryFact({ value: 'RETAIL' }),
      context
    );
    expect(first.evidenceId).not.toBe(second.evidenceId);
  });

  it('10. preserves tenant identity in the accepted state and source fact', async () => {
    const state = await accepted();
    expect(state.tenantId).toBe(TENANT_ID);
    expect(state.initialDomainState.tenantId).toBe(TENANT_ID);
    expect(
      state.initialDomainState.evidence[0].sourceFact.provenance.tenantId
    ).toBe(TENANT_ID);
  });

  it('11. maps correlation identity to the evidence session without invention', async () => {
    const state = await accepted();
    const evidence =
      state.initialDomainState.evidence[0].appliedEvidence;
    expect(state.correlationId).toBe(CORRELATION_ID);
    expect(evidence.sessionId).toBe(CORRELATION_ID);
    expect(evidence.turnId).toBe('bootstrap-1');
  });

  it('12. preserves AFFIRMED and NEGATED polarity semantics', () => {
    const factory = new PipelineBootstrapEvidenceFactory();
    const context = {
      bootstrapId: 'bootstrap-1',
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
    };
    expect(
      factory.create(createIndustryFact(), context).polarity
    ).toBe('POSITIVE');
    expect(
      factory.create(
        createIndustryFact({ polarity: 'NEGATED' }),
        context
      ).polarity
    ).toBe('NEGATIVE');
  });

  it('13. maps every closed reliability level to its explicit numeric score', () => {
    expect(PIPELINE_BOOTSTRAP_RELIABILITY_SCORES).toEqual({
      CONFIRMED: 1,
      HIGH: 0.8,
      MEDIUM: 0.6,
      LOW: 0.3,
      UNKNOWN: 0,
    });
    const factory = new PipelineBootstrapEvidenceFactory();
    const context = {
      bootstrapId: 'bootstrap-1',
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
    };
    for (const [level, score] of Object.entries(
      PIPELINE_BOOTSTRAP_RELIABILITY_SCORES
    )) {
      const reliability =
        level as PipelineBootstrapFact['reliability'];
      expect(
        factory.create(
          createIndustryFact({
            reliability,
            provenance: { reliability },
          }),
          context
        ).reliability
      ).toBe(score);
    }
  });

  it('14. maps every closed directness level to its explicit numeric score', () => {
    expect(PIPELINE_BOOTSTRAP_DIRECTNESS_SCORES).toEqual({
      DIRECT: 1,
      DERIVED: 0.75,
      INFERRED: 0.5,
    });
    const factory = new PipelineBootstrapEvidenceFactory();
    const context = {
      bootstrapId: 'bootstrap-1',
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
    };
    for (const [level, score] of Object.entries(
      PIPELINE_BOOTSTRAP_DIRECTNESS_SCORES
    )) {
      const directness =
        level as PipelineBootstrapFact['directness'];
      expect(
        factory.create(
          createIndustryFact({
            directness,
            provenance: { directness },
          }),
          context
        ).directness
      ).toBe(score);
    }
  });

  it('15. maps epistemic UNKNOWN to zero only with opt-in and rejects UNKNOWN business values', async () => {
    const reliabilityUnknown = createIndustryFact({
      reliability: 'UNKNOWN',
      provenance: {
        ...createIndustryFact().provenance,
        reliability: 'UNKNOWN',
      },
    });
    const acceptedUnknown = await createBootstrapper().bootstrap(
      createInput({
        facts: [reliabilityUnknown],
        policy: createPolicy({ allowUnknownReliability: true }),
      })
    );
    expect(acceptedUnknown.status).toBe('ACCEPTED');
    if (acceptedUnknown.status === 'ACCEPTED') {
      expect(
        acceptedUnknown.initialDomainState.evidence[0].appliedEvidence
          .reliability
      ).toBe(0);
    }

    const businessUnknown = createIndustryFact({
      category: 'ORGANIZATION_EMPLOYEE_BAND',
      value: 'UNKNOWN',
    });
    expect(
      (
        await createBootstrapper().bootstrap(
          createInput({ facts: [businessUnknown] })
        )
      ).status
    ).toBe('REJECTED');
  });

  it('16. rejects UNCERTAIN rather than converting it to applied evidence', async () => {
    const uncertain = createIndustryFact({ polarity: 'UNCERTAIN' });
    const state = await createBootstrapper().bootstrap(
      createInput({
        facts: [uncertain],
        policy: createPolicy({ allowUncertainPolarity: true }),
      })
    );
    expect(state.status).toBe('REJECTED');
    if (state.status === 'REJECTED') {
      expect(state.errors).toContainEqual({
        code: 'BOOTSTRAP_FAILED',
        message: 'Pipeline bootstrap fact mapping failed',
        retryable: false,
      });
    }
  });

  it('17. rejects duplicate fact identifiers fail-closed', async () => {
    const state = await createBootstrapper().bootstrap(
      createInput({
        facts: [
          createIncidentFact('duplicate-fact'),
          createIncidentFact('duplicate-fact'),
        ],
      })
    );
    expect(state.status).toBe('REJECTED');
    if (state.status === 'REJECTED') {
      expect(state.errors.map((error) => error.code)).toContain(
        'DUPLICATE_FACT_ID'
      );
    }
  });

  it('18. rejects duplicate mapped evidence identifiers fail-closed', async () => {
    const realFactory = new PipelineBootstrapEvidenceFactory();
    const duplicateFactory = {
      create(
        fact: PipelineBootstrapFact,
        context: {
          readonly bootstrapId: string;
          readonly tenantId: string;
          readonly correlationId: string;
        }
      ): EnterpriseEvidence {
        return {
          ...realFactory.create(fact, context),
          evidenceId: 'evidence-duplicate',
        };
      },
    };
    const state = await createBootstrapper(duplicateFactory).bootstrap(
      createInput({
        facts: [
          createIncidentFact('incident-1'),
          createIncidentFact('incident-2'),
        ],
      })
    );
    expect(state.status).toBe('REJECTED');
    if (state.status === 'REJECTED') {
      expect(state.errors[0]).toMatchObject({
        code: 'BOOTSTRAP_FAILED',
        message:
          'Pipeline bootstrap evidence identity is duplicated',
      });
    }
  });

  it('19. rejects an invalid fact through existing validators', async () => {
    const input = structuredClone(createInput());
    delete (input.facts[0] as unknown as { value?: unknown }).value;
    const state = await createBootstrapper().bootstrap(input);
    expect(state.status).toBe('REJECTED');
  });

  it('20. rejects an unknown taxonomy category', async () => {
    const input = structuredClone(createInput()) as unknown as {
      facts: Array<Record<string, unknown>>;
    };
    input.facts[0].category = 'UNREGISTERED_CATEGORY';
    const state = await createBootstrapper().bootstrap(
      asRuntimeInput(input)
    );
    expect(state.status).toBe('REJECTED');
    if (state.status === 'REJECTED') {
      expect(state.errors.map((error) => error.code)).toContain(
        'UNKNOWN_TAXONOMY_CATEGORY'
      );
    }
  });

  it('21. rejects an invalid provenance source combination', async () => {
    const fact = createIndustryFact({
      provenance: {
        ...createIndustryFact().provenance,
        sourceType: 'DOCUMENT',
        collectionMethod: 'SYSTEM_EVENT',
      },
    });
    const state = await createBootstrapper().bootstrap(
      createInput({ facts: [fact] })
    );
    expect(state.status).toBe('REJECTED');
    if (state.status === 'REJECTED') {
      expect(state.errors.map((error) => error.code)).toContain(
        'INVALID_PROVENANCE'
      );
    }
  });

  it('22. rejects an invalid observation timestamp', async () => {
    const fact = createIndustryFact({ observedAt: 201 });
    const state = await createBootstrapper().bootstrap(
      createInput({ facts: [fact] })
    );
    expect(state.status).toBe('REJECTED');
    if (state.status === 'REJECTED') {
      expect(state.errors.map((error) => error.code)).toContain(
        'INVALID_PROVENANCE'
      );
    }
  });

  it('23. rejects a scenario that is absent from the registry', async () => {
    const input = structuredClone(createInput()) as unknown as {
      targetScenario: Record<string, unknown>;
    };
    input.targetScenario.scenarioId = 'UNREGISTERED_SCENARIO';
    const state = await createBootstrapper().bootstrap(
      asRuntimeInput(input)
    );
    expect(state.status).toBe('REJECTED');
    if (state.status === 'REJECTED') {
      expect(state.errors.map((error) => error.code)).toContain(
        'INVALID_TARGET_SCENARIO'
      );
    }
  });

  it('24. rejects a policy that is not fail-closed', async () => {
    const input = structuredClone(createInput()) as unknown as {
      policy: Record<string, unknown>;
    };
    input.policy.failClosed = false;
    const state = await createBootstrapper().bootstrap(
      asRuntimeInput(input)
    );
    expect(state.status).toBe('REJECTED');
    if (state.status === 'REJECTED') {
      expect(state.errors.map((error) => error.code)).toContain(
        'INVALID_BOOTSTRAP_INPUT'
      );
    }
  });

  it('25. applies exactly the accepted evidence to the mental model', async () => {
    const state = await accepted(
      createInput({
        facts: [
          createIndustryFact(),
          createIncidentFact('fact-incident-1'),
        ],
      })
    );
    const envelopeIds = state.initialDomainState.evidence.map(
      (item) => item.appliedEvidence.evidenceId
    );
    expect(
      Object.keys(state.initialDomainState.mentalModel.evidences).sort()
    ).toEqual([...envelopeIds].sort());
    for (const item of state.initialDomainState.evidence) {
      expect(
        state.initialDomainState.mentalModel.evidences[
          item.appliedEvidence.evidenceId
        ]
      ).toBe(item.appliedEvidence);
    }
  });

  it('26. uses the production evidence applier instead of direct array insertion', () => {
    const source = readBootstrapSource('PipelineBootstrapper.ts');
    expect(source).toMatch(/applyEvidenceBatch/);
    expect(source).not.toMatch(/mentalModel\.evidences\s*\[/);
  });

  it('27. creates a knowledge graph that passes structural validation', async () => {
    const state = await accepted();
    expect(state.initialDomainState.knowledgeGraph).toEqual({
      nodes: {},
      relationships: {},
    });
  });

  it('28. keeps the initial graph legitimately empty', async () => {
    const graph = (await accepted()).initialDomainState.knowledgeGraph;
    expect(Object.keys(graph.nodes)).toHaveLength(0);
    expect(Object.keys(graph.relationships)).toHaveLength(0);
  });

  it('29. invents no nodes or heuristic relationships', async () => {
    const graph = (await accepted()).initialDomainState.knowledgeGraph;
    expect(graph.nodes).toEqual({});
    expect(graph.relationships).toEqual({});
  });

  it('30. returns the existing typed REJECTED contract', async () => {
    const state = await createBootstrapper().bootstrap(
      createInput({ facts: [] })
    );
    expect(state).toMatchObject({
      status: 'REJECTED',
      bootstrapId: 'bootstrap-1',
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      bootstrapVersion: '1',
      createdAt: CREATED_AT,
    });
    if (state.status === 'REJECTED') {
      expect(state.errors[0].code).toBe('EMPTY_FACT_SET');
    }
  });

  it('31. exposes no fact value or complete payload in mapping errors', async () => {
    const sensitiveValue = 'CRITICAL';
    const fact = createIndustryFact({
      category: 'EXECUTIVE_NORMALIZED_PRIORITY',
      value: 'UNKNOWN',
      factId: sensitiveValue,
    });
    const state = await createBootstrapper().bootstrap(
      createInput({ facts: [fact] })
    );
    expect(state.status).toBe('REJECTED');
    if (state.status === 'REJECTED') {
      const serializedErrors = JSON.stringify(state.errors);
      expect(serializedErrors).not.toContain(sensitiveValue);
      expect(serializedErrors).not.toContain('"facts"');
    }
  });

  it('32. never mutates the bootstrap input', async () => {
    const input = createInput({
      facts: [
        createIncidentFact('z-fact'),
        createIncidentFact('a-fact'),
      ],
    });
    const snapshot = structuredClone(input);
    await createBootstrapper().bootstrap(input);
    expect(input).toEqual(snapshot);
  });

  it('33. returns an output object graph independent from the input', async () => {
    const input = createInput();
    const state = await accepted(input);
    expect(state.initialDomainState.evidence[0].sourceFact).not.toBe(
      input.facts[0]
    );
    expect(
      state.initialDomainState.evidence[0].sourceFact.provenance
    ).not.toBe(input.facts[0].provenance);
  });

  it('34. returns independent and frozen arrays', async () => {
    const input = createInput();
    const state = await accepted(input);
    expect(state.initialDomainState.evidence).not.toBe(input.facts);
    expect(
      state.initialDomainState.scenario.requestedStages
    ).not.toBe(input.targetScenario.requestedStages);
    expect(Object.isFrozen(state.initialDomainState.evidence)).toBe(
      true
    );
    expect(
      Object.isFrozen(
        state.initialDomainState.scenario.requestedStages
      )
    ).toBe(true);
  });

  it('35. is completely deterministic for the same input, clock, and dependencies', async () => {
    const input = createInput();
    const first = await createBootstrapper().bootstrap(input);
    const second = await createBootstrapper().bootstrap(input);
    expect(first).toEqual(second);
  });

  it('36. contains no implicit Date.now source', () => {
    expect(readBootstrapSource('PipelineBootstrapper.ts')).not.toMatch(
      /Date\.now\s*\(/
    );
    expect(
      readBootstrapSource('PipelineBootstrapEvidenceFactory.ts')
    ).not.toMatch(/Date\.now\s*\(/);
  });

  it('37. contains no randomUUID source', () => {
    expect(
      `${readBootstrapSource(
        'PipelineBootstrapper.ts'
      )}\n${readBootstrapSource(
        'PipelineBootstrapEvidenceFactory.ts'
      )}`
    ).not.toMatch(/randomUUID/);
  });

  it('38. contains no Math.random source', () => {
    expect(
      `${readBootstrapSource(
        'PipelineBootstrapper.ts'
      )}\n${readBootstrapSource(
        'PipelineBootstrapEvidenceFactory.ts'
      )}`
    ).not.toMatch(/Math\.random\s*\(/);
  });

  it('39. has zero Firebase coupling', () => {
    expect(
      `${readBootstrapSource(
        'PipelineBootstrapper.ts'
      )}\n${readBootstrapSource(
        'PipelineBootstrapEvidenceFactory.ts'
      )}`
    ).not.toMatch(/firebase|firestore/i);
  });

  it('40. has zero Discovery coupling', () => {
    expect(
      `${readBootstrapSource(
        'PipelineBootstrapper.ts'
      )}\n${readBootstrapSource(
        'PipelineBootstrapEvidenceFactory.ts'
      )}`
    ).not.toMatch(/(?:from\s+|import\s*\()['"][^'"]*discovery|Discovery/i);
  });

  it('41. has zero Boundary coupling', () => {
    expect(
      `${readBootstrapSource(
        'PipelineBootstrapper.ts'
      )}\n${readBootstrapSource(
        'PipelineBootstrapEvidenceFactory.ts'
      )}`
    ).not.toMatch(/BoundaryExecutionPort|BoundaryResponse|boundary\//i);
  });

  it('42. has zero network, filesystem, persistence, environment, or UI I/O', () => {
    expect(
      `${readBootstrapSource(
        'PipelineBootstrapper.ts'
      )}\n${readBootstrapSource(
        'PipelineBootstrapEvidenceFactory.ts'
      )}`
    ).not.toMatch(
      /fetch\s*\(|XMLHttpRequest|node:fs|writeFile|readFile|localStorage|sessionStorage|indexedDB|process\.env|firebase|firestore|react/i
    );
  });
});
