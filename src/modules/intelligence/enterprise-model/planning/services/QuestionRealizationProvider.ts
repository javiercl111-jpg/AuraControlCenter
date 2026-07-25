import type {
  PlannerExecutionContext,
  QuestionCandidate,
  QuestionIntent,
} from '../domain/types';
import {
  PlanningValidationError,
  validatePlannerExecutionContext,
  validatePlanningTraceability,
} from '../domain/validation';

export interface IQuestionRealizationProvider {
  realizeIntents(
    intents: QuestionIntent[],
    ctx?: PlannerExecutionContext
  ): Promise<QuestionCandidate[]> | QuestionCandidate[];
}

export class DeterministicQuestionRealizationProvider
  implements IQuestionRealizationProvider
{
  public realizeIntents(
    intents: QuestionIntent[],
    ctx?: PlannerExecutionContext
  ): QuestionCandidate[] {
    const validCtx = validatePlannerExecutionContext(ctx);

    if (!intents || intents.length === 0) {
      return [];
    }

    const candidates: QuestionCandidate[] = [];

    intents.forEach((intent) => {
      if (!validatePlanningTraceability(intent.traceability)) {
        throw new PlanningValidationError(
          `Intent ${intent.intentId} lacks valid traceability.`,
          'MISSING_REFERENCES'
        );
      }

      const formattedQuestionText = this.formatQuestionText(
        intent.promptTemplate,
        intent.domainId
      );

      const candidateId = `cand-${validCtx.executionId}-${intent.intentId}-0`;

      candidates.push({
        candidateId,
        intentId: intent.intentId,
        domainId: intent.domainId,
        questionText: formattedQuestionText,
        rationale: `Realized consultative discovery question targeting gap in domain ${intent.domainId}`,
        traceability: { ...intent.traceability },
      });
    });

    return candidates;
  }

  private formatQuestionText(template: string, domain: string): string {
    if (template.includes('${domainId}')) {
      return template.replace(/\$\{domainId\}/g, domain);
    }
    return template;
  }
}

const QuestionRealizationProviderModule = {
  DeterministicQuestionRealizationProvider,
};

export default QuestionRealizationProviderModule;
