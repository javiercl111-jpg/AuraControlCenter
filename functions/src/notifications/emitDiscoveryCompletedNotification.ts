import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { GoogleAuth } from "google-auth-library";
import { projectPlatformInbox, NotificationProjectionInput } from "./projectPlatformInbox";

// Retries and backoff matching user requirements
export const emitDiscoveryCompletedNotification = onTaskDispatched({
  serviceAccount: "aura-control-center-notifier@aura-control-center-debb3.iam.gserviceaccount.com",
  retryConfig: {
    maxAttempts: 3,
    minBackoffSeconds: 30,
    maxBackoffSeconds: 300,
    maxDoublings: 2
  }
}, async (request) => {
  const payload = request.data;

  if (!payload || typeof payload !== 'object') {
    console.error("Invalid payload structure", payload);
    return; // Non-retryable
  }

  // Strict allowlist of fields to prevent unknown or sensitive data from leaking
  const allowedKeys = ['discoverySessionId', 'dossierId', 'advisorUid', 'tenantId', 'companyName', 'prospectName', 'correlationId', 'idempotencyKey'];
  const payloadKeys = Object.keys(payload);
  const unknownKeys = payloadKeys.filter(k => !allowedKeys.includes(k));
  if (unknownKeys.length > 0) {
    console.error("Payload contains unknown keys:", unknownKeys);
    return;
  }

  if (
    typeof payload.discoverySessionId !== 'string' || payload.discoverySessionId.length > 128 ||
    typeof payload.dossierId !== 'string' || payload.dossierId.length > 128 ||
    typeof payload.advisorUid !== 'string' || payload.advisorUid.length > 128 ||
    typeof payload.tenantId !== 'string' || payload.tenantId.length > 64 ||
    typeof payload.correlationId !== 'string' || payload.correlationId.length > 128 ||
    typeof payload.idempotencyKey !== 'string' || payload.idempotencyKey.length > 256
  ) {
    console.error("Payload validation failed: type or max length exceeded", payload);
    return;
  }

  if (payload.idempotencyKey !== `discovery.completed:${payload.discoverySessionId}`) {
    console.error("Payload validation failed: idempotencyKey does not match the expected format or session ID");
    return;
  }

  if (payload.tenantId !== 'aura_root') {
    console.error("Unauthorized tenantId:", payload.tenantId);
    return;
  }

  const GATEWAY_URL = "https://aura-maintenance-os.vercel.app/api/platform-notifications";

  try {
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(GATEWAY_URL);

    // Build Canonical V1 Payload
    const notificationEvent = {
      schemaVersion: "1.0",
      eventId: `event_${payload.discoverySessionId}_${Date.now()}`,
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
      channels: ["INBOX", "PUSH"],
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

    const resultData = response.data as any;

    if (resultData && resultData.status === "FAILED") {
      // It reached the gateway but failed inside it
      console.error("Gateway returned FAILED status", resultData);
      throw new Error(`Gateway processing failed: ${resultData.error}`);
    }

    if (resultData && resultData.idempotentReplay) {
      console.log(`Event previously processed (idempotent duplicate): ${notificationEvent.idempotencyKey}`);
      // Fallthrough to projection logic for idempotency check
    } else {
      console.log("Notification dispatched successfully:", resultData);
    }

    const inboxCreated = resultData?.inboxCreated || 0;
    if (inboxCreated >= 1 || resultData?.idempotentReplay) {
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
    }

  } catch (error: any) {
    console.error("Error emitting discovery completed notification", error);
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
