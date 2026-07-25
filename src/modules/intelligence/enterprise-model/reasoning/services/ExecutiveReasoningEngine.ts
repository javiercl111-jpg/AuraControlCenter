import type { ExecutiveReasoningContext, ExecutiveReasoningReport, ReasoningExecutionContext } from '../domain/types';
import type { ReasoningPolicy } from '../policies/ReasoningPolicy';
import ReasoningContextBuilder from './ReasoningContextBuilder';
import ClaimGenerator from './ClaimGenerator';
import EvidenceEvaluator from './EvidenceEvaluator';
import ContradictionResolver from './ContradictionResolver';
import RootCauseAnalyzer from './RootCauseAnalyzer';
import FindingSynthesizer from './FindingSynthesizer';
import ReasoningReportBuilder from './ReasoningReportBuilder';

export class ExecutiveReasoningEngine {
  private policy: ReasoningPolicy;

  constructor(policy: ReasoningPolicy) {
    this.policy = policy;
  }

  public execute(
    context: ExecutiveReasoningContext,
    executionContext: ReasoningExecutionContext
  ): ExecutiveReasoningReport {
    // 1. Validation and Context Building
    const validation = ReasoningContextBuilder.validateOrReject(context, this.policy, executionContext);
    if (!validation.valid) {
      return validation.fallbackReport; // Fail-closed early if not ready
    }

    const validContext = validation.context;

    // 2. Generate Claims
    const rawClaims = ClaimGenerator.generateCandidates(validContext, executionContext);

    // 3. Evaluate Evidence
    const evaluatedClaims = EvidenceEvaluator.evaluate(rawClaims, validContext, this.policy);

    // 4. Resolve Contradictions
    const resolvedClaims = ContradictionResolver.resolve(evaluatedClaims, validContext, this.policy);

    // 5. Analyze Root Causes
    const rootCauseAnalysis = RootCauseAnalyzer.analyze(resolvedClaims, validContext, this.policy, executionContext);

    // 6. Synthesize Findings
    const synthesis = FindingSynthesizer.synthesize(
      rootCauseAnalysis.updatedClaims,
      validContext,
      this.policy,
      executionContext
    );

    // 7. Build Report
    const report = ReasoningReportBuilder.build(
      synthesis.findings,
      synthesis.risks,
      synthesis.opportunities,
      rootCauseAnalysis.rootCauses,
      synthesis.rejectedClaims,
      executionContext
    );

    return report;
  }
}

export default ExecutiveReasoningEngine;
