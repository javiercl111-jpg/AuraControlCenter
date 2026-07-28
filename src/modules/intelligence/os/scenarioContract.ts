import { AuraIntelligenceOSError, ErrorCodes } from './errors';
import type { PipelineExecutionScenario } from './types';
import type { CoverageScenarioScope } from '../enterprise-model/coverage/domain/types';
import {
  assertCoverageScenarioScopeValid,
  CoverageScenarioScopeValidationError
} from '../enterprise-model/coverage/domain/validation';

export function assertExecutionScenarioCompatibility(
  executionScenario: PipelineExecutionScenario | undefined,
  targetScenario: string | undefined
): void {
  if (
    executionScenario &&
    targetScenario !== undefined &&
    executionScenario.scenarioId !== targetScenario
  ) {
    throw new AuraIntelligenceOSError(
      ErrorCodes.INVALID_CONTRACT,
      'executionScenario.scenarioId must match targetScenario when both are provided',
      false,
      undefined,
      {
        executionScenarioId: executionScenario.scenarioId,
        targetScenario,
      }
    );
  }
}

export function clonePipelineExecutionScenario(
  scenario: PipelineExecutionScenario
): PipelineExecutionScenario {
  const stageDependencies = Object.fromEntries(
    Object.entries(scenario.stageDependencies).map(([stage, dependencies]) => [
      stage,
      [...dependencies],
    ])
  ) as unknown as PipelineExecutionScenario['stageDependencies'];

  return {
    scenarioId: scenario.scenarioId,
    scenarioVersion: scenario.scenarioVersion,
    objectiveKey: scenario.objectiveKey,
    requestedStages: [...scenario.requestedStages],
    allowedStages: [...scenario.allowedStages],
    requiredStages: [...scenario.requiredStages],
    stageDependencies,
    includedDomains: [...scenario.includedDomains],
    excludedDomains: [...scenario.excludedDomains],
  };
}

export function cloneAndFreezePipelineExecutionScenario(
  scenario: PipelineExecutionScenario
): PipelineExecutionScenario {
  const clone = clonePipelineExecutionScenario(scenario);
  const frozenStageDependencies = Object.fromEntries(
    Object.entries(clone.stageDependencies).map(([stage, dependencies]) => [
      stage,
      Object.freeze([...dependencies]),
    ])
  ) as unknown as PipelineExecutionScenario['stageDependencies'];

  return Object.freeze({
    ...clone,
    requestedStages: Object.freeze([...clone.requestedStages]),
    allowedStages: Object.freeze([...clone.allowedStages]),
    requiredStages: Object.freeze([...clone.requiredStages]),
    stageDependencies: Object.freeze(frozenStageDependencies),
    includedDomains: Object.freeze([...clone.includedDomains]),
    excludedDomains: Object.freeze([...clone.excludedDomains]),
  });
}

export function toCoverageScenarioScope(
  scenario: PipelineExecutionScenario
): CoverageScenarioScope {
  const scope: CoverageScenarioScope = {
    scenarioId: scenario.scenarioId,
    includedDomains: [...scenario.includedDomains],
    excludedDomains: [...scenario.excludedDomains],
  };

  try {
    assertCoverageScenarioScopeValid(scope);
  } catch (error) {
    if (error instanceof CoverageScenarioScopeValidationError) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.INVALID_CONTRACT,
        'Invalid nominal coverage scope',
        false,
        'KNOWLEDGE_COVERAGE',
        {
          scenarioId: scenario.scenarioId,
          coverageScopeIssue: error.reason,
        }
      );
    }
    throw error;
  }

  return scope;
}
