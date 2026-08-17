import { describe, expect, expectTypeOf, it } from 'vitest';
import type { PipelineAggregatedState } from '../../contextTypes';
import type {
  BootstrapAcceptedState,
  BootstrapRejectedState,
  PipelineBootstrapFact,
  PipelineBootstrapInput,
  PipelineBootstrapPolicy,
  PipelineBootstrapState,
  PipelineBootstrapTargetScenario,
  PipelineInitialDomainState,
  PipelineInitialEvidence,
  PipelineScenarioDescriptor,
} from '../types';
import type { PipelineBootstrapPort } from '../ports';
import { createEmptyEnterpriseMentalModel } from '../../../enterprise-model/services/modelUpdater';
import { createEmptyEnterpriseKnowledgeGraph } from '../../../enterprise-model/graph/services/operations';
import {
  PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS,
  PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY,
  PIPELINE_BOOTSTRAP_STAGE_DEPENDENCIES,
  PIPELINE_BOOTSTRAP_VERSIONING_MODE,
} from '../types';
import {
  validateBootstrapAcceptedState,
  validatePipelineBootstrapInput,
  validatePipelineBootstrapTargetScenario,
  validatePipelineInitialDomainState,
  validatePipelineScenarioDescriptor,
} from '../validators';

function createPolicy(): PipelineBootstrapPolicy {
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
  };
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

function createFact(): PipelineBootstrapFact {
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

function createInitialDomainState(): PipelineInitialDomainState {
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
  };
}

function createAcceptedState(): BootstrapAcceptedState {
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
  };
}

function createInput(): PipelineBootstrapInput {
  return {
    bootstrapId: 'bootstrap-1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    targetScenario: createScenario(),
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
  };
}

