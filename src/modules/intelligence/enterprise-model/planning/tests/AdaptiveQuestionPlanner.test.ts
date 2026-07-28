// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, expect, it } from 'vitest';
import {
  createEmptyEnterpriseKnowledgeGraph,
  upsertGraphNode,
} from '../../graph/services/operations';
import { CoverageCalculator } from '../../coverage/services/CoverageCalculator';
import { CoverageDecisionEngine } from '../../coverage/services/CoverageDecisionEngine';
import { KnowledgeObjectiveEngine } from '../services/KnowledgeObjectiveEngine';
import { StrategyPlanner } from '../services/StrategyPlanner';
import { QuestionIntentBuilder } from '../services/QuestionIntentBuilder';
import { DeterministicQuestionRealizationProvider } from '../services/QuestionRealizationProvider';
import { QuestionPlanEvaluator } from '../services/QuestionPlanEvaluator';
import { AdaptiveQuestionPlanner } from '../services/AdaptiveQuestionPlanner';
import { CoverageAdapter } from '../domain/adapters';
import {
  calculateJaccardSimilarity,
  PlanningValidationError,
} from '../domain/validation';
import type {
  PlannerExecutionContext,
  PlannerPolicy,
  PlanningTraceability,
  QuestionCandidate,
} from '../domain/types';

