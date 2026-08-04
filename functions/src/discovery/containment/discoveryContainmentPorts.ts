import type {
  DiscoveryContainmentAuditRecordV1,
  DiscoveryContainmentDecisionV1,
  DiscoveryContainmentEnvironment,
  DiscoveryContainmentEvaluationRequestV1,
  DiscoveryContainmentPolicyV1,
  DiscoveryEmergencyQuotaOperation,
  DiscoveryEmergencyQuotaRuleV1,
} from "./discoveryContainmentTypes";

export interface DiscoveryContainmentPolicyProvider {
  getActivePolicy(
    environment: DiscoveryContainmentEnvironment,
  ): Promise<DiscoveryContainmentPolicyV1 | null>;
  getPolicyVersion(input: Readonly<{
    environment: DiscoveryContainmentEnvironment;
    policyVersion: string;
  }>): Promise<DiscoveryContainmentPolicyV1 | null>;
}

export interface DiscoveryContainmentEvaluator {
  evaluate(
    request: DiscoveryContainmentEvaluationRequestV1,
  ): Promise<DiscoveryContainmentDecisionV1>;
}

export interface DiscoveryContainmentAuditRepository {
  append(record: DiscoveryContainmentAuditRecordV1): Promise<"CREATED" | "REPLAY">;
}

export interface DiscoveryContainmentClock {
  nowEpochMilliseconds(): number;
}

export interface DiscoveryEmergencyQuotaConsumer {
  consume(input: Readonly<{
    environment: DiscoveryContainmentEnvironment;
    policyVersion: string;
    operation: DiscoveryEmergencyQuotaOperation;
    rule: DiscoveryEmergencyQuotaRuleV1;
  }>): Promise<Readonly<{
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  }>>;
}
