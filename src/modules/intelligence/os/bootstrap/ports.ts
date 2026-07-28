import type {
  PipelineBootstrapInput,
  PipelineBootstrapState,
} from './types';

export interface PipelineBootstrapPort {
  bootstrap(
    input: PipelineBootstrapInput,
    signal?: AbortSignal
  ): Promise<PipelineBootstrapState>;
}
