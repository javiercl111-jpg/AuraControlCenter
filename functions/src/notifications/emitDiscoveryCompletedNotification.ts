import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { GoogleAuth } from "google-auth-library";
import { projectPlatformInbox, NotificationProjectionInput } from "./projectPlatformInbox";
import { createHash } from "crypto";
import * as admin from "firebase-admin";
import {
  DISCOVERY_COST_BOUND_POLICY_V1,
  payloadBytes,
} from "../discovery/payloadBounds";
import {
  deriveTelemetryDerivedSubjectV1,
  normalizeTelemetryReasonCodeV1,
  recordDiscoveryTelemetrySafe,
} from "../discovery/telemetry";
import { enforceDiscoveryContainmentV1 } from "../discovery/containment";

export interface MaintenanceDeliveryResult {
  status?: string;
  inboxCreated: number;
  idempotentReplay: boolean;
}

export function extractMaintenanceDeliveryResult(responseData: unknown): MaintenanceDeliveryResult {
  let parsed: unknown = responseData;

  if (typeof responseData === "string") {
    try {
      parsed = JSON.parse(responseData);
    } catch {
      console.warn("MAINTENANCE_RESPONSE_INVALID_JSON", { responseType: "string" });
      return { inboxCreated: 0, idempotentReplay: false };
    }
  }

  if (parsed === null || typeof parsed !== "object") {
    console.warn("MAINTENANCE_RESPONSE_NOT_AN_OBJECT", { type: typeof parsed });
    return { inboxCreated: 0, idempotentReplay: false };
  }

  const obj = parsed as Record<string, unknown>;

  const status = typeof obj.status === "string" ? obj.status : undefined;

  let inboxCreated = 0;
  if (typeof obj.inboxCreated === "number" && Number.isFinite(obj.inboxCreated)) {
    inboxCreated = obj.inboxCreated;
  } else if (typeof obj.inboxCreated === "string") {
    const parsedNum = parseInt(obj.inboxCreated, 10);
    if (!isNaN(parsedNum)) {
      inboxCreated = parsedNum;
    }
  }

  const idempotentReplay = Boolean(obj.idempotentReplay);

  const hasExpectedContractKeys =
    typeof obj.inboxCreated === "number" ||
    typeof obj.inboxCreated === "string" ||
    typeof obj.idempotentReplay === "boolean" ||
    typeof obj.status === "string";

  if (!hasExpectedContractKeys) {
    console.warn("MAINTENANCE_RESPONSE_CONTRACT_MISMATCH", {
      keys: Object.keys(obj)
    });
  }

  return {
    status,
    inboxCreated,
    idempotentReplay
  };
}

