import type { 
  EvidenceMap, 
  TypedEvidenceLink, 
  AssessmentExecutionContext 
} from '../domain/types';
import type { 
  ExecutiveFinding, 
  EnterpriseRisk, 
  EnterpriseOpportunity, 
  RootCauseHypothesis 
} from '../../reasoning/domain/types';

export class EvidenceMapBuilder {
  public build(
    findings: ExecutiveFinding[],
    risks: EnterpriseRisk[],
    opportunities: EnterpriseOpportunity[],
    rootCauses: RootCauseHypothesis[],
    context: AssessmentExecutionContext
  ): EvidenceMap {
    const links: TypedEvidenceLink[] = [];

    // Map findings
    findings.forEach(finding => {
      finding.chain.claims.forEach(claim => {
        // Link FINDING to CLAIM
        links.push({
          sourceId: finding.findingId,
          sourceType: 'FINDING',
          targetId: claim.claimId,
          targetType: 'CLAIM'
        });

        claim.evidenceSupports.forEach(support => {
          // Link CLAIM to EVIDENCE
          links.push({
            sourceId: claim.claimId,
            sourceType: 'CLAIM',
            targetId: support.evidenceRef,
            targetType: 'EVIDENCE',
            description: support.rationale
          });
        });
      });
    });

    // Map Risks
    risks.forEach(risk => {
      risk.chain.claims.forEach(claim => {
        links.push({
          sourceId: risk.findingId,
          sourceType: 'RISK',
          targetId: claim.claimId,
          targetType: 'CLAIM'
        });
        // Risk claims link to evidence handled below or similar to findings.
        claim.evidenceSupports.forEach(support => {
          links.push({
            sourceId: claim.claimId,
            sourceType: 'CLAIM',
            targetId: support.evidenceRef,
            targetType: 'EVIDENCE',
            description: support.rationale
          });
        });
      });
    });

    // Map Opportunities
    opportunities.forEach(opp => {
      opp.chain.claims.forEach(claim => {
        links.push({
          sourceId: opp.findingId,
          sourceType: 'OPPORTUNITY',
          targetId: claim.claimId,
          targetType: 'CLAIM'
        });
        claim.evidenceSupports.forEach(support => {
          links.push({
            sourceId: claim.claimId,
            sourceType: 'CLAIM',
            targetId: support.evidenceRef,
            targetType: 'EVIDENCE',
            description: support.rationale
          });
        });
      });
    });

    // Map Root Causes
    rootCauses.forEach(rc => {
      // Link ROOT CAUSE to FINDINGS
      rc.relatedFindings.forEach(rfId => {
        links.push({
          sourceId: rc.findingId,
          sourceType: 'ROOT_CAUSE_HYPOTHESIS',
          targetId: rfId,
          targetType: 'FINDING'
        });
      });
      
      rc.chain.claims.forEach(claim => {
        links.push({
          sourceId: rc.findingId,
          sourceType: 'ROOT_CAUSE_HYPOTHESIS',
          targetId: claim.claimId,
          targetType: 'CLAIM'
        });
        claim.evidenceSupports.forEach(support => {
          links.push({
            sourceId: claim.claimId,
            sourceType: 'CLAIM',
            targetId: support.evidenceRef,
            targetType: 'EVIDENCE',
            description: support.rationale
          });
        });
      });
    });

    // Remove exact duplicates
    const uniqueLinks: TypedEvidenceLink[] = [];
    const linkKeys = new Set<string>();

    links.forEach(link => {
      const key = `${link.sourceId}-${link.sourceType}-${targetIdStr(link.targetId)}-${link.targetType}`;
      if (!linkKeys.has(key)) {
        linkKeys.add(key);
        uniqueLinks.push(link);
      }
    });

    const mapId = context.generateDeterministicId({
      executionId: context.executionId,
      policyVersion: context.policyVersion,
      references: uniqueLinks.map(l => l.sourceId + l.targetId),
      content: 'EvidenceMap'
    });

    return {
      mapId,
      links: uniqueLinks
    };
  }
}

function targetIdStr(targetId: string | undefined): string {
  return targetId || '';
}
