import { describe, it, expect } from 'vitest';
import { GrowthPublicSemanticProjectorV1 } from '../GrowthPublicSemanticProjectorV1';
import type { BoundarySemanticProjectionContextV1 } from '../../../boundary/ports';

describe('GrowthPublicSemanticProjectorV1', () => {
  const projector = new GrowthPublicSemanticProjectorV1();

  const createContext = (operation?: string, capability = 'GROWTH_INTELLIGENCE_V1'): BoundarySemanticProjectionContextV1 => ({
    requestId: 'req-1',
    correlationId: 'cor-1',
    tenantId: 't-1',
    actorId: 'a-1',
    mode: 'EVALUATION',
    source: 'test',
    capability,
    operation,
  });

  const createRawData = (stageResults: unknown = {}) => ({
    executionId: 'exec-1',
    sessionId: 'sess-1',
    status: 'COMPLETED',
    contractVersion: '1.0',
    stageResults,
  });

  it('returns undefined if rawData is invalid or undefined', () => {
    expect(projector.project(undefined, createContext('ANALYZE_CAMPAIGN'))).toBeUndefined();
    expect(projector.project(null, createContext('ANALYZE_CAMPAIGN'))).toBeUndefined();
    expect(projector.project({}, createContext('ANALYZE_CAMPAIGN'))).toBeUndefined();
  });

  it('returns undefined if capability is unknown or not GROWTH_INTELLIGENCE_V1', () => {
    expect(projector.project(createRawData(), createContext('ANALYZE_CAMPAIGN', 'UNKNOWN_CAP'))).toBeUndefined();
  });

  it('returns undefined if operation is unknown', () => {
    expect(projector.project(createRawData(), createContext('UNKNOWN_OP'))).toBeUndefined();
  });

  it('ANALYZE_CAMPAIGN maps findings, risks, and recommendations without PII or narrative', () => {
    const rawData = createRawData({
      TRANSFORMATION_ASSESSMENT: {
        output: {
          findings: [{ id: 'f1', description: 'Finding 1', secret: 'hide' }],
          risks: [{ id: 'r1', description: 'Risk 1' }],
          recommendationCandidates: [{ id: 'rc1', proposedAction: 'Do this' }],
          narrative: 'some PII here',
        }
      }
    });

    const result = projector.project(rawData, createContext('ANALYZE_CAMPAIGN'));
    expect(result).toBeDefined();
    expect(result?.operation).toBe('ANALYZE_CAMPAIGN');
    expect(result?.status).toBe('PARTIAL_SUCCESS');
    expect(result?.missingFields).toEqual(['knowledgeGaps']);

    const output = result?.output as Record<string, unknown>;
    expect((output.findings as unknown[])).toHaveLength(1);
    expect((output.findings as Record<string, unknown>[])[0]).toEqual({ id: 'f1', description: 'Finding 1' });
    expect((output.findings as Record<string, unknown>[])[0].secret).toBeUndefined();
    expect((output.risks as unknown[])).toHaveLength(1);
    expect((output.recommendations as unknown[])).toHaveLength(1);
    expect(output.narrative).toBeUndefined();
  });

  it('ANALYZE_CAMPAIGN returns undefined if findings/risks are missing', () => {
    const rawData = createRawData({
      TRANSFORMATION_ASSESSMENT: { output: {} }
    });
    expect(projector.project(rawData, createContext('ANALYZE_CAMPAIGN'))).toBeUndefined();
  });

  it('PRIORITIZE_OPPORTUNITIES maps opportunities from Dossier priorities', () => {
    const rawData = createRawData({
      EXECUTIVE_DOSSIER: {
        output: {
          priorities: [{ id: 'opp1', rank: 1, addressedWeaknesses: ['w1'] }]
        }
      }
    });

    const result = projector.project(rawData, createContext('PRIORITIZE_OPPORTUNITIES'));
    expect(result).toBeDefined();
    expect(result?.status).toBe('PARTIAL_SUCCESS');
    expect(result?.missingFields).toEqual(['score', 'rationale', 'confidence']);

    const output = result?.output as Record<string, unknown>;
    expect((output.opportunities as unknown[])).toHaveLength(1);
    expect((output.opportunities as Record<string, unknown>[])[0]).toEqual({ opportunityId: 'opp1', position: 1, evidenceIds: ['w1'] });
  });

  it('RECOMMEND_ACTIONS maps actions safely', () => {
    const rawData = createRawData({
      EXECUTIVE_DOSSIER: {
        output: {
          recommendationCandidates: [{ id: 'rc1', proposedAction: 'Act', effortEstimate: 'LOW', evidenceRefs: ['e1'], internal: true }]
        }
      }
    });

    const result = projector.project(rawData, createContext('RECOMMEND_ACTIONS'));
    expect(result).toBeDefined();
    expect(result?.status).toBe('PARTIAL_SUCCESS');
    expect(result?.missingFields).toEqual(['primaryRecommendation', 'alternatives']);

    const output = result?.output as Record<string, unknown>;
    expect((output.recommendations as unknown[])).toHaveLength(1);
    expect((output.recommendations as Record<string, unknown>[])[0]).toEqual({ actionId: 'rc1', proposedAction: 'Act', effortEstimate: 'LOW', evidenceIds: ['e1'] });
    expect((output.recommendations as Record<string, unknown>[])[0].internal).toBeUndefined();
  });

  it('ASSESS_GROWTH_CAPABILITY maps maturity and dimensions', () => {
    const rawData = createRawData({
      TRANSFORMATION_ASSESSMENT: {
        output: {
          maturityProfile: {
            overallMaturity: 'MANAGED',
            dimensions: [{ dimension: 'TECH', score: 4.5, internal: true }]
          },
          transformationReadiness: {
            criticalGaps: ['g1'],
            dependencies: [{ id: 'd1', sourcePriorityId: 'sp1' }]
          }
        }
      }
    });

    const result = projector.project(rawData, createContext('ASSESS_GROWTH_CAPABILITY'));
    expect(result).toBeDefined();
    expect(result?.status).toBe('PARTIAL_SUCCESS');
    expect(result?.missingFields).toEqual(['roadmap']);

    const output = result?.output as Record<string, unknown>;
    expect(output.maturityScore).toBe('MANAGED');
    expect((output.dimensions as unknown[])).toHaveLength(1);
    expect((output.dimensions as Record<string, unknown>[])[0]).toEqual({ dimension: 'TECH', score: 4.5 });
    expect((output.dimensions as Record<string, unknown>[])[0].internal).toBeUndefined();
    expect(output.gaps).toEqual(['g1']);
    expect((output.dependencies as unknown[])).toHaveLength(1);
  });

  it('does not mutate rawData and returns new reference', () => {
    const rawData = createRawData({
      TRANSFORMATION_ASSESSMENT: {
        output: { findings: [{ id: 'f1' }], risks: [{ id: 'r1' }] }
      }
    });

    projector.project(rawData, createContext('ANALYZE_CAMPAIGN'));
    expect((((rawData as Record<string, unknown>).stageResults as Record<string, unknown>).TRANSFORMATION_ASSESSMENT as Record<string, unknown>).output as Record<string, unknown>).toBeDefined();
    expect((((((rawData as Record<string, unknown>).stageResults as Record<string, unknown>).TRANSFORMATION_ASSESSMENT as Record<string, unknown>).output as Record<string, unknown>).findings as Record<string, unknown>[])[0].description).toBeUndefined();
  });
});
