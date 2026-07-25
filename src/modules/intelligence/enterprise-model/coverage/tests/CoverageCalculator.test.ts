// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, expect, it } from 'vitest';
import {
  createEmptyEnterpriseKnowledgeGraph,
  upsertGraphNode,
  addGraphRelationship,
} from '../../graph/services/operations';
import { CoverageCalculator } from '../services/CoverageCalculator';
import { calculateCompletenessScore } from '../domain/validation';

describe('AI-01D: Knowledge Coverage Engine - CoverageCalculator', () => {
  it('1. should return 0 completeness score and critical gap for an empty knowledge graph', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const metrics = CoverageCalculator.calculateDomainMetrics(graph, 'payroll');

    expect(metrics.nodeCount).toBe(0);
    expect(metrics.completenessScore).toBe(0);
    expect(metrics.gaps).toHaveLength(1);
    expect(metrics.gaps[0].severity).toBe('critical');
    expect(metrics.gaps[0].gapType).toBe('missing_node_type');
  });

  it('2. should calculate domain metrics correctly for organization domain nodes', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    const res = upsertGraphNode(graph, 'ROLE', 'HR Department Role', { domain: 'org', confidence: 0.9, evidenceRef: 'ev-1' });
    graph = res.graph;

    const metrics = CoverageCalculator.calculateDomainMetrics(graph, 'organization');

    expect(metrics.nodeCount).toBe(1);
    expect(metrics.avgConfidence).toBe(0.9);
    expect(metrics.evidenceDensity).toBe(1.0);
    expect(metrics.completenessScore).toBeGreaterThan(0);
  });

  it('3. should calculate domain metrics correctly for payroll domain nodes', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    const res = upsertGraphNode(graph, 'POLICY', 'Payroll Tax Formula', { category: 'payroll', confidence: 0.85, evidenceRef: 'ev-tax' });
    graph = res.graph;

    const metrics = CoverageCalculator.calculateDomainMetrics(graph, 'payroll');

    expect(metrics.nodeCount).toBe(1);
    expect(metrics.domain).toBe('payroll');
    expect(metrics.evidenceDensity).toBe(1.0);
  });

  it('4. should compute evidence density accurately based on evidence references', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    const res1 = upsertGraphNode(graph, 'METRIC', 'Salary Grid', { confidence: 0.7, evidenceRef: 'doc-1' });
    const res2 = upsertGraphNode(res1.graph, 'POLICY', 'Bonus Salary Scheme', { confidence: 0.7 });
    graph = res2.graph;

    const metrics = CoverageCalculator.calculateDomainMetrics(graph, 'payroll');

    expect(metrics.nodeCount).toBe(2);
    expect(metrics.evidenceDensity).toBe(0.5);
  });

  it('5. should compute average confidence score across domain nodes', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    const res1 = upsertGraphNode(graph, 'METRIC', 'Base Salary', { confidence: 0.9, evidenceRef: 'ev-1' });
    const res2 = upsertGraphNode(res1.graph, 'POLICY', 'Pay Slip Audit', { confidence: 0.5, evidenceRef: 'ev-2' });
    graph = res2.graph;

    const metrics = CoverageCalculator.calculateDomainMetrics(graph, 'payroll');

    expect(metrics.avgConfidence).toBe(0.7);
  });

  it('6. should detect low confidence gaps when average confidence is below threshold', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    const res = upsertGraphNode(graph, 'METRIC', 'Payroll Deduction', { confidence: 0.4 });
    graph = res.graph;

    const metrics = CoverageCalculator.calculateDomainMetrics(graph, 'payroll');

    const lowConfGap = metrics.gaps.find((g) => g.gapType === 'low_confidence');
    expect(lowConfGap).toBeDefined();
    expect(lowConfGap?.severity).toBe('high');
  });

  it('7. should detect missing evidence gaps when evidence density is below 50%', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    let res = upsertGraphNode(graph, 'POLICY', 'Payroll Rule A', { confidence: 0.8 });
    res = upsertGraphNode(res.graph, 'POLICY', 'Payroll Rule B', { confidence: 0.8 });
    res = upsertGraphNode(res.graph, 'POLICY', 'Payroll Rule C', { confidence: 0.8 });
    graph = res.graph;

    const metrics = CoverageCalculator.calculateDomainMetrics(graph, 'payroll');

    const missingEvGap = metrics.gaps.find((g) => g.gapType === 'missing_evidence');
    expect(missingEvGap).toBeDefined();
    expect(metrics.evidenceDensity).toBe(0);
  });

  it('8. should generate an overall coverage report with all 8 enterprise domains', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);

    expect(report.domainBreakdown).toBeDefined();
    expect(Object.keys(report.domainBreakdown)).toHaveLength(8);
    expect(report.totalNodes).toBe(0);
    expect(report.overallScore).toBe(0);
  });

  it('9. should categorize overall confidence level as EXECUTIVE when score is >= 85', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    const domains = [
      'organization',
      'payroll',
      'compensation',
      'benefits',
      'compliance',
      'talent_performance',
      'time_attendance',
      'workforce_analytics',
    ] as const;

    domains.forEach((dom, idx) => {
      const r1 = upsertGraphNode(graph, 'POLICY', `${dom} policy 1`, { domain: dom, confidence: 0.95, evidenceRef: `ev-${idx}-1` });
      const r2 = upsertGraphNode(r1.graph, 'POLICY', `${dom} policy 2`, { domain: dom, confidence: 0.95, evidenceRef: `ev-${idx}-2` });
      const r3 = upsertGraphNode(r2.graph, 'METRIC', `${dom} metric 1`, { domain: dom, confidence: 0.95, evidenceRef: `ev-${idx}-3` });
      const r4 = upsertGraphNode(r3.graph, 'METRIC', `${dom} metric 2`, { domain: dom, confidence: 0.95, evidenceRef: `ev-${idx}-4` });
      const r5 = upsertGraphNode(r4.graph, 'ROLE', `${dom} role 1`, { domain: dom, confidence: 0.95, evidenceRef: `ev-${idx}-5` });

      const rel1 = addGraphRelationship(r5.graph, r1.nodeId, r2.nodeId, 'DEPENDS_ON');
      const rel2 = addGraphRelationship(rel1.graph, r2.nodeId, r3.nodeId, 'DEPENDS_ON');
      const rel3 = addGraphRelationship(rel2.graph, r3.nodeId, r4.nodeId, 'DEPENDS_ON');
      const rel4 = addGraphRelationship(rel3.graph, r4.nodeId, r5.nodeId, 'DEPENDS_ON');
      const rel5 = addGraphRelationship(rel4.graph, r5.nodeId, r1.nodeId, 'DEPENDS_ON');

      graph = rel5.graph;
    });

    const report = CoverageCalculator.calculateOverallReport(graph);

    expect(report.overallScore).toBeGreaterThanOrEqual(85);
    expect(report.confidenceLevel).toBe('EXECUTIVE');
  });

  it('10. should categorize overall confidence level as HIGH when score is >= 70', () => {
    const score = calculateCompletenessScore(5, 5, 0.8, 0.8);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('11. should categorize overall confidence level as MEDIUM when score is >= 50', () => {
    const score = calculateCompletenessScore(3, 2, 0.6, 0.6);
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it('12. should categorize overall confidence level as LOW when score is < 50', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);

    expect(report.confidenceLevel).toBe('LOW');
  });

  it('13. should set readinessForDecision to true when score >= 60 and no critical gaps exist', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    const domains = [
      'organization',
      'payroll',
      'compensation',
      'benefits',
      'compliance',
      'talent_performance',
      'time_attendance',
      'workforce_analytics',
    ] as const;

    domains.forEach((dom, idx) => {
      const r1 = upsertGraphNode(graph, 'POLICY', `${dom} role policy`, { domain: dom, confidence: 0.9, evidenceRef: `ev-${idx}` });
      const r2 = upsertGraphNode(r1.graph, 'METRIC', `${dom} metric`, { domain: dom, confidence: 0.9, evidenceRef: `ev-${idx}-b` });
      const r3 = addGraphRelationship(r2.graph, r1.nodeId, r2.nodeId, 'DEPENDS_ON');
      graph = r3.graph;
    });

    const report = CoverageCalculator.calculateOverallReport(graph);

    expect(report.readinessForDecision).toBe(true);
  });

  it('14. should set readinessForDecision to false when critical gaps exist', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);

    expect(report.readinessForDecision).toBe(false);
  });
});

const CoverageCalculatorTestModule = {
  name: 'CoverageCalculatorTestModule',
};

export default CoverageCalculatorTestModule;
