import type {
  ReasoningClaim,
  ExecutiveReasoningContext,
  ExecutiveFinding,
  EnterpriseRisk,
  EnterpriseOpportunity,
  ReasoningExecutionContext,
} from '../domain/types';
import type { ReasoningPolicy } from '../policies/ReasoningPolicy';

export class FindingSynthesizer {
  /**
   * Converts highly supported claims into Findings, Risks, and Opportunities.
   */
  public static synthesize(
    claims: ReasoningClaim[],
    context: ExecutiveReasoningContext,
    policy: ReasoningPolicy,
    executionContext: ReasoningExecutionContext
  ): {
    findings: ExecutiveFinding[];
    risks: EnterpriseRisk[];
    opportunities: EnterpriseOpportunity[];
    rejectedClaims: ReasoningClaim[];
  } {
    const findings: ExecutiveFinding[] = [];
    const risks: EnterpriseRisk[] = [];
    const opportunities: EnterpriseOpportunity[] = [];
    const rejectedClaims: ReasoningClaim[] = [];

    let findingIdx = 0;
    let riskIdx = 0;
    let oppIdx = 0;

    for (const claim of claims) {
      if (claim.status === 'NOT_DEFENDABLE' || claim.status === 'CONTRADICTED') {
        rejectedClaims.push(claim);
        continue;
      }

      // Check if it's related to a Risk
      let isRisk = false;
      let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
      for (const nodeId of claim.sourceNodes) {
        const node = context.knowledgeGraph.nodes[nodeId];
        if (node && node.type === 'RISK') {
          isRisk = true;
          if (node.properties.severity) {
            const rawSev = (node.properties.severity as string).toUpperCase();
            if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(rawSev)) {
              severity = rawSev as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
            }
          }
          break;
        }
      }

      if (isRisk) {
        if (policy.requireDirectEvidenceForRisks && claim.confidence.directness < 1.0) {
          claim.status = 'REQUIRES_MORE_EVIDENCE'; // Demote if policy fails
        }
        
        if (claim.status === 'SUPPORTED_FINDING' || claim.status === 'PARTIALLY_SUPPORTED') {
          risks.push({
            findingId: `risk-${executionContext.executionId}-${riskIdx++}`,
            statement: claim.statement,
            type: 'RISK',
            status: claim.status,
            confidence: { ...claim.confidence },
            severity,
            impactArea: 'General', // Would be derived from node
            chain: {
              chainId: `chain-risk-${riskIdx}`,
              claims: [claim],
              logicDescription: 'Risk derived from Knowledge Graph node.',
            },
          });
        } else {
          rejectedClaims.push(claim);
        }
        continue;
      }

      // Check if it's related to an Opportunity (or Objective/Capability Gap)
      let isOpportunity = false;
      for (const nodeId of claim.sourceNodes) {
        const node = context.knowledgeGraph.nodes[nodeId];
        if (node && (node.type === 'OBJECTIVE' || node.type === 'CAPABILITY')) {
          isOpportunity = true;
          break;
        }
      }

      if (isOpportunity) {
        if (!policy.allowInferenceForOpportunities && claim.confidence.directness < 1.0) {
          claim.status = 'REQUIRES_MORE_EVIDENCE';
        }
        
        if (claim.status === 'SUPPORTED_FINDING' || claim.status === 'PARTIALLY_SUPPORTED') {
          opportunities.push({
            findingId: `opp-${executionContext.executionId}-${oppIdx++}`,
            statement: claim.statement,
            type: 'OPPORTUNITY',
            status: claim.status,
            confidence: { ...claim.confidence },
            potentialValue: 'Medium',
            effort: 'Medium',
            chain: {
              chainId: `chain-opp-${oppIdx}`,
              claims: [claim],
              logicDescription: 'Opportunity derived from Knowledge Graph node.',
            },
          });
        } else {
          rejectedClaims.push(claim);
        }
        continue;
      }

      // Generic Finding
      if (claim.status === 'SUPPORTED_FINDING' || claim.status === 'PARTIALLY_SUPPORTED') {
        findings.push({
          findingId: `finding-${executionContext.executionId}-${findingIdx++}`,
          statement: claim.statement,
          type: 'FINDING',
          status: claim.status,
          confidence: { ...claim.confidence },
          chain: {
            chainId: `chain-find-${findingIdx}`,
            claims: [claim],
            logicDescription: 'General finding derived from enterprise model.',
          },
        });
      } else {
        rejectedClaims.push(claim);
      }
    }

    return { findings, risks, opportunities, rejectedClaims };
  }
}

export default FindingSynthesizer;
