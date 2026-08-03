import { RateLimitError } from "./rateLimitErrors";
import type { RateLimitPolicyProvider } from "./rateLimitPorts";
import type {
  RateLimitDimension,
  RateLimitPolicyV1,
} from "./rateLimitTypes";
import {
  validateRateLimitPolicyV1,
} from "./rateLimitValidation";

function policyKey(
  dimension: RateLimitDimension,
  environment: string,
): string {
  return `${environment}\0${dimension}`;
}

export class StaticRateLimitPolicyProvider
  implements RateLimitPolicyProvider
{
  readonly #policies: ReadonlyMap<string, RateLimitPolicyV1>;

  constructor(policies: readonly RateLimitPolicyV1[]) {
    const entries = new Map<string, RateLimitPolicyV1>();
    for (const policyValue of policies) {
      const policy = validateRateLimitPolicyV1(policyValue);
      const key = policyKey(policy.dimension, policy.environment);
      if (entries.has(key)) {
        throw new RateLimitError(
          "CONFIGURATION_ERROR",
          "Duplicate rate-limit policy for dimension and environment.",
        );
      }
      entries.set(key, policy);
    }
    this.#policies = entries;
  }

  async getPolicy(input: Readonly<{
    dimension: RateLimitDimension;
    environment: string;
  }>): Promise<RateLimitPolicyV1 | null> {
    return (
      this.#policies.get(
        policyKey(input.dimension, input.environment),
      ) ?? null
    );
  }
}
