import type { EnterpriseMentalModel } from '../../domain/types';
import type { EnterpriseKnowledgeGraph, GraphNode } from '../../graph/domain/types';
import type {
  CoverageDomain,
  CoverageGap,
  DomainCoverageMetrics,
  OverallCoverageReport,
} from '../domain/types';
import {
  calculateCompletenessScore,
  categorizeGapSeverity,
} from '../domain/validation';

export const ALL_COVERAGE_DOMAINS: CoverageDomain[] = [
  'organization',
  'payroll',
  'compensation',
  'benefits',
  'compliance',
  'talent_performance',
  'time_attendance',
  'workforce_analytics',
];

export class CoverageCalculator {
  public static calculateDomainMetrics(
    graph: EnterpriseKnowledgeGraph,
    domain: CoverageDomain
  ): DomainCoverageMetrics {
    const nodes = Object.values(graph.nodes).filter((node) =>
      this.isNodeInDomain(node, domain)
    );

    const nodeIds = new Set(nodes.map((n) => n.id));
    const relationships = Object.values(graph.relationships).filter(
      (rel) => nodeIds.has(rel.sourceId) || nodeIds.has(rel.targetId)
    );

    const nodeCount = nodes.length;
    const relationshipCount = relationships.length;

    if (nodeCount === 0) {
      return {
        domain,
        nodeCount: 0,
        relationshipCount: 0,
        confirmedEntitiesRatio: 0,
        evidenceDensity: 0,
        avgConfidence: 0,
        completenessScore: 0,
        gaps: [
          {
            id: `gap-${domain}-missing`,
            domain,
            gapType: 'missing_node_type',
            severity: 'critical',
            description: `No data nodes found for enterprise domain: ${domain}`,
            recommendedAction: `Extract evidence related to ${domain}`,
          },
        ],
      };
    }

    const nodeEvidenceCount = nodes.filter((n) => {
      const propEv = n.properties?.evidenceRef || n.properties?.hasEvidence;
      const hasPropEv = Boolean(propEv);
      const relEv = relationships.some(
        (r) => (r.sourceId === n.id || r.targetId === n.id) && r.evidenceRefs && r.evidenceRefs.length > 0
      );
      return hasPropEv || relEv || n.status === 'CONFIRMED';
    }).length;

    const evidenceDensity = nodeEvidenceCount / nodeCount;

    const totalConfidence = nodes.reduce((sum, n) => {
      let score = 0.5;
      if (typeof n.properties?.confidence === 'number') {
        score = n.properties.confidence as number;
      } else if (n.status === 'CONFIRMED') {
        score = 0.9;
      } else if (n.status === 'CANDIDATE') {
        score = 0.6;
      } else if (n.status === 'CONTRADICTED' || n.status === 'REJECTED') {
        score = 0.0;
      }
      return sum + score;
    }, 0);

    const avgConfidence = totalConfidence / nodeCount;

    const confirmedNodes = nodes.filter((n) => n.status === 'CONFIRMED' || (n.properties?.confidence && (n.properties.confidence as number) >= 0.8));
    const confirmedEntitiesRatio = confirmedNodes.length / nodeCount;

    const completenessScore = calculateCompletenessScore(
      nodeCount,
      relationshipCount,
      avgConfidence,
      evidenceDensity
    );

    const gaps: CoverageGap[] = [];

    if (avgConfidence < 0.6) {
      gaps.push({
        id: `gap-${domain}-low-conf`,
        domain,
        gapType: 'low_confidence',
        severity: categorizeGapSeverity('low_confidence', avgConfidence),
        description: `Average confidence score in ${domain} is low (${(avgConfidence * 100).toFixed(0)}%)`,
        recommendedAction: `Gather verified operational evidence for ${domain}`,
      });
    }

    if (evidenceDensity < 0.5) {
      gaps.push({
        id: `gap-${domain}-low-evidence`,
        domain,
        gapType: 'missing_evidence',
        severity: categorizeGapSeverity('missing_evidence', avgConfidence),
        description: `Evidence density in ${domain} is low (${(evidenceDensity * 100).toFixed(0)}%)`,
        recommendedAction: `Attach explicit documents or conversational evidence to ${domain} entities`,
      });
    }

    return {
      domain,
      nodeCount,
      relationshipCount,
      confirmedEntitiesRatio,
      evidenceDensity,
      avgConfidence,
      completenessScore,
      gaps,
    };
  }

  public static calculateOverallReport(
    graph: EnterpriseKnowledgeGraph,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _model?: EnterpriseMentalModel
  ): OverallCoverageReport {
    const domainBreakdown: Record<CoverageDomain, DomainCoverageMetrics> = {} as Record<
      CoverageDomain,
      DomainCoverageMetrics
    >;
    let totalScore = 0;
    const allGaps: CoverageGap[] = [];

    ALL_COVERAGE_DOMAINS.forEach((domain) => {
      const metrics = this.calculateDomainMetrics(graph, domain);
      domainBreakdown[domain] = metrics;
      totalScore += metrics.completenessScore;
      allGaps.push(...metrics.gaps);
    });

    const overallScore = Math.round(totalScore / ALL_COVERAGE_DOMAINS.length);
    const criticalGaps = allGaps.filter(
      (g) => g.severity === 'critical' || g.severity === 'high'
    );

    let confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXECUTIVE' = 'LOW';
    if (overallScore >= 85) confidenceLevel = 'EXECUTIVE';
    else if (overallScore >= 70) confidenceLevel = 'HIGH';
    else if (overallScore >= 50) confidenceLevel = 'MEDIUM';

    const totalNodes = Object.keys(graph.nodes).length;
    const totalRelationships = Object.keys(graph.relationships).length;

    return {
      timestamp: new Date().toISOString(),
      totalNodes,
      totalRelationships,
      overallScore,
      confidenceLevel,
      domainBreakdown,
      criticalGaps,
      readinessForDecision: overallScore >= 60 && criticalGaps.length === 0,
    };
  }

  private static isNodeInDomain(node: GraphNode, domain: CoverageDomain): boolean {
    const text = `${node.label} ${node.type} ${JSON.stringify(node.properties)}`.toLowerCase();

    switch (domain) {
      case 'organization':
        return (
          text.includes('org') ||
          text.includes('department') ||
          text.includes('role') ||
          text.includes('structure') ||
          text.includes('headcount')
        );
      case 'payroll':
        return (
          text.includes('pay') ||
          text.includes('nomina') ||
          text.includes('salary') ||
          text.includes('tax') ||
          text.includes('deduction')
        );
      case 'compensation':
        return (
          text.includes('comp') ||
          text.includes('bonus') ||
          text.includes('incentive') ||
          text.includes('equity')
        );
      case 'benefits':
        return (
          text.includes('benefit') ||
          text.includes('health') ||
          text.includes('insurance') ||
          text.includes('pension')
        );
      case 'compliance':
        return (
          text.includes('compliance') ||
          text.includes('legal') ||
          text.includes('policy') ||
          text.includes('audit')
        );
      case 'talent_performance':
        return (
          text.includes('performance') ||
          text.includes('talent') ||
          text.includes('review') ||
          text.includes('kpi')
        );
      case 'time_attendance':
        return (
          text.includes('time') ||
          text.includes('attendance') ||
          text.includes('shift') ||
          text.includes('leave')
        );
      case 'workforce_analytics':
        return (
          text.includes('metric') ||
          text.includes('analytics') ||
          text.includes('turnover')
        );
      default:
        return false;
    }
  }
}

export default CoverageCalculator;
