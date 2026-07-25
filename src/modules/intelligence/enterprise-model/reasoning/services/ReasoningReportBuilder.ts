import type {
  ExecutiveFinding,
  EnterpriseRisk,
  EnterpriseOpportunity,
  RootCauseHypothesis,
  ReasoningClaim,
  ExecutiveReasoningReport,
  ReasoningExecutionContext,
} from '../domain/types';

export class ReasoningReportBuilder {
  public static build(
    findings: ExecutiveFinding[],
    risks: EnterpriseRisk[],
    opportunities: EnterpriseOpportunity[],
    rootCauses: RootCauseHypothesis[],
    rejectedClaims: ReasoningClaim[],
    executionContext: ReasoningExecutionContext
  ): ExecutiveReasoningReport {
    // Determine overall status
    let overallStatus: ExecutiveReasoningReport['overallStatus'] = 'REQUIRES_MORE_EVIDENCE';
    
    const allItems = [...findings, ...risks, ...opportunities, ...rootCauses];
    if (allItems.length > 0) {
      const allSupported = allItems.every((i) => i.status === 'SUPPORTED_FINDING');
      if (allSupported) {
        overallStatus = 'SUPPORTED_FINDING';
      } else {
        overallStatus = 'PARTIALLY_SUPPORTED';
      }
    }

    // Explicit check for contradicted items which might override overall status
    const hasContradicted = allItems.some((i) => i.status === 'CONTRADICTED');
    if (hasContradicted) {
      overallStatus = 'CONTRADICTED';
    }

    return {
      reportId: `report-${executionContext.executionId}`,
      timestamp: executionContext.timestamp,
      overallStatus,
      findings,
      risks,
      opportunities,
      rootCauses,
      rejectedClaims,
      readinessGaps: [],
    };
  }
}

export default ReasoningReportBuilder;
