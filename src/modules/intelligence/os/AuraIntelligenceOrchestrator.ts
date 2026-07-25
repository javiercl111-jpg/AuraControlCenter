import { AuraIntelligenceOSError, ErrorCodes } from './errors';
import type { 
  PipelineSessionId,
  PipelineExecutionKey,
  PipelineExecutionMetadata,
  PipelineStatus,
  PipelineStageId,
  PipelineStageResult,
  PipelineResult,
  SerializableAuraOSError,
  StageStatus
} from './types';
import type { PipelineAggregatedState } from './contextTypes';
import type { AuraIntelligenceOSDependencies } from './dependencyComposition';
import { PipelineContextBuilder } from './PipelineContextBuilder';
import { PipelineExecutionContext } from './PipelineExecutionContext';

export interface OrchestrationInput {
  sessionId: PipelineSessionId;
  executionKey?: PipelineExecutionKey;
  targetScenario?: string;
  objectiveIds?: readonly string[];
  metadata?: PipelineExecutionMetadata;
}

export class AuraIntelligenceOrchestrator {
  private readonly osContext: PipelineExecutionContext;
  private readonly dependencies: AuraIntelligenceOSDependencies;

  constructor(osContext: PipelineExecutionContext, dependencies: AuraIntelligenceOSDependencies) {
    this.osContext = osContext;
    this.dependencies = dependencies;
  }

  /**
   * Ejecuta el pipeline completo de inteligencia de forma secuencial y determinista.
   */
  public async executePipeline(
    input: OrchestrationInput,
    initialState?: PipelineAggregatedState
  ): Promise<PipelineResult> {
    const startedAt = this.dependencies.clock.toISOString();
    const stageResults: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>> = {};
    const skippedStages: PipelineStageId[] = [];
    const warnings: string[] = [];
    let partialFailures = false;

    let currentState: PipelineAggregatedState = initialState ? { ...initialState } : {
      sessionId: input.sessionId,
      executionKey: input.executionKey,
      targetScenario: input.targetScenario,
      objectiveIds: input.objectiveIds,
      metadata: input.metadata
    };

    try {
      // 1. EVIDENCE_EXTRACTION + MENTAL_MODEL + KNOWLEDGE_GRAPH
      let extractionFailed = false;
      if (!this.checkCancelled('EVIDENCE_EXTRACTION', skippedStages)) {
        if (currentState.extractionResult && this.dependencies.extractionApplier) {
          const result = await this.executeExtractionStage(currentState, stageResults);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            extractionFailed = true;
            partialFailures = true;
          }
        } else if (!this.dependencies.extractionApplier) {
          skippedStages.push('EVIDENCE_EXTRACTION', 'MENTAL_MODEL', 'KNOWLEDGE_GRAPH');
        }
      }

      // If extraction failed, subsequent core models cannot be built
      if (extractionFailed) {
        skippedStages.push('MENTAL_MODEL', 'KNOWLEDGE_GRAPH', 'KNOWLEDGE_COVERAGE', 'ADAPTIVE_PLANNING', 'EXECUTIVE_REASONING', 'EXECUTIVE_DOSSIER', 'TRANSFORMATION_ASSESSMENT');
        return this.finalizePipeline(currentState, stageResults, skippedStages, partialFailures, warnings, startedAt);
      }

      // 4. KNOWLEDGE_COVERAGE
      if (!this.checkCancelled('KNOWLEDGE_COVERAGE', skippedStages) && !skippedStages.includes('KNOWLEDGE_COVERAGE')) {
        if (!currentState.coverageReport && this.dependencies.coverageDecisionEngine) {
          const result = await this.executeCoverageStage(currentState, stageResults);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            partialFailures = true;
          }
        } else if (!this.dependencies.coverageDecisionEngine) {
          skippedStages.push('KNOWLEDGE_COVERAGE');
        }
      }

