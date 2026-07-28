import { describe, expect, it } from 'vitest';
import {
  createPipelineBootstrapError,
  type PipelineBootstrapError,
} from '../errors';
import type {
  BootstrapAcceptedState,
  BootstrapRejectedState,
  PipelineBootstrapFact,
  PipelineBootstrapInput,
  PipelineBootstrapPolicy,
  PipelineInitialDomainState,
  PipelineInitialEvidence,
  PipelineScenarioDescriptor,
} from '../types';
import {
  PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY,
} from '../types';
import { createEmptyEnterpriseMentalModel } from '../../../enterprise-model/services/modelUpdater';
import { createEmptyEnterpriseKnowledgeGraph } from '../../../enterprise-model/graph/services/operations';
import {
  validateBootstrapAcceptedState,
  validateBootstrapRejectedState,
  validatePipelineBootstrapContext,
  validatePipelineBootstrapFact,
  validatePipelineBootstrapFactValue,
  validatePipelineBootstrapFacts,
  validatePipelineBootstrapInput,
  validatePipelineBootstrapPolicy,
  validatePipelineBootstrapState,
  validatePipelineInitialDomainState,
  validatePipelineInitialEvidence,
  validatePipelineScenarioDescriptor,
  validatePipelineBootstrapTimestamp,
} from '../validators';

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
    maxTotalPayloadSize: 4096,
    duplicateFactPolicy: 'REJECT',
    conflictPolicy: 'REJECT',
    failClosed: true,
    requireExplicitScenario: true,
    ...overrides,
  };
}

function createFact(
  overrides: Partial<
    Extract<PipelineBootstrapFact, { readonly valueType: 'ENUM' }>
  > = {}
): Extract<PipelineBootstrapFact, { readonly valueType: 'ENUM' }> {
  return {
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
      tenantId: 'tenant-1',
      correlationId: 'correlation-1',
    },
    reliability: 'HIGH',
    directness: 'DIRECT',
    polarity: 'AFFIRMED',
    observedAt: 100,
    schemaVersion: '1',
    ...overrides,
  };
}

function createIncidentFact(
  factId: string,
  polarity: 'AFFIRMED' | 'NEGATED' | 'UNCERTAIN' = 'AFFIRMED'
): Extract<PipelineBootstrapFact, { readonly valueType: 'ENUM' }> {
  const base = createFact();
  return {
    ...base,
    factId,
    category: 'OPERATIONS_INCIDENT_SIGNAL',
    value: 'OBSERVED',
    valueType: 'ENUM',
    polarity,
  };
}

function createInput(
  overrides: Partial<PipelineBootstrapInput> = {}
): PipelineBootstrapInput {
  return {
    bootstrapId: 'bootstrap-1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    targetScenario: {
      scenarioId: 'PAYROLL_AUDIT',
      scenarioVersion: '1',
      objectiveKey: 'ASSESS_PAYROLL_AUDIT_READINESS',
      source: 'AUTHORIZED_SYSTEM_CONFIGURATION',
      explicitSelection: true,
    },
    facts: [createFact()],
    context: {
      requestedAt: 300,
      requestedBy: {
        requesterId: 'bootstrap-service',
        actorType: 'SYSTEM',
      },
      locale: 'es-MX',
      timezone: 'America/Mexico_City',
      source: 'governed-bootstrap-contract',
    },
    policy: createPolicy(),
    schemaVersion: '1',
    ...overrides,
  };
}

function createScenarioDescriptor(): PipelineScenarioDescriptor {
  const registry = PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY.PAYROLL_AUDIT;
  return {
    scenarioId: 'PAYROLL_AUDIT',
    scenarioVersion: '1',
    objectiveKey: 'ASSESS_PAYROLL_AUDIT_READINESS',
    requestedStages: [...registry.requiredStages],
    allowedStages: [...registry.allowedStages],
    requiredStages: [...registry.requiredStages],
    stageDependencies: registry.stageDependencies,
    includedDomains: [...registry.includedDomains],
    excludedDomains: [...registry.excludedDomains],
    source: 'AUTHORIZED_SYSTEM_CONFIGURATION',
    explicitSelection: true,
  };
}

