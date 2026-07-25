import type { ExecutiveReasoningReport } from '../../reasoning/domain/types';

export class ContextValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextValidationError';
  }
}

export function validateReasoningReport(report: unknown): report is ExecutiveReasoningReport {
  if (!report || typeof report !== 'object') {
    throw new ContextValidationError('Report must be an object');
  }

  const r = report as Record<string, unknown>;
  
  if (typeof r.reportId !== 'string' || !r.reportId.trim()) {
    throw new ContextValidationError('Invalid or missing reportId');
  }

  if (typeof r.timestamp !== 'string') {
    throw new ContextValidationError('Invalid or missing timestamp');
  }

  if (typeof r.overallStatus !== 'string') {
    throw new ContextValidationError('Invalid or missing overallStatus');
  }

  if (!Array.isArray(r.findings)) {
    throw new ContextValidationError('findings must be an array');
  }

  if (!Array.isArray(r.risks)) {
    throw new ContextValidationError('risks must be an array');
  }

  if (!Array.isArray(r.opportunities)) {
    throw new ContextValidationError('opportunities must be an array');
  }

  if (!Array.isArray(r.rootCauses)) {
    throw new ContextValidationError('rootCauses must be an array');
  }

  if (!Array.isArray(r.rejectedClaims)) {
    throw new ContextValidationError('rejectedClaims must be an array');
  }

  // Basic check for contents could be added, but this is a fail-closed structural check.
  // We assume the upstream engine guarantees the content structure if it's an array.
  
  return true;
}

export default validateReasoningReport;
