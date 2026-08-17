import { describe, expect, it } from 'vitest';

import {
  COVERAGE_DOMAINS,
  type CoverageDomain,
} from '../domain/types';

import { CoverageCalculator } from '../services/CoverageCalculator';
import { CoverageDecisionEngine } from '../services/CoverageDecisionEngine';

const GROWTH_DOMAINS = [
  'growth_strategy',
  'commercial_performance',
  'campaigns',
  'opportunities',
] as const satisfies readonly CoverageDomain[];

function graphWithNode(
  type: string,
  statement: string,
): Record<string, unknown> {
  return {
    nodes: {
      node_1: {
        nodeId: 'node_1',
        type,
        properties: {
          statement,
          name: statement,
        },
      },
    },
    relationships: {},
  };
}

describe('INTEL-GROWTH-01 — Growth Coverage Domains V1', () => {
  it('registers the four canonical Growth coverage domains', () => {
    for (const domain of GROWTH_DOMAINS) {
      expect(COVERAGE_DOMAINS).toContain(domain);
    }
  });

  it('keeps Growth coverage domains unique', () => {
    expect(new Set(GROWTH_DOMAINS).size).toBe(GROWTH_DOMAINS.length);
  });

  it.each([
    [
      'growth_strategy',
      'OBJECTIVE',
      'Increase market growth and strategic expansion',
    ],
    [
      'commercial_performance',
      'METRIC',
      'Revenue conversion pipeline performance',
    ],
    [
      'campaigns',
      'CAPABILITY',
      'Campaign audience channel messaging',
    ],
    [
      'opportunities',
      'OBJECTIVE',
      'Prioritize commercial opportunity and market potential',
    ],
  ] as const)(
    'classifies %s evidence deterministically',
    (domain, type, statement) => {
      const metrics = CoverageCalculator.calculateDomainMetrics(
        graphWithNode(type, statement) as never,
        domain,
      );

      expect(metrics.domain).toBe(domain);
    },
  );

  it('accepts an explicit Growth coverage scope', () => {
    const scope = {
      scenarioId: 'GROWTH_INTELLIGENCE',
      includedDomains: [...GROWTH_DOMAINS],
      excludedDomains: [],
    } as const;

    expect(() =>
      CoverageDecisionEngine.evaluateDecisionReadiness(
        {
          totalNodes: 0,
          totalRelationships: 0,
          overallScore: 0,
          domainBreakdown: {},
          timestamp: '2026-08-17T00:00:00.000Z',
          criticalGaps: [],
          readinessForDecision: false,
          confidenceLevel: 'LOW',
        } as never,
        scope,
      ),
    ).not.toThrow();
  });
});
