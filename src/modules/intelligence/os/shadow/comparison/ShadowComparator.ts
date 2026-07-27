import type { ShadowClock, ShadowExecutionIdGenerator } from '../ports';
import type { ShadowComparatorPort } from './ports';
import type { 
  ShadowComparisonRequest, 
  ShadowComparisonResult, 
  ShadowDifference,
  ShadowDifferenceType,
  ShadowDifferenceSeverity,
  LegacyComparisonInput,
  OSComparisonInput,
  ShadowComparisonStatus,
  ShadowComparisonMetrics
} from './types';
import { MetadataSanitizer } from '../metadataSanitizer';
import type { PipelineStageId, PipelineResult } from '../../types';
import { ShadowComparisonError, ShadowComparisonErrorCodes } from './errors';

export class ShadowComparator implements ShadowComparatorPort {
  private clock: ShadowClock;
  private idGenerator: ShadowExecutionIdGenerator;

  constructor(
    clock: ShadowClock,
    idGenerator: ShadowExecutionIdGenerator
  ) {
    this.clock = clock;
    this.idGenerator = idGenerator;
  }

  public compare(request: ShadowComparisonRequest): ShadowComparisonResult {
    const startedAtMs = this.clock.now();
    const startedAt = this.clock.toISOString();
    const comparisonId = request.comparisonId || this.idGenerator.generateExecutionId();

    try {
      this.validateInput(request);
      
      const { legacyInput, osResult, policy } = request;

      // Derive OS Comparison Input from OS Result
      const osInput = this.deriveOSInput(osResult);
      
      const differences: ShadowDifference[] = [];
      const comparableFields: string[] = [];
      const nonComparableFields: string[] = [];

      // Helper to add difference
      const addDiff = (
        type: ShadowDifferenceType,
        field: string,
        legacyValue: unknown,
        osValue: unknown,
        defaultSeverity: ShadowDifferenceSeverity,
        message: string,
        delta?: number
      ) => {
        if (policy.ignoredDifferenceTypes.includes(type)) return;
        if (differences.length >= policy.maxDifferences) return;

        let severity = defaultSeverity;
        if (type === 'STATUS_MISMATCH' && policy.criticalStatusPairs[`${legacyValue}:${osValue}`]) {
          severity = 'CRITICAL';
        } else if (type === 'STATUS_MISMATCH' && policy.criticalStatusPairs[`${osValue}:${legacyValue}`]) {
          severity = 'CRITICAL';
        }

        differences.push({ type, field, legacyValue, osValue, severity, message, delta });
      };

      // 1. Completion / Status Mismatch
      comparableFields.push('status');
      const legacyStatus = legacyInput.completionStatus || (legacyInput.closed ? 'COMPLETED' : 'PENDING');
      const osStatus = osInput.pipelineStatus;
      
      // Exact match is not always possible without domain mapping, but we compare strings
      if (legacyStatus !== osStatus) {
        addDiff('STATUS_MISMATCH', 'status', legacyStatus, osStatus, 'HIGH', 'Pipeline status mismatch');
      }

      // 2. Coverage Delta
      if (legacyInput.coverageScore !== undefined && osInput.coverageScore !== undefined) {
        comparableFields.push('coverageScore');
        if (Number.isNaN(legacyInput.coverageScore) || Number.isNaN(osInput.coverageScore) || 
            !isFinite(legacyInput.coverageScore) || !isFinite(osInput.coverageScore)) {
          throw new ShadowComparisonError(ShadowComparisonErrorCodes.SHADOW_COMPARISON_INVALID_INPUT, 'Invalid coverage score', false);
        }
        
        const delta = Math.abs(legacyInput.coverageScore - osInput.coverageScore);
        if (delta > policy.coverageDeltaThreshold) {
          addDiff('COVERAGE_DELTA', 'coverageScore', legacyInput.coverageScore, osInput.coverageScore, 'MEDIUM', 'Coverage score exceeds threshold', delta);
        }
      } else if (legacyInput.coverageScore !== undefined || osInput.coverageScore !== undefined) {
        nonComparableFields.push('coverageScore');
        if (policy.treatMissingAsDifference) {
          if (legacyInput.coverageScore === undefined) addDiff('MISSING_IN_LEGACY', 'coverageScore', undefined, osInput.coverageScore, 'LOW', 'Missing coverage in legacy');
          else addDiff('MISSING_IN_OS', 'coverageScore', legacyInput.coverageScore, undefined, 'LOW', 'Missing coverage in OS');
        }
      }

      // 3. Duration Delta
      if (osInput.durationMs !== undefined) {
        // Legacy doesn't always have duration, but if it did, we'd compare. 
        // For now, only OS has it explicitly in derivation.
        nonComparableFields.push('duration');
      }

      // 4. Findings Count Delta
      if (legacyInput.findingsCount !== undefined && osInput.findingsCount !== undefined) {
        comparableFields.push('findingsCount');
        if (Number.isNaN(legacyInput.findingsCount) || Number.isNaN(osInput.findingsCount)) {
          throw new ShadowComparisonError(ShadowComparisonErrorCodes.SHADOW_COMPARISON_INVALID_INPUT, 'Invalid findings count', false);
        }
        const delta = Math.abs(legacyInput.findingsCount - osInput.findingsCount);
        if (delta > policy.findingsCountDeltaThreshold) {
          addDiff('FINDINGS_COUNT_DELTA', 'findingsCount', legacyInput.findingsCount, osInput.findingsCount, 'LOW', 'Findings count exceeds threshold', delta);
        }
      } else if (legacyInput.findingsCount !== undefined || osInput.findingsCount !== undefined) {
        nonComparableFields.push('findingsCount');
        if (policy.treatMissingAsDifference) {
          if (legacyInput.findingsCount === undefined) addDiff('MISSING_IN_LEGACY', 'findingsCount', undefined, osInput.findingsCount, 'LOW', 'Missing findings count in legacy');
          else addDiff('MISSING_IN_OS', 'findingsCount', legacyInput.findingsCount, undefined, 'LOW', 'Missing findings count in OS');
        }
      }

      // 5. Objective Match
      if (legacyInput.nextObjective !== undefined && osInput.planningObjective !== undefined) {
        comparableFields.push('nextObjective');
        const lObj = legacyInput.nextObjective.trim();
        const oObj = osInput.planningObjective.trim();
        if (lObj !== oObj) {
          addDiff('OBJECTIVE_MISMATCH', 'nextObjective', lObj, oObj, 'MEDIUM', 'Planning objective mismatch');
        }
      } else if (legacyInput.nextObjective !== undefined || osInput.planningObjective !== undefined) {
        nonComparableFields.push('nextObjective');
        if (policy.treatMissingAsDifference) {
          if (legacyInput.nextObjective === undefined) addDiff('MISSING_IN_LEGACY', 'nextObjective', undefined, osInput.planningObjective, 'LOW', 'Missing objective in legacy');
          else addDiff('MISSING_IN_OS', 'nextObjective', legacyInput.nextObjective, undefined, 'LOW', 'Missing objective in OS');
        }
      }

      // 6. Diagnostic / Assessment Status
      if (legacyInput.diagnosticStatus !== undefined && osInput.dossierStatus !== undefined) {
        comparableFields.push('diagnosticStatus');
        if (legacyInput.diagnosticStatus !== osInput.dossierStatus) {
          addDiff('DIAGNOSTIC_STATUS_MISMATCH', 'diagnosticStatus', legacyInput.diagnosticStatus, osInput.dossierStatus, 'MEDIUM', 'Diagnostic status mismatch');
        }
      }
      if (legacyInput.assessmentStatus !== undefined && osInput.assessmentStatus !== undefined) {
        comparableFields.push('assessmentStatus');
        if (legacyInput.assessmentStatus !== osInput.assessmentStatus) {
          addDiff('ASSESSMENT_STATUS_MISMATCH', 'assessmentStatus', legacyInput.assessmentStatus, osInput.assessmentStatus, 'MEDIUM', 'Assessment status mismatch');
        }
      }

      // 7. Skipped Stages & Stage Statuses
      if (policy.compareSkippedStages && legacyInput.stageStatusMap) {
        comparableFields.push('stageStatuses');
        for (const [stage, status] of Object.entries(legacyInput.stageStatusMap)) {
          const osStageStatus = osInput.stageStatuses[stage as keyof typeof osInput.stageStatuses];
          if (osStageStatus) {
            if (osStageStatus !== status) {
              addDiff('STAGE_MISMATCH', `stageStatus.${stage}`, status, osStageStatus, 'MEDIUM', `Stage status mismatch for ${stage}`);
            }
          } else if (osInput.skippedStages.includes(stage as PipelineStageId)) {
            if (status !== 'SKIPPED') {
              addDiff('STAGE_MISMATCH', `stageStatus.${stage}`, status, 'SKIPPED', 'LOW', `Stage skipped in OS but ${status} in legacy`);
            }
          } else if (policy.treatMissingAsDifference) {
            addDiff('MISSING_IN_OS', `stageStatus.${stage}`, status, undefined, 'LOW', `Stage missing in OS`);
          }
        }
      } else if (legacyInput.stageStatusMap) {
        nonComparableFields.push('stageStatuses');
      }

      // Order differences deterministically by field then type
      differences.sort((a, b) => a.field.localeCompare(b.field) || a.type.localeCompare(b.type));

      // Metrics
      const statusMatch = !differences.some(d => d.type === 'STATUS_MISMATCH');
      const objectiveMatch = !differences.some(d => d.type === 'OBJECTIVE_MISMATCH');
      
      const diffsByType: Partial<Record<ShadowDifferenceType, number>> = {};
      const diffsBySeverity: Partial<Record<ShadowDifferenceSeverity, number>> = {};
      
      for (const d of differences) {
        diffsByType[d.type] = (diffsByType[d.type] || 0) + 1;
        diffsBySeverity[d.severity] = (diffsBySeverity[d.severity] || 0) + 1;
      }

      const metrics: ShadowComparisonMetrics = {
        totalFieldsCompared: comparableFields.length,
        totalDifferences: differences.length,
        differencesByType: diffsByType,
        differencesBySeverity: diffsBySeverity,
        comparableRatio: comparableFields.length / (comparableFields.length + nonComparableFields.length || 1),
        coverageDelta: differences.find(d => d.type === 'COVERAGE_DELTA')?.delta,
        findingsCountDelta: differences.find(d => d.type === 'FINDINGS_COUNT_DELTA')?.delta,
        statusMatch,
        objectiveMatch
      };

      const status: ShadowComparisonStatus = differences.length > 0 ? 'COMPLETED_WITH_DIFFERENCES' : 'COMPLETED';

      const legacySnapshot = this.createLegacySnapshot(legacyInput);
      const osSnapshot = this.createOSSnapshot(osInput);
      
      const sanitizedMetadata = policy.includeSafeMetadata 
        ? MetadataSanitizer.sanitize(legacyInput.safeMetadata)
        : undefined;

      return {
        comparisonId,
        executionKey: request.legacyInput.executionKey,
        sessionKey: request.legacyInput.sessionKey,
        status,
        startedAt,
        completedAt: this.clock.toISOString(),
        durationMs: this.clock.now() - startedAtMs,
        summary: differences.length > 0 ? `Completed with ${differences.length} differences` : 'Perfect match',
        differences,
        metrics,
        comparableFields,
        nonComparableFields,
        legacySnapshot,
        osSnapshot,
        sanitizedMetadata,
        warnings: []
      };
    } catch (e) {
      return this.buildInvalidResult(request, comparisonId, startedAt, startedAtMs, e);
    }
  }

