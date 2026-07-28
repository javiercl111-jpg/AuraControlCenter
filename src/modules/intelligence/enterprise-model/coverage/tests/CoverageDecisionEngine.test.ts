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
import {
  validateCoverageScore,
  assertCoverageReportValid,
  CoverageScenarioScopeValidationError,
} from '../domain/validation';
import type { CoverageDomain, CoverageScenarioScope } from '../domain/types';

const allCoverageDomains: readonly CoverageDomain[] = [
  'organization',
  'payroll',
  'compensation',
  'benefits',
  'compliance',
  'talent_performance',
  'time_attendance',
  'workforce_analytics',
];

function createCoverageScope(
  scenarioId: string,
  includedDomains: readonly CoverageDomain[]
): CoverageScenarioScope {
  const includedSet = new Set(includedDomains);
  return {
    scenarioId,
    includedDomains: [...includedDomains],
    excludedDomains: allCoverageDomains.filter(
      (domain) => !includedSet.has(domain)
    ),
  };
}

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

  it('23. uses exact nominal domains for PAYROLL_AUDIT', () => {
    const scope = createCoverageScope(
      'PAYROLL_AUDIT',
      ['payroll', 'organization', 'compliance']
    );
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      createEmptyEnterpriseKnowledgeGraph(),
      scope
    );

    expect(assessment.blockingGaps.map((gap) => gap.domain)).toEqual(
      scope.includedDomains
    );
  });

  it('24. uses exact nominal domains for COMPENSATION_RESTRUCTURE', () => {
    const scope = createCoverageScope(
      'COMPENSATION_RESTRUCTURE',
      ['compensation', 'organization', 'payroll', 'benefits']
    );
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      createEmptyEnterpriseKnowledgeGraph(),
      scope
    );

    expect(assessment.blockingGaps.map((gap) => gap.domain)).toEqual(
      scope.includedDomains
    );
  });

  it('25. uses exact nominal domains for ORGANIZATION_RESTRUCTURE', () => {
    const scope = createCoverageScope(
      'ORGANIZATION_RESTRUCTURE',
      ['organization', 'workforce_analytics', 'talent_performance']
    );
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      createEmptyEnterpriseKnowledgeGraph(),
      scope
    );

    expect(assessment.blockingGaps.map((gap) => gap.domain)).toEqual(
      scope.includedDomains
    );
  });

  it('26. uses exact nominal domains for COMPLIANCE_AUDIT', () => {
    const scope = createCoverageScope(
      'COMPLIANCE_AUDIT',
      ['compliance', 'payroll', 'time_attendance']
    );
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      createEmptyEnterpriseKnowledgeGraph(),
      scope
    );

    expect(assessment.blockingGaps.map((gap) => gap.domain)).toEqual(
      scope.includedDomains
    );
  });

  it('27. nominal scope has priority and never invokes string heuristics', () => {
    const scope = createCoverageScope(
      'COMPLIANCE_AUDIT',
      ['talent_performance']
    );
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      createEmptyEnterpriseKnowledgeGraph(),
      scope
    );

    expect(assessment.targetScenario).toBe('COMPLIANCE_AUDIT');
    expect(assessment.blockingGaps.map((gap) => gap.domain)).toEqual([
      'talent_performance',
    ]);
    expect(
      assessment.blockingGaps.some((gap) =>
        scope.excludedDomains.includes(gap.domain)
      )
    ).toBe(false);
  });

  it('28. string-only callers retain the legacy fallback', () => {
    const assessment = CoverageDecisionEngine.evaluateDecisionReadiness(
      createEmptyEnterpriseKnowledgeGraph(),
      'unmapped_scenario'
    );

    expect(assessment.blockingGaps.map((gap) => gap.domain)).toEqual([
      'organization',
      'payroll',
    ]);
  });

  it('29. rejects overlapping included and excluded domains', () => {
    const scope: CoverageScenarioScope = {
      scenarioId: 'PAYROLL_AUDIT',
      includedDomains: ['payroll'],
      excludedDomains: ['payroll'],
    };

    expect(() => CoverageDecisionEngine.evaluateDecisionReadiness(
      createEmptyEnterpriseKnowledgeGraph(),
      scope
    )).toThrowError(
      expect.objectContaining<
        Partial<CoverageScenarioScopeValidationError>
      >({ reason: 'OVERLAPPING_COVERAGE_DOMAINS' })
    );
  });

  it('30. rejects unknown nominal domains', () => {
    const scope = {
      scenarioId: 'PAYROLL_AUDIT',
      includedDomains: ['unknown_domain'],
      excludedDomains: [],
    } as unknown as CoverageScenarioScope;

    expect(() => CoverageDecisionEngine.evaluateDecisionReadiness(
      createEmptyEnterpriseKnowledgeGraph(),
      scope
    )).toThrowError(
      expect.objectContaining<
        Partial<CoverageScenarioScopeValidationError>
      >({ reason: 'UNKNOWN_COVERAGE_DOMAIN' })
    );
  });

  it('31. rejects an empty included domain set without legacy fallback', () => {
    const scope: CoverageScenarioScope = {
      scenarioId: 'PAYROLL_AUDIT',
      includedDomains: [],
      excludedDomains: allCoverageDomains,
    };

    expect(() => CoverageDecisionEngine.evaluateDecisionReadiness(
      createEmptyEnterpriseKnowledgeGraph(),
      scope
    )).toThrowError(
      expect.objectContaining<
        Partial<CoverageScenarioScopeValidationError>
      >({ reason: 'EMPTY_INCLUDED_DOMAINS' })
    );
  });

  it('32. does not mutate nominal scope arrays', () => {
    const includedDomains = Object.freeze([
      'organization',
      'workforce_analytics',
      'talent_performance',
    ] as const);
    const excludedDomains = Object.freeze([
      'payroll',
      'compensation',
      'benefits',
      'compliance',
      'time_attendance',
    ] as const);
    const scope: CoverageScenarioScope = Object.freeze({
      scenarioId: 'ORGANIZATION_RESTRUCTURE',
      includedDomains,
      excludedDomains,
    });

    CoverageDecisionEngine.evaluateDecisionReadiness(
      createEmptyEnterpriseKnowledgeGraph(),
      scope
    );

    expect(scope.includedDomains).toBe(includedDomains);
    expect(scope.excludedDomains).toBe(excludedDomains);
    expect(scope.includedDomains).toEqual([
      'organization',
      'workforce_analytics',
      'talent_performance',
    ]);
  });
});

const CoverageDecisionEngineTestModule = {
  name: 'CoverageDecisionEngineTestModule',
};

export default CoverageDecisionEngineTestModule;
