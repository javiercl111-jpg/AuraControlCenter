import {
  RATE_LIMIT_POLICY_SCHEMA_VERSION,
  RateLimitEvaluator,
  StaticRateLimitPolicyProvider,
  type RateLimitClock,
  type RateLimitRepository,
} from "../../rateLimits";
import type { DiscoveryEmergencyQuotaConsumer } from "./discoveryContainmentPorts";

export class P2DiscoveryEmergencyQuotaConsumer
implements DiscoveryEmergencyQuotaConsumer {
  constructor(
    private readonly repository: RateLimitRepository,
    private readonly clock: RateLimitClock,
  ) {}

  async consume(input: Parameters<DiscoveryEmergencyQuotaConsumer["consume"]>[0]) {
    const environment = input.environment.toLowerCase();
    const evaluator = new RateLimitEvaluator(
      new StaticRateLimitPolicyProvider([{
        schemaVersion: RATE_LIMIT_POLICY_SCHEMA_VERSION,
        version: `containment.${input.policyVersion}.${input.operation}`,
        dimension: "CUSTOM",
        windowSeconds: input.rule.windowSeconds,
        maxRequests: input.rule.maxRequests,
        burst: input.rule.burst,
        enabled: true,
        environment,
        reason: "DISCOVERY_EMERGENCY_GLOBAL_QUOTA",
        owner: "SECURITY_OPERATIONS",
      }]),
      this.repository,
      this.clock,
    );
    const result = await evaluator.evaluate({
      dimension: "CUSTOM",
      environment,
      key: {
        scheme: "OPAQUE_V1",
        version: "containment.v1",
        value: `global.${input.operation.toLowerCase()}`,
      },
      metadata: { operation: input.operation, containment: true },
    });
    return Object.freeze({
      allowed: result.decision === "ALLOW",
      remaining: result.remaining,
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

