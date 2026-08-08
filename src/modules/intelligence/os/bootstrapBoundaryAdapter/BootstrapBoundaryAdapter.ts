import type {
  BoundaryClockPort,
  BoundaryExecutionPort,
  InternalExecutionInput,
  InternalExecutionResult,
} from '../boundary/ports';
import {
  BoundaryContextContractError,
  GovernedBoundaryError,
} from '../boundary/errors';
import type {
  BootstrapBoundaryBridgeAuthorityV1,
  BootstrapBoundaryBridgeEnvelopeV1,
  BootstrapBoundaryBridgeResultV1,
} from '../bootstrapBoundaryBridge/types';
import {
  createBootstrapBoundaryBridgeAuthorityV1,
  createBootstrapBoundaryBridgeEnvelopeV1,
  createBootstrapBoundaryBridgeResultV1,
} from '../bootstrapBoundaryBridge/validators';
import type { PipelineBootstrapPort } from '../bootstrap/ports';
import type {
  PipelineBootstrapPolicy,
  PipelineBootstrapState,
} from '../bootstrap/types';
import {
  mapBootstrapBoundaryEnvelopeToPipelineInputV1,
} from './BootstrapBoundaryInputMapperV1';

export interface BootstrapBoundaryAdapterDependencies {
  readonly bootstrapper: PipelineBootstrapPort;
  readonly clock: BoundaryClockPort;
}
function invalidBusinessPayload(): never {
  throw new GovernedBoundaryError(
    'INVALID_REQUEST',
    'Bootstrap business payload is invalid',
    false
  );
}
function parseCanonicalTimestamp(value: string): number | undefined {
  const milliseconds = Date.parse(value);

  if (
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 0
  ) {
    return undefined;
  }

  try {
    return new Date(milliseconds).toISOString() === value
      ? milliseconds
      : undefined;
  } catch {
    return undefined;
  }
}
function adaptBridgeResult(
  result: BootstrapBoundaryBridgeResultV1
): InternalExecutionResult {
  if (result.bridgeStatus === 'ACCEPTED') {
    return Object.freeze({
      executionId: result.bootstrapState.bootstrapId,
      sessionId: result.authority.correlationId,
      status: 'SUCCEEDED',
      rawData: result,
    });
  }
  const errors = Object.freeze([
    Object.freeze({
      code: result.publicError.code,
      message: result.publicError.message,
    }),
  ]);
  return Object.freeze({
    executionId: result.bootstrapState.bootstrapId,
    sessionId: result.authority.correlationId,
    status: 'FAILED',
    rawData: result,
    errors,
  });
}

export class BootstrapBoundaryAdapter
  implements BoundaryExecutionPort {
  private readonly bootstrapper: PipelineBootstrapPort;
  private readonly clock: BoundaryClockPort;

  constructor(
    dependencies: BootstrapBoundaryAdapterDependencies
  ) {
    this.bootstrapper = dependencies.bootstrapper;
    this.clock = dependencies.clock;
  }

  public async execute(
    input: InternalExecutionInput,
    signal?: AbortSignal
  ): Promise<InternalExecutionResult> {
    this.assertNotCancelled(signal);
    const authority = this.createAuthority(input);
    this.assertCanProceed(authority, signal);
    if (input.sessionId !== authority.correlationId) {
      throw new BoundaryContextContractError(
        'BOUNDARY_REQUEST_CONTEXT_MISMATCH'
      );
    }

    const envelope = this.createEnvelope(
      authority,
      input.payload,
      signal
    );
    const bootstrapInput =
      mapBootstrapBoundaryEnvelopeToPipelineInputV1(
        envelope
      );

    this.assertCanProceed(authority, signal);
    let bootstrapState: PipelineBootstrapState;
    try {
      bootstrapState = await this.bootstrapper.bootstrap(
        bootstrapInput,
        envelope.cancellationSignal
      );
    } catch {
      this.assertCanProceed(authority, signal);
      throw new GovernedBoundaryError(
        'EXECUTION_FAILED',
        'Pipeline Bootstrap execution failed',
        false
      );
    }
    this.assertCanProceed(authority, signal);
    const bridgeResult = this.createBridgeResult(
      authority,
      bootstrapState,
      bootstrapInput.policy
    );
    if (
      bridgeResult.bootstrapState.bootstrapId !==
      bootstrapInput.bootstrapId
    ) {
      throw new GovernedBoundaryError(
        'EXECUTION_FAILED',
        'Pipeline Bootstrap returned an invalid execution identity',
        false
      );
    }
    this.assertCanProceed(authority, signal);
    return adaptBridgeResult(bridgeResult);
  }

  private createAuthority(
    input: InternalExecutionInput
  ): BootstrapBoundaryBridgeAuthorityV1 {
    if (input.authoritativeContext === undefined) {
      throw new BoundaryContextContractError(
        'BOUNDARY_CONTEXT_MISSING'
      );
    }
    try {
      return createBootstrapBoundaryBridgeAuthorityV1(
        input.authoritativeContext
      );
    } catch {
      throw new BoundaryContextContractError(
        'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
      );
    }
  }

  private createEnvelope(
    authority: BootstrapBoundaryBridgeAuthorityV1,
    payload: unknown,
    signal: AbortSignal | undefined
  ): BootstrapBoundaryBridgeEnvelopeV1 {
    try {
      return createBootstrapBoundaryBridgeEnvelopeV1(
        authority,
        payload,
        signal
      );
    } catch {
      invalidBusinessPayload();
    }
  }

  private createBridgeResult(
    authority: BootstrapBoundaryBridgeAuthorityV1,
    bootstrapState: unknown,
    policy: PipelineBootstrapPolicy
  ): BootstrapBoundaryBridgeResultV1 {
    try {
      return createBootstrapBoundaryBridgeResultV1(
        authority,
        bootstrapState,
        policy
      );
    } catch {
      throw new GovernedBoundaryError(
        'EXECUTION_FAILED',
        'Pipeline Bootstrap returned an invalid result',
        false
      );
    }
  }

  private assertCanProceed(
    authority: BootstrapBoundaryBridgeAuthorityV1,
    signal: AbortSignal | undefined
  ): void {
    this.assertNotCancelled(signal);
    let currentTime: string;
    try {
      currentTime = this.clock.now();
    } catch {
      throw new BoundaryContextContractError(
        'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
      );
    }
    const currentMilliseconds =
      parseCanonicalTimestamp(currentTime);
    const deadlineMilliseconds = parseCanonicalTimestamp(
      authority.authoritativeDeadlineAt
    );
    if (
      currentMilliseconds === undefined ||
      deadlineMilliseconds === undefined
    ) {
      throw new BoundaryContextContractError(
        'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
      );
    }
    if (currentMilliseconds >= deadlineMilliseconds) {
      throw new GovernedBoundaryError(
        'TIMEOUT',
        'Authoritative execution deadline has expired',
        false
      );
    }
  }

  private assertNotCancelled(
    signal: AbortSignal | undefined
  ): void {
    if (signal?.aborted) {
      throw new GovernedBoundaryError(
        'CANCELLED',
        'Bootstrap boundary execution was cancelled',
        false
      );
    }
  }
}
