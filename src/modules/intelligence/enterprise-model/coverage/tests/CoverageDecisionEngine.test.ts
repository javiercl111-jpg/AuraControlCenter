// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, expect, it } from 'vitest';
import {
  createEmptyEnterpriseKnowledgeGraph,
  upsertGraphNode,
  addGraphRelationship,
} from '../../graph/services/operations';
import { CoverageCalculator } from '../services/CoverageCalculator';
import { CoverageDecisionEngine } from '../services/CoverageDecisionEngine';
import { validateCoverageScore, assertCoverageReportValid } from '../domain/validation';

describe('AI-01D: Knowledge Coverage Engine - CoverageDecisionEngine', () => {
  it('15. should evaluate decision readiness for payroll audit scenario with sufficient coverage', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    const payrollDomains = ['payroll', 'organization', 'compliance'] as const;

    payrollDomains.forEach((dom, idx) => {
      const r1 = upsertGraphNode(graph, 'POLICY', `${dom} role policy`, { domain: dom, confidence: 0.9, evidenceRef: `ev-${idx}` });
      const r2 = upsertGraphNode(r1.graph, 'METRIC', `${dom} metric`, { domain: dom, confidence: 0.9, evidenceRef: `ev-${idx}-b` });
      const r3 = addGraphRelationship(r2.graph, r1.nodeId, r2.nodeId, 'DEPENDS_ON');
      graph = r3.graph;
    });

    const otherDomains = [
      'compensation',
      'benefits',
      'talent_performance',
      'time_attendance',
      'workforce_analytics',
    ] as const;
    otherDomains.forEach((dom, idx) => {
      const res = upsertGraphNode(graph, 'ENTITY', `${dom} node`, { domain: dom, confidence: 0.8, evidenceRef: `ev-oth-${idx}` });
      graph = res.graph;
    });

    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      graph,
      'payroll_audit'
    );

    expect(assessment.targetScenario).toBe('payroll_audit');
    expect(assessment.score).toBeGreaterThan(0);
  });

  it('16. should evaluate decision readiness for payroll audit scenario with missing payroll domain', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      graph,
      'payroll_audit'
    );

    expect(assessment.isReady).toBe(false);
    expect(assessment.blockingGaps.length).toBeGreaterThan(0);
  });

  it('17. should evaluate decision readiness for compensation restructure scenario', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      graph,
      'compensation_restructure'
    );

    expect(assessment.targetScenario).toBe('compensation_restructure');
    expect(assessment.isReady).toBe(false);
  });

  it('18. should evaluate decision readiness for organization restructure scenario', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      graph,
      'organization_restructure'
    );

    expect(assessment.targetScenario).toBe('organization_restructure');
    expect(assessment.isReady).toBe(false);
  });

  it('19. should generate targeted recommended questions when critical blocking gaps exist', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      graph,
      'payroll_audit'
    );

    expect(assessment.recommendedQuestions.length).toBeGreaterThan(0);
    expect(typeof assessment.recommendedQuestions[0]).toBe('string');
  });

  it('20. should return default positive message when decision readiness is achieved', () => {
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
      const r1 = upsertGraphNode(graph, 'POLICY', `${dom} role policy`, { domain: dom, confidence: 0.95, evidenceRef: `ev-${idx}` });
      const r2 = upsertGraphNode(r1.graph, 'METRIC', `${dom} metric`, { domain: dom, confidence: 0.95, evidenceRef: `ev-${idx}-b` });
      const r3 = addGraphRelationship(r2.graph, r1.nodeId, r2.nodeId, 'DEPENDS_ON');
      graph = r3.graph;
    });

    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      graph,
      'payroll_audit'
    );

    expect(assessment.recommendedQuestions[0]).toContain('Knowledge coverage is sufficient');
  });

  it('21. should correctly handle an input OverallCoverageReport object directly', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);

    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      report,
      'payroll_audit'
    );

    expect(assessment.score).toBe(report.overallScore);
  });

  it('22. should validate bounds for completeness score calculation', () => {
    expect(validateCoverageScore(50)).toBe(true);
    expect(validateCoverageScore(0)).toBe(true);
    expect(validateCoverageScore(100)).toBe(true);
    expect(validateCoverageScore(-1)).toBe(false);
    expect(validateCoverageScore(105)).toBe(false);

    const graph = createEmptyEnterpriseKnowledgeGraph();
    const report = CoverageCalculator.calculateOverallReport(graph);
    expect(assertCoverageReportValid(report)).toBe(true);
  });
});

const CoverageDecisionEngineTestModule = {
  name: 'CoverageDecisionEngineTestModule',
};

export default CoverageDecisionEngineTestModule;
