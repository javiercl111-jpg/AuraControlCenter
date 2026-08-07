import type { AuraIntelligenceOrchestrator } from '../AuraIntelligenceOrchestrator';
import { PipelineExecutionContext } from '../PipelineExecutionContext';
import type { PipelineClock } from '../ports';
import type { PipelineResult } from '../types';
import {
  PipelineBootstrapCoreError,
  throwPipelineBootstrapCoreError,
} from './PipelineBootstrapCoreErrors';
import type {
  PipelineBootstrapCheckpointMapperOptions,
  PipelineBootstrapExecutionHandoff,
} from './PipelineBootstrapCheckpointMapper';
import type { PipelineBootstrapPort } from './ports';
import type {
  BootstrapAcceptedState,
  BootstrapRejectedState,
  PipelineBootstrapInput,
  PipelineBootstrapState,
} from './types';
import { validatePipelineBootstrapState } from './validators';

export type PipelineBootstrapCheckpointMapper = (
  value: unknown,
  options: PipelineBootstrapCheckpointMapperOptions
) => PipelineBootstrapExecutionHandoff;

export interface PipelineBootstrapExecutionComposerDependencies {
  readonly bootstrapPort: PipelineBootstrapPort;
  readonly checkpointMapper: PipelineBootstrapCheckpointMapper;
  readonly clock: PipelineClock;
  readonly orchestratorFactory: (
    osContext: PipelineExecutionContext
  ) => Pick<AuraIntelligenceOrchestrator, 'executePipeline'>;
  readonly producer:
    PipelineBootstrapCheckpointMapperOptions['producer'];
}

export type PipelineBootstrapExecutionResult =
  | {
      readonly status: 'BOOTSTRAP_REJECTED';
      readonly bootstrapState: BootstrapRejectedState;
    }
  | {
      readonly status: 'EXECUTION_COMPLETED';
      readonly bootstrapState: BootstrapAcceptedState;
      readonly handoff: PipelineBootstrapExecutionHandoff;
      readonly pipelineResult: PipelineResult;
    }
  | {
      readonly status: 'EXECUTION_FAILED';
      readonly bootstrapState: BootstrapAcceptedState;
      readonly handoff: PipelineBootstrapExecutionHandoff;
      readonly pipelineResult: PipelineResult;
    };

export class PipelineBootstrapExecutionComposer {
  private readonly bootstrapPort: PipelineBootstrapPort;
  private readonly checkpointMapper: PipelineBootstrapCheckpointMapper;
  private readonly clock: PipelineClock;
  private readonly orchestratorFactory: (
    osContext: PipelineExecutionContext
  ) => Pick<AuraIntelligenceOrchestrator, 'executePipeline'>;
  private readonly producer:
    PipelineBootstrapCheckpointMapperOptions['producer'];

  constructor(
    dependencies: PipelineBootstrapExecutionComposerDependencies
  ) {
    this.bootstrapPort = dependencies.bootstrapPort;
    this.checkpointMapper = dependencies.checkpointMapper;
    this.clock = dependencies.clock;
    this.orchestratorFactory = dependencies.orchestratorFactory;
    this.producer = Object.freeze({ ...dependencies.producer });
  }

  public async execute(
    input: PipelineBootstrapInput,
    signal?: AbortSignal
  ): Promise<PipelineBootstrapExecutionResult> {
    let bootstrapState: PipelineBootstrapState;
    try {
      bootstrapState = await this.bootstrapPort.bootstrap(
        input,
        signal
      );
    } catch {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_EXECUTION_COMPOSITION_FAILED'
      );
    }

    const stateResult = validatePipelineBootstrapState(
      bootstrapState,
      input.policy
    );
    if (!stateResult.valid) {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_EXECUTION_COMPOSITION_FAILED'
      );
    }
    const validatedState = stateResult.value;
    if (validatedState.status === 'REJECTED') {
      return Object.freeze({
        status: 'BOOTSTRAP_REJECTED',
        bootstrapState: validatedState,
      });
    }

    let handoff: PipelineBootstrapExecutionHandoff;
    try {
      handoff = this.checkpointMapper(validatedState, {
        policy: input.policy,
        producer: this.producer,
      });
    } catch (error) {
      if (error instanceof PipelineBootstrapCoreError) {
        throw error;
      }
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_EXECUTION_COMPOSITION_FAILED'
      );
    }

    let pipelineResult: PipelineResult;
    try {
      const osContext = new PipelineExecutionContext(
        input.bootstrapId,
        this.clock,
        handoff.pipelineInput,
        signal
      );
      const orchestrator = this.orchestratorFactory(osContext);
      pipelineResult = await orchestrator.executePipeline(
        handoff.pipelineInput,
        handoff.aggregatedState
      );
    } catch {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_EXECUTION_COMPOSITION_FAILED'
      );
    }

    return Object.freeze({
      status:
        pipelineResult.status === 'SUCCESS'
          ? 'EXECUTION_COMPLETED'
          : 'EXECUTION_FAILED',
      bootstrapState: validatedState,
      handoff,
      pipelineResult,
    });
  }
}