function createInitialEvidence(): PipelineInitialEvidence {
  return {
    sourceFact: createFact(),
    appliedEvidence: {
      evidenceId: 'evidence-industry-1',
      sessionId: 'correlation-1',
      turnId: 'bootstrap-1',
      source: 'governed-bootstrap-contract',
      sourceType: 'INTEGRATION',
      originalText: null,
      normalizedStatement: 'BUSINESS_INDUSTRY=HOSPITALITY',
      category: 'BUSINESS_INDUSTRY',
      entityRefs: [],
      capturedAt: 200,
      reliability: 0.8,
      directness: 1,
      polarity: 'POSITIVE',
      extractorVersion: '1',
      metadata: {},
    },
  };
}

function createInitialDomainState(
  overrides: Partial<PipelineInitialDomainState> = {}
): PipelineInitialDomainState {
  const initialEvidence = createInitialEvidence();
  const mentalModel = createEmptyEnterpriseMentalModel();
  mentalModel.evidences[initialEvidence.appliedEvidence.evidenceId] =
    initialEvidence.appliedEvidence;

  return {
    mentalModel,
    knowledgeGraph: createEmptyEnterpriseKnowledgeGraph(),
    evidence: [initialEvidence],
    scenario: createScenarioDescriptor(),
    bootstrapId: 'bootstrap-1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    createdAt: 300,
    schemaVersion: '1',
    ...overrides,
  };
}

function createAcceptedState(
  overrides: Partial<BootstrapAcceptedState> = {}
): BootstrapAcceptedState {
  return {
    status: 'ACCEPTED',
    bootstrapId: 'bootstrap-1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    initialDomainState: createInitialDomainState(),
    provenanceSummary: {
      factCount: 1,
      sourceTypes: ['INTEGRATION'],
      earliestObservedAt: 100,
      latestObservedAt: 100,
    },
    bootstrapVersion: '1',
    createdAt: 300,
    ...overrides,
  };
}

function createRejectedState(): BootstrapRejectedState {
  return {
    status: 'REJECTED',
    bootstrapId: 'bootstrap-1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    errors: [
      createPipelineBootstrapError(
        'INVALID_INITIAL_DOMAIN_STATE',
        'Initial domain state is invalid'
      ),
    ],
    bootstrapVersion: '1',
    createdAt: 300,
  };
}

function codes(
  result: ReturnType<typeof validatePipelineBootstrapInput>
): readonly string[] {
  return result.valid ? [] : result.errors.map((item) => item.code);
}

function factCodes(
  result: ReturnType<typeof validatePipelineBootstrapFacts>
): readonly string[] {
  return result.valid ? [] : result.errors.map((item) => item.code);
}

