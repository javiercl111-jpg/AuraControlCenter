import type {
  DiscoveryIntakeAtomicCreateEffectV1,
  DiscoveryIntakeIdempotencyAcquireCommandV1,
  DiscoveryIntakeIdempotencyAcquireDecisionV1,
  DiscoveryIntakeIdempotencyCleanupRequestV1,
  DiscoveryIntakeIdempotencyCleanupResultV1,
  DiscoveryIntakeIdempotencyCompleteCommandV1,
  DiscoveryIntakeIdempotencyFailCommandV1,
  DiscoveryIntakeIdempotencyRecordV1,
} from "./discoveryIntakeIdempotencyTypes";

export interface DiscoveryIntakeIdempotencyClock {
  nowEpochMilliseconds(): number;
}

export interface DiscoveryIntakeIdempotencyRepository {
  acquire(
    command: DiscoveryIntakeIdempotencyAcquireCommandV1,
  ): Promise<DiscoveryIntakeIdempotencyAcquireDecisionV1>;

  complete(
    command: DiscoveryIntakeIdempotencyCompleteCommandV1,
    effect: DiscoveryIntakeAtomicCreateEffectV1,
  ): Promise<DiscoveryIntakeIdempotencyRecordV1>;

  fail(command: DiscoveryIntakeIdempotencyFailCommandV1): Promise<void>;
}

export interface DiscoveryIntakeIdempotencyCleanupPort {
  cleanup(
    request?: DiscoveryIntakeIdempotencyCleanupRequestV1,
  ): Promise<DiscoveryIntakeIdempotencyCleanupResultV1>;
}
