import type { 
  PipelineExecutionId, 
  PipelineSessionId, 
  PipelineExecutionKey, 
  PipelineInput 
} from './types';
import { OS_CONTRACT_VERSION, OS_PIPELINE_VERSION } from './types';
import type { PipelineClock, PipelineCancellationSignal } from './ports';

export class PipelineExecutionContext {
  public readonly executionId: PipelineExecutionId;
  public readonly sessionId: PipelineSessionId;
  public readonly executionKey?: PipelineExecutionKey;
  public readonly contractVersion: string = OS_CONTRACT_VERSION;
  public readonly pipelineVersion: string = OS_PIPELINE_VERSION;
  public readonly createdAt: string;
  public readonly clock: PipelineClock;
  public readonly cancellationSignal?: PipelineCancellationSignal;
  public readonly metadata?: Record<string, string | number | boolean | null | undefined>;
  
  public readonly initialInput: Readonly<PipelineInput>;

  constructor(
    executionId: PipelineExecutionId,
    clock: PipelineClock,
    input: PipelineInput,
    cancellationSignal?: PipelineCancellationSignal
  ) {
    this.executionId = executionId;
    this.clock = clock;
    this.createdAt = clock.toISOString();
    this.sessionId = input.sessionId;
    this.executionKey = input.executionKey;
    this.cancellationSignal = cancellationSignal;
    
    // Deep freeze initial input to ensure immutability
    this.initialInput = Object.freeze({
      ...input,
      objectiveIds: input.objectiveIds ? Object.freeze([...input.objectiveIds]) : undefined,
      metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined
    });

    if (this.initialInput.metadata) {
      this.metadata = this.initialInput.metadata;
    }
  }

  public isCancelled(): boolean {
    return this.cancellationSignal?.aborted ?? false;
  }
}
