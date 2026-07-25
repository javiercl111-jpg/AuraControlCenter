import type {
  OverallCoverageReport,
  DecisionReadinessAssessment,
} from '../../coverage/domain/types';
import { CoverageAdapter } from '../domain/adapters';
import type {
  KnowledgeObjective,
  PlannerExecutionContext,
  ResearchQueue,
} from '../domain/types';
import {
  PlanningValidationError,
  validatePlannerExecutionContext,
  validatePlannerPolicy,
} from '../domain/validation';

export class KnowledgeObjectiveEngine {
  public static createObjectives(
    report: OverallCoverageReport,
    assessment?: DecisionReadinessAssessment,
    queue?: ResearchQueue,
    ctx?: PlannerExecutionContext,
    completedObjectiveIds: string[] = []
  ): KnowledgeObjective[] {
    const validCtx = validatePlannerExecutionContext(ctx);
    validatePlannerPolicy(validCtx.policy);

    const activeQueue = queue || CoverageAdapter.buildResearchQueue(report, assessment);

    if (!activeQueue.items || activeQueue.items.length === 0) {
      if (report.criticalGaps.length === 0 && (!assessment || assessment.isReady)) {
        return [];
      }
      throw new PlanningValidationError(
        'ResearchQueue missing valid traceable items for objectives formulation.',
        'MISSING_REFERENCES'
      );
    }

    const objectives: KnowledgeObjective[] = [];

    activeQueue.items.forEach((item, index) => {
      const objectiveId = `obj-${validCtx.executionId}-${item.domain}-${index}`;

      if (completedObjectiveIds.includes(objectiveId)) {
        return; // skip completed objective
      }

      if (!item.domain || (!item.sourceGapId && !item.id)) {
        throw new PlanningValidationError(
          `Traceability reference missing for gap item in domain ${item.domain}`,
          'MISSING_REFERENCES'
        );
      }

      objectives.push({
        objectiveId,
        domainId: item.domain,
        description: `Verify and complete operational domain knowledge for ${item.domain}: ${item.description}`,
        priority: item.priorityScore,
        status: 'PENDING',
        traceability: {
          domainId: item.domain,
          coverageDecisionRef: assessment?.targetScenario
            ? `assessment-${assessment.targetScenario}`
            : undefined,
          researchQueueRef: item.id,
          sourceGapId: item.sourceGapId,
        },
      });
    });

    return objectives;
  }
}

export default KnowledgeObjectiveEngine;