describe('AI-01E: Adaptive Question Planning Engine', () => {
  const mockCtx: PlannerExecutionContext = {
    executionId: 'exec-test-01E',
    timestamp: '2026-07-25T10:00:00.000Z',
    policy: {
      maxQuestionsPerPlan: 5,
      minConfidenceThreshold: 0.5,
      jaccardThreshold: 0.6,
      allowClosedQuestions: false,
    },
  };

  it('1. should create deterministic objectives from AI-01D OverallCoverageReport', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);
    const objectives = KnowledgeObjectiveEngine.createObjectives(
      report,
      undefined,
      undefined,
      mockCtx
    );

    expect(objectives.length).toBeGreaterThan(0);
    expect(objectives[0].objectiveId).toContain('obj-exec-test-01E-organization-0');
    expect(objectives[0].traceability.domainId).toBe('organization');
    expect(objectives[0].traceability.sourceGapId).toBeDefined();
  });

  it('2. should create objectives using DecisionReadinessAssessment blocking gaps', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      graph,
      'payroll_audit'
    );

    const objectives = KnowledgeObjectiveEngine.createObjectives(
      report,
      assessment,
      undefined,
      mockCtx
    );

    expect(objectives.length).toBeGreaterThan(0);
    expect(objectives.some((o) => o.domainId === 'payroll')).toBe(true);
  });

  it('3. should throw PlanningValidationError on invalid context or policy', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);

    expect(() =>
      KnowledgeObjectiveEngine.createObjectives(
        report,
        undefined,
        undefined,
        {} as unknown as PlannerExecutionContext
      )
    ).toThrow(PlanningValidationError);
  });

  it('4. should throw PlanningValidationError on missing references in queue items', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);
    const invalidQueue = {
      items: [
        {
          id: '',
          domain: 'payroll' as const,
          sourceGapId: '',
          description: 'invalid gap',
          recommendedAction: '',
          priorityScore: 50,
        },
      ],
      priorityDomains: ['payroll' as const],
      recommendedQuestions: [],
    };

    expect(() =>
      KnowledgeObjectiveEngine.createObjectives(
        report,
        undefined,
        invalidQueue,
        mockCtx
      )
    ).toThrow(PlanningValidationError);
  });

  it('5. should skip completed objectives cleanly', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);
    const initialObjectives = KnowledgeObjectiveEngine.createObjectives(
      report,
      undefined,
      undefined,
      mockCtx
    );

    const completedId = initialObjectives[0].objectiveId;
    const remainingObjectives = KnowledgeObjectiveEngine.createObjectives(
      report,
      undefined,
      undefined,
      mockCtx,
      [completedId]
    );

    expect(remainingObjectives.length).toBe(initialObjectives.length - 1);
    expect(remainingObjectives.some((o) => o.objectiveId === completedId)).toBe(false);
  });

  it('6. should generate strategic approaches with deterministic IDs and valid traceability', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);
    const objectives = KnowledgeObjectiveEngine.createObjectives(
      report,
      undefined,
      undefined,
      mockCtx
    );
    const strategies = StrategyPlanner.createStrategies(objectives, mockCtx);

    expect(strategies.length).toBeGreaterThan(0);
    expect(strategies[0].strategyId).toContain('strat-exec-test-01E-obj-exec-test-01E');
    expect(strategies[0].traceability.domainId).toBeDefined();
  });

  it('7. should throw PlanningValidationError if objectives lack traceability', () => {
    const invalidObjectives = [
      {
        objectiveId: 'obj-bad',
        domainId: 'payroll' as const,
        description: 'bad obj',
        priority: 90,
        status: 'PENDING' as const,
        traceability: {} as unknown as PlanningTraceability,
      },
    ];

    expect(() => StrategyPlanner.createStrategies(invalidObjectives, mockCtx)).toThrow(
      PlanningValidationError
    );
  });

  it('8. should construct open, consultative, product-neutral question intents', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);
    const objectives = KnowledgeObjectiveEngine.createObjectives(
      report,
      undefined,
      undefined,
      mockCtx
    );
    const strategies = StrategyPlanner.createStrategies(objectives, mockCtx);
    const intents = QuestionIntentBuilder.createIntents(strategies, mockCtx);

    expect(intents.length).toBeGreaterThan(0);
    expect(intents.every((i) => i.isClosed === false)).toBe(true);
    expect(intents[0].promptTemplate).not.toContain('Workday');
    expect(intents[0].promptTemplate).not.toContain('SAP');
  });

  it('9. should construct closed question intents when policy permits', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);
    const objectives = KnowledgeObjectiveEngine.createObjectives(
      report,
      undefined,
      undefined,
      mockCtx
    );
    const strategies = StrategyPlanner.createStrategies(objectives, mockCtx);

    const closedCtx: PlannerExecutionContext = {
      ...mockCtx,
      policy: {
        ...mockCtx.policy!,
        allowClosedQuestions: true,
      },
    };

    const intents = QuestionIntentBuilder.createIntents(strategies, closedCtx);
    expect(intents.some((i) => i.isClosed === true)).toBe(true);
  });

  it('10. should throw PlanningValidationError if strategies lack traceability', () => {
    const invalidStrategies = [
      {
        strategyId: 'strat-bad',
        objectiveId: 'obj-1',
        domainId: 'payroll' as const,
        approach: 'TOP_DOWN' as const,
        rationale: 'bad',
        traceability: {} as unknown as PlanningTraceability,
      },
    ];

    expect(() =>
      QuestionIntentBuilder.createIntents(invalidStrategies, mockCtx)
    ).toThrow(PlanningValidationError);
  });

  it('11. should realize concrete question candidates deterministically without LLM network calls', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);
    const objectives = KnowledgeObjectiveEngine.createObjectives(
      report,
      undefined,
      undefined,
      mockCtx
    );
    const strategies = StrategyPlanner.createStrategies(objectives, mockCtx);
    const intents = QuestionIntentBuilder.createIntents(strategies, mockCtx);

    const provider = new DeterministicQuestionRealizationProvider();
    const candidates = provider.realizeIntents(intents, mockCtx);

    expect(candidates.length).toBe(intents.length);
    expect(candidates[0].candidateId).toContain('cand-exec-test-01E-intent-exec-test-01E');
  });

  it('12. should throw PlanningValidationError if intents lack traceability during realization', () => {
    const provider = new DeterministicQuestionRealizationProvider();
    const invalidIntents = [
      {
        intentId: 'intent-bad',
        strategyId: 'strat-1',
        domainId: 'payroll' as const,
        promptTemplate: 'test',
        targetGapType: 'gap',
        isClosed: false,
        traceability: {} as unknown as PlanningTraceability,
      },
    ];

    expect(() => provider.realizeIntents(invalidIntents, mockCtx)).toThrow(
      PlanningValidationError
    );
  });

  it('13. should calculate normalized Jaccard lexical similarity accurately', () => {
    const textA = 'What primary payroll rules govern tax deductions?';
    const textB = 'What primary payroll rules govern tax deductions?';
    const textC = 'How are salary structures defined in compensation?';

    expect(calculateJaccardSimilarity(textA, textB)).toBe(1.0);
    expect(calculateJaccardSimilarity(textA, textC)).toBeLessThan(0.3);
  });

  it('14. should normalize punctuation, diacritics, and case for Jaccard similarity', () => {
    const textA = '¿Cuáles son las reglas de nómina y deducciones fiscales?';
    const textB = 'cuales son las reglas de nomina y deducciones fiscales!';

    expect(calculateJaccardSimilarity(textA, textB)).toBeGreaterThan(0.9);
  });

  it('15. should reject candidate questions lacking mandatory traceability (fail-closed)', () => {
    const candidates: QuestionCandidate[] = [
      {
        candidateId: 'cand-bad',
        intentId: 'intent-1',
        domainId: 'payroll' as const,
        questionText: 'What is the payroll policy?',
        rationale: 'test',
        traceability: {} as unknown as PlanningTraceability,
      },
    ];

    expect(() =>
      QuestionPlanEvaluator.evaluateCandidates(candidates, mockCtx.policy, mockCtx)
    ).toThrow(PlanningValidationError);
  });

  it('16. should filter closed questions when allowClosedQuestions is false', () => {
    const candidates: QuestionCandidate[] = [
      {
        candidateId: 'cand-1',
        intentId: 'intent-1',
        domainId: 'payroll' as const,
        questionText: 'What primary policies govern payroll computation?',
        rationale: 'test',
        traceability: {
          domainId: 'payroll',
          sourceGapId: 'gap-payroll-1',
        },
      },
      {
        candidateId: 'cand-2',
        intentId: 'intent-2',
        domainId: 'payroll' as const,
        questionText: 'Is the payroll calculation verified?',
        rationale: 'test',
        traceability: {
          domainId: 'payroll',
          sourceGapId: 'gap-payroll-2',
        },
      },
    ];

    const policy: PlannerPolicy = {
      ...mockCtx.policy!,
      allowClosedQuestions: false,
    };

    const { plan, summary } = QuestionPlanEvaluator.evaluateCandidates(
      candidates,
      policy,
      mockCtx
    );

    expect(plan.items.length).toBe(1);
    expect(summary.rejectedClosedCandidates).toBe(1);
  });

  it('17. should deduplicate candidates exceeding Jaccard threshold', () => {
    const candidates: QuestionCandidate[] = [
      {
        candidateId: 'cand-1',
        intentId: 'intent-1',
        domainId: 'payroll' as const,
        questionText: 'What primary policies define payroll governance?',
        rationale: 'test',
        traceability: { domainId: 'payroll', sourceGapId: 'gap-1' },
      },
      {
        candidateId: 'cand-2',
        intentId: 'intent-2',
        domainId: 'payroll' as const,
        questionText: 'What primary policies define payroll governance in detail?',
        rationale: 'test',
        traceability: { domainId: 'payroll', sourceGapId: 'gap-2' },
      },
    ];

    const { plan, summary } = QuestionPlanEvaluator.evaluateCandidates(
      candidates,
      mockCtx.policy,
      mockCtx
    );

    expect(plan.items.length).toBe(1);
    expect(summary.rejectedDuplicateCandidates).toBe(1);
  });

  it('18. should throw fail-closed error when zero valid candidates exist', () => {
    expect(() =>
      QuestionPlanEvaluator.evaluateCandidates([], mockCtx.policy, mockCtx)
    ).toThrow(PlanningValidationError);
  });

  it('19. should enforce maxQuestionsPerPlan policy limit', () => {
    const candidateTexts = [
      'What primary organization structures govern headcount tracking?',
      'How are payroll tax calculations verified across entities?',
      'Which compensation packages include executive equity bonuses?',
      'How do healthcare benefits impact compliance audit requirements?',
      'What time attendance metrics reflect shift scheduling compliance?',
    ];
    const candidates: QuestionCandidate[] = candidateTexts.map((text, i) => ({
      candidateId: `cand-${i}`,
      intentId: `intent-${i}`,
      domainId: 'payroll' as const,
      questionText: text,
      rationale: 'test',
      traceability: { domainId: 'payroll', sourceGapId: `gap-${i}` },
    }));

    const policy: PlannerPolicy = {
      ...mockCtx.policy!,
      maxQuestionsPerPlan: 3,
    };

    const { plan } = QuestionPlanEvaluator.evaluateCandidates(
      candidates,
      policy,
      mockCtx
    );

    expect(plan.items.length).toBe(3);
  });

  it('20. should plan questions from graph end-to-end for a low coverage enterprise graph', async () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const result = await AdaptiveQuestionPlanner.planQuestionsFromGraph(
      { graph },
      mockCtx
    );

    expect(result.planId).toBe('adaptive-plan-exec-test-01E');
    expect(result.objectives.length).toBeGreaterThan(0);
    expect(result.selectedPlan.items.length).toBeGreaterThan(0);
    expect(result.selectedPlan.items.length).toBeLessThanOrEqual(5);
  });

  it('21. should plan questions from graph for a payroll audit decision scenario', async () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const result = await AdaptiveQuestionPlanner.planQuestionsFromGraph(
      {
        graph,
        targetScenario: 'payroll_audit',
      },
      mockCtx
    );

    expect(result.objectives.some((o) => o.domainId === 'payroll')).toBe(true);
    expect(result.selectedPlan.items.length).toBeGreaterThan(0);
  });

  it('22. should produce full traceability matrix linking objective -> strategy -> intent -> candidate -> domain -> coverage ref', async () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const result = await AdaptiveQuestionPlanner.planQuestionsFromGraph(
      { graph },
      mockCtx
    );

    expect(result.traceabilityMatrix.length).toBe(result.selectedPlan.items.length);
    expect(result.traceabilityMatrix[0].objectiveId).toBeDefined();
    expect(result.traceabilityMatrix[0].strategyId).toBeDefined();
    expect(result.traceabilityMatrix[0].intentId).toBeDefined();
    expect(result.traceabilityMatrix[0].candidateId).toBeDefined();
    expect(result.traceabilityMatrix[0].coverageRef).toBeDefined();
  });

  it('23. should use injected PlannerExecutionContext for all IDs and timestamps without Date.now or Math.random', async () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const customCtx: PlannerExecutionContext = {
      executionId: 'exec-deterministic-999',
      timestamp: '2026-12-31T23:59:59.000Z',
    };

    const result = await AdaptiveQuestionPlanner.planQuestionsFromGraph(
      { graph },
      customCtx
    );

    expect(result.planId).toBe('adaptive-plan-exec-deterministic-999');
    expect(result.selectedPlan.timestamp).toBe('2026-12-31T23:59:59.000Z');
    expect(result.objectives[0].objectiveId).toContain('exec-deterministic-999');
  });

  it('24. should build a valid ResearchQueue from AI-01D coverage outputs using CoverageAdapter', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      graph,
      'payroll_audit'
    );

    const queue = CoverageAdapter.buildResearchQueue(report, assessment);
    expect(queue.items.length).toBeGreaterThan(0);
    expect(queue.priorityDomains.length).toBeGreaterThan(0);
  });

  it('25. should handle empty critical gaps by falling back to domain breakdown gaps', async () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    // Add one node to organization
    const res = upsertGraphNode(graph, 'ENTITY', 'Org Unit', {
      domain: 'organization',
      confidence: 0.9,
      evidenceRef: 'ev-1',
    });
    graph = res.graph;

    const result = await AdaptiveQuestionPlanner.planQuestionsFromGraph(
      { graph },
      mockCtx
    );

    expect(result.selectedPlan.items.length).toBeGreaterThan(0);
  });

  it('26. should keep nominal planning objectives inside the coverage scope', async () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const includedDomains = [
      'organization',
      'workforce_analytics',
      'talent_performance',
    ] as const;
    const result = await AdaptiveQuestionPlanner.planQuestionsFromGraph(
      {
        graph,
        coverageScenario: {
          scenarioId: 'ORGANIZATION_RESTRUCTURE',
          includedDomains,
          excludedDomains: [
            'payroll',
            'compensation',
            'benefits',
            'compliance',
            'time_attendance',
          ],
        },
      },
      mockCtx
    );

    expect(result.objectives.length).toBeGreaterThan(0);
    expect(
      result.objectives.every((objective) =>
        includedDomains.includes(
          objective.domainId as (typeof includedDomains)[number]
        )
      )
    ).toBe(true);
    expect(
      result.objectives.some((objective) => objective.domainId === 'payroll')
    ).toBe(false);
    expect(
      result.objectives.some(
        (objective) => objective.domainId === 'compensation'
      )
    ).toBe(false);
  });
});

const AdaptiveQuestionPlannerTestModule = {
  name: 'AdaptiveQuestionPlannerTestModule',
};

export default AdaptiveQuestionPlannerTestModule;
