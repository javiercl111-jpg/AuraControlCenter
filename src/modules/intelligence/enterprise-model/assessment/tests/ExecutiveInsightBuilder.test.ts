// @ts-expect-error Vitest ambient module types
import { describe, it, expect } from 'vitest';
import { ExecutiveInsightBuilder } from '../services/ExecutiveInsightBuilder';

describe('ExecutiveInsightBuilder', () => {
  const builder = new ExecutiveInsightBuilder();

  it('should map summary and narrative verbatim', () => {
    const summary = {
      headline: 'A headline',
      keyInsights: [],
      criticalRisksSummary: 'Risk summary'
    };
    const narrative = {
      executiveSummary: 'Exec summary',
      currentState: 'Current state',
      burningIssues: 'Burning issues',
      opportunitiesForGrowth: 'Opportunities'
    };

    const insight = builder.build(summary, narrative);

    expect(insight.summary.headline).toBe('A headline');
    expect(insight.narrative.currentState).toBe('Current state');
  });

  it('should convert key insights into TraceableTakeaway', () => {
    const summary = {
      headline: '',
      keyInsights: ['Insight 1', 'Insight 2'],
      criticalRisksSummary: ''
    };
    const narrative = { executiveSummary: '', currentState: '', burningIssues: '', opportunitiesForGrowth: '' };

    const insight = builder.build(summary, narrative);

    expect(insight.keyTakeaways).toHaveLength(2);
    expect(insight.keyTakeaways[0].text).toBe('Insight 1');
    expect(insight.keyTakeaways[0].sourceRefs).toEqual([]);
  });

  it('should create new objects without mutating the original inputs', () => {
    const summary = {
      headline: 'A headline',
      keyInsights: ['Insight 1'],
      criticalRisksSummary: 'Risk summary'
    };
    const narrative = {
      executiveSummary: 'Exec summary',
      currentState: 'Current state',
      burningIssues: 'Burning issues',
      opportunitiesForGrowth: 'Opportunities'
    };

    const insight = builder.build(summary, narrative);

    expect(insight.summary).not.toBe(summary);
    expect(insight.narrative).not.toBe(narrative);
  });

  it('should handle empty key insights gracefully', () => {
    const summary = {
      headline: '',
      keyInsights: [],
      criticalRisksSummary: ''
    };
    const narrative = { executiveSummary: '', currentState: '', burningIssues: '', opportunitiesForGrowth: '' };

    const insight = builder.build(summary, narrative);

    expect(insight.keyTakeaways).toHaveLength(0);
  });
});
