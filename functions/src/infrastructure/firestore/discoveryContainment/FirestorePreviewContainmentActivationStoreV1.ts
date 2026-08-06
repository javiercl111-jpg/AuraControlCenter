import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import {
  PREVIEW_CONTAINMENT_ACTIVATION_AUDIT_SCHEMA_VERSION,
  PREVIEW_CONTAINMENT_TARGET_V1,
  PreviewContainmentActivationErrorV1,
  type PreviewContainmentActivationAuditV1,
  type PreviewContainmentActivationStoreV1,
} from "../../../discovery/containment";
import {
  DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION,
  DISCOVERY_CONTAINMENT_AUDIT_COLLECTION,
  DISCOVERY_CONTAINMENT_POLICIES_COLLECTION,
} from "./firestoreDiscoveryContainmentCollections";
import {
  buildDiscoveryContainmentPolicyDocumentId,
  deserializeDiscoveryContainmentPolicyDocumentV1,
  serializeDiscoveryContainmentPolicyDocumentV1,
} from "./FirestoreDiscoveryContainmentRepository";

const ACTIVE_POINTER_VERSION = "DISCOVERY_CONTAINMENT_ACTIVE_V1" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readActivePointer(value: unknown): Readonly<{
  policyVersion: string;
  tenantId: string | null;
  fingerprint: string | null;
}> {
  if (!isRecord(value) || value.version !== ACTIVE_POINTER_VERSION ||
      value.environment !== PREVIEW_CONTAINMENT_TARGET_V1.environment ||
      typeof value.policyVersion !== "string" ||
      (value.projectId !== undefined &&
        value.projectId !== PREVIEW_CONTAINMENT_TARGET_V1.projectId) ||
      (value.region !== undefined && value.region !== PREVIEW_CONTAINMENT_TARGET_V1.region) ||
      (value.tenantId !== undefined && typeof value.tenantId !== "string") ||
      (value.fingerprint !== undefined &&
        (typeof value.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(value.fingerprint)))) {
    throw new PreviewContainmentActivationErrorV1("ACTIVATION_STATE_CORRUPTED");
  }
  return Object.freeze({
    policyVersion: value.policyVersion,
    tenantId: typeof value.tenantId === "string" ? value.tenantId : null,
    fingerprint: typeof value.fingerprint === "string" ? value.fingerprint : null,
  });
}

function readAudit(value: unknown): PreviewContainmentActivationAuditV1 {
  if (!isRecord(value) ||
      value.schemaVersion !== PREVIEW_CONTAINMENT_ACTIVATION_AUDIT_SCHEMA_VERSION ||
      typeof value.requestId !== "string" || typeof value.correlationId !== "string" ||
      typeof value.actor !== "string" || typeof value.approver !== "string" ||
      typeof value.reason !== "string" || typeof value.tenantId !== "string" ||
      value.projectId !== PREVIEW_CONTAINMENT_TARGET_V1.projectId ||
      value.region !== PREVIEW_CONTAINMENT_TARGET_V1.region ||
      (value.previousVersion !== null && typeof value.previousVersion !== "string") ||
      typeof value.proposedVersion !== "string" || typeof value.idempotencyKey !== "string" ||
      typeof value.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
      value.result !== "APPLIED" || !(value.serverTimestamp instanceof Timestamp)) {
    throw new PreviewContainmentActivationErrorV1("ACTIVATION_STATE_CORRUPTED");
  }
  return Object.freeze({
    ...value,
    serverTimestamp: value.serverTimestamp.toMillis(),
  }) as unknown as PreviewContainmentActivationAuditV1;
}

function auditMatches(
  audit: PreviewContainmentActivationAuditV1,
  input: Parameters<PreviewContainmentActivationStoreV1["execute"]>[0],
): boolean {
  return audit.requestId === input.request.requestId &&
    audit.correlationId === input.request.correlationId &&
    audit.actor === input.request.actor && audit.approver === input.request.approver &&
    audit.reason === input.request.reason && audit.tenantId === input.request.tenantId &&
    audit.projectId === input.request.projectId && audit.region === input.request.region &&
    audit.previousVersion === input.request.expectedCurrentVersion &&
    audit.proposedVersion === input.request.proposedVersion &&
    audit.idempotencyKey === input.request.idempotencyKey &&
    audit.fingerprint === input.fingerprint && audit.result === "APPLIED";
}

