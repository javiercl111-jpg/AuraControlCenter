import type {
  PlannerExecutionContext,
  QuestionIntent,
  QuestionStrategy,
} from '../domain/types';
import {
  PlanningValidationError,
  validatePlannerExecutionContext,
  validatePlannerPolicy,
  validatePlanningTraceability,
} from '../domain/validation';

export class QuestionIntentBuilder {
  public static createIntents(
    strategies: QuestionStrategy[],
    ctx?: PlannerExecutionContext
  ): QuestionIntent[] {
    const validCtx = validatePlannerExecutionContext(ctx);
    const policy = validatePlannerPolicy(validCtx.policy);

    if (!strategies || strategies.length === 0) {
      return [];
    }

    const intents: QuestionIntent[] = [];

    strategies.forEach((strat) => {
      if (!validatePlanningTraceability(strat.traceability)) {
        throw new PlanningValidationError(
          `Strategy ${strat.strategyId} lacks valid traceability.`,
          'MISSING_REFERENCES'
        );
      }

      const openTemplates = [
        `What primary policies, data sources, and operational rules define ${strat.domainId} governance within the enterprise?`,
        `How are responsibilities, validation workflows, and system dependencies structured across ${strat.domainId}?`,
      ];

      const closedTemplate = `Is the explicit configuration and verification status for ${strat.domainId} documented and active?`;

      openTemplates.forEach((promptTemplate, index) => {
        const intentId = `intent-${validCtx.executionId}-${strat.strategyId}-${index}`;
        intents.push({
          intentId,
          strategyId: strat.strategyId,
          domainId: strat.domainId,
          promptTemplate,
          targetGapType: 'domain_coverage_gap',
          isClosed: false,
          traceability: { ...strat.traceability },
        });
      });

      if (policy.allowClosedQuestions) {
        const intentId = `intent-${validCtx.executionId}-${strat.strategyId}-closed`;
        intents.push({
          intentId,
          strategyId: strat.strategyId,
          domainId: strat.domainId,
          promptTemplate: closedTemplate,
          targetGapType: 'domain_verification_gap',
          isClosed: true,
          traceability: { ...strat.traceability },
        });
      }
    });

    return intents;
  }
}

export default QuestionIntentBuilder;
