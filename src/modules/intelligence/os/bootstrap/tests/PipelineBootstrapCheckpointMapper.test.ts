import { describe, expect, it } from 'vitest';
import {
  createEmptyEnterpriseKnowledgeGraph,
  upsertGraphNode,
} from '../../../enterprise-model/graph/services/operations';
import { createEmptyEnterpriseMentalModel } from '../../../enterprise-model/services/modelUpdater';
import {
  calculateCheckpointStageFingerprints,
  validateCheckpointForAdmission,
  validatePrecomputedPipelineCheckpoint,
  type PipelineStageAdmission,
} from '../../checkpoint';
import {
  PipelineBootstrapCheckpointMappingError,
  deriveBootstrapCheckpointId,
  mapBootstrapAcceptedStateToCheckpointHandoff,
  type PipelineBootstrapCheckpointMapperOptions,
} from '../PipelineBootstrapCheckpointMapper';
import {
  PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY,
  type BootstrapAcceptedState,
  type BootstrapRejectedState,
  type PipelineBootstrapFact,
  type PipelineBootstrapPolicy,
  type PipelineBootstrapScenarioId,
  type PipelineInitialEvidence,
  type PipelineScenarioDescriptor,
} from '../types';

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

function createFact(index: number): PipelineBootstrapFact {
  return {
    factId: `fact-${index}`,
    category: 'BUSINESS_INDUSTRY',
    value: 'HOSPITALITY',
    valueType: 'ENUM',
    provenance: {
      sourceType: 'INTEGRATION',
      sourceId: `source-${index}`,
      collectionMethod: 'SYSTEM_EVENT',
      capturedAt: 200 + index,
      reliability: 'HIGH',
      directness: 'DIRECT',
      actorType: 'SYSTEM',
      tenantId: 'tenant-1',
      correlationId: 'correlation-1',
    },
    reliability: 'HIGH',
    directness: 'DIRECT',
    polarity: 'AFFIRMED',
    observedAt: 100 + index,
    schemaVersion: '1',
  };
}

function createInitialEvidence(
  index: number,
  evidenceId: string,
  statementSuffix = ''
): PipelineInitialEvidence {
  const sourceFact = createFact(index);
  return {
    sourceFact,
    appliedEvidence: {
      evidenceId,
      sessionId: 'session-bootstrap-1',
      turnId: `bootstrap-turn-${index}`,
      source: 'governed-bootstrap-contract',
      sourceType: 'INTEGRATION',
      originalText: null,
      normalizedStatement:
        `BUSINESS_INDUSTRY=HOSPITALITY${statementSuffix}`,
      category: 'BUSINESS_INDUSTRY',
      entityRefs: [],
      capturedAt: sourceFact.provenance.capturedAt,
      reliability: 0.8,
      directness: 1,
      polarity: 'POSITIVE',
      extractorVersion: '1',
      metadata: {},
    },
  };
}

function createScenarioDescriptor(
  scenarioId: PipelineBootstrapScenarioId = 'PAYROLL_AUDIT'
): PipelineScenarioDescriptor {
  const registry = PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY[scenarioId];
  return {
    scenarioId,
    scenarioVersion: '1',
    objectiveKey: registry.objectiveKey,
    requestedStages: [...registry.requiredStages],
    allowedStages: [...registry.allowedStages],
    requiredStages: [...registry.requiredStages],
    stageDependencies: registry.stageDependencies,
    includedDomains: [...registry.includedDomains],
    excludedDomains: [...registry.excludedDomains],
    source: 'AUTHORIZED_SYSTEM_CONFIGURATION',
    explicitSelection: true,
  } as PipelineScenarioDescriptor;
}

interface AcceptedStateOptions {
  readonly scenarioId?: PipelineBootstrapScenarioId;
  readonly evidenceStatementSuffix?: string;
  readonly mutateModel?: boolean;
  readonly mutateGraph?: boolean;
}

