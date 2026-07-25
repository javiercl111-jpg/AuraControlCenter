import type { 
  ExecutiveReasoningReport, 
  ExecutiveFinding,
  EnterpriseRisk,
  EnterpriseOpportunity,
  RootCauseHypothesis
} from '../../reasoning/domain/types';
import type { DossierStatus, DiagnosticAudit } from '../domain/types';
import { validateReasoningReport } from '../utils/validators';

export interface DiagnosticContext {
  report: ExecutiveReasoningReport;
  status: DossierStatus;
  blocks: string[];
  findings: ExecutiveFinding[];
  risks: EnterpriseRisk[];
  opportunities: EnterpriseOpportunity[];
  rootCauses: RootCauseHypothesis[];
  audit: DiagnosticAudit;
}

export class DiagnosticContextBuilder {
  public build(report: unknown): DiagnosticContext {
    // 1. Fail-closed schema validation
    if (!validateReasoningReport(report)) {
      throw new Error('Unreachable: Validator should throw');
    }

    let status: DossierStatus = 'VALID';
    const blocks: string[] = [];

    // 2. Evaluate defense / coverage
    if (report.overallStatus === 'NOT_DEFENDABLE' || report.overallStatus === 'REQUIRES_MORE_EVIDENCE') {
      status = 'INSUFFICIENT_EVIDENCE';
      blocks.push(`Report overall status is ${report.overallStatus}`);
    }

    if (report.readinessGaps && report.readinessGaps.length > 0) {
      status = 'INSUFFICIENT_EVIDENCE';
      blocks.push(`Report has readiness gaps: ${report.readinessGaps.join(', ')}`);
    }

    // 3. Extract and filter entities
    // Constraint 5: Exclude rejectedClaims from synthesis, preserve in audit
    const audit: DiagnosticAudit = {
      rejectedClaims: report.rejectedClaims.map(claim => ({
        claim,
        reason: 'Rejected during reasoning phase'
      }))
    };

    return {
      report,
      status,
      blocks,
      findings: report.findings,
      risks: report.risks,
      opportunities: report.opportunities,
      rootCauses: report.rootCauses,
      audit
    };
  }
}

export default DiagnosticContextBuilder;
