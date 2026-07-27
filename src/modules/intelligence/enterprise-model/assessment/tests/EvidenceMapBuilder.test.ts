import { describe, it, expect } from 'vitest';
import { EvidenceMapBuilder } from '../services/EvidenceMapBuilder';
import { AssessmentContextBuilder } from '../services/AssessmentContextBuilder';

describe('EvidenceMapBuilder', () => {
  const context = new AssessmentContextBuilder('exec-1', '1.0', '2026-07-25T10:00:00Z').build();
  const builder = new EvidenceMapBuilder();

  const mockFinding = {
    findingId: 'f-1',
    statement: 'Finding 1',
    type: 'FINDING' as const,
    chain: {
      chainId: 'c-1',
      claims: [
        {
          claimId: 'claim-1',
          statement: '',
          sourceNodes: [],
          sourceRelationships: [],
          evidenceSupports: [
            { supportId: 's-1', evidenceRef: 'ev-1', correlationType: 'DIRECT' as const, weight: 1, rationale: '' }
          ],
          confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 1 },
          status: 'SUPPORTED_FINDING' as const,
          createdAt: ''
        }
      ],
      logicDescription: ''
    },
    status: 'SUPPORTED_FINDING' as const,
    confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 1 }
  };

  const mockRisk = {
    ...mockFinding,
    findingId: 'r-1',
    type: 'RISK' as const,
    severity: 'HIGH' as const,
    impactArea: 'TECH'
  };

  it('should map findings to claims and claims to evidence', () => {
    const map = builder.build([mockFinding], [], [], [], context);
    
    expect(map.links).toContainEqual(expect.objectContaining({
      sourceId: 'f-1',
      sourceType: 'FINDING',
      targetId: 'claim-1',
      targetType: 'CLAIM'
    }));

    expect(map.links).toContainEqual(expect.objectContaining({
      sourceId: 'claim-1',
      sourceType: 'CLAIM',
      targetId: 'ev-1',
      targetType: 'EVIDENCE'
    }));
  });

  it('should map risks correctly', () => {
    const map = builder.build([], [mockRisk], [], [], context);
    
    expect(map.links).toContainEqual(expect.objectContaining({
      sourceId: 'r-1',
      sourceType: 'RISK',
      targetId: 'claim-1',
      targetType: 'CLAIM'
    }));
  });

  it('should map root cause hypothesis to related findings', () => {
    const rootCause = {
      ...mockFinding,
      findingId: 'rc-1',
      type: 'ROOT_CAUSE' as const,
      relatedFindings: ['f-2']
    };

    const map = builder.build([], [], [], [rootCause], context);
    
    expect(map.links).toContainEqual(expect.objectContaining({
      sourceId: 'rc-1',
      sourceType: 'ROOT_CAUSE_HYPOTHESIS',
      targetId: 'f-2',
      targetType: 'FINDING'
    }));
  });

  it('should ensure deterministic mapId generation', () => {
    const map1 = builder.build([mockFinding], [], [], [], context);
    const map2 = builder.build([mockFinding], [], [], [], context);
    
    expect(map1.mapId).toBe(map2.mapId);
  });
});