  private validateInput(request: ShadowComparisonRequest) {
    if (!request.legacyInput || !request.legacyInput.executionKey || !request.legacyInput.sessionKey) {
      throw new ShadowComparisonError(ShadowComparisonErrorCodes.SHADOW_COMPARISON_INVALID_INPUT, 'Missing required legacy input fields', false);
    }
    if (!request.osResult) {
      throw new ShadowComparisonError(ShadowComparisonErrorCodes.SHADOW_COMPARISON_INVALID_INPUT, 'Missing required OS result', false);
    }
    if (!request.policy) {
      throw new ShadowComparisonError(ShadowComparisonErrorCodes.SHADOW_COMPARISON_INVALID_INPUT, 'Missing required policy', false);
    }
  }

  private deriveOSInput(osResult: ShadowExecutionResult | PipelineResult): OSComparisonInput {
    // If osResult is a ShadowExecutionResult, unwrap the pipelineResult
    const pipelineResult = 'pipelineResult' in osResult ? osResult.pipelineResult! : osResult;

    const input: OSComparisonInput = {
      pipelineStatus: pipelineResult.status || osResult.status,
      durationMs: pipelineResult.durationMs,
      skippedStages: pipelineResult.skippedStages || [],
      stageStatuses: {},
      errors: pipelineResult.errors || []
    };

    if (pipelineResult.stageResults) {
      for (const [stageId, stageData] of Object.entries(pipelineResult.stageResults)) {
        input.stageStatuses[stageId as keyof typeof input.stageStatuses] = stageData.status;
        
        // Extract specific scalar metrics if present in stage output
        if (stageId === 'KNOWLEDGE_COVERAGE' && stageData.output?.score !== undefined) {
          input.coverageScore = stageData.output.score;
        }
        if (stageId === 'EVIDENCE_EXTRACTION' && stageData.output?.findings) {
          input.findingsCount = stageData.output.findings.length;
        }
        if (stageId === 'ADAPTIVE_PLANNING' && stageData.output?.objective) {
          input.planningObjective = stageData.output.objective;
        }
        if (stageId === 'EXECUTIVE_DOSSIER') {
          input.dossierStatus = stageData.status;
        }
        if (stageId === 'TRANSFORMATION_ASSESSMENT') {
          input.assessmentStatus = stageData.status;
        }
      }
    }
    
    return input;
  }

