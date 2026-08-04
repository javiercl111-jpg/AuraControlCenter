import { DiscoveryContainmentError, isDiscoveryContainmentError } from
  "./discoveryContainmentErrors";
import type {
  DiscoveryContainmentClock,
  DiscoveryContainmentEvaluator,
  DiscoveryContainmentPolicyProvider,
  DiscoveryEmergencyQuotaConsumer,
} from "./discoveryContainmentPorts";
import {
  DISCOVERY_CONTAINMENT_DECISION_SCHEMA_VERSION,
  type DiscoveryContainmentDecisionV1,
  type DiscoveryContainmentEvaluationRequestV1,
  type DiscoveryContainmentPolicyV1,
  type DiscoveryEmergencyQuotaOperation,
} from "./discoveryContainmentTypes";
import {
  validateDiscoveryContainmentPolicyV1,
  validateDiscoveryContainmentRequestV1,
} from "./discoveryContainmentValidation";

const SWITCH_BY_SURFACE = Object.freeze({
  PUBLIC_INTAKE: "publicIntakeEnabled",
  ADVISOR_CODE_RESOLUTION: "advisorCodeResolutionEnabled",
  TOKEN_ISSUANCE: "tokenIssuanceEnabled",
  SESSION_RESOLUTION: "sessionResolutionEnabled",
  SESSION_COMPLETION: "sessionCompletionEnabled",
  CONVERSATION_AI: "conversationAiEnabled",
  EXTERNAL_REPORT_GENERATION: "externalReportGenerationEnabled",
  DOCUMENT_DOWNLOAD: "documentDownloadEnabled",
  NOTIFICATION_FANOUT: "notificationFanoutEnabled",
} as const satisfies Record<
  DiscoveryContainmentEvaluationRequestV1["surface"], keyof DiscoveryContainmentPolicyV1
>);

const QUOTA_BY_SURFACE: Partial<Record<
  DiscoveryContainmentEvaluationRequestV1["surface"],
  DiscoveryEmergencyQuotaOperation
>> = Object.freeze({
  PUBLIC_INTAKE: "INTAKE",
  SESSION_COMPLETION: "COMPLETION",
  CONVERSATION_AI: "AI_EVALUATION",
  EXTERNAL_REPORT_GENERATION: "REPORT_GENERATION",
  DOCUMENT_DOWNLOAD: "DOWNLOAD",
  NOTIFICATION_FANOUT: "NOTIFICATION",
});

function createDecision(
  request: DiscoveryContainmentEvaluationRequestV1,
  code: DiscoveryContainmentDecisionV1["code"],
  policyVersion: string | null,
  retryAfterSeconds = 0,
): DiscoveryContainmentDecisionV1 {
  return Object.freeze({
    version: DISCOVERY_CONTAINMENT_DECISION_SCHEMA_VERSION,
    decision: code === "CONTAINMENT_ALLOWED" ? "ALLOW" : "DENY",
    code,
    surface: request.surface,
    environment: request.environment,
    policyVersion,
    retryAfterSeconds,
  });
}

export class DefaultDiscoveryContainmentEvaluator
implements DiscoveryContainmentEvaluator {
  constructor(
    private readonly policyProvider: DiscoveryContainmentPolicyProvider,
    private readonly quotaConsumer: DiscoveryEmergencyQuotaConsumer,
    private readonly clock: DiscoveryContainmentClock,
  ) {}

  async evaluate(
    requestValue: DiscoveryContainmentEvaluationRequestV1,
  ): Promise<DiscoveryContainmentDecisionV1> {
    const request = validateDiscoveryContainmentRequestV1(requestValue);
    let policyValue: DiscoveryContainmentPolicyV1 | null;
    try {
      policyValue = await this.policyProvider.getActivePolicy(request.environment);
    } catch (error: unknown) {
      if (isDiscoveryContainmentError(error) &&
          error.code === "CONTAINMENT_POLICY_CORRUPTED") {
        return createDecision(request, error.code, null);
      }
      throw new DiscoveryContainmentError(
        "CONTAINMENT_INTERNAL_FAILURE",
        "Containment policy provider failed.",
        { cause: error },
      );
    }
    if (policyValue === null) {
      return createDecision(request, "CONTAINMENT_POLICY_NOT_FOUND", null);
    }
    let policy: DiscoveryContainmentPolicyV1;
    try {
      policy = validateDiscoveryContainmentPolicyV1(policyValue);
    } catch {
      return createDecision(request, "CONTAINMENT_POLICY_CORRUPTED", null);
    }
    if (policy.environment !== request.environment) {
      return createDecision(
        request, "CONTAINMENT_POLICY_CORRUPTED", policy.policyVersion,
      );
    }
    let now: number;
    try {
      now = this.clock.nowEpochMilliseconds();
    } catch (error: unknown) {
      throw new DiscoveryContainmentError(
        "CONTAINMENT_INTERNAL_FAILURE", "Containment clock failed.", { cause: error },
      );
    }
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new DiscoveryContainmentError(
        "CONTAINMENT_CONFIGURATION_ERROR", "Containment clock is invalid.",
      );
    }
    if (policy.status === "EXPIRED" || policy.expiresAt <= now) {
      return createDecision(request, "CONTAINMENT_POLICY_EXPIRED", policy.policyVersion);
    }
    if (policy.status === "INVALID") {
      return createDecision(request, "CONTAINMENT_POLICY_CORRUPTED", policy.policyVersion);
    }
    if (policy.status === "REVOKED") {
      return createDecision(request, "CONTAINMENT_DISABLED", policy.policyVersion);
    }
    if ((request.appId && policy.blockedAppIds.includes(request.appId)) ||
        (request.commercialCodeHash &&
          policy.blockedCommercialCodeHashes.includes(request.commercialCodeHash))) {
      return createDecision(
        request, "CONTAINMENT_SUBJECT_BLOCKED", policy.policyVersion,
      );
    }
    const switchField = SWITCH_BY_SURFACE[request.surface];
    if (policy[switchField] !== true) {
      return createDecision(request, "CONTAINMENT_DISABLED", policy.policyVersion);
    }
    const quotaOperation = QUOTA_BY_SURFACE[request.surface];
    if (quotaOperation) {
      const rule = policy.emergencyGlobalQuota[quotaOperation];
      if (rule.enabled) {
        try {
          const quota = await this.quotaConsumer.consume({
            environment: policy.environment,
            policyVersion: policy.policyVersion,
            operation: quotaOperation,
            rule,
          });
          if (!quota.allowed) {
            return createDecision(
              request,
              "EMERGENCY_QUOTA_EXCEEDED",
              policy.policyVersion,
              Math.max(1, quota.retryAfterSeconds),
            );
          }
        } catch (error: unknown) {
          throw new DiscoveryContainmentError(
            "CONTAINMENT_INTERNAL_FAILURE",
            "Emergency quota failed closed.",
            { cause: error },
          );
        }
      }
    }
    return createDecision(request, "CONTAINMENT_ALLOWED", policy.policyVersion);
  }
}
