import type { EnterpriseKnowledgeGraph } from '../../graph/domain/types';
import type {
  OverallCoverageReport,
  DecisionReadinessAssessment,
} from '../../coverage/domain/types';
import { CoverageCalculator } from '../../coverage/services/CoverageCalculator';
import { CoverageDecisionEngine } from '../../coverage/services/CoverageDecisionEngine';
import { CoverageAdapter } from '../domain/adapters';
import type {
  AdaptiveQuestionPlanResult,
  PlannerExecutionContext,
  PlannerPolicy,
  ResearchQueue,
} from '../domain/types';
import { validatePlannerExecutionContext, validatePlannerPolicy } from '../domain/validation';
import { KnowledgeObjectiveEngine } from './KnowledgeObjectiveEngine';
import { StrategyPlanner } from './StrategyPlanner';
import { QuestionIntentBuilder } from './QuestionIntentBuilder';
import {
  DeterministicQuestionRealizationProvider,
  type IQuestionRealizationProvider,
} from './QuestionRealizationProvider';
import { QuestionPlanEvaluator } from './QuestionPlanEvaluator';

export interface PlanFromGraphOptions {
  graph: EnterpriseKnowledgeGraph;
  targetScenario?: string;
  policy?: PlannerPolicy;
  realizationProvider?: IQuestionRealizationProvider;
  completedObjectiveIds?: string[];
}

export interface PlanFromReportOptions {
  report: OverallCoverageReport;
  assessment?: DecisionReadinessAssessment;
  queue?: ResearchQueue;
  policy?: PlannerPolicy;
  realizationProvider?: IQuestionRealizationProvider;
  completedObjectiveIds?: string[];
}

export class AdaptiveQuestionPlanner {
  public static async planQuestionsFromGraph(
    options: PlanFromGraphOptions,
    ctx: PlannerExecutionContext
  ): Promise<AdaptiveQuestionPlanResult> {
    const report = CoverageCalculator.calculateOverallReport(options.graph);
    const assessment = options.targetScenario
      ? CoverageDecisionEngine.evaluateDecisionReadiness(options.graph, options.targetScenario)
      : undefined;

    return this.planQuestionsFromReport(
      {
        report,
        assessment,
        policy: options.policy,
        realizationProvider: options.realizationProvider,
        completedObjectiveIds: options.completedObjectiveIds,
      },
      ctx
    );
  }

  public static async planQuestionsFromReport(
    options: PlanFromReportOptions,
    ctx: PlannerExecutionContext
  ): Promise<AdaptiveQuestionPlanResult> {
    const validCtx = validatePlannerExecutionContext(ctx);
    const activePolicy = validatePlannerPolicy(options.policy || validCtx.policy);
    const effectiveCtx: PlannerExecutionContext = {
      ...validCtx,
      policy: activePolicy,
    };

    const provider =
      options.realizationProvider ||
      new DeterministicQuestionRealizationProvider();

    const queue =
      options.queue ||
      CoverageAdapter.buildResearchQueue(options.report, options.assessment);

    // Pipeline Step 1: KnowledgeObjectiveEngine
    const objectives = KnowledgeObjectiveEngine.createObjectives(
      options.report,
      options.assessment,
      queue,
      effectiveCtx,
      options.completedObjectiveIds || []
    );

    // Pipeline Step 2: StrategyPlanner
    const strategies = StrategyPlanner.createStrategies(objectives, effectiveCtx);

    // Pipeline Step 3: QuestionIntentBuilder
    const intents = QuestionIntentBuilder.createIntents(strategies, effectiveCtx);

    // Pipeline Step 4: QuestionRealizationProvider (Injected)
    const candidates = await provider.realizeIntents(intents, effectiveCtx);

    // Pipeline Step 5: QuestionPlanEvaluator
    const { plan: selectedPlan, summary: evaluationSummary } =
      QuestionPlanEvaluator.evaluateCandidates(candidates, activePolicy, effectiveCtx);

    // Step 6: Assemble Traceability Matrix & Result
    const traceabilityMatrix = selectedPlan.items.map((item) => {
      const candidate = candidates.find((c) => c.candidateId === item.candidateId);
      const intent = intents.find((i) => i.intentId === candidate?.intentId);
      const strategy = strategies.find((s) => s.strategyId === intent?.strategyId);

      return {
        objectiveId: strategy?.objectiveId || 'unknown-objective',
        strategyId: strategy?.strategyId || 'unknown-strategy',
        intentId: intent?.intentId || 'unknown-intent',
        candidateId: item.candidateId,
        domainId: item.domainId,
        coverageRef:
          item.traceability.researchQueueRef ||
          item.traceability.coverageDecisionRef ||
          'unknown-ref',
      };
    });

    const planId = `adaptive-plan-${validCtx.executionId}`;

    return {
      planId,
      objectives,
      strategies,
      intents,
      candidates,
      selectedPlan,
      evaluationSummary,
      traceabilityMatrix,
    };
  }
}

export default AdaptiveQuestionPlanner;
