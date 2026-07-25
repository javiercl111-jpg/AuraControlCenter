import type {
  OverallCoverageReport,
  DecisionReadinessAssessment,
  CoverageDomain,
  CoverageGap,
} from '../../coverage/domain/types';
import type { ResearchQueue, ResearchQueueItem } from './types';

export class CoverageAdapter {
  public static buildResearchQueue(
    report: OverallCoverageReport,
    assessment?: DecisionReadinessAssessment
  ): ResearchQueue {
    const items: ResearchQueueItem[] = [];
    const priorityDomainsSet = new Set<CoverageDomain>();

    const gaps: CoverageGap[] = [...report.criticalGaps];
    if (assessment && assessment.blockingGaps) {
      assessment.blockingGaps.forEach((bg) => {
        if (!gaps.some((g) => g.id === bg.id)) {
          gaps.push(bg);
        }
      });
    }

    if (gaps.length === 0 && report.domainBreakdown) {
      Object.values(report.domainBreakdown).forEach((db) => {
        if (db && db.gaps) {
          db.gaps.forEach((g) => gaps.push(g));
        }
      });
    }

    gaps.forEach((gap, index) => {
      priorityDomainsSet.add(gap.domain);
      let score = 50;
      if (gap.severity === 'critical') score = 100;
      else if (gap.severity === 'high') score = 80;
      else if (gap.severity === 'medium') score = 60;
      else if (gap.severity === 'low') score = 40;

      items.push({
        id: `rq-${gap.domain}-${index}`,
        domain: gap.domain,
        sourceGapId: gap.id,
        description: gap.description,
        recommendedAction: gap.recommendedAction,
        priorityScore: score,
      });
    });

    const recommendedQuestions = assessment?.recommendedQuestions || [];

    return {
      items,
      priorityDomains: Array.from(priorityDomainsSet),
      recommendedQuestions,
    };
  }
}

export default CoverageAdapter;