describe('Pipeline bootstrap input validation', () => {
  it('26. rejects an empty fact set', () => {
    const result = validatePipelineBootstrapInput(
      createInput({ facts: [] })
    );

    expect(codes(result)).toContain('EMPTY_FACT_SET');
  });

  it('27. rejects a duplicate fact identifier', () => {
    const first = createFact();
    const second = createFact({
      category: 'EXECUTIVE_NORMALIZED_PRIORITY',
      value: 'HIGH',
    });
    const result = validatePipelineBootstrapInput(
      createInput({ facts: [first, second] })
    );

    expect(codes(result)).toContain('DUPLICATE_FACT_ID');
  });

  it('28. applies the maximum fact count', () => {
    const result = validatePipelineBootstrapInput(
      createInput({
        facts: [createFact(), createFact({ factId: 'fact-2' })],
        policy: createPolicy({ maxFacts: 1 }),
      })
    );

    expect(codes(result)).toContain('TOO_MANY_FACTS');
  });

  it('29. applies the total payload limit', () => {
    const result = validatePipelineBootstrapInput(
      createInput({ policy: createPolicy({ maxTotalPayloadSize: 1 }) })
    );

    expect(codes(result)).toContain('PAYLOAD_TOO_LARGE');
  });

  it('30. rejects an unsupported input schema version', () => {
    const result = validatePipelineBootstrapInput({
      ...createInput(),
      schemaVersion: '2',
    });

    expect(codes(result)).toContain('UNSUPPORTED_SCHEMA_VERSION');
  });

  it('31. detects a correlation mismatch', () => {
    const fact = createFact({
      provenance: {
        ...createFact().provenance,
        correlationId: 'correlation-2',
      },
    });
    const result = validatePipelineBootstrapInput(
      createInput({ facts: [fact] })
    );

    expect(codes(result)).toContain('CORRELATION_CONTEXT_MISMATCH');
  });

  it('32. rejects an invalid closed-vocabulary fact value', () => {
    const result = validatePipelineBootstrapInput(
      createInput({ facts: [createFact({ value: 'UNLISTED_INDUSTRY' })] })
    );

    expect(codes(result)).toContain('INVALID_FACT_VALUE');
  });

  it('33. rejects a callable fact value', () => {
    const result = validatePipelineBootstrapFactValue(
      'ENUM',
      () => 'HOSPITALITY',
      'BUSINESS_INDUSTRY',
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('34. rejects a bigint fact value', () => {
    const result = validatePipelineBootstrapFactValue(
      'ENUM',
      BigInt(1),
      'BUSINESS_INDUSTRY',
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('35. rejects non-finite numeric input', () => {
    expect(
      validatePipelineBootstrapTimestamp(Number.NaN).valid
    ).toBe(false);
    expect(
      validatePipelineBootstrapTimestamp(Number.NEGATIVE_INFINITY).valid
    ).toBe(false);
  });

  it('36. rejects a date object as a fact value', () => {
    const result = validatePipelineBootstrapFactValue(
      'ENUM',
      new Date(0),
      'BUSINESS_INDUSTRY',
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('37. rejects a custom class instance', () => {
    class ValueEnvelope {
      readonly value = 'HOSPITALITY';
    }

    const result = validatePipelineBootstrapFactValue(
      'ENUM',
      new ValueEnvelope(),
      'BUSINESS_INDUSTRY',
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });
});

describe('Pipeline bootstrap conflict validation', () => {
  it('38. rejects multiple facts for a single-value category', () => {
    const result = validatePipelineBootstrapFacts(
      [
        createFact(),
        createFact({
          factId: 'fact-industry-2',
          value: 'MANUFACTURING',
        }),
      ],
      createPolicy(),
      'tenant-1',
      'correlation-1'
    );

    expect(factCodes(result)).toContain('DUPLICATE_FACT_CONFLICT');
  });

  it('39. permits repeated equal values for a multi-value category', () => {
    const first = createIncidentFact('incident-1');
    const second = createIncidentFact('incident-2');
    const result = validatePipelineBootstrapFacts(
      [first, second],
      createPolicy(),
      'tenant-1',
      'correlation-1'
    );

    expect(result.valid).toBe(true);
  });

  it('40. requires the default rejection conflict policy', () => {
    const result = validatePipelineBootstrapPolicy({
      ...createPolicy(),
      conflictPolicy: 'REQUIRE_REVIEW',
    });

    expect(result.valid).toBe(false);
  });

  it('41. leaves conflicting multi-value facts unresolved', () => {
    const result = validatePipelineBootstrapFacts(
      [
        createIncidentFact('incident-1', 'AFFIRMED'),
        createIncidentFact('incident-2', 'UNCERTAIN'),
      ],
      createPolicy({ allowUncertainPolarity: true }),
      'tenant-1',
      'correlation-1'
    );

    expect(factCodes(result)).toContain('UNRESOLVED_FACT_CONFLICT');
  });

  it('88. accepts absence of an incident fact as no incident evidence', () => {
    const result = validatePipelineBootstrapInput(createInput());

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(
        result.value.facts.some(
          (fact) => fact.category === 'OPERATIONS_INCIDENT_SIGNAL'
        )
      ).toBe(false);
    }
  });

  it('89. rejects boolean false as an incident signal', () => {
    const result = validatePipelineBootstrapFact(
      {
        ...createIncidentFact('incident-1'),
        value: false,
        valueType: 'BOOLEAN',
      },
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('90. rejects a negated observed incident signal', () => {
    const result = validatePipelineBootstrapFact(
      createIncidentFact('incident-1', 'NEGATED'),
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('91. rejects same incident value with opposite polarity', () => {
    const result = validatePipelineBootstrapFacts(
      [
        createIncidentFact('incident-1', 'AFFIRMED'),
        createIncidentFact('incident-2', 'NEGATED'),
      ],
      createPolicy(),
      'tenant-1',
      'correlation-1'
    );

    expect(result.valid).toBe(false);
  });
});

describe('Pipeline bootstrap error contract', () => {
  function createError(): PipelineBootstrapError {
    return createPipelineBootstrapError(
      'INVALID_BOOTSTRAP_INPUT',
      'Input is invalid'
    );
  }

  it('42. does not expose a stack', () => {
    expect('stack' in createError()).toBe(false);
  });

  it('43. does not expose a cause', () => {
    expect('cause' in createError()).toBe(false);
  });

  it('44. does not expose an input payload', () => {
    expect('payload' in createError()).toBe(false);
  });

  it('45. is transport agnostic', () => {
    const value = createError();

    expect('httpStatus' in value).toBe(false);
    expect('statusCode' in value).toBe(false);
    expect(Object.keys(value).sort()).toEqual([
      'code',
      'message',
      'retryable',
    ]);
  });
});

describe('Pipeline bootstrap source isolation', () => {
  const sourceModules = import.meta.glob('../*.ts', {
    eager: true,
    query: '?raw',
    import: 'default',
  });
  const sourceText = Object.values(sourceModules).join('\n');

  it('46. has no external persistence SDK vocabulary', () => {
    const token = ['fire', 'base'].join('');
    expect(sourceText).not.toMatch(new RegExp(token, 'i'));
  });

  it('47. has no consumer-domain vocabulary', () => {
    const token = ['Dis', 'covery'].join('');
    expect(sourceText).not.toMatch(new RegExp(token));
  });

  it('48. has no UI library vocabulary', () => {
    const token = ['re', 'act'].join('');
    expect(sourceText).not.toMatch(new RegExp(token, 'i'));
  });

  it('49. has no direct wall-clock call', () => {
    const token = ['Date', '\\.now'].join('');
    expect(sourceText).not.toMatch(new RegExp(token));
  });

  it('50. has no ambient pseudo-random call', () => {
    const token = ['Math', '\\.random'].join('');
    expect(sourceText).not.toMatch(new RegExp(token));
  });

  it('51. has no ambient UUID call', () => {
    const token = ['random', 'UUID'].join('');
    expect(sourceText).not.toMatch(new RegExp(token));
  });

  it('52. has no unsafe type escape', () => {
    const looseType = ['\\b', 'a', 'ny', '\\b'].join('');
    const looseCast = ['as', '\\s+', 'a', 'ny'].join('');

    expect(sourceText).not.toMatch(new RegExp(looseType));
    expect(sourceText).not.toMatch(new RegExp(looseCast));
  });

  it('120. has no orchestrator execution dependency', () => {
    const token = ['AuraIntelligence', 'Orchestrator'].join('');
    expect(sourceText).not.toMatch(new RegExp(token));
  });

  it('121. has no bootstrapper implementation', () => {
    const token = ['Pipeline', 'Bootstrapper'].join('');
    expect(sourceText).not.toMatch(new RegExp(token));
  });
});

describe('Pipeline bootstrap structural hardening', () => {
  it('66. rejects extra top-level input fields', () => {
    const result = validatePipelineBootstrapInput({
      ...createInput(),
      extraField: true,
    });

    expect(codes(result)).toContain('INVALID_BOOTSTRAP_INPUT');
  });

  it('67. rejects accessor-backed input fields', () => {
    const candidate = createInput();
    const descriptor = {
      enumerable: true,
      get: () => 'bootstrap-1',
    };
    Object.defineProperty(candidate, 'bootstrapId', descriptor);

    const result = validatePipelineBootstrapInput(candidate);

    expect(codes(result)).toContain('INVALID_BOOTSTRAP_INPUT');
  });

  it('68. rejects symbols on contract objects', () => {
    const candidate = createInput();
    Object.defineProperty(candidate, Symbol('hidden'), {
      enumerable: true,
      value: 'side-value',
    });

    const result = validatePipelineBootstrapInput(candidate);

    expect(codes(result)).toContain('INVALID_BOOTSTRAP_INPUT');
  });

  it('69. rejects policy limits that are not positive integers', () => {
    const result = validatePipelineBootstrapPolicy({
      ...createPolicy(),
      maxFacts: 0,
      maxFactValueSize: 1.5,
      maxTotalPayloadSize: Number.POSITIVE_INFINITY,
    });

    expect(result.valid).toBe(false);
  });

  it('70. rejects an observation after provenance capture', () => {
    const result = validatePipelineBootstrapFact(
      createFact({ observedAt: 201 }),
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('71. rejects reliability that diverges from provenance', () => {
    const result = validatePipelineBootstrapFact(
      createFact({ reliability: 'CONFIRMED' }),
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('72. rejects directness that diverges from provenance', () => {
    const result = validatePipelineBootstrapFact(
      createFact({ directness: 'DERIVED' }),
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('73. rejects business data added to execution context', () => {
    const result = validatePipelineBootstrapContext({
      ...createInput().context,
      industry: 'HOSPITALITY',
    });

    expect(result.valid).toBe(false);
  });

  it('74. accepts only explicit fail-closed policy controls', () => {
    expect(validatePipelineBootstrapPolicy(createPolicy()).valid).toBe(true);
    expect(
      validatePipelineBootstrapPolicy({
        ...createPolicy(),
        failClosed: false,
        requireExplicitScenario: false,
      }).valid
    ).toBe(false);
  });

  it('92. rejects a policy that claims a scenario version beyond v1', () => {
    const result = validatePipelineBootstrapPolicy({
      ...createPolicy(),
      allowedScenarioVersion: '2',
    });

    expect(result.valid).toBe(false);
  });
});

describe('Executable bootstrap state contracts', () => {
  it('102. accepts a complete bootstrap state', () => {
    const result = validateBootstrapAcceptedState(
      createAcceptedState(),
      createPolicy()
    );

    expect(result.valid).toBe(true);
  });

  it('103. rejects an accepted state without a mental model', () => {
    const initialState = createInitialDomainState();
    const { mentalModel: _mentalModel, ...withoutMentalModel } = initialState;
    const result = validateBootstrapAcceptedState(
      createAcceptedState({
        initialDomainState: withoutMentalModel as PipelineInitialDomainState,
      }),
      createPolicy()
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'MISSING_INITIAL_MENTAL_MODEL'
      );
    }
  });

  it('104. rejects an accepted state without a knowledge graph', () => {
    const initialState = createInitialDomainState();
    const { knowledgeGraph: _knowledgeGraph, ...withoutGraph } = initialState;
    const result = validateBootstrapAcceptedState(
      createAcceptedState({
        initialDomainState: withoutGraph as PipelineInitialDomainState,
      }),
      createPolicy()
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'MISSING_INITIAL_KNOWLEDGE_GRAPH'
      );
    }
  });

  it('105. rejects an accepted state with empty evidence', () => {
    const result = validateBootstrapAcceptedState(
      createAcceptedState({
        initialDomainState: createInitialDomainState({ evidence: [] }),
      }),
      createPolicy()
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'EMPTY_INITIAL_EVIDENCE'
      );
    }
  });

  it('106. rejects an accepted state without a scenario descriptor', () => {
    const initialState = createInitialDomainState();
    const { scenario: _scenario, ...withoutScenario } = initialState;
    const result = validateBootstrapAcceptedState(
      createAcceptedState({
        initialDomainState: withoutScenario as PipelineInitialDomainState,
      }),
      createPolicy()
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'INVALID_SCENARIO_DESCRIPTOR'
      );
    }
  });

  it('107. accepts a rejected state without domain objects', () => {
    const state = createRejectedState();
    const result = validateBootstrapRejectedState(state);

    expect(result.valid).toBe(true);
    expect('initialDomainState' in state).toBe(false);
    expect('mentalModel' in state).toBe(false);
    expect('knowledgeGraph' in state).toBe(false);
    expect('evidence' in state).toBe(false);
  });

  it('108. rejects tenant divergence inside initial evidence', () => {
    const result = validatePipelineInitialDomainState(
      createInitialDomainState({ tenantId: 'tenant-2' }),
      createPolicy()
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'INITIAL_DOMAIN_CONTEXT_MISMATCH'
      );
    }
  });

  it('109. rejects correlation divergence inside initial evidence', () => {
    const result = validatePipelineInitialDomainState(
      createInitialDomainState({ correlationId: 'correlation-2' }),
      createPolicy()
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'INITIAL_DOMAIN_CONTEXT_MISMATCH'
      );
    }
  });

  it('110. preserves source fact provenance in initial evidence', () => {
    const evidence = createInitialEvidence();
    const result = validatePipelineInitialEvidence(
      evidence,
      createPolicy(),
      'tenant-1',
      'correlation-1'
    );

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.sourceFact.provenance).toEqual(
        createFact().provenance
      );
    }
  });

  it('111. rejects an initial state with a non-v1 schema', () => {
    const result = validatePipelineInitialDomainState(
      {
        ...createInitialDomainState(),
        schemaVersion: '2',
      },
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('112. rejects a scenario descriptor with an objective mismatch', () => {
    const result = validatePipelineScenarioDescriptor(
      {
        ...createScenarioDescriptor(),
        objectiveKey: 'ASSESS_COMPLIANCE_AUDIT_READINESS',
      },
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('113. rejects scenario dependencies that diverge from registry', () => {
    const descriptor = createScenarioDescriptor();
    const result = validatePipelineScenarioDescriptor(
      {
        ...descriptor,
        stageDependencies: {
          ...descriptor.stageDependencies,
          KNOWLEDGE_COVERAGE: [],
        },
      },
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('114. rejects evidence metadata as a side channel', () => {
    const evidence = createInitialEvidence();
    const result = validatePipelineInitialEvidence(
      {
        ...evidence,
        appliedEvidence: {
          ...evidence.appliedEvidence,
          metadata: { hidden: 'payload' },
        },
      },
      createPolicy(),
      'tenant-1',
      'correlation-1'
    );

    expect(result.valid).toBe(false);
  });

  it('115. rejects mental-model evidence divergence', () => {
    const result = validatePipelineInitialDomainState(
      createInitialDomainState({
        mentalModel: createEmptyEnterpriseMentalModel(),
      }),
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('116. rejects partial domain objects added to rejected state', () => {
    const result = validateBootstrapRejectedState({
      ...createRejectedState(),
      initialDomainState: createInitialDomainState(),
    });

    expect(result.valid).toBe(false);
  });

  it('117. rejects future outputs added to accepted state', () => {
    const result = validatePipelineBootstrapState(
      {
        ...createAcceptedState(),
        coverageReport: {},
      },
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('118. rejects an accepted state without initial domain state', () => {
    const state = createAcceptedState();
    const {
      initialDomainState: _initialDomainState,
      ...withoutInitialDomainState
    } = state;
    const result = validatePipelineBootstrapState(
      withoutInitialDomainState,
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('119. rejects raw text in canonical applied evidence', () => {
    const evidence = createInitialEvidence();
    const result = validatePipelineInitialEvidence(
      {
        ...evidence,
        appliedEvidence: {
          ...evidence.appliedEvidence,
          originalText: 'raw message',
        },
      },
      createPolicy(),
      'tenant-1',
      'correlation-1'
    );

    expect(result.valid).toBe(false);
  });
});
