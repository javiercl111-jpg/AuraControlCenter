// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import ExecutiveReasoningEngine from '../services/ExecutiveReasoningEngine';
import { createStrictPolicy } from '../policies/ReasoningPolicy';
import type { ExecutiveReasoningContext, ReasoningExecutionContext } from '../domain/types';
import type { DomainCoverageMetrics } from '../../coverage/domain/types';
import type { EnterpriseMentalModel } from '../../domain/types';

describe('ExecutiveReasoningEngine Orchestrator', () => {
  const policy = createStrictPolicy();
  const engine = new ExecutiveReasoningEngine(policy);
  const execCtx: ReasoningExecutionContext = { executionId: 'ex-e2e', timestamp: '2026-07-25T12:00:00Z' };

  it('27. should execute full pipeline end-to-end for a hotel maintenance scenario', () => {
    // Hotel con mantenimiento en Excel (Risk scenario)
    const ctx: ExecutiveReasoningContext = {
      coverageReport: { overallScore: 0.9, domainBreakdown: {} as Record<string, DomainCoverageMetrics>, totalNodes: 2, totalRelationships: 1, timestamp: '', criticalGaps: [], readinessForDecision: true, confidenceLevel: 'HIGH' },
      decisionAssessment: { isReady: true, score: 90, targetScenario: '', recommendedQuestions: [], blockingGaps: [] },
      knowledgeGraph: {
        nodes: {
          'n1': { id: 'n1', label: 'Hotel Maintenance Process', type: 'PROCESS', status: 'CONFIRMED', properties: { evidenceRefs: 'ev1' }, createdAt: 0, updatedAt: 0, mentalModelRef: null },
          'n2': { id: 'n2', label: 'Manual Excel Tracking', type: 'RISK', status: 'CONFIRMED', properties: { evidenceRefs: 'ev2', severity: 'HIGH' }, createdAt: 0, updatedAt: 0, mentalModelRef: null }
        },
        relationships: {
          'r1': { id: 'r1', sourceId: 'n1', targetId: 'n2', type: 'AFFECTS', status: 'CONFIRMED', evidenceRefs: ['ev3'], confidence: 1, properties: {}, createdAt: 0, updatedAt: 0 }
        }
      },
      evidences: [
        { evidenceId: 'ev1', sessionId: 's1', turnId: 't1', source: 'doc1', sourceType: 'DOCUMENT', originalText: null, normalizedStatement: 'We do maintenance', category: 'cat', entityRefs: [], capturedAt: 0, reliability: 1, directness: 1, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {} },
        { evidenceId: 'ev2', sessionId: 's1', turnId: 't1', source: 'doc2', sourceType: 'DOCUMENT', originalText: null, normalizedStatement: 'Tracked in Excel', category: 'cat', entityRefs: [], capturedAt: 0, reliability: 1, directness: 1, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {} },
        { evidenceId: 'ev3', sessionId: 's1', turnId: 't1', source: 'doc3', sourceType: 'DOCUMENT', originalText: null, normalizedStatement: 'Maintenance slow due to Excel', category: 'cat', entityRefs: [], capturedAt: 0, reliability: 1, directness: 1, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {} }
      ],
      hypotheses: [],
      contradictions: [],
      constraints: [],
      executiveObjectives: [],
      mentalModel: {} as EnterpriseMentalModel,
      questionHistory: { historyId: '1', items: [] }
    };

    const report = engine.execute(ctx, execCtx);

    expect(report.overallStatus).toBe('SUPPORTED_FINDING');
    
    // The relationship node generates a generic finding
    // The RISK node generates a Risk
    expect(report.risks.length).toBeGreaterThanOrEqual(1);
    
    const excelRisk = report.risks.find(r => r.statement === 'Manual Excel Tracking');
    expect(excelRisk).toBeDefined();
    expect(excelRisk?.severity).toBe('HIGH');
    
    // Trazabilidad completa (Full traceability)
    expect(excelRisk?.chain).toBeDefined();
    expect(excelRisk?.chain.claims[0].evidenceSupports.length).toBeGreaterThan(0);
    expect(excelRisk?.chain.claims[0].evidenceSupports[0].evidenceRef).toBe('ev2');
  });

  it('28. should return early if context is not ready', () => {
    const ctx = {
      coverageReport: { overallScore: 0.1 },
      decisionAssessment: { blockingGaps: [{ id: 'gap' }] }
    } as unknown as ExecutiveReasoningContext;

    const report = engine.execute(ctx, execCtx);
    expect(report.overallStatus).toBe('REQUIRES_MORE_EVIDENCE');
    expect(report.readinessGaps.length).toBeGreaterThan(0);
  });
});