function createAcceptedState(
  options: AcceptedStateOptions = {}
): BootstrapAcceptedState {
  const first = createInitialEvidence(
    1,
    'evidence-z',
    options.evidenceStatementSuffix
  );
  const second = createInitialEvidence(
    2,
    'evidence-a',
    options.evidenceStatementSuffix
  );
  const evidence = [first, second];
  const mentalModel = createEmptyEnterpriseMentalModel();
  for (const item of evidence) {
    mentalModel.evidences[item.appliedEvidence.evidenceId] =
      item.appliedEvidence;
  }
  if (options.mutateModel) {
    mentalModel.strategicContext.executivePriorities.push(
      'Changed priority'
    );
  }

  let knowledgeGraph = createEmptyEnterpriseKnowledgeGraph();
  if (options.mutateGraph) {
    knowledgeGraph = upsertGraphNode(
      knowledgeGraph,
      'PROCESS',
      'Changed graph node',
      {},
      1
    ).graph;
  }

  const scenario = createScenarioDescriptor(options.scenarioId);
  return {
    status: 'ACCEPTED',
    bootstrapId: 'bootstrap-1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    initialDomainState: {
      mentalModel,
      knowledgeGraph,
      evidence,
      scenario,
      bootstrapId: 'bootstrap-1',
      tenantId: 'tenant-1',
      correlationId: 'correlation-1',
      createdAt: 300,
      schemaVersion: '1',
    },
    provenanceSummary: {
      factCount: 2,
      sourceTypes: ['INTEGRATION'],
      earliestObservedAt: 101,
      latestObservedAt: 102,
    },
    bootstrapVersion: '1',
    createdAt: 300,
  };
}

function createRejectedState(): BootstrapRejectedState {
  return {
    status: 'REJECTED',
    bootstrapId: 'bootstrap-1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    errors: [],
    bootstrapVersion: '1',
    createdAt: 300,
  };
}

function createMapperOptions(
  overrides: Partial<
    PipelineBootstrapCheckpointMapperOptions['producer']
  > = {}
): PipelineBootstrapCheckpointMapperOptions {
  return {
    policy: createPolicy(),
    producer: {
      producerId: 'bootstrap-checkpoint-mapper',
      producerVersion: '1',
      ...overrides,
    },
  };
}

function expectMappingIssue(
  operation: () => unknown,
  issue: string
): void {
  try {
    operation();
    throw new Error('Expected mapping to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(
      PipelineBootstrapCheckpointMappingError
    );
    expect(
      (error as PipelineBootstrapCheckpointMappingError).issue
    ).toBe(issue);
  }
}

function admission(
  state: ReturnType<
    typeof mapBootstrapAcceptedStateToCheckpointHandoff
  >,
  stageId: PipelineStageAdmission['stageId']
): PipelineStageAdmission {
  const result = state.precomputedCheckpoint.admissions.find(
    (candidate) => candidate.stageId === stageId
  );
  if (!result) {
    throw new Error(`Missing admission ${stageId}`);
  }
  return result;
}

