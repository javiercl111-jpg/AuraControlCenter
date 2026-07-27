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
import { executeWithGuards, type GuardContext } from './executionGuards';

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

  private cloneState(state: PipelineAggregatedState): PipelineAggregatedState {
    return {
      ...state,
      objectiveIds: state.objectiveIds ? [...state.objectiveIds] : undefined,
      metadata: state.metadata ? { ...state.metadata } : undefined,
      evidence: state.evidence ? [...state.evidence] : undefined,
      hypotheses: state.hypotheses ? [...state.hypotheses] : undefined,
      constraints: state.constraints ? [...state.constraints] : undefined,
      transformationConstraints: state.transformationConstraints ? [...state.transformationConstraints] : undefined,
      transformationDependencies: state.transformationDependencies ? [...state.transformationDependencies] : undefined,
      executiveObjectives: state.executiveObjectives ? [...state.executiveObjectives] : undefined
    };
  }

  private buildGuardContext(globalStartedAtMs: number): GuardContext {
    return {
      clock: this.dependencies.clock,
      timeoutPolicy: this.dependencies.timeoutPolicy,
      cancellationSignal: this.dependencies.cancellationSignal,
      auditSink: this.dependencies.auditSink,
      globalStartedAtMs,
      executionId: this.osContext.executionId
    };
  }

  public async executePipeline(
    input: OrchestrationInput,
    initialState?: PipelineAggregatedState
  ): Promise<PipelineResult> {
    const startedAt = this.dependencies.clock.toISOString();
    const globalStartedAtMs = this.dependencies.clock.now();
    const guardCtx = this.buildGuardContext(globalStartedAtMs);

    const stageResults: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>> = {};
    const skippedStages: PipelineStageId[] = [];
    const warnings: string[] = [];
    let partialFailures = false;

    let currentState: PipelineAggregatedState = initialState ? this.cloneState(initialState) : {
      sessionId: input.sessionId,
      executionKey: input.executionKey,
      targetScenario: input.targetScenario,
      objectiveIds: input.objectiveIds ? [...input.objectiveIds] : undefined,
      metadata: input.metadata ? { ...input.metadata } : undefined
    };

    try {
      let pipelineAborted = false;

      // 1. EVIDENCE_EXTRACTION + MENTAL_MODEL + KNOWLEDGE_GRAPH
      let extractionFailed = false;
      if (!this.checkCancelled('EVIDENCE_EXTRACTION', skippedStages, globalStartedAtMs)) {
        if (!this.dependencies.extractionApplier) {
          skippedStages.push('EVIDENCE_EXTRACTION', 'MENTAL_MODEL', 'KNOWLEDGE_GRAPH');
        } else {
          const result = await this.executeExtractionStage(currentState, stageResults, guardCtx);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            extractionFailed = true;
            partialFailures = true;
            if (result.status === 'TIMED_OUT' || result.status === 'CANCELLED') pipelineAborted = true;
          }
        }
      }

      if (extractionFailed || pipelineAborted) {
        if (!skippedStages.includes('MENTAL_MODEL')) skippedStages.push('MENTAL_MODEL', 'KNOWLEDGE_GRAPH');
        skippedStages.push('KNOWLEDGE_COVERAGE', 'ADAPTIVE_PLANNING', 'EXECUTIVE_REASONING', 'EXECUTIVE_DOSSIER', 'TRANSFORMATION_ASSESSMENT');
        return this.finalizePipeline(currentState, stageResults, skippedStages, partialFailures, warnings, startedAt, globalStartedAtMs);
      }

      // 4. KNOWLEDGE_COVERAGE
      if (!this.checkCancelled('KNOWLEDGE_COVERAGE', skippedStages, globalStartedAtMs) && !skippedStages.includes('KNOWLEDGE_COVERAGE')) {
        if (!this.dependencies.coverageDecisionEngine) {
          skippedStages.push('KNOWLEDGE_COVERAGE');
        } else {
          const result = await this.executeCoverageStage(currentState, stageResults, guardCtx);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            partialFailures = true;
            if (result.status === 'TIMED_OUT' || result.status === 'CANCELLED') pipelineAborted = true;
          }
        }
      }

      if (pipelineAborted) {
        skippedStages.push('ADAPTIVE_PLANNING', 'EXECUTIVE_REASONING', 'EXECUTIVE_DOSSIER', 'TRANSFORMATION_ASSESSMENT');
        return this.finalizePipeline(currentState, stageResults, skippedStages, partialFailures, warnings, startedAt, globalStartedAtMs);
      }

      // 5. ADAPTIVE_PLANNING
      if (!this.checkCancelled('ADAPTIVE_PLANNING', skippedStages, globalStartedAtMs) && !skippedStages.includes('ADAPTIVE_PLANNING')) {
        if (!this.dependencies.adaptiveQuestionPlanner) {
          skippedStages.push('ADAPTIVE_PLANNING');
        } else {
          const result = await this.executePlanningStage(currentState, stageResults, guardCtx);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            partialFailures = true;
            if (result.status === 'TIMED_OUT' || result.status === 'CANCELLED') pipelineAborted = true;
          }
        }
      }

      if (pipelineAborted) {
        skippedStages.push('EXECUTIVE_REASONING', 'EXECUTIVE_DOSSIER', 'TRANSFORMATION_ASSESSMENT');
        return this.finalizePipeline(currentState, stageResults, skippedStages, partialFailures, warnings, startedAt, globalStartedAtMs);
      }

      // 6. EXECUTIVE_REASONING
      let reasoningFailed = false;
      if (!this.checkCancelled('EXECUTIVE_REASONING', skippedStages, globalStartedAtMs) && !skippedStages.includes('EXECUTIVE_REASONING')) {
        if (!this.dependencies.executiveReasoningEngine) {
          skippedStages.push('EXECUTIVE_REASONING');
          reasoningFailed = true;
        } else {
          const result = await this.executeReasoningStage(currentState, stageResults, guardCtx);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            reasoningFailed = true;
            partialFailures = true;
            if (result.status === 'TIMED_OUT' || result.status === 'CANCELLED') pipelineAborted = true;
          }
        }
      }

      if (reasoningFailed || pipelineAborted) {
        skippedStages.push('EXECUTIVE_DOSSIER', 'TRANSFORMATION_ASSESSMENT');
        return this.finalizePipeline(currentState, stageResults, skippedStages, partialFailures, warnings, startedAt, globalStartedAtMs);
      }

      // 7. EXECUTIVE_DOSSIER
      let dossierFailed = false;
      if (!this.checkCancelled('EXECUTIVE_DOSSIER', skippedStages, globalStartedAtMs) && !skippedStages.includes('EXECUTIVE_DOSSIER')) {
        if (!this.dependencies.executiveDossierBuilder) {
          skippedStages.push('EXECUTIVE_DOSSIER');
          dossierFailed = true;
        } else {
          const result = await this.executeDossierStage(currentState, stageResults, guardCtx);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            dossierFailed = true;
            partialFailures = true;
            if (result.status === 'TIMED_OUT' || result.status === 'CANCELLED') pipelineAborted = true;
          }
        }
      }

      if (dossierFailed || pipelineAborted) {
        skippedStages.push('TRANSFORMATION_ASSESSMENT');
        return this.finalizePipeline(currentState, stageResults, skippedStages, partialFailures, warnings, startedAt, globalStartedAtMs);
      }

      // 8. TRANSFORMATION_ASSESSMENT
      if (!this.checkCancelled('TRANSFORMATION_ASSESSMENT', skippedStages, globalStartedAtMs) && !skippedStages.includes('TRANSFORMATION_ASSESSMENT')) {
        if (!this.dependencies.enterpriseTransformationAssessmentBuilder) {
          skippedStages.push('TRANSFORMATION_ASSESSMENT');
        } else {
          const result = await this.executeAssessmentStage(currentState, stageResults, guardCtx);
          if (result.status === 'SUCCEEDED' && result.output) {
            currentState = result.output;
          } else {
            partialFailures = true;
          }
        }
      }

      return this.finalizePipeline(currentState, stageResults, skippedStages, partialFailures, warnings, startedAt, globalStartedAtMs);

    } catch (error) {
      const osError = this.normalizeError(error, ErrorCodes.ORCHESTRATION_FAILED, undefined);
      return this.finalizePipeline(currentState, stageResults, skippedStages, true, warnings, startedAt, globalStartedAtMs, [osError]);
    }
  }

  private checkCancelled(stage: PipelineStageId, skippedStages: PipelineStageId[], globalStartedAtMs: number): boolean {
    if (this.dependencies.cancellationSignal?.aborted) {
      skippedStages.push(stage);
      return true;
    }
    const globalTimeoutMs = this.dependencies.timeoutPolicy?.getExecutionTimeoutMs() ?? 0;
    if (globalTimeoutMs > 0) {
      const elapsed = this.dependencies.clock.now() - globalStartedAtMs;
      if (elapsed >= globalTimeoutMs) {
        skippedStages.push(stage);
        return true;
      }
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
    globalStartedAtMs: number,
    globalErrors: SerializableAuraOSError[] = []
  ): PipelineResult {
    const completedAt = this.dependencies.clock.toISOString();
    const durationMs = this.dependencies.clock.now() - globalStartedAtMs;

    let status: PipelineStatus = 'SUCCESS';
    const results = Object.values(stageResults);
    const hasCancelled = this.dependencies.cancellationSignal?.aborted || results.some(r => r?.status === 'CANCELLED');
    const hasTimedOut = results.some(r => r?.status === 'TIMED_OUT');
    const globalTimeoutMs = this.dependencies.timeoutPolicy?.getExecutionTimeoutMs() ?? 0;
    const globalTimedOut = globalTimeoutMs > 0 && durationMs >= globalTimeoutMs;

    if (hasCancelled || globalErrors.some(e => e.code === ErrorCodes.CANCELLED)) {
      status = 'CANCELLED';
    } else if (hasTimedOut || globalTimedOut || globalErrors.some(e => e.code === ErrorCodes.PIPELINE_TIMEOUT)) {
      status = 'TIMED_OUT';
    } else if (globalErrors.length > 0) {
      status = 'FAILED';
    } else {
      const allSucceeded = results.every(r => r?.status === 'SUCCEEDED');
      const anySucceeded = results.some(r => r?.status === 'SUCCEEDED');
      const anyFailed = results.some(r => r?.status === 'FAILED');

      if (allSucceeded && skippedStages.length === 0 && !anyFailed) {
        status = 'SUCCESS';
      } else if (anySucceeded && !anyFailed) {
        status = 'PARTIAL_SUCCESS';
      } else if (anySucceeded && anyFailed) {
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
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>,
    guardCtx: GuardContext
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAtString = this.dependencies.clock.toISOString();
    const startedAtMs = this.dependencies.clock.now();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      nextState = await executeWithGuards(async () => {
        if (!this.dependencies.extractionApplier || !state.extractionResult || !state.mentalModel || !state.knowledgeGraph) {
          throw new AuraIntelligenceOSError(ErrorCodes.STAGE_DEPENDENCY_FAILED, 'Missing extraction dependencies or state', false, 'EVIDENCE_EXTRACTION');
        }

        const result = this.dependencies.extractionApplier.applyExtraction(
          state.mentalModel,
          state.knowledgeGraph,
          state.extractionResult
        );

        return {
          ...state,
          mentalModel: result.mentalModel,
          knowledgeGraph: result.knowledgeGraph,
          extractionResult: result.extractionResult
        };
      }, 'EVIDENCE_EXTRACTION', guardCtx);
      
      status = 'SUCCEEDED';
      this.recordLogicalStageResult('EVIDENCE_EXTRACTION', 'SUCCEEDED', startedAtMs, startedAtString, results);
      this.recordLogicalStageResult('MENTAL_MODEL', 'SUCCEEDED', startedAtMs, startedAtString, results);
      this.recordLogicalStageResult('KNOWLEDGE_GRAPH', 'SUCCEEDED', startedAtMs, startedAtString, results);

    } catch (e) {
      const osError = this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'EVIDENCE_EXTRACTION');
      errors.push(osError);
      
      if (osError.code === ErrorCodes.CANCELLED) status = 'CANCELLED';
      else if (osError.code === ErrorCodes.STAGE_TIMEOUT || osError.code === ErrorCodes.PIPELINE_TIMEOUT) status = 'TIMED_OUT';
      
      this.recordLogicalStageResult('EVIDENCE_EXTRACTION', status, startedAtMs, startedAtString, results, errors);
      this.recordLogicalStageResult('MENTAL_MODEL', status, startedAtMs, startedAtString, results);
      this.recordLogicalStageResult('KNOWLEDGE_GRAPH', status, startedAtMs, startedAtString, results);
    }

    const completedAt = this.dependencies.clock.toISOString();
    return {
      stage: 'EVIDENCE_EXTRACTION',
      status,
      startedAt: startedAtString,
      completedAt,
      durationMs: this.dependencies.clock.now() - startedAtMs,
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private recordLogicalStageResult(
    stage: PipelineStageId,
    status: StageStatus,
    startedAtMs: number,
    startedAtString: string,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>,
    errors: SerializableAuraOSError[] = []
  ) {
    const completedAt = this.dependencies.clock.toISOString();
    results[stage] = {
      stage,
      status,
      startedAt: startedAtString,
      completedAt,
      durationMs: this.dependencies.clock.now() - startedAtMs,
      errors,
      warnings: []
    };
  }

  private async executeCoverageStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>,
    guardCtx: GuardContext
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAtString = this.dependencies.clock.toISOString();
    const startedAtMs = this.dependencies.clock.now();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      nextState = await executeWithGuards(async () => {
        const ctx = PipelineContextBuilder.buildCoverageContext(state);
        if (!this.dependencies.coverageDecisionEngine || !this.dependencies.coverageCalculator) {
          throw new AuraIntelligenceOSError(ErrorCodes.STAGE_DEPENDENCY_FAILED, 'Missing coverage dependencies', false, 'KNOWLEDGE_COVERAGE');
        }

        const report = this.dependencies.coverageCalculator.calculateOverallReport(ctx.graph);
        const assessment = this.dependencies.coverageDecisionEngine.evaluateDecisionReadiness(
          report,
          ctx.targetScenario
        );

        return {
          ...state,
          coverageReport: report,
          readinessAssessment: assessment
        };
      }, 'KNOWLEDGE_COVERAGE', guardCtx);
      
      status = 'SUCCEEDED';
    } catch (e) {
      const osError = this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'KNOWLEDGE_COVERAGE');
      errors.push(osError);
      
      if (osError.code === ErrorCodes.CANCELLED) status = 'CANCELLED';
      else if (osError.code === ErrorCodes.STAGE_TIMEOUT || osError.code === ErrorCodes.PIPELINE_TIMEOUT) status = 'TIMED_OUT';
    }

    this.recordLogicalStageResult('KNOWLEDGE_COVERAGE', status, startedAtMs, startedAtString, results, errors);
    const completedAt = this.dependencies.clock.toISOString();
    
    return {
      stage: 'KNOWLEDGE_COVERAGE',
      status,
      startedAt: startedAtString,
      completedAt,
      durationMs: this.dependencies.clock.now() - startedAtMs,
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private async executePlanningStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>,
    guardCtx: GuardContext
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAtString = this.dependencies.clock.toISOString();
    const startedAtMs = this.dependencies.clock.now();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      nextState = await executeWithGuards(async () => {
        const { options, executionContext } = PipelineContextBuilder.buildPlanningContext(state, this.dependencies, this.osContext);
        if (!this.dependencies.adaptiveQuestionPlanner) {
          throw new AuraIntelligenceOSError(ErrorCodes.STAGE_DEPENDENCY_FAILED, 'Missing adaptiveQuestionPlanner', false, 'ADAPTIVE_PLANNING');
        }

        const planResult = await this.dependencies.adaptiveQuestionPlanner.planQuestionsFromGraph(options, executionContext);

        return {
          ...state,
          planningResult: planResult
        };
      }, 'ADAPTIVE_PLANNING', guardCtx);
      
      status = 'SUCCEEDED';
    } catch (e) {
      const osError = this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'ADAPTIVE_PLANNING');
      errors.push(osError);
      
      if (osError.code === ErrorCodes.CANCELLED) status = 'CANCELLED';
      else if (osError.code === ErrorCodes.STAGE_TIMEOUT || osError.code === ErrorCodes.PIPELINE_TIMEOUT) status = 'TIMED_OUT';
    }

    this.recordLogicalStageResult('ADAPTIVE_PLANNING', status, startedAtMs, startedAtString, results, errors);
    const completedAt = this.dependencies.clock.toISOString();
    
    return {
      stage: 'ADAPTIVE_PLANNING',
      status,
      startedAt: startedAtString,
      completedAt,
      durationMs: this.dependencies.clock.now() - startedAtMs,
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private async executeReasoningStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>,
    guardCtx: GuardContext
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAtString = this.dependencies.clock.toISOString();
    const startedAtMs = this.dependencies.clock.now();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      nextState = await executeWithGuards(async () => {
        const { context, executionContext } = PipelineContextBuilder.buildReasoningContext(state, this.dependencies, this.osContext);
        if (!this.dependencies.executiveReasoningEngine) {
          throw new AuraIntelligenceOSError(ErrorCodes.STAGE_DEPENDENCY_FAILED, 'Missing executiveReasoningEngine', false, 'EXECUTIVE_REASONING');
        }

        const report = this.dependencies.executiveReasoningEngine.execute(context, executionContext);

        return {
          ...state,
          reasoningReport: report
        };
      }, 'EXECUTIVE_REASONING', guardCtx);
      
      status = 'SUCCEEDED';
    } catch (e) {
      const osError = this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'EXECUTIVE_REASONING');
      errors.push(osError);
      
      if (osError.code === ErrorCodes.CANCELLED) status = 'CANCELLED';
      else if (osError.code === ErrorCodes.STAGE_TIMEOUT || osError.code === ErrorCodes.PIPELINE_TIMEOUT) status = 'TIMED_OUT';
    }

    this.recordLogicalStageResult('EXECUTIVE_REASONING', status, startedAtMs, startedAtString, results, errors);
    const completedAt = this.dependencies.clock.toISOString();
    
    return {
      stage: 'EXECUTIVE_REASONING',
      status,
      startedAt: startedAtString,
      completedAt,
      durationMs: this.dependencies.clock.now() - startedAtMs,
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private async executeDossierStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>,
    guardCtx: GuardContext
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAtString = this.dependencies.clock.toISOString();
    const startedAtMs = this.dependencies.clock.now();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      nextState = await executeWithGuards(async () => {
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

        return {
          ...state,
          dossier
        };
      }, 'EXECUTIVE_DOSSIER', guardCtx);
      
      status = 'SUCCEEDED';
    } catch (e) {
      const osError = this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'EXECUTIVE_DOSSIER');
      errors.push(osError);
      
      if (osError.code === ErrorCodes.CANCELLED) status = 'CANCELLED';
      else if (osError.code === ErrorCodes.STAGE_TIMEOUT || osError.code === ErrorCodes.PIPELINE_TIMEOUT) status = 'TIMED_OUT';
    }

    this.recordLogicalStageResult('EXECUTIVE_DOSSIER', status, startedAtMs, startedAtString, results, errors);
    const completedAt = this.dependencies.clock.toISOString();
    
    return {
      stage: 'EXECUTIVE_DOSSIER',
      status,
      startedAt: startedAtString,
      completedAt,
      durationMs: this.dependencies.clock.now() - startedAtMs,
      output: status === 'SUCCEEDED' ? nextState : undefined,
      errors,
      warnings: []
    };
  }

  private async executeAssessmentStage(
    state: PipelineAggregatedState,
    results: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>,
    guardCtx: GuardContext
  ): Promise<PipelineStageResult<PipelineAggregatedState>> {
    const startedAtString = this.dependencies.clock.toISOString();
    const startedAtMs = this.dependencies.clock.now();
    let status: StageStatus = 'FAILED';
    const errors: SerializableAuraOSError[] = [];
    let nextState = state;

    try {
      nextState = await executeWithGuards(async () => {
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

        return {
          ...state,
          assessment
        };
      }, 'TRANSFORMATION_ASSESSMENT', guardCtx);
      
      status = 'SUCCEEDED';
    } catch (e) {
      const osError = this.normalizeError(e, ErrorCodes.STAGE_EXECUTION_FAILED, 'TRANSFORMATION_ASSESSMENT');
      errors.push(osError);
      
      if (osError.code === ErrorCodes.CANCELLED) status = 'CANCELLED';
      else if (osError.code === ErrorCodes.STAGE_TIMEOUT || osError.code === ErrorCodes.PIPELINE_TIMEOUT) status = 'TIMED_OUT';
    }

    this.recordLogicalStageResult('TRANSFORMATION_ASSESSMENT', status, startedAtMs, startedAtString, results, errors);
    const completedAt = this.dependencies.clock.toISOString();
    
    return {
      stage: 'TRANSFORMATION_ASSESSMENT',
      status,
      startedAt: startedAtString,
      completedAt,
      durationMs: this.dependencies.clock.now() - startedAtMs,
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
    const code = (error && typeof error === 'object' && 'code' in error && typeof (error as {code: string}).code === 'string') 
      ? (error as {code: string}).code 
      : defaultCode;
    
    const osError = new AuraIntelligenceOSError(code, message, false, stage, undefined, error);
    return osError.toJSON();
  }
}
