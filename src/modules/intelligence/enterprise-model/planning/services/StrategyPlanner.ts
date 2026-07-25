import type {
  KnowledgeObjective,
  PlannerExecutionContext,
  QuestionStrategy,
  StrategyApproach,
} from '../domain/types';
import {
  PlanningValidationError,
  validatePlannerExecutionContext,
  validatePlannerPolicy,
  validatePlanningTraceability,
} from '../domain/validation';

export class StrategyPlanner {
  public static createStrategies(
    objectives: KnowledgeObjective[],
    ctx?: PlannerExecutionContext
  ): QuestionStrategy[] {
    const validCtx = validatePlannerExecutionContext(ctx);
    validatePlannerPolicy(validCtx.policy);

    if (!objectives || objectives.length === 0) {
      return [];
    }

    const strategies: QuestionStrategy[] = [];

    objectives.forEach((obj) => {
      if (!validatePlanningTraceability(obj.traceability)) {
        throw new PlanningValidationError(
          `Objective ${obj.objectiveId} lacks valid traceability.`,
          'MISSING_REFERENCES'
        );
      }

      const approaches: StrategyApproach[] =
        obj.priority >= 80 ? ['DEEP_DIVE', 'TOP_DOWN'] : ['BOTTOM_UP', 'LATERAL_VERIFICATION'];

      approaches.forEach((approach) => {
        const strategyId = `strat-${validCtx.executionId}-${obj.objectiveId}-${approach.toLowerCase()}`;
        strategies.push({
          strategyId,
          objectiveId: obj.objectiveId,
          domainId: obj.domainId,
          approach,
          rationale: `Strategic discovery via ${approach} strategy for objective ${obj.objectiveId}`,
          traceability: { ...obj.traceability },
        });
      });
    });

    return strategies;
  }
}

export default StrategyPlanner;
