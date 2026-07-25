import type {
  ExecutiveReasoningContext,
  ExecutiveReasoningReport,
  ReasoningExecutionContext,
} from '../domain/types';
import type { ReasoningPolicy } from '../policies/ReasoningPolicy';

export class ReasoningContextBuilder {
  /**
   * Validates the context before reasoning begins.
   * As per requirements, if coverage is insufficient, it doesn't throw an exception,
   * but rather returns a pre-built REQUIRES_MORE_EVIDENCE report.
   * If valid, it returns the Context to continue the pipeline.
   */
  public static validateOrReject(
    context: ExecutiveReasoningContext,
    policy: ReasoningPolicy,
    executionContext: ReasoningExecutionContext
  ): { valid: true; context: ExecutiveReasoningContext } | { valid: false; fallbackReport: ExecutiveReasoningReport } {
    
    let isCoverageSufficient = true;
    const blockingReasons: string[] = [];

    // Check overall score
    if (context.coverageReport.overallScore < policy.failClosedOnCoverageScore) {
      isCoverageSufficient = false;
      blockingReasons.push(`Overall coverage score (${context.coverageReport.overallScore}) is below policy threshold (${policy.failClosedOnCoverageScore})`);
    }

    // Check decision readiness blocking gaps
    if (context.decisionAssessment && context.decisionAssessment.blockingGaps && context.decisionAssessment.blockingGaps.length > 0) {
      if (policy.failClosedOnMissingEntities) {
        isCoverageSufficient = false;
        blockingReasons.push(`There are ${context.decisionAssessment.blockingGaps.length} blocking gaps in decision assessment`);
      }
    }

    if (!isCoverageSufficient) {
      const fallbackReport: ExecutiveReasoningReport = {
        reportId: `err-${executionContext.executionId}`,
        timestamp: executionContext.timestamp,
        overallStatus: 'REQUIRES_MORE_EVIDENCE',
        findings: [],
        risks: [],
        opportunities: [],
        rootCauses: [],
        rejectedClaims: [],
        readinessGaps: blockingReasons,
      };

      return {
        valid: false,
        fallbackReport,
      };
    }

    return {
      valid: true,
      context,
    };
  }
}

export default ReasoningContextBuilder;
