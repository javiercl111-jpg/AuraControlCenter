import type { PipelineBootstrapCheckpointProducerIdentity } from '../os/bootstrap/PipelineBootstrapCheckpointMapper';

export const AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_ID =
  'aura-intelligence-bootstrap-checkpoint' as const;

export const AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_VERSION = '1' as const;

export const AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_V1:
  Readonly<PipelineBootstrapCheckpointProducerIdentity> = Object.freeze({
    producerId: AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_ID,
    producerVersion: AURA_INTELLIGENCE_CHECKPOINT_PRODUCER_VERSION,
  });