describe('Pipeline bootstrap contract types', () => {
  it('1. accepts a minimal valid bootstrap input contract', () => {
    const input = createInput();
    const result = validatePipelineBootstrapInput(input);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBe(input);
    }
  });

  it('2. accepted state has complete domain state and no future results', () => {
    const state = createAcceptedState();

    expect(state.initialDomainState.mentalModel).toBeDefined();
    expect(state.initialDomainState.knowledgeGraph).toBeDefined();
    expect(state.initialDomainState.evidence).toHaveLength(1);
    expect(state.initialDomainState.scenario.scenarioId).toBe('PAYROLL_AUDIT');
    expect('coverageReport' in state).toBe(false);
    expect('planningResult' in state).toBe(false);
    expect('reasoningReport' in state).toBe(false);
    expect('dossier' in state).toBe(false);
    expect('assessment' in state).toBe(false);
    expect(validateBootstrapAcceptedState(state, createPolicy()).valid).toBe(
      true
    );
  });

  it('3. rejected state has no complete payload', () => {
    const state: BootstrapRejectedState = {
      status: 'REJECTED',
      bootstrapId: 'bootstrap-1',
      tenantId: 'tenant-1',
      correlationId: 'correlation-1',
      errors: [
        {
          code: 'INVALID_BOOTSTRAP_INPUT',
          message: 'Input is invalid',
          retryable: false,
        },
      ],
      bootstrapVersion: '1',
      createdAt: 300,
    };

    expect('facts' in state).toBe(false);
    expect('targetScenario' in state).toBe(false);
    expect('policy' in state).toBe(false);
    expect('initialDomainState' in state).toBe(false);
    expect('mentalModel' in state).toBe(false);
    expect('knowledgeGraph' in state).toBe(false);
    expect('evidence' in state).toBe(false);
  });

  it('4. bootstrap port returns only the discriminated bootstrap state', () => {
    expectTypeOf<
      ReturnType<PipelineBootstrapPort['bootstrap']>
    >().toEqualTypeOf<Promise<PipelineBootstrapState>>();
    expectTypeOf<
      ReturnType<PipelineBootstrapPort['bootstrap']>
    >().not.toEqualTypeOf<Promise<PipelineAggregatedState>>();
  });

  it('5. top-level contracts preserve readonly structure', () => {
    expectTypeOf<Readonly<PipelineBootstrapInput>>().toEqualTypeOf<PipelineBootstrapInput>();
    expectTypeOf<PipelineBootstrapFact>().toMatchTypeOf<
      Readonly<PipelineBootstrapFact>
    >();
    expectTypeOf<Readonly<PipelineBootstrapState>>().toEqualTypeOf<PipelineBootstrapState>();
  });

  it('21. validates an explicitly selected known scenario', () => {
    const result = validatePipelineBootstrapTargetScenario(
      createScenario(),
      createPolicy()
    );

    expect(result.valid).toBe(true);
  });

  it('22. rejects a missing scenario', () => {
    const result = validatePipelineBootstrapTargetScenario(
      undefined,
      createPolicy()
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'TARGET_SCENARIO_REQUIRED'
      );
    }
  });

  it('23. rejects a scenario that was not selected explicitly', () => {
    const result = validatePipelineBootstrapTargetScenario(
      { ...createScenario(), explicitSelection: false },
      createPolicy()
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'TARGET_SCENARIO_REQUIRED'
      );
    }
  });

  it('24. rejects an unknown scenario identifier', () => {
    const result = validatePipelineBootstrapTargetScenario(
      { ...createScenario(), scenarioId: 'UNLISTED_SCENARIO' },
      createPolicy()
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'INVALID_TARGET_SCENARIO'
      );
    }
  });

  it('25. rejects an unsupported scenario version', () => {
    const result = validatePipelineBootstrapTargetScenario(
      { ...createScenario(), scenarioVersion: '2' },
      createPolicy()
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'INVALID_TARGET_SCENARIO'
      );
    }
  });

  it('75. exposes a complete scenario registry for v1', () => {
    expect(Object.keys(PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY)).toEqual([
      'PAYROLL_AUDIT',
      'COMPENSATION_RESTRUCTURE',
      'ORGANIZATION_RESTRUCTURE',
      'COMPLIANCE_AUDIT',
      'GROWTH_INTELLIGENCE',
    ]);
    expect(
      Object.values(PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY).every(
        (scenario) =>
          scenario.version === '1' &&
          scenario.description.length > 0 &&
          scenario.allowedStages.length === 8 &&
          scenario.requiredStages.length > 0 &&
          scenario.includedDomains.length > 0 &&
          scenario.excludedDomains.length > 0
      )
    ).toBe(true);
  });

  it('76. binds every scenario to one nominal objective key', () => {
    for (const scenario of Object.values(
      PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY
    )) {
      expect(scenario.objectiveKey).toBe(
        PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS[
          scenario.scenarioId
        ]
      );
    }
  });

  it('77. rejects an objective key not bound to the scenario', () => {
    const result = validatePipelineBootstrapTargetScenario(
      {
        ...createScenario(),
        objectiveKey: 'ASSESS_COMPLIANCE_AUDIT_READINESS',
      },
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('78. rejects requested stages with a missing dependency', () => {
    const result = validatePipelineBootstrapTargetScenario(
      {
        ...createScenario(),
        requestedStages: [
          'EVIDENCE_EXTRACTION',
          'MENTAL_MODEL',
          'KNOWLEDGE_GRAPH',
          'KNOWLEDGE_COVERAGE',
          'EXECUTIVE_DOSSIER',
        ],
      },
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('79. declares the observed pipeline dependency graph', () => {
    expect(PIPELINE_BOOTSTRAP_STAGE_DEPENDENCIES).toMatchObject({
      KNOWLEDGE_COVERAGE: [
        'EVIDENCE_EXTRACTION',
        'MENTAL_MODEL',
        'KNOWLEDGE_GRAPH',
      ],
      ADAPTIVE_PLANNING: ['KNOWLEDGE_COVERAGE'],
      EXECUTIVE_REASONING: ['KNOWLEDGE_COVERAGE'],
      EXECUTIVE_DOSSIER: ['EXECUTIVE_REASONING'],
      TRANSFORMATION_ASSESSMENT: [
        'EXECUTIVE_REASONING',
        'EXECUTIVE_DOSSIER',
      ],
    });
  });

  it('80. declares bootstrap contracts as v1 only', () => {
    expect(PIPELINE_BOOTSTRAP_VERSIONING_MODE).toBe('V1_ONLY');
  });

  it('93. validates a complete initial domain state', () => {
    const state = createInitialDomainState();
    const result = validatePipelineInitialDomainState(state, createPolicy());

    expect(result.valid).toBe(true);
  });

  it('94. scenario descriptor preserves its nominal objective key', () => {
    const descriptor = createScenarioDescriptor();
    const result = validatePipelineScenarioDescriptor(
      descriptor,
      createPolicy()
    );

    expect(result.valid).toBe(true);
    expect(descriptor.objectiveKey).toBe(
      PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS.PAYROLL_AUDIT
    );
  });

  it('95. scenario descriptor preserves registry stage dependencies', () => {
    const descriptor = createScenarioDescriptor();

    expect(descriptor.stageDependencies).toEqual(
      PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY.PAYROLL_AUDIT.stageDependencies
    );
  });

  it('96. scenario descriptor preserves allowed and required stages', () => {
    const descriptor = createScenarioDescriptor();
    const registry = PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY.PAYROLL_AUDIT;

    expect(descriptor.allowedStages).toEqual(registry.allowedStages);
    expect(descriptor.requiredStages).toEqual(registry.requiredStages);
    expect(descriptor.requestedStages).toEqual(registry.requiredStages);
  });

  it('97. scenario descriptor remains nominal instead of heuristic text', () => {
    const descriptor = createScenarioDescriptor();

    expect(descriptor.scenarioId).toBe('PAYROLL_AUDIT');
    expect('targetScenario' in descriptor).toBe(false);
    expect('description' in descriptor).toBe(false);
  });

  it('98. initial evidence preserves the complete source fact', () => {
    const evidence = createInitialEvidence();

    expect(evidence.sourceFact).toEqual(createFact());
    expect(evidence.appliedEvidence.sourceType).toBe(
      evidence.sourceFact.provenance.sourceType
    );
    expect(evidence.appliedEvidence.capturedAt).toBe(
      evidence.sourceFact.provenance.capturedAt
    );
  });

  it('99. initial evidence is the accepted-state source of truth', () => {
    const state = createAcceptedState();

    expect('normalizedFacts' in state).toBe(false);
    expect(state.initialDomainState.evidence[0]?.sourceFact.factId).toBe(
      'fact-industry-1'
    );
  });

  it('100. initial domain state excludes every future pipeline output', () => {
    const state = createInitialDomainState();

    expect('coverageReport' in state).toBe(false);
    expect('readinessAssessment' in state).toBe(false);
    expect('planningResult' in state).toBe(false);
    expect('reasoningReport' in state).toBe(false);
    expect('dossier' in state).toBe(false);
    expect('assessment' in state).toBe(false);
  });

  it('101. accepted and initial domain state remain v1-only', () => {
    const state = createAcceptedState();

    expect(state.bootstrapVersion).toBe('1');
    expect(state.initialDomainState.schemaVersion).toBe('1');
  });

  it('53. keeps the cancellation signal separate from the input', () => {
    expectTypeOf<
      Parameters<PipelineBootstrapPort['bootstrap']>
    >().toEqualTypeOf<
      [input: PipelineBootstrapInput, signal?: AbortSignal]
    >();
    expect('cancellationSignal' in createInput()).toBe(false);
  });

  it('54. accepted and rejected states are distinguished by status', () => {
    const acceptedStatus: PipelineBootstrapState['status'] = 'ACCEPTED';
    const rejectedStatus: PipelineBootstrapState['status'] = 'REJECTED';

    expect(acceptedStatus).toBe('ACCEPTED');
    expect(rejectedStatus).toBe('REJECTED');
  });
});