  private createLegacySnapshot(input: LegacyComparisonInput): Partial<LegacyComparisonInput> {
    const snapshot: Partial<LegacyComparisonInput> = {
      sessionKey: input.sessionKey,
      executionKey: input.executionKey,
      completionStatus: input.completionStatus,
      closed: input.closed,
      nextObjective: input.nextObjective,
      coverageScore: input.coverageScore,
      findingsCount: input.findingsCount,
      diagnosticStatus: input.diagnosticStatus,
      assessmentStatus: input.assessmentStatus
    };
    if (input.stageStatusMap) {
      snapshot.stageStatusMap = { ...input.stageStatusMap };
    }
    return snapshot;
  }

  private createOSSnapshot(input: OSComparisonInput): Partial<OSComparisonInput> {
    return {
      pipelineStatus: input.pipelineStatus,
      durationMs: input.durationMs,
      coverageScore: input.coverageScore,
      planningObjective: input.planningObjective,
      findingsCount: input.findingsCount,
      dossierStatus: input.dossierStatus,
      assessmentStatus: input.assessmentStatus,
      skippedStages: [...input.skippedStages],
      stageStatuses: { ...input.stageStatuses },
      errors: input.errors.map(e => ({ ...e }))
    };
  }

  private buildInvalidResult(
    request: ShadowComparisonRequest,
    comparisonId: string,
    startedAt: string,
    startedAtMs: number,
    error: unknown
  ): ShadowComparisonResult {
    return {
      comparisonId,
      executionKey: request.legacyInput?.executionKey || 'unknown',
      sessionKey: request.legacyInput?.sessionKey || 'unknown',
      status: 'INVALID_INPUT',
      startedAt,
      completedAt: this.clock.toISOString(),
      durationMs: this.clock.now() - startedAtMs,
      summary: 'Invalid input',
      differences: [],
      metrics: {
        totalFieldsCompared: 0,
        totalDifferences: 0,
        differencesByType: {},
        differencesBySeverity: {},
        comparableRatio: 0,
        statusMatch: false,
        objectiveMatch: false
      },
      comparableFields: [],
      nonComparableFields: [],
      warnings: [],
      normalizedError: error instanceof ShadowComparisonError ? error.toJSON() : new ShadowComparisonError(
        ShadowComparisonErrorCodes.SHADOW_COMPARISON_INVALID_INPUT,
        error.message || 'Unknown error',
        false
      ).toJSON()
    };
  }
}