export class FirestorePreviewContainmentActivationStoreV1
implements PreviewContainmentActivationStoreV1 {
  constructor(private readonly db: Firestore) {}

  async execute(input: Parameters<PreviewContainmentActivationStoreV1["execute"]>[0]) {
    const activeRef = this.db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION)
      .doc(PREVIEW_CONTAINMENT_TARGET_V1.environment);
    const proposedRef = this.db.collection(DISCOVERY_CONTAINMENT_POLICIES_COLLECTION).doc(
      buildDiscoveryContainmentPolicyDocumentId(
        PREVIEW_CONTAINMENT_TARGET_V1.environment, input.request.proposedVersion,
      ),
    );
    const auditRef = this.db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION)
      .doc(input.auditId);

    return this.db.runTransaction(async (transaction) => {
      const [activeSnapshot, proposedSnapshot, auditSnapshot] = await Promise.all([
        transaction.get(activeRef), transaction.get(proposedRef), transaction.get(auditRef),
      ]);
      const active = activeSnapshot.exists ? readActivePointer(activeSnapshot.data()) : null;
      if (active && active.tenantId !== null && active.tenantId !== input.request.tenantId) {
        throw new PreviewContainmentActivationErrorV1("ACTIVATION_TENANT_REJECTED");
      }

      if (auditSnapshot.exists) {
        const audit = readAudit(auditSnapshot.data());
        if (!auditMatches(audit, input)) {
          throw new PreviewContainmentActivationErrorV1(
            "ACTIVATION_IDEMPOTENCY_CONFLICT",
          );
        }
        if (!active || active.policyVersion !== input.request.proposedVersion ||
            active.fingerprint !== input.fingerprint || !proposedSnapshot.exists) {
          throw new PreviewContainmentActivationErrorV1("ACTIVATION_STATE_CORRUPTED");
        }
        const replayPolicy = deserializeDiscoveryContainmentPolicyDocumentV1(
          proposedSnapshot.data(),
        );
        if (replayPolicy.policyVersion !== input.request.proposedVersion ||
            replayPolicy.environment !== "PREVIEW") {
          throw new PreviewContainmentActivationErrorV1("ACTIVATION_STATE_CORRUPTED");
        }
        return Object.freeze({
          decision: input.request.dryRun ? "DRY_RUN_VALIDATED" as const : "REPLAY" as const,
          previousVersion: input.request.expectedCurrentVersion,
          proposedVersion: input.request.proposedVersion,
          fingerprint: input.fingerprint,
          auditId: input.request.dryRun ? null : input.auditId,
        });
      }

      if (active) {
        const currentRef = this.db.collection(DISCOVERY_CONTAINMENT_POLICIES_COLLECTION).doc(
          buildDiscoveryContainmentPolicyDocumentId(
            PREVIEW_CONTAINMENT_TARGET_V1.environment, active.policyVersion,
          ),
        );
        const currentSnapshot = active.policyVersion === input.request.proposedVersion
          ? proposedSnapshot : await transaction.get(currentRef);
        if (!currentSnapshot.exists) {
          throw new PreviewContainmentActivationErrorV1("ACTIVATION_ORPHAN_POINTER");
        }
        const currentPolicy = deserializeDiscoveryContainmentPolicyDocumentV1(
          currentSnapshot.data(),
        );
        if (currentPolicy.environment !== "PREVIEW" ||
            currentPolicy.policyVersion !== active.policyVersion) {
          throw new PreviewContainmentActivationErrorV1("ACTIVATION_STATE_CORRUPTED");
        }
      }

      const currentVersion = active?.policyVersion ?? null;
      if (currentVersion !== input.request.expectedCurrentVersion) {
        throw new PreviewContainmentActivationErrorV1("ACTIVATION_CAS_MISMATCH");
      }
      if (currentVersion === input.request.proposedVersion) {
        throw new PreviewContainmentActivationErrorV1("ACTIVATION_DUPLICATE_REJECTED");
      }
      if (proposedSnapshot.exists) {
        throw new PreviewContainmentActivationErrorV1("ACTIVATION_VERSION_IMMUTABLE");
      }

      if (input.request.dryRun) {
        return Object.freeze({
          decision: "DRY_RUN_VALIDATED" as const,
          previousVersion: currentVersion,
          proposedVersion: input.request.proposedVersion,
          fingerprint: input.fingerprint,
          auditId: null,
        });
      }

      const audit: PreviewContainmentActivationAuditV1 = Object.freeze({
        schemaVersion: PREVIEW_CONTAINMENT_ACTIVATION_AUDIT_SCHEMA_VERSION,
        requestId: input.request.requestId,
        correlationId: input.request.correlationId,
        actor: input.request.actor,
        approver: input.request.approver,
        reason: input.request.reason,
        tenantId: input.request.tenantId,
        projectId: input.request.projectId,
        region: input.request.region,
        previousVersion: currentVersion,
        proposedVersion: input.request.proposedVersion,
        idempotencyKey: input.request.idempotencyKey,
        fingerprint: input.fingerprint,
        result: "APPLIED",
        serverTimestamp: input.serverTimestamp,
      });
      transaction.create(proposedRef,
        serializeDiscoveryContainmentPolicyDocumentV1(input.policy));
      transaction.set(activeRef, {
        version: ACTIVE_POINTER_VERSION,
        environment: PREVIEW_CONTAINMENT_TARGET_V1.environment,
        projectId: PREVIEW_CONTAINMENT_TARGET_V1.projectId,
        region: PREVIEW_CONTAINMENT_TARGET_V1.region,
        tenantId: input.request.tenantId,
        policyVersion: input.request.proposedVersion,
        fingerprint: input.fingerprint,
        updatedAt: Timestamp.fromMillis(input.serverTimestamp),
      });
      transaction.create(auditRef, {
        ...audit,
        serverTimestamp: Timestamp.fromMillis(input.serverTimestamp),
      });
      return Object.freeze({
        decision: "APPLIED" as const,
        previousVersion: currentVersion,
        proposedVersion: input.request.proposedVersion,
        fingerprint: input.fingerprint,
        auditId: input.auditId,
      });
    }, { maxAttempts: 20 });
  }
}
