import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { FirestoreDiscoveryContainmentPolicyProvider } from
  "../../infrastructure/firestore/discoveryContainment";
import { FirestoreRateLimitRepository } from
  "../../infrastructure/firestore/rateLimits";
import {
  recordDiscoveryTelemetrySafe,
  resolveStructuredAbuseEnvironmentV1,
  type StructuredAbuseEventType,
} from "../telemetry";
import { DefaultDiscoveryContainmentEvaluator } from
  "./DefaultDiscoveryContainmentEvaluator";
import { P2DiscoveryEmergencyQuotaConsumer } from
  "./P2DiscoveryEmergencyQuotaConsumer";
import type {
  DiscoveryContainmentDecisionV1,
  DiscoveryContainmentEnvironment,
  DiscoveryContainmentErrorCode,
  DiscoveryContainmentSurface,
} from "./discoveryContainmentTypes";

function environment(): DiscoveryContainmentEnvironment {
  return resolveStructuredAbuseEnvironmentV1();
}

function deniedEvent(code: DiscoveryContainmentErrorCode): StructuredAbuseEventType {
  switch (code) {
    case "CONTAINMENT_POLICY_NOT_FOUND": return "containment.policy_missing";
    case "CONTAINMENT_POLICY_CORRUPTED": return "containment.policy_corrupted";
    case "CONTAINMENT_POLICY_EXPIRED": return "containment.policy_expired";
    case "CONTAINMENT_SUBJECT_BLOCKED": return "containment.selective_block";
    case "EMERGENCY_QUOTA_EXCEEDED":
      return "containment.emergency_quota_exceeded";
    default: return "containment.denied";
  }
}

export async function enforceDiscoveryContainmentV1(
  db: Firestore,
  input: Readonly<{
    surface: DiscoveryContainmentSurface;
    source: string;
    component: string;
    correlationKey: string;
    requestKey: string;
    startedAt: number;
    appId?: string;
    commercialCodeHash?: string;
  }>,
): Promise<DiscoveryContainmentDecisionV1> {
  const clock = { nowEpochMilliseconds: () => Date.now() };
  const evaluator = new DefaultDiscoveryContainmentEvaluator(
    new FirestoreDiscoveryContainmentPolicyProvider(db),
    new P2DiscoveryEmergencyQuotaConsumer(
      new FirestoreRateLimitRepository(db), clock,
    ),
    clock,
  );
  let result: DiscoveryContainmentDecisionV1;
  try {
    result = await evaluator.evaluate({
      surface: input.surface,
      environment: environment(),
      ...(input.appId ? { appId: input.appId } : {}),
      ...(input.commercialCodeHash
        ? { commercialCodeHash: input.commercialCodeHash } : {}),
    });
  } catch {
    result = Object.freeze({
      version: "DISCOVERY_CONTAINMENT_DECISION_V1",
      decision: "DENY",
      code: "CONTAINMENT_INTERNAL_FAILURE",
      surface: input.surface,
      environment: environment(),
      policyVersion: null,
      retryAfterSeconds: 0,
    });
  }

  const allowed = result.decision === "ALLOW" || result.decision === "DEGRADED_ALLOW";
  await recordDiscoveryTelemetrySafe(db, {
    eventType: allowed ? "containment.allowed" : deniedEvent(result.code as DiscoveryContainmentErrorCode),
    severity: allowed ? "INFO" :
      result.code === "CONTAINMENT_POLICY_CORRUPTED" ? "CRITICAL" : "WARN",
    source: input.source,
    component: input.component,
    outcome: allowed ? "ALLOWED" : "DENIED",
    reasonCode: result.code,
    durationMs: Math.max(0, Date.now() - input.startedAt),
    correlationKey: input.correlationKey,
    requestKey: `${input.requestKey}:${input.surface}:${result.code}`,
    measurements: {
      requests: 1,
      ...(allowed ? {} : { rejections: 1 }),
    },
  });
  if (!allowed) {
    if (result.code === "EMERGENCY_QUOTA_EXCEEDED") {
      throw new HttpsError(
        "resource-exhausted",
        "DISCOVERY_TEMPORARILY_UNAVAILABLE",
        { retryAfterSeconds: result.retryAfterSeconds },
      );
    }
    throw new HttpsError("unavailable", "DISCOVERY_TEMPORARILY_UNAVAILABLE");
  }
  return result;
}