      // 5. ADAPTIVE_PLANNING
      if (!this.checkCancelled('ADAPTIVE_PLANNING', skippedStages) && !skippedStages.includes('ADAPTIVE_PLANNING')) {
        // Planning can continue even if coverage failed, but only if its own inputs are valid.
        if (!currentState.planningResult && this.dependencies.adaptiveQuestionPlanner && this.dependencies.plannerPolicy && this.dependencies.questionRealizationProvider) {
          const result = await this.executePlanningStage(currentState, stageResults);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            partialFailures = true;
          }
        } else {
          skippedStages.push('ADAPTIVE_PLANNING');
        }
      }

      // 6. EXECUTIVE_REASONING
      let reasoningFailed = false;
      if (!this.checkCancelled('EXECUTIVE_REASONING', skippedStages) && !skippedStages.includes('EXECUTIVE_REASONING')) {
        if (!currentState.reasoningReport && this.dependencies.executiveReasoningEngine && this.dependencies.reasoningPolicy) {
          const result = await this.executeReasoningStage(currentState, stageResults);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            reasoningFailed = true;
            partialFailures = true;
          }
        } else {
          skippedStages.push('EXECUTIVE_REASONING');
          reasoningFailed = true; // Skip dossier and assessment if reasoning is skipped
        }
      }

      if (reasoningFailed) {
        skippedStages.push('EXECUTIVE_DOSSIER', 'TRANSFORMATION_ASSESSMENT');
        return this.finalizePipeline(currentState, stageResults, skippedStages, partialFailures, warnings, startedAt);
      }

      // 7. EXECUTIVE_DOSSIER
      let dossierFailed = false;
      if (!this.checkCancelled('EXECUTIVE_DOSSIER', skippedStages) && !skippedStages.includes('EXECUTIVE_DOSSIER')) {
        if (!currentState.dossier && this.dependencies.executiveDossierBuilder && this.dependencies.dossierPolicy && this.dependencies.diagnosticNarrativeProvider) {
          const result = await this.executeDossierStage(currentState, stageResults);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            dossierFailed = true;
            partialFailures = true;
          }
        } else {
          skippedStages.push('EXECUTIVE_DOSSIER');
          dossierFailed = true;
        }
      }

      if (dossierFailed) {
        skippedStages.push('TRANSFORMATION_ASSESSMENT');
        return this.finalizePipeline(currentState, stageResults, skippedStages, partialFailures, warnings, startedAt);
      }

      // 8. TRANSFORMATION_ASSESSMENT
      if (!this.checkCancelled('TRANSFORMATION_ASSESSMENT', skippedStages) && !skippedStages.includes('TRANSFORMATION_ASSESSMENT')) {
        if (!currentState.assessment && this.dependencies.enterpriseTransformationAssessmentBuilder && this.dependencies.assessmentPolicy) {
          const result = await this.executeAssessmentStage(currentState, stageResults);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            partialFailures = true;
          }
        } else {
          skippedStages.push('TRANSFORMATION_ASSESSMENT');
        }
      }

      return this.finalizePipeline(currentState, stageResults, skippedStages, partialFailures, warnings, startedAt);

    } catch (error) {
      const osError = this.normalizeError(error, 'ORCHESTRATION_FAILED', undefined);
      return this.finalizePipeline(currentState, stageResults, skippedStages, true, warnings, startedAt, [osError]);
    }
  }

  private checkCancelled(stage: PipelineStageId, skippedStages: PipelineStageId[]): boolean {
    if (this.dependencies.cancellationSignal?.aborted) {
      skippedStages.push(stage);
      return true;
    }
    return false;
  }

  private finalizePipeline(
    state: PipelineAggregatedState,
    stageResults: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>,
    skippedStages: PipelineStageId[],
    partialFailures: boolean,
    warnings: string[],
    startedAt: string,
    globalErrors: SerializableAuraOSError[] = []
  ): PipelineResult {
    const completedAt = this.dependencies.clock.toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime(); // Note: Fallback to Date since clock duration isn't available, but it's safe as it's just math. We should preferably use a monotonic clock if available.

    let status: PipelineStatus = 'SUCCESS';
    if (this.dependencies.cancellationSignal?.aborted) {
      status = 'CANCELLED';
    } else if (globalErrors.length > 0) {
      status = 'FAILED';
    } else {
      const allSucceeded = Object.values(stageResults).every(r => r?.status === 'SUCCEEDED');
      const anySucceeded = Object.values(stageResults).some(r => r?.status === 'SUCCEEDED');
      if (allSucceeded && skippedStages.length === 0) {
        status = 'SUCCESS';
      } else if (anySucceeded) {
        status = 'PARTIAL_SUCCESS';
      } else {
        status = 'FAILED';
      }
    }

    return {
      contractVersion: '1',
      pipelineVersion: '1',
      executionId: this.osContext.executionId,
      sessionId: state.sessionId,
      status,
      startedAt,
      completedAt,
      durationMs,
      stageResults,
      partialFailures,
      skippedStages: Array.from(new Set(skippedStages)),
      errors: globalErrors,
      warnings,
      auditTrail: this.buildAuditTrail(stageResults, skippedStages, status)
    };
  }

  private buildAuditTrail(
    stageResults: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>,
    skippedStages: PipelineStageId[],
    finalStatus: PipelineStatus
  ): string[] {
    const trail: string[] = [];
    trail.push(`[PIPELINE] Execution started (Status: RUNNING)`);
    
    for (const [stage, result] of Object.entries(stageResults)) {
      if (result) {
        trail.push(`[STAGE] ${stage} completed with status: ${result.status} in ${result.durationMs}ms`);
      }
    }
    for (const skipped of skippedStages) {
      trail.push(`[STAGE] ${skipped} skipped`);
    }
    trail.push(`[PIPELINE] Execution finished (Status: ${finalStatus})`);
    return trail;
  }

  private async executeExtractionStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAt = this.dependencies.clock.toISOString();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      if (!this.dependencies.extractionApplier || !state.extractionResult || !state.mentalModel || !state.knowledgeGraph) {
        throw new AuraIntelligenceOSError(ErrorCodes.STAGE_DEPENDENCY_FAILED, 'Missing extraction dependencies or state', false, 'EVIDENCE_EXTRACTION');
      }

      const result = this.dependencies.extractionApplier.applyExtraction(
        state.mentalModel,
        state.knowledgeGraph,
        state.extractionResult
      );

      nextState = {
        ...state,
        mentalModel: result.mentalModel,
        knowledgeGraph: result.knowledgeGraph,
        extractionResult: result.extractionResult
      };
      
      status = 'SUCCEEDED';
      this.recordLogicalStageResult('EVIDENCE_EXTRACTION', 'SUCCEEDED', startedAt, results);
      this.recordLogicalStageResult('MENTAL_MODEL', 'SUCCEEDED', startedAt, results);
      this.recordLogicalStageResult('KNOWLEDGE_GRAPH', 'SUCCEEDED', startedAt, results);

    } catch (e) {
      const osError = this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'EVIDENCE_EXTRACTION');
      errors.push(osError);
      this.recordLogicalStageResult('EVIDENCE_EXTRACTION', 'FAILED', startedAt, results, errors);
      this.recordLogicalStageResult('MENTAL_MODEL', 'FAILED', startedAt, results);
      this.recordLogicalStageResult('KNOWLEDGE_GRAPH', 'FAILED', startedAt, results);
    }

    const completedAt = this.dependencies.clock.toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    
    return {
      stage: 'EVIDENCE_EXTRACTION',
      status,
      startedAt,
      completedAt,
      durationMs,
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private recordLogicalStageResult(
    stage: PipelineStageId,
    status: StageStatus,
    startedAt: string,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>,
    errors: SerializableAuraOSError[] = []
  ) {
    const completedAt = this.dependencies.clock.toISOString();
    results[stage] = {
      stage,
      status,
      startedAt,
      completedAt,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      errors,
      warnings: []
    };
  }

  private async executeCoverageStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAt = this.dependencies.clock.toISOString();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      const ctx = PipelineContextBuilder.buildCoverageContext(state);
      if (!this.dependencies.coverageDecisionEngine || !this.dependencies.coverageCalculator) {
        throw new AuraIntelligenceOSError(ErrorCodes.STAGE_DEPENDENCY_FAILED, 'Missing coverage dependencies', false, 'KNOWLEDGE_COVERAGE');
      }

      const report = this.dependencies.coverageCalculator.calculateOverallReport(ctx.graph);
      const assessment = this.dependencies.coverageDecisionEngine.evaluateDecisionReadiness(
        report,
        ctx.targetScenario
      );

      nextState = {
        ...state,
        coverageReport: report,
        readinessAssessment: assessment
      };
      status = 'SUCCEEDED';
    } catch (e) {
      errors.push(this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'KNOWLEDGE_COVERAGE'));
    }

    this.recordLogicalStageResult('KNOWLEDGE_COVERAGE', status, startedAt, results, errors);
    const completedAt = this.dependencies.clock.toISOString();
    
    return {
      stage: 'KNOWLEDGE_COVERAGE',
      status,
      startedAt,
      completedAt,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private async executePlanningStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAt = this.dependencies.clock.toISOString();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      const { options, executionContext } = PipelineContextBuilder.buildPlanningContext(state, this.dependencies, this.osContext);
      if (!this.dependencies.adaptiveQuestionPlanner) {
        throw new AuraIntelligenceOSError(ErrorCodes.STAGE_DEPENDENCY_FAILED, 'Missing adaptiveQuestionPlanner', false, 'ADAPTIVE_PLANNING');
      }

      const planResult = await this.dependencies.adaptiveQuestionPlanner.planQuestionsFromGraph(options, executionContext);

      nextState = {
        ...state,
        planningResult: planResult
      };
      status = 'SUCCEEDED';
    } catch (e) {
      errors.push(this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'ADAPTIVE_PLANNING'));
    }

    this.recordLogicalStageResult('ADAPTIVE_PLANNING', status, startedAt, results, errors);
    const completedAt = this.dependencies.clock.toISOString();
    
    return {
      stage: 'ADAPTIVE_PLANNING',
      status,
      startedAt,
      completedAt,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private async executeReasoningStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAt = this.dependencies.clock.toISOString();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      const { context, executionContext } = PipelineContextBuilder.buildReasoningContext(state, this.dependencies, this.osContext);
      if (!this.dependencies.executiveReasoningEngine) {
        throw new AuraIntelligenceOSError(ErrorCodes.STAGE_DEPENDENCY_FAILED, 'Missing executiveReasoningEngine', false, 'EXECUTIVE_REASONING');
      }

      const report = this.dependencies.executiveReasoningEngine.execute(context, executionContext);

      nextState = {
        ...state,
        reasoningReport: report
      };
      status = 'SUCCEEDED';
    } catch (e) {
      errors.push(this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'EXECUTIVE_REASONING'));
    }

    this.recordLogicalStageResult('EXECUTIVE_REASONING', status, startedAt, results, errors);
    const completedAt = this.dependencies.clock.toISOString();
    
    return {
      stage: 'EXECUTIVE_REASONING',
      status,
      startedAt,
      completedAt,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private async executeDossierStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAt = this.dependencies.clock.toISOString();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      const { executionContext, report } = PipelineContextBuilder.buildDossierContext(state, this.dependencies, this.osContext);
      if (!this.dependencies.executiveDossierBuilder || !this.dependencies.dossierPolicy || !this.dependencies.diagnosticNarrativeProvider) {
        throw new AuraIntelligenceOSError(ErrorCodes.STAGE_DEPENDENCY_FAILED, 'Missing dossier builder dependencies', false, 'EXECUTIVE_DOSSIER');
      }

      const dossier = this.dependencies.executiveDossierBuilder.build(
        executionContext,
        this.dependencies.dossierPolicy,
        this.dependencies.diagnosticNarrativeProvider,
        report
      );

      nextState = {
        ...state,
        dossier
      };
      status = 'SUCCEEDED';
    } catch (e) {
      errors.push(this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'EXECUTIVE_DOSSIER'));
    }

    this.recordLogicalStageResult('EXECUTIVE_DOSSIER', status, startedAt, results, errors);
    const completedAt = this.dependencies.clock.toISOString();
    
    return {
      stage: 'EXECUTIVE_DOSSIER',
      status,
      startedAt,
      completedAt,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private async executeAssessmentStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAt = this.dependencies.clock.toISOString();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      const ctx = PipelineContextBuilder.buildAssessmentContext(state, this.dependencies, this.osContext);
      if (!this.dependencies.enterpriseTransformationAssessmentBuilder || !this.dependencies.assessmentPolicy) {
        throw new AuraIntelligenceOSError(ErrorCodes.STAGE_DEPENDENCY_FAILED, 'Missing assessment builder dependencies', false, 'TRANSFORMATION_ASSESSMENT');
      }

      const assessment = this.dependencies.enterpriseTransformationAssessmentBuilder.build(
        this.dependencies.assessmentPolicy,
        ctx.executionId,
        ctx.timestamp,
        ctx.dossier,
        ctx.reasoning,
        ctx.constraints,
        ctx.transformationDependencies
      );

      nextState = {
        ...state,
        assessment
      };
      status = 'SUCCEEDED';
    } catch (e) {
      errors.push(this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'TRANSFORMATION_ASSESSMENT'));
    }

    this.recordLogicalStageResult('TRANSFORMATION_ASSESSMENT', status, startedAt, results, errors);
    const completedAt = this.dependencies.clock.toISOString();
    
    return {
      stage: 'TRANSFORMATION_ASSESSMENT',
      status,
      startedAt,
      completedAt,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private normalizeError(error: unknown, defaultCode: string, stage?: PipelineStageId): SerializableAuraOSError {
    if (error instanceof AuraIntelligenceOSError) {
      return error.toJSON();
    }
    
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as any)?.code || defaultCode;
    
    const osError = new AuraIntelligenceOSError(code, message, false, stage, undefined, error);
    return osError.toJSON();
  }
}
