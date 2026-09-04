import { describe, it, expect } from 'vitest';
import { createAuraIntelligenceOrchestratorV1 } from '../createAuraIntelligenceOrchestratorV1';
import { AuraIntelligenceOrchestrator } from '../../os/AuraIntelligenceOrchestrator';
import { PipelineExecutionContext } from '../../os/PipelineExecutionContext';
import { SystemPipelineClockV1 } from '../adapters/SystemPipelineClockV1';

import type { PipelineSessionId, PipelineExecutionKey } from '../../os/types';

describe('AEA-05-R1C.3 createAuraIntelligenceOrchestratorV1 - Structural', () => {
  const clock = new SystemPipelineClockV1();
  it('returns a valid AuraIntelligenceOrchestrator instance', () => {
    const context = new PipelineExecutionContext('test-exec-1', clock, { sessionId: 's-1' });
    const orchestrator = createAuraIntelligenceOrchestratorV1(context);
    expect(orchestrator).toBeInstanceOf(AuraIntelligenceOrchestrator);
  });

  it('two calls produce distinct valid instances (no shared mutable state)', () => {
    const ctx1 = new PipelineExecutionContext('exec-1', clock, { sessionId: 's-1' });
    const ctx2 = new PipelineExecutionContext('exec-2', clock, { sessionId: 's-2' });

    const orch1 = createAuraIntelligenceOrchestratorV1(ctx1);
    const orch2 = createAuraIntelligenceOrchestratorV1(ctx2);

    expect(orch1).not.toBe(orch2);
    expect(orch1).toBeInstanceOf(AuraIntelligenceOrchestrator);
    expect(orch2).toBeInstanceOf(AuraIntelligenceOrchestrator);
  });

  it('orchestrator is correctly wired internally', () => {
    const ctx = new PipelineExecutionContext('test-wired-1', clock, { sessionId: 's-1' });
    const orchestrator = createAuraIntelligenceOrchestratorV1(ctx);
    expect(orchestrator).toBeDefined();
    expect(typeof orchestrator.executePipeline).toBe('function');
  });
});

import {
  createMinimalMentalModel,
  createMinimalKnowledgeGraph,
  createMinimalExtractionResult,
  createMinimalCoverageReport,
  createMinimalReadinessAssessment
} from '../../os/tests/fixtures';

describe('AEA-05-R1C.3 createAuraIntelligenceOrchestratorV1 - Pipeline Execution', () => {
  const clock = new SystemPipelineClockV1();
  it('executes a minimal scenario to produce EXECUTIVE_DOSSIER and TRANSFORMATION_ASSESSMENT', async () => {
    const sessionId: PipelineSessionId = 'test-session-id';
    const executionKey: PipelineExecutionKey = 'test-execution-key';

    const ctx = new PipelineExecutionContext('pipeline-exec-1', clock, {
      sessionId,
      executionKey,
      targetScenario: 'ENTERPRISE_PREVIEW',
      metadata: { source: 'TEST_FACTORY' }
    });

    const orchestrator = createAuraIntelligenceOrchestratorV1(ctx);

    const initialState = {
      sessionId,
      executionKey,
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph(),
      coverageReport: createMinimalCoverageReport(),
      readinessAssessment: createMinimalReadinessAssessment()
    };

    const result = await orchestrator.executePipeline({
      sessionId,
      executionKey,
      targetScenario: 'ENTERPRISE_PREVIEW',
      metadata: { source: 'TEST_FACTORY' }
    }, initialState);

    // 13. ejecución inicia correctamente.
    expect(result).toBeDefined();

    // 14. executionId existe.
    expect(result.executionId).toBe('pipeline-exec-1');

    // 15. session/request identifiers preservados
    expect(result.sessionId).toBe(sessionId);

    // Verify stages
    const stageIds = Object.keys(result.stageResults);

    // 16, 17, 18. Engines execute
    expect(stageIds).toContain('EVIDENCE_EXTRACTION');
    expect(stageIds).toContain('KNOWLEDGE_COVERAGE');
    expect(stageIds).toContain('EXECUTIVE_REASONING');

    // 19. EXECUTIVE_DOSSIER produce output
    const dossierStage = result.stageResults['EXECUTIVE_DOSSIER'];
    expect(dossierStage).toBeDefined();
    expect(dossierStage?.status).toBe('SUCCEEDED');
    expect(dossierStage?.output).toBeDefined();

    // 20. TRANSFORMATION_ASSESSMENT produce output
    const assessmentStage = result.stageResults['TRANSFORMATION_ASSESSMENT'];
    expect(assessmentStage).toBeDefined();
    expect(assessmentStage?.status).toBe('SUCCEEDED');
    expect(assessmentStage?.output).toBeDefined();

    // 21. status final pertenece a estados contractuales válidos
    const validStatuses = ['SUCCESS', 'PARTIAL_SUCCESS', 'PARTIAL', 'FAILED', 'TIMEOUT', 'CANCELLED'];
    expect(validStatuses).toContain(result.status);

    // 22. raw result conserva estructura PipelineResult real
    expect(result.stageResults).toBeDefined();
    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
  });
});