describe('AI-02C.3D PipelineBootstrapCheckpointMapper', () => {
  it('1. maps a valid accepted state to a handoff', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.aggregatedState.sessionId).toBe(
      'session-bootstrap-1'
    );
    expect(handoff.pipelineInput.precomputedCheckpoint).toBe(
      handoff.precomputedCheckpoint
    );
  });

  it('2. carries the Mental Model into aggregatedState', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.aggregatedState.mentalModel).toBeDefined();
    expect(handoff.aggregatedState.mentalModel?.evidences).toHaveProperty(
      'evidence-a'
    );
  });

  it('3. carries the Knowledge Graph into aggregatedState', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.aggregatedState.knowledgeGraph).toEqual(
      createEmptyEnterpriseKnowledgeGraph()
    );
  });

  it('4. carries only applied evidence into aggregatedState', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.aggregatedState.evidence).toHaveLength(2);
    expect(handoff.aggregatedState.evidence?.[0]).toHaveProperty(
      'evidenceId'
    );
    expect(handoff.aggregatedState.evidence?.[0]).not.toHaveProperty(
      'sourceFact'
    );
  });

  it('5. projects the executionScenario structurally', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.aggregatedState.executionScenario).toMatchObject({
      scenarioId: 'PAYROLL_AUDIT',
      scenarioVersion: '1',
      objectiveKey: 'ASSESS_PAYROLL_AUDIT_READINESS',
    });
  });

  it('6. leaves targetScenario absent', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.aggregatedState.targetScenario).toBeUndefined();
    expect(handoff.pipelineInput.targetScenario).toBeUndefined();
  });

  it('7. leaves extractionResult absent', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.aggregatedState.extractionResult).toBeUndefined();
  });

  it('8. leaves objectiveIds absent', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.aggregatedState.objectiveIds).toBeUndefined();
  });

  it('9. leaves executionKey absent', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.aggregatedState.executionKey).toBeUndefined();
  });

  it('10. leaves metadata absent', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.aggregatedState.metadata).toBeUndefined();
    expect(handoff.pipelineInput.metadata).toBeUndefined();
  });

  it('11. creates a contract-valid checkpoint', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(
      validatePrecomputedPipelineCheckpoint(
        handoff.precomputedCheckpoint
      ).valid
    ).toBe(true);
  });

  it('12. creates exactly three foundational admissions', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.precomputedCheckpoint.admissions).toHaveLength(3);
    expect(
      handoff.precomputedCheckpoint.admissions.map(
        (item) => item.stageId
      )
    ).toEqual([
      'EVIDENCE_EXTRACTION',
      'MENTAL_MODEL',
      'KNOWLEDGE_GRAPH',
    ]);
  });

  it('13. canonicalizes admission and evidence order', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(
      handoff.precomputedCheckpoint.admissions.map(
        (item) => item.stageId
      )
    ).toEqual([
      'EVIDENCE_EXTRACTION',
      'MENTAL_MODEL',
      'KNOWLEDGE_GRAPH',
    ]);
    expect(
      handoff.precomputedCheckpoint.admissions[0].evidenceRefs.map(
        (reference) =>
          reference.referenceType === 'EVIDENCE'
            ? reference.evidenceId
            : ''
      )
    ).toEqual(['evidence-a', 'evidence-z']);
  });

  it('14. creates refs for real applied evidence IDs', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const evidenceIds = new Set(
      handoff.aggregatedState.evidence?.map(
        (item) => item.evidenceId
      )
    );
    for (const reference of admission(
      handoff,
      'MENTAL_MODEL'
    ).evidenceRefs) {
      expect(reference.referenceType).toBe('EVIDENCE');
      if (reference.referenceType === 'EVIDENCE') {
        expect(evidenceIds.has(reference.evidenceId)).toBe(true);
      }
    }
  });

  it('15. emits deduplicated evidence refs', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const refs = admission(
      handoff,
      'KNOWLEDGE_GRAPH'
    ).evidenceRefs;
    expect(new Set(refs.map((ref) => JSON.stringify(ref))).size).toBe(
      refs.length
    );
  });

  it('16. preserves explicit producer identity', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions({
        producerId: 'producer-explicit',
        producerVersion: '2.1',
      })
    );
    expect(handoff.precomputedCheckpoint.producerId).toBe(
      'producer-explicit'
    );
    expect(handoff.precomputedCheckpoint.producerVersion).toBe('2.1');
  });

  it('17. converts and preserves accepted createdAt', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.precomputedCheckpoint.completedAt).toBe(
      '1970-01-01T00:00:00.300Z'
    );
  });

  it('18. derives a deterministic reversible checkpointId', () => {
    const maximumLengthId = 'b'.repeat(180);
    expect(deriveBootstrapCheckpointId('bootstrap-1')).toBe('bootstrap-1');
    expect(deriveBootstrapCheckpointId(maximumLengthId)).toBe(
      maximumLengthId
    );
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(handoff.precomputedCheckpoint.checkpointId).toBe('bootstrap-1');
  });

  it('19. matches the expected Extraction input fingerprint', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const item = admission(handoff, 'EVIDENCE_EXTRACTION');
    const expected = calculateCheckpointStageFingerprints(
      'EVIDENCE_EXTRACTION',
      {
        tenantId: handoff.tenantId,
        correlationId: handoff.correlationId,
        scenarioId:
          handoff.aggregatedState.executionScenario!.scenarioId,
        scenarioVersion:
          handoff.aggregatedState.executionScenario!.scenarioVersion,
        evidenceRefs: item.evidenceRefs,
        appliedEvidence: handoff.aggregatedState.evidence!,
        mentalModel: handoff.aggregatedState.mentalModel,
        knowledgeGraph: handoff.aggregatedState.knowledgeGraph,
      }
    );
    expect(item.inputFingerprint).toBe(expected.inputFingerprint);
  });

  it('20. matches the expected Extraction output fingerprint', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const item = admission(handoff, 'EVIDENCE_EXTRACTION');
    const expected = calculateCheckpointStageFingerprints(
      'EVIDENCE_EXTRACTION',
      {
        tenantId: handoff.tenantId,
        correlationId: handoff.correlationId,
        scenarioId:
          handoff.aggregatedState.executionScenario!.scenarioId,
        scenarioVersion:
          handoff.aggregatedState.executionScenario!.scenarioVersion,
        evidenceRefs: item.evidenceRefs,
        appliedEvidence: handoff.aggregatedState.evidence!,
      }
    );
    expect(item.outputFingerprint).toBe(expected.outputFingerprint);
  });

  it('21. matches the expected Model input fingerprint', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const item = admission(handoff, 'MENTAL_MODEL');
    const expected = calculateCheckpointStageFingerprints(
      'MENTAL_MODEL',
      {
        tenantId: handoff.tenantId,
        correlationId: handoff.correlationId,
        scenarioId:
          handoff.aggregatedState.executionScenario!.scenarioId,
        scenarioVersion:
          handoff.aggregatedState.executionScenario!.scenarioVersion,
        evidenceRefs: item.evidenceRefs,
        appliedEvidence: handoff.aggregatedState.evidence!,
        mentalModel: handoff.aggregatedState.mentalModel,
      }
    );
    expect(item.inputFingerprint).toBe(expected.inputFingerprint);
  });

  it('22. matches the expected Model output fingerprint', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const item = admission(handoff, 'MENTAL_MODEL');
    const expected = calculateCheckpointStageFingerprints(
      'MENTAL_MODEL',
      {
        tenantId: handoff.tenantId,
        correlationId: handoff.correlationId,
        scenarioId:
          handoff.aggregatedState.executionScenario!.scenarioId,
        scenarioVersion:
          handoff.aggregatedState.executionScenario!.scenarioVersion,
        evidenceRefs: item.evidenceRefs,
        appliedEvidence: handoff.aggregatedState.evidence!,
        mentalModel: handoff.aggregatedState.mentalModel,
      }
    );
    expect(item.outputFingerprint).toBe(expected.outputFingerprint);
  });

  it('23. matches the expected Graph input fingerprint', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const item = admission(handoff, 'KNOWLEDGE_GRAPH');
    const expected = calculateCheckpointStageFingerprints(
      'KNOWLEDGE_GRAPH',
      {
        tenantId: handoff.tenantId,
        correlationId: handoff.correlationId,
        scenarioId:
          handoff.aggregatedState.executionScenario!.scenarioId,
        scenarioVersion:
          handoff.aggregatedState.executionScenario!.scenarioVersion,
        evidenceRefs: item.evidenceRefs,
        appliedEvidence: handoff.aggregatedState.evidence!,
        mentalModel: handoff.aggregatedState.mentalModel,
        knowledgeGraph: handoff.aggregatedState.knowledgeGraph,
      }
    );
    expect(item.inputFingerprint).toBe(expected.inputFingerprint);
  });

  it('24. matches the expected Graph output fingerprint', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const item = admission(handoff, 'KNOWLEDGE_GRAPH');
    const expected = calculateCheckpointStageFingerprints(
      'KNOWLEDGE_GRAPH',
      {
        tenantId: handoff.tenantId,
        correlationId: handoff.correlationId,
        scenarioId:
          handoff.aggregatedState.executionScenario!.scenarioId,
        scenarioVersion:
          handoff.aggregatedState.executionScenario!.scenarioVersion,
        evidenceRefs: item.evidenceRefs,
        appliedEvidence: handoff.aggregatedState.evidence!,
        mentalModel: handoff.aggregatedState.mentalModel,
        knowledgeGraph: handoff.aggregatedState.knowledgeGraph,
      }
    );
    expect(item.outputFingerprint).toBe(expected.outputFingerprint);
  });

  it('25. passes the exact AI-02C.3C admission validator', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(() =>
      validateCheckpointForAdmission({
        checkpoint: handoff.precomputedCheckpoint,
        tenantId: handoff.tenantId,
        correlationId: handoff.correlationId,
        executionScenario:
          handoff.aggregatedState.executionScenario,
        state: handoff.aggregatedState,
        authorizer: { isAuthorized: () => true },
        isStageConfigured: () => true,
      })
    ).not.toThrow();
  });

  it('26. rejects a REJECTED bootstrap state', () => {
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          createRejectedState(),
          createMapperOptions()
        ),
      'BOOTSTRAP_STATE_NOT_ACCEPTED'
    );
  });

  it('27. rejects an accepted envelope without initialDomainState', () => {
    const state = createAcceptedState() as unknown as Record<
      string,
      unknown
    >;
    delete state.initialDomainState;
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          state,
          createMapperOptions()
        ),
      'BOOTSTRAP_INITIAL_STATE_MISSING'
    );
  });

  it('28. rejects a tenant mismatch', () => {
    const state = {
      ...createAcceptedState(),
      tenantId: 'tenant-2',
    };
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          state,
          createMapperOptions()
        ),
      'BOOTSTRAP_CHECKPOINT_MAPPING_FAILED'
    );
  });

  it('29. rejects a correlation mismatch', () => {
    const state = {
      ...createAcceptedState(),
      correlationId: 'correlation-2',
    };
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          state,
          createMapperOptions()
        ),
      'BOOTSTRAP_CHECKPOINT_MAPPING_FAILED'
    );
  });

  it('30. rejects a scenario mismatch', () => {
    const state = createAcceptedState();
    const scenario = {
      ...state.initialDomainState.scenario,
      objectiveKey: 'WRONG_OBJECTIVE',
    };
    const invalid = {
      ...state,
      initialDomainState: {
        ...state.initialDomainState,
        scenario,
      },
    };
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          invalid,
          createMapperOptions()
        ),
      'BOOTSTRAP_SCENARIO_MISMATCH'
    );
  });

  it('31. rejects applied evidence without identity', () => {
    const state = createAcceptedState();
    const evidence = [...state.initialDomainState.evidence];
    evidence[0] = {
      ...evidence[0],
      appliedEvidence: {
        ...evidence[0].appliedEvidence,
        evidenceId: '',
      },
    };
    const invalid = {
      ...state,
      initialDomainState: {
        ...state.initialDomainState,
        evidence,
      },
    };
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          invalid,
          createMapperOptions()
        ),
      'BOOTSTRAP_EVIDENCE_IDENTITY_INVALID'
    );
  });

  it('32. rejects duplicate applied evidence identity', () => {
    const state = createAcceptedState();
    const evidence = [...state.initialDomainState.evidence];
    evidence[1] = {
      ...evidence[1],
      appliedEvidence: {
        ...evidence[1].appliedEvidence,
        evidenceId: evidence[0].appliedEvidence.evidenceId,
      },
    };
    const invalid = {
      ...state,
      initialDomainState: {
        ...state.initialDomainState,
        evidence,
      },
    };
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          invalid,
          createMapperOptions()
        ),
      'BOOTSTRAP_EVIDENCE_IDENTITY_INVALID'
    );
  });

  it('33. rejects Mental Model and evidence inconsistency', () => {
    const state = createAcceptedState();
    const mentalModel = createEmptyEnterpriseMentalModel();
    const invalid = {
      ...state,
      initialDomainState: {
        ...state.initialDomainState,
        mentalModel,
      },
    };
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          invalid,
          createMapperOptions()
        ),
      'BOOTSTRAP_CHECKPOINT_MAPPING_FAILED'
    );
  });

  it('34. rejects an invalid Knowledge Graph', () => {
    const state = createAcceptedState();
    const invalid = {
      ...state,
      initialDomainState: {
        ...state.initialDomainState,
        knowledgeGraph: {
          nodes: {},
          relationships: {
            broken: {
              id: 'broken',
              sourceId: 'missing',
              targetId: 'missing',
              type: 'CAUSES',
              status: 'CONFIRMED',
              confidence: 1,
              evidenceRefs: [],
              properties: {},
              createdAt: 1,
              updatedAt: 1,
            },
          },
        },
      },
    };
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          invalid,
          createMapperOptions()
        ),
      'BOOTSTRAP_CHECKPOINT_MAPPING_FAILED'
    );
  });

  it('35. rejects an empty producerId', () => {
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          createAcceptedState(),
          createMapperOptions({ producerId: '' })
        ),
      'BOOTSTRAP_PRODUCER_IDENTITY_INVALID'
    );
  });

  it('36. rejects an empty producerVersion', () => {
    expectMappingIssue(
      () =>
        mapBootstrapAcceptedStateToCheckpointHandoff(
          createAcceptedState(),
          createMapperOptions({ producerVersion: '' })
        ),
      'BOOTSTRAP_PRODUCER_IDENTITY_INVALID'
    );
  });

  it('37. does not mutate its accepted-state input', () => {
    const state = createAcceptedState();
    const before = JSON.stringify(state);
    mapBootstrapAcceptedStateToCheckpointHandoff(
      state,
      createMapperOptions()
    );
    expect(JSON.stringify(state)).toBe(before);
  });

  it('38. protects output from later input mutation', () => {
    const state = createAcceptedState();
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      state,
      createMapperOptions()
    );
    state.initialDomainState.mentalModel.identity.organizationName =
      'Mutated input';
    expect(
      handoff.aggregatedState.mentalModel?.identity.organizationName
    ).toBeNull();
    expect(Object.isFrozen(handoff.aggregatedState.mentalModel)).toBe(
      true
    );
    expect(() => {
      (
        handoff.aggregatedState.mentalModel!.identity as {
          organizationName: string | null;
        }
      ).organizationName = 'Mutated output';
    }).toThrow();
    expect(
      state.initialDomainState.mentalModel.identity.organizationName
    ).toBe('Mutated input');
  });

  it('39. creates independent arrays', () => {
    const state = createAcceptedState();
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      state,
      createMapperOptions()
    );
    expect(handoff.aggregatedState.evidence).not.toBe(
      state.initialDomainState.evidence
    );
    expect(
      handoff.precomputedCheckpoint.admissions[0].evidenceRefs
    ).not.toBe(state.initialDomainState.evidence);
  });

  it('40. creates an independent frozen scenario', () => {
    const state = createAcceptedState();
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      state,
      createMapperOptions()
    );
    expect(handoff.aggregatedState.executionScenario).not.toBe(
      state.initialDomainState.scenario
    );
    expect(
      Object.isFrozen(
        handoff.aggregatedState.executionScenario?.stageDependencies
      )
    ).toBe(true);
  });

  it('41. creates an independent frozen checkpoint', () => {
    const first = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const second = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(first.precomputedCheckpoint).not.toBe(
      second.precomputedCheckpoint
    );
    expect(Object.isFrozen(first.precomputedCheckpoint)).toBe(true);
  });

  it('42. maps deterministically', () => {
    const first = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const second = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect(first.precomputedCheckpoint).toEqual(
      second.precomputedCheckpoint
    );
  });

  it('43. produces equal handoffs for equal input', () => {
    const state = createAcceptedState();
    expect(
      mapBootstrapAcceptedStateToCheckpointHandoff(
        state,
        createMapperOptions()
      )
    ).toEqual(
      mapBootstrapAcceptedStateToCheckpointHandoff(
        state,
        createMapperOptions()
      )
    );
  });

  it('44. changes evidence-dependent fingerprints with evidence', () => {
    const base = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const changed = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState({ evidenceStatementSuffix: '-CHANGED' }),
      createMapperOptions()
    );
    expect(
      admission(base, 'EVIDENCE_EXTRACTION').outputFingerprint
    ).not.toBe(
      admission(changed, 'EVIDENCE_EXTRACTION').outputFingerprint
    );
  });

  it('45. changes model-dependent fingerprints with Mental Model', () => {
    const base = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const changed = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState({ mutateModel: true }),
      createMapperOptions()
    );
    expect(admission(base, 'MENTAL_MODEL').outputFingerprint).not.toBe(
      admission(changed, 'MENTAL_MODEL').outputFingerprint
    );
    expect(admission(base, 'KNOWLEDGE_GRAPH').inputFingerprint).not.toBe(
      admission(changed, 'KNOWLEDGE_GRAPH').inputFingerprint
    );
  });

  it('46. changes graph output fingerprint with Knowledge Graph', () => {
    const base = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const changed = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState({ mutateGraph: true }),
      createMapperOptions()
    );
    expect(
      admission(base, 'KNOWLEDGE_GRAPH').outputFingerprint
    ).not.toBe(
      admission(changed, 'KNOWLEDGE_GRAPH').outputFingerprint
    );
  });

  it('47. changes Extraction input fingerprint with scenario', () => {
    const base = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    const changed = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState({ scenarioId: 'COMPLIANCE_AUDIT' }),
      createMapperOptions()
    );
    expect(
      admission(base, 'EVIDENCE_EXTRACTION').inputFingerprint
    ).not.toBe(
      admission(changed, 'EVIDENCE_EXTRACTION').inputFingerprint
    );
  });

  it('48. never fabricates TurnExtractionResult', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect('extractionResult' in handoff.aggregatedState).toBe(false);
  });

  it('49. never emits targetScenario legacy compatibility data', () => {
    const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
      createAcceptedState(),
      createMapperOptions()
    );
    expect('targetScenario' in handoff.aggregatedState).toBe(false);
    expect('targetScenario' in handoff.pipelineInput).toBe(false);
  });
});
