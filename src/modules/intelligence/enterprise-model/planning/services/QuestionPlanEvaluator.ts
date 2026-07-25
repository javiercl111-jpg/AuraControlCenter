import type {
  EvaluationSummary,
  PlannerExecutionContext,
  PlannerPolicy,
  QuestionCandidate,
  QuestionPlan,
  QuestionPlanItem,
} from '../domain/types';
import {
  calculateJaccardSimilarity,
  PlanningValidationError,
  validatePlannerExecutionContext,
  validatePlannerPolicy,
  validatePlanningTraceability,
} from '../domain/validation';

export class QuestionPlanEvaluator {
  public static evaluateCandidates(
    candidates: QuestionCandidate[],
    policy?: PlannerPolicy,
    ctx?: PlannerExecutionContext
  ): { plan: QuestionPlan; summary: EvaluationSummary } {
    const validCtx = validatePlannerExecutionContext(ctx);
    const activePolicy = validatePlannerPolicy(policy || validCtx.policy);

    if (!candidates) {
      throw new PlanningValidationError(
        'Absence of candidates for evaluation.',
        'NO_VALID_CANDIDATES'
      );
    }

    let rejectedUntraceableCandidates = 0;
    let rejectedClosedCandidates = 0;
    let rejectedDuplicateCandidates = 0;

    const acceptedItems: QuestionPlanItem[] = [];

    candidates.forEach((candidate, index) => {
      // 1. Traceability Check (Fail-Closed)
      if (!validatePlanningTraceability(candidate.traceability)) {
        rejectedUntraceableCandidates++;
        return; // reject untraceable candidate
      }

      // 2. Closed Question Policy Check
      const isClosedText =
        candidate.questionText.trim().toLowerCase().startsWith('is ') ||
        candidate.questionText.trim().toLowerCase().startsWith('are ') ||
        candidate.questionText.trim().toLowerCase().startsWith('does ');

      if (!activePolicy.allowClosedQuestions && isClosedText) {
        rejectedClosedCandidates++;
        return;
      }

      // 3. Jaccard Lexical Deduplication
      const isDuplicate = acceptedItems.some((accepted) => {
        const sim = calculateJaccardSimilarity(
          candidate.questionText,
          accepted.questionText
        );
        return sim >= activePolicy.jaccardThreshold;
      });

      if (isDuplicate) {
        rejectedDuplicateCandidates++;
        return;
      }

      // 4. Max limit check
      if (acceptedItems.length >= activePolicy.maxQuestionsPerPlan) {
        return;
      }

      const itemId = `item-${validCtx.executionId}-${index}`;

      acceptedItems.push({
        itemId,
        candidateId: candidate.candidateId,
        domainId: candidate.domainId,
        questionText: candidate.questionText,
        priority: 100 - acceptedItems.length * 10,
        traceability: { ...candidate.traceability },
      });
    });

    if (acceptedItems.length === 0) {
      throw new PlanningValidationError(
        'Absence of valid candidates after fail-closed evaluation.',
        'NO_VALID_CANDIDATES'
      );
    }

    const planId = `plan-${validCtx.executionId}`;

    const traceabilityMatrix = acceptedItems.map((item) => ({
      candidateId: item.candidateId,
      domainId: item.domainId,
      coverageDecisionRef: item.traceability.coverageDecisionRef,
      researchQueueRef: item.traceability.researchQueueRef,
    }));

    const summary: EvaluationSummary = {
      totalCandidates: candidates.length,
      selectedCandidates: acceptedItems.length,
      rejectedDuplicateCandidates,
      rejectedClosedCandidates,
      rejectedUntraceableCandidates,
    };

    const plan: QuestionPlan = {
      planId,
      items: acceptedItems,
      timestamp: validCtx.timestamp,
      totalQuestions: acceptedItems.length,
      evaluatedCandidateCount: candidates.length,
      traceabilityMatrix,
    };

    return { plan, summary };
  }
}

export default QuestionPlanEvaluator;
