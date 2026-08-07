import {
  AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_V1,
  PipelineBootstrapEvidenceFactory,
  PipelineBootstrapExecutionComposer,
  PipelineBootstrapper,
  ProductionBoundaryExecutionAdapterV1,
  SystemPipelineClockV1,
  createAuraIntelligenceOrchestratorV1,
  mapBootstrapAcceptedStateToCheckpointHandoff,
} from '@aura/intelligence-execution-runtime';

export function createIntelligenceExecutionCompositionV1() {
  const clock = new SystemPipelineClockV1();

  const bootstrapper = new PipelineBootstrapper({
    clock,
    evidenceFactory: new PipelineBootstrapEvidenceFactory(),
  });

  const composer = new PipelineBootstrapExecutionComposer({
    bootstrapPort: bootstrapper,
    checkpointMapper: mapBootstrapAcceptedStateToCheckpointHandoff,
    clock,
    orchestratorFactory: createAuraIntelligenceOrchestratorV1,
    producer: AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_V1,
  });

  const executionAdapter =
    new ProductionBoundaryExecutionAdapterV1(composer);

  return Object.freeze({
    executionAdapter,
  });
}

export type IntelligenceExecutionCompositionV1 =
  ReturnType<typeof createIntelligenceExecutionCompositionV1>;
