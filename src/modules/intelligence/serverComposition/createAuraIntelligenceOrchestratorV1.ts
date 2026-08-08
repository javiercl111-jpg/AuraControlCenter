import { AuraIntelligenceOrchestrator } from '../os/AuraIntelligenceOrchestrator';
import { PipelineExecutionContext } from '../os/PipelineExecutionContext';
import { SystemPipelineClockV1 } from './adapters/SystemPipelineClockV1';
import { CryptoPipelineIdGeneratorV1 } from './adapters/CryptoPipelineIdGeneratorV1';

import { ExtractionApplier } from '../enterprise-model/extraction/services/ExtractionApplier';
import { CoverageDecisionEngine } from '../enterprise-model/coverage/services/CoverageDecisionEngine';
import { CoverageCalculator } from '../enterprise-model/coverage/services/CoverageCalculator';
import { ExecutiveReasoningEngine } from '../enterprise-model/reasoning/services/ExecutiveReasoningEngine';
import { createStrictPolicy } from '../enterprise-model/reasoning/policies/ReasoningPolicy';
import { ExecutiveDossierBuilder } from '../enterprise-model/dossier/services/ExecutiveDossierBuilder';
import { NarrativeBuilder } from '../enterprise-model/dossier/services/NarrativeBuilder';
import { createDossierPolicyV1 } from '../enterprise-model/dossier/policies/createDossierPolicyV1';
import { EnterpriseTransformationAssessmentBuilder } from '../enterprise-model/assessment/services/EnterpriseTransformationAssessmentBuilder';
import { createAssessmentPolicyV1 } from '../enterprise-model/assessment/policies/createAssessmentPolicyV1';

import type { AuraIntelligenceOSDependencies } from '../os/dependencyComposition';
import type { DossierExecutionContext, DiagnosticNarrativeProvider, DossierPolicy } from '../enterprise-model/dossier/domain/types';
import type { AssessmentPolicy } from '../enterprise-model/assessment/domain/types';

/**
 * AEA-05-R1C.3 - Orchestrator Server Factory
 *
 * Instantiates a production-ready AuraIntelligenceOrchestrator using certified adapters,
 * exact business engines, and canonical policies.
 *
 * Omissions:
 * - PlannerPolicy & adaptiveQuestionPlanner are omitted as they are optional for the current target pipeline.
 * - auditSink, timeoutPolicy, cancellationSignal, checkpointProducerAuthorizer are omitted as permitted by OS optional ports.
 */
export function createAuraIntelligenceOrchestratorV1(osContext: PipelineExecutionContext): AuraIntelligenceOrchestrator {
  // Production Core Adapters
  const clock = new SystemPipelineClockV1();
  const idGenerator = new CryptoPipelineIdGeneratorV1();

  // Policies
  const reasoningPolicy = createStrictPolicy();
  const dossierPolicy = createDossierPolicyV1();
  const assessmentPolicy = createAssessmentPolicyV1();
  const narrativeProvider = new NarrativeBuilder();

  // OS Dependencies Configuration
  const dependencies: AuraIntelligenceOSDependencies = {
    clock,
    idGenerator,

    // Core optional ports omitted by design for the current target pipeline:
    // auditSink, timeoutPolicy, cancellationSignal, checkpointProducerAuthorizer

    // Engine execution ports
    extractionApplier: new ExtractionApplier(),
    coverageDecisionEngine: CoverageDecisionEngine,
    coverageCalculator: CoverageCalculator,

    // Reasoning
    reasoningPolicy,
    executiveReasoningEngine: new ExecutiveReasoningEngine(reasoningPolicy),

    // Dossier
    dossierPolicy,
    diagnosticNarrativeProvider: narrativeProvider,
    executiveDossierBuilder: {
      build: (
        executionContext: DossierExecutionContext,
        policy: DossierPolicy,
        provider: DiagnosticNarrativeProvider,
        report: unknown
      ) => {
        const builder = new ExecutiveDossierBuilder(executionContext, policy, provider);
        return builder.build(report);
      }
    },

    // Assessment
    assessmentPolicy,
    enterpriseTransformationAssessmentBuilder: {
      build: (
        policy: AssessmentPolicy,
        execId: string,
        timestamp: string,
        dossier,
        reasoning,
        constraints,
        deps
      ) => {
        const builder = new EnterpriseTransformationAssessmentBuilder(policy);
        return builder.build(execId, timestamp, dossier, reasoning, constraints, deps);
      }
    }
  };

  return new AuraIntelligenceOrchestrator(osContext, dependencies);
}