// Retries and backoff matching user requirements
export const emitDiscoveryCompletedNotification = onTaskDispatched({
  serviceAccount: "aura-control-center-notifier@aura-control-center-debb3.iam.gserviceaccount.com",
  retryConfig: {
    maxAttempts: DISCOVERY_COST_BOUND_POLICY_V1.notificationMaxAttempts,
    minBackoffSeconds: 30,
    maxBackoffSeconds: 300,
    maxDoublings: 2
  }
}, async (request) => {
  const startedAt = Date.now();
  const db = admin.firestore();
  const payload = request.data;
  const telemetryKey = payload && typeof payload === "object" &&
    typeof payload.idempotencyKey === "string"
    ? payload.idempotencyKey : `notification:${startedAt}`;
  const telemetrySubject = payload && typeof payload === "object" &&
    typeof payload.discoverySessionId === "string"
    ? deriveTelemetryDerivedSubjectV1(payload.discoverySessionId) : undefined;
  const skipped = async (reasonCode: string) => recordDiscoveryTelemetrySafe(db, {
    eventType: "notification.skipped", source: "emitDiscoveryCompletedNotification",
    component: "discovery.notification", outcome: "SKIPPED", reasonCode,
    durationMs: Date.now() - startedAt, correlationKey: telemetryKey,
    requestKey: `${telemetryKey}:notification:${request.retryCount}`,
    ...(telemetrySubject ? { subject: telemetrySubject } : {}),
    measurements: {
      rejections: 1,
      ...(request.retryCount > 0 ? { retries: 1 } : {}),
    },
  });

  if (!payload || typeof payload !== 'object') {
    console.error("Invalid notification payload structure");
    await skipped("NOTIFICATION_PAYLOAD_INVALID");
    return; // Non-retryable
  }
  if (payloadBytes(payload) > DISCOVERY_COST_BOUND_POLICY_V1.notificationPayloadMaxBytes) {
    console.error("Payload exceeds notification budget");
    await skipped("NOTIFICATION_PAYLOAD_TOO_LARGE");
    return;
  }

  // Strict allowlist of fields to prevent unknown or sensitive data from leaking
  const allowedKeys = ['discoverySessionId', 'dossierId', 'advisorUid', 'tenantId', 'companyName', 'prospectName', 'correlationId', 'idempotencyKey'];
  const payloadKeys = Object.keys(payload);
  const unknownKeys = payloadKeys.filter(k => !allowedKeys.includes(k));
  if (unknownKeys.length > 0) {
    console.error("Payload contains unknown keys:", unknownKeys);
    await skipped("NOTIFICATION_UNKNOWN_FIELDS");
    return;
  }

  if (
    typeof payload.discoverySessionId !== 'string' || payload.discoverySessionId.length > 128 ||
    typeof payload.dossierId !== 'string' || payload.dossierId.length > 128 ||
    typeof payload.advisorUid !== 'string' || payload.advisorUid.length > 128 ||
    typeof payload.tenantId !== 'string' || payload.tenantId.length > 64 ||
    typeof payload.correlationId !== 'string' || payload.correlationId.length > 128 ||
    typeof payload.idempotencyKey !== 'string' || payload.idempotencyKey.length > 256 ||
    (payload.companyName !== undefined && typeof payload.companyName !== 'string') ||
    (payload.prospectName !== undefined && typeof payload.prospectName !== 'string') ||
    (typeof payload.companyName === 'string' && Buffer.byteLength(payload.companyName, 'utf8') > 160) ||
    (typeof payload.prospectName === 'string' && Buffer.byteLength(payload.prospectName, 'utf8') > 160)
  ) {
    console.error("Notification payload validation failed");
    await skipped("NOTIFICATION_PAYLOAD_INVALID");
    return;
  }

  if (payload.idempotencyKey !== `discovery.completed:${payload.discoverySessionId}`) {
    console.error("Payload validation failed: idempotencyKey does not match the expected format or session ID");
    await skipped("NOTIFICATION_IDEMPOTENCY_MISMATCH");
    return;
  }

  if (payload.tenantId !== 'aura_root') {
    console.error("Unauthorized notification tenant");
    await skipped("NOTIFICATION_TENANT_DENIED");
    return;
  }

  try {
    await enforceDiscoveryContainmentV1(db, {
      surface: "NOTIFICATION_FANOUT",
      source: "emitDiscoveryCompletedNotification",
      component: "discovery.notification",
      correlationKey: telemetryKey,
      requestKey: `${telemetryKey}:notification:${request.retryCount}`,
      startedAt,
    });
  } catch {
    await skipped("CONTAINMENT_DENIED");
    return;
  }

  const GATEWAY_URL = "https://aura-maintenance-os.vercel.app/api/platform-notifications";

  try {
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(GATEWAY_URL);

    // Build Canonical V1 Payload
    const notificationEvent = {
      schemaVersion: "1.0",
      eventId: `event_${createHash("sha256").update(payload.idempotencyKey).digest("hex").slice(0, 40)}`,
      eventType: "discovery.completed",
      sourceModule: "CONTROL_CENTER", // The gateway expects sourceModule
      tenantId: payload.tenantId,
      entityType: "DOSSIER",
      entityId: payload.dossierId,
      actorId: "system",
      recipientUserIds: [
        {
          userId: payload.advisorUid,
          userDomain: "PLATFORM"
        }
      ],
      channels: [...DISCOVERY_COST_BOUND_POLICY_V1.notificationChannels],
      title: "Discovery completado",
      body: `El expediente de ${payload.companyName || 'la empresa'} ha sido generado y está listo para revisión.`,
      templateId: "control_center.discovery.completed.v1",
      locale: "es-MX",
      variables: {
        prospectName: payload.prospectName || "Unknown",
        companyName: payload.companyName || "Unknown",
        dossierId: payload.dossierId,
        discoverySessionId: payload.discoverySessionId
      },
      priority: "HIGH",
      idempotencyKey: `discovery.completed:${payload.discoverySessionId}`,
      correlationId: payload.correlationId,
      metadata: {
        sourceModule: "DISCOVERY"
      }
    };

    // Use internal timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await client.request({
      url: GATEWAY_URL,
      method: 'POST',
      data: notificationEvent,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const deliveryResult = extractMaintenanceDeliveryResult(response.data);

    console.log("MAINTENANCE_RESPONSE_PARSED", {
      status: deliveryResult.status,
      inboxCreated: deliveryResult.inboxCreated,
      idempotentReplay: deliveryResult.idempotentReplay
    });

    if (deliveryResult.status === "FAILED") {
      // It reached the gateway but failed inside it
      console.error("Gateway returned FAILED status", { status: deliveryResult.status });
      throw new Error(`Gateway processing failed: ${deliveryResult.status}`);
    }

    if (deliveryResult.idempotentReplay) {
      console.log(`Event previously processed (idempotent duplicate): ${notificationEvent.idempotencyKey}`);
      // Fallthrough to projection logic for idempotency check
    } else {
      console.log("Notification dispatched successfully:", {
        status: deliveryResult.status,
        inboxCreated: deliveryResult.inboxCreated
      });
    }

    if (deliveryResult.inboxCreated >= 1 || deliveryResult.idempotentReplay) {
      const projectionInput: NotificationProjectionInput = {
        eventId: notificationEvent.eventId,
        recipientUid: payload.advisorUid,
        type: notificationEvent.eventType,
        title: notificationEvent.title,
        body: notificationEvent.body,
        entityType: notificationEvent.entityType,
        entityId: notificationEvent.entityId,
        sourceModule: notificationEvent.sourceModule,
        priority: notificationEvent.priority as "LOW" | "NORMAL" | "HIGH",
        createdAt: Date.now(),
        context: {
          dossierId: payload.dossierId
        }
      };
      await projectPlatformInbox(projectionInput);
      await recordDiscoveryTelemetrySafe(db, {
        eventType: "notification.emitted", source: "emitDiscoveryCompletedNotification",
        component: "discovery.notification", outcome: "EMITTED",
        reasonCode: deliveryResult.idempotentReplay
          ? "NOTIFICATION_IDEMPOTENT_REPLAY" : "NOTIFICATION_EMITTED",
        durationMs: Date.now() - startedAt, correlationKey: telemetryKey,
        requestKey: `${telemetryKey}:notification:${request.retryCount}`,
        ...(telemetrySubject ? { subject: telemetrySubject } : {}),
        measurements: {
          notifications: deliveryResult.idempotentReplay ? 0 : 1,
          ...(deliveryResult.idempotentReplay ? { replays: 1 } : {}),
          ...(request.retryCount > 0 ? { retries: 1 } : {}),
        },
      });
    } else {
      console.log("PROJECTION_SKIPPED_NO_CANONICAL_DELIVERY", {
        status: deliveryResult.status,
        inboxCreated: deliveryResult.inboxCreated,
        idempotentReplay: deliveryResult.idempotentReplay
      });
      await skipped("NOTIFICATION_NO_CANONICAL_DELIVERY");
    }

  } catch (error: any) {
    console.error("Error emitting discovery completed notification", {
      reasonCode: normalizeTelemetryReasonCodeV1(error),
    });
    await skipped(normalizeTelemetryReasonCodeV1(error));
    // If it's an abort error (timeout) or 5xx, we throw to trigger Cloud Tasks retry mechanism
    if (error.name === 'AbortError' || (error.response && error.response.status >= 500)) {
      throw error;
    }
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
      throw error;
    }
    // 4xx errors from gateway usually mean malformed payload or unauthorized. Retry won't fix it.
    // So we don't throw, we just log it and stop retrying.
  }
});
