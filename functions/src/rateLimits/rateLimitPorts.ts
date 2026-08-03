import type {
  RateLimitCounterCommandV1,
  RateLimitDimension,
  RateLimitPolicyV1,
  RateLimitRepositoryResultV1,
} from "./rateLimitTypes";

export interface RateLimitClock {
  nowEpochMilliseconds(): number;
}

export interface RateLimitPolicyProvider {
  getPolicy(input: Readonly<{
    dimension: RateLimitDimension;
    environment: string;
  }>): Promise<RateLimitPolicyV1 | null>;
}

export interface RateLimitRepository {
  consume(
    command: RateLimitCounterCommandV1,
  ): Promise<RateLimitRepositoryResultV1>;
}
