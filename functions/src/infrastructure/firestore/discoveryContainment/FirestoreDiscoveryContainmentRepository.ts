import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import {
  DISCOVERY_CONTAINMENT_AUDIT_SCHEMA_VERSION,
  DiscoveryContainmentError,
  type DiscoveryContainmentAuditRecordV1,
  type DiscoveryContainmentAuditRepository,
  type DiscoveryContainmentEnvironment,
  type DiscoveryContainmentPolicyProvider,
  type DiscoveryContainmentPolicyV1,
  validateDiscoveryContainmentAuditV1,
  validateDiscoveryContainmentPolicyV1,
} from "../../../discovery/containment";
import { recordDiscoveryTelemetrySafe } from "../../../discovery/telemetry";
import {
  DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION,
  DISCOVERY_CONTAINMENT_AUDIT_COLLECTION,
  DISCOVERY_CONTAINMENT_POLICIES_COLLECTION,
} from "./firestoreDiscoveryContainmentCollections";

const ACTIVE_POINTER_VERSION = "DISCOVERY_CONTAINMENT_ACTIVE_V1" as const;
const MAX_ROLLBACK_DEPTH = 8;

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function buildDiscoveryContainmentPolicyDocumentId(
  environment: DiscoveryContainmentEnvironment,
  policyVersion: string,
): string {
  return digest(`${environment}\0${policyVersion}`);
}

export function buildDiscoveryContainmentAuditId(input: Readonly<{
  environment: DiscoveryContainmentEnvironment;
  action: string;
  policyVersion: string;
  previousPolicyVersion: string | null;
}>): string {
  return `audit_${digest([
    input.environment, input.action, input.policyVersion,
    input.previousPolicyVersion ?? "none",
  ].join("\0")).slice(0, 48)}`;
}

function policyRef(
  db: Firestore,
  environment: DiscoveryContainmentEnvironment,
  policyVersion: string,
) {
  return db.collection(DISCOVERY_CONTAINMENT_POLICIES_COLLECTION)
    .doc(buildDiscoveryContainmentPolicyDocumentId(environment, policyVersion));
}

function serializePolicy(policy: DiscoveryContainmentPolicyV1): Record<string, unknown> {
  return {
    ...policy,
    blockedAppIds: [...policy.blockedAppIds],
    blockedCommercialCodeHashes: [...policy.blockedCommercialCodeHashes],
    emergencyGlobalQuota: Object.fromEntries(Object.entries(policy.emergencyGlobalQuota)
      .map(([operation, rule]) => [operation, { ...rule }])),
    createdAt: Timestamp.fromMillis(policy.createdAt),
    updatedAt: Timestamp.fromMillis(policy.updatedAt),
    expiresAt: Timestamp.fromMillis(policy.expiresAt),
  };
}

function deserializePolicy(value: unknown): DiscoveryContainmentPolicyV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DiscoveryContainmentError("CONTAINMENT_POLICY_CORRUPTED");
  }
  const data = value as Record<string, unknown>;
  const toMillis = (field: string): number => {
    const timestamp = data[field];
    if (!(timestamp instanceof Timestamp)) {
      throw new DiscoveryContainmentError("CONTAINMENT_POLICY_CORRUPTED");
    }
    return timestamp.toMillis();
  };
  return validateDiscoveryContainmentPolicyV1({
    ...data,
    createdAt: toMillis("createdAt"),
    updatedAt: toMillis("updatedAt"),
    expiresAt: toMillis("expiresAt"),
  });
}

function serializeAudit(record: DiscoveryContainmentAuditRecordV1): Record<string, unknown> {
  return {
    ...record,
    timestamp: Timestamp.fromMillis(record.timestamp),
    expiresAt: Timestamp.fromMillis(record.expiresAt),
  };
}

function readActivePointer(
  value: unknown,
  environment: DiscoveryContainmentEnvironment,
): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DiscoveryContainmentError("CONTAINMENT_POLICY_CORRUPTED");
  }
  const data = value as Record<string, unknown>;
  if (data.version !== ACTIVE_POINTER_VERSION || data.environment !== environment ||
      typeof data.policyVersion !== "string") {
    throw new DiscoveryContainmentError("CONTAINMENT_POLICY_CORRUPTED");
  }
  return data.policyVersion;
}

function policiesEqual(
  left: DiscoveryContainmentPolicyV1,
  right: DiscoveryContainmentPolicyV1,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class FirestoreDiscoveryContainmentPolicyProvider
implements DiscoveryContainmentPolicyProvider {
  constructor(protected readonly db: Firestore) {}

  async getActivePolicy(
    environment: DiscoveryContainmentEnvironment,
  ): Promise<DiscoveryContainmentPolicyV1 | null> {
    const active = await this.db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION)
      .doc(environment).get();
    if (!active.exists) return null;
    const policyVersion = readActivePointer(active.data(), environment);
    return this.getPolicyVersion({ environment, policyVersion });
  }

  async getPolicyVersion(input: Readonly<{
    environment: DiscoveryContainmentEnvironment;
    policyVersion: string;
  }>): Promise<DiscoveryContainmentPolicyV1 | null> {
    const snapshot = await policyRef(this.db, input.environment, input.policyVersion).get();
    if (!snapshot.exists) return null;
    const policy = deserializePolicy(snapshot.data());
    if (policy.environment !== input.environment ||
        policy.policyVersion !== input.policyVersion) {
      throw new DiscoveryContainmentError("CONTAINMENT_POLICY_CORRUPTED");
    }
    return policy;
  }
}

export class FirestoreDiscoveryContainmentRepository
extends FirestoreDiscoveryContainmentPolicyProvider
implements DiscoveryContainmentAuditRepository {
  async append(recordValue: DiscoveryContainmentAuditRecordV1): Promise<"CREATED" | "REPLAY"> {
    const record = validateDiscoveryContainmentAuditV1(recordValue);
    const ref = this.db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION).doc(record.auditId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) return "REPLAY" as const;
      transaction.create(ref, serializeAudit(record));
      return "CREATED" as const;
    });
  }

  async activatePolicy(input: Readonly<{
    policy: DiscoveryContainmentPolicyV1;
    actorRole: string;
    approverRole: string;
    reasonCode: string;
  }>): Promise<Readonly<{ decision: "APPLIED" | "REPLAY"; auditId: string }>> {
    const policy = validateDiscoveryContainmentPolicyV1(input.policy);
    if (policy.status !== "ACTIVE" || input.actorRole !== policy.ownerRole ||
        input.approverRole !== policy.approvedByRole) {
      throw new DiscoveryContainmentError("CONTAINMENT_CONFIGURATION_ERROR");
    }
    const activeRef = this.db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION)
      .doc(policy.environment);
    const versionRef = policyRef(this.db, policy.environment, policy.policyVersion);
    return this.db.runTransaction(async (transaction) => {
      const [activeSnapshot, versionSnapshot] = await Promise.all([
        transaction.get(activeRef), transaction.get(versionRef),
      ]);
      const previousPolicyVersion = activeSnapshot.exists
        ? readActivePointer(activeSnapshot.data(), policy.environment) : null;
      let rollbackTarget: DiscoveryContainmentPolicyV1 | null = null;
      if (policy.rollbackVersion !== null) {
        const rollbackSnapshot = await transaction.get(
          policyRef(this.db, policy.environment, policy.rollbackVersion),
        );
        if (!rollbackSnapshot.exists) {
          throw new DiscoveryContainmentError("CONTAINMENT_CONFIGURATION_ERROR");
        }
        rollbackTarget = deserializePolicy(rollbackSnapshot.data());
        if (rollbackTarget.environment !== policy.environment ||
            rollbackTarget.policyVersion !== policy.rollbackVersion ||
            rollbackTarget.createdAt > policy.createdAt ||
            rollbackTarget.status !== "ACTIVE") {
          throw new DiscoveryContainmentError("CONTAINMENT_CONFIGURATION_ERROR");
        }
      }
      if (versionSnapshot.exists) {
        const existing = deserializePolicy(versionSnapshot.data());
        if (!policiesEqual(existing, policy)) {
          throw new DiscoveryContainmentError("CONTAINMENT_CONFIGURATION_ERROR");
        }
        if (previousPolicyVersion === policy.policyVersion) {
          return Object.freeze({
            decision: "REPLAY" as const,
            auditId: buildDiscoveryContainmentAuditId({
              environment: policy.environment,
              action: "ACTIVATE",
              policyVersion: policy.policyVersion,
              previousPolicyVersion: null,
            }),
          });
        }
      }
      const action = previousPolicyVersion === null ? "ACTIVATE" : "UPDATE";
      const auditId = buildDiscoveryContainmentAuditId({
        environment: policy.environment, action,
        policyVersion: policy.policyVersion, previousPolicyVersion,
      });
      const auditRef = this.db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION).doc(auditId);
      const auditSnapshot = await transaction.get(auditRef);
      if (auditSnapshot.exists) return Object.freeze({ decision: "REPLAY" as const, auditId });
      const audit = validateDiscoveryContainmentAuditV1({
        version: DISCOVERY_CONTAINMENT_AUDIT_SCHEMA_VERSION,
        auditId, policyVersion: policy.policyVersion, previousPolicyVersion,
        action, environment: policy.environment, actorRole: input.actorRole,
        approverRole: input.approverRole, reasonCode: input.reasonCode,
        timestamp: policy.updatedAt, expiresAt: policy.expiresAt,
        rollbackVersion: policy.rollbackVersion, result: "APPLIED",
      });
      if (!versionSnapshot.exists) transaction.create(versionRef, serializePolicy(policy));
      transaction.set(activeRef, {
        version: ACTIVE_POINTER_VERSION,
        environment: policy.environment,
        policyVersion: policy.policyVersion,
        updatedAt: Timestamp.fromMillis(policy.updatedAt),
      });
      transaction.create(auditRef, serializeAudit(audit));
      return Object.freeze({ decision: "APPLIED" as const, auditId });
    });
  }

  async transitionActivePolicy(input: Readonly<{
    policy: DiscoveryContainmentPolicyV1;
    action: "EXPIRE" | "REVOKE";
    actorRole: string;
    approverRole: string;
    reasonCode: string;
  }>): Promise<Readonly<{ decision: "APPLIED" | "REPLAY"; auditId: string }>> {
    const policy = validateDiscoveryContainmentPolicyV1(input.policy);
    const expectedStatus = input.action === "EXPIRE" ? "EXPIRED" : "REVOKED";
    if (policy.status !== expectedStatus || input.actorRole !== policy.ownerRole ||
        input.approverRole !== policy.approvedByRole) {
      throw new DiscoveryContainmentError("CONTAINMENT_CONFIGURATION_ERROR");
    }
    const activeRef = this.db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION)
      .doc(policy.environment);
    const versionRef = policyRef(this.db, policy.environment, policy.policyVersion);
    return this.db.runTransaction(async (transaction) => {
      const [activeSnapshot, versionSnapshot] = await Promise.all([
        transaction.get(activeRef), transaction.get(versionRef),
      ]);
      if (!activeSnapshot.exists) {
        throw new DiscoveryContainmentError("CONTAINMENT_CONFIGURATION_ERROR");
      }
      const previousPolicyVersion = readActivePointer(
        activeSnapshot.data(), policy.environment,
      );
      if (previousPolicyVersion === policy.policyVersion ||
          policy.rollbackVersion !== previousPolicyVersion) {
        throw new DiscoveryContainmentError("CONTAINMENT_CONFIGURATION_ERROR");
      }
      const previousSnapshot = await transaction.get(
        policyRef(this.db, policy.environment, previousPolicyVersion),
      );
      if (!previousSnapshot.exists ||
          deserializePolicy(previousSnapshot.data()).status !== "ACTIVE") {
        throw new DiscoveryContainmentError("CONTAINMENT_CONFIGURATION_ERROR");
      }
      const auditId = buildDiscoveryContainmentAuditId({
        environment: policy.environment,
        action: input.action,
        policyVersion: policy.policyVersion,
        previousPolicyVersion,
      });
      const auditRef = this.db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION)
        .doc(auditId);
      const auditSnapshot = await transaction.get(auditRef);
      if (auditSnapshot.exists) {
        if (!versionSnapshot.exists ||
            !policiesEqual(deserializePolicy(versionSnapshot.data()), policy)) {
          throw new DiscoveryContainmentError("CONTAINMENT_CONFIGURATION_ERROR");
        }
        return Object.freeze({ decision: "REPLAY" as const, auditId });
      }
      if (versionSnapshot.exists) {
        throw new DiscoveryContainmentError("CONTAINMENT_CONFIGURATION_ERROR");
      }
      const audit = validateDiscoveryContainmentAuditV1({
        version: DISCOVERY_CONTAINMENT_AUDIT_SCHEMA_VERSION,
        auditId,
        policyVersion: policy.policyVersion,
        previousPolicyVersion,
        action: input.action,
        environment: policy.environment,
        actorRole: input.actorRole,
        approverRole: input.approverRole,
        reasonCode: input.reasonCode,
        timestamp: policy.updatedAt,
        expiresAt: policy.expiresAt,
        rollbackVersion: policy.rollbackVersion,
        result: "APPLIED",
      });
      transaction.create(versionRef, serializePolicy(policy));
      transaction.set(activeRef, {
        version: ACTIVE_POINTER_VERSION,
        environment: policy.environment,
        policyVersion: policy.policyVersion,
        updatedAt: Timestamp.fromMillis(policy.updatedAt),
      });
      transaction.create(auditRef, serializeAudit(audit));
      return Object.freeze({ decision: "APPLIED" as const, auditId });
    });
  }

  async rollback(input: Readonly<{
    environment: DiscoveryContainmentEnvironment;
    actorRole: string;
    approverRole: string;
    reasonCode: string;
    timestamp: number;
  }>): Promise<Readonly<{
    decision: "APPLIED" | "REPLAY";
    policy: DiscoveryContainmentPolicyV1;
    auditId: string;
  }>> {
    const activeRef = this.db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION)
      .doc(input.environment);
    const result = await this.db.runTransaction(async (transaction: Transaction) => {
      const activeSnapshot = await transaction.get(activeRef);
      if (!activeSnapshot.exists) {
        throw new DiscoveryContainmentError("CONTAINMENT_ROLLBACK_INVALID");
      }
      const activeVersion = readActivePointer(activeSnapshot.data(), input.environment);
      const activePolicySnapshot = await transaction.get(
        policyRef(this.db, input.environment, activeVersion),
      );
      if (!activePolicySnapshot.exists) {
        throw new DiscoveryContainmentError("CONTAINMENT_ROLLBACK_INVALID");
      }
      const activePolicy = deserializePolicy(activePolicySnapshot.data());
      const targetVersion = activePolicy.rollbackVersion;
      if (!targetVersion || targetVersion === activeVersion) {
        throw new DiscoveryContainmentError("CONTAINMENT_ROLLBACK_INVALID");
      }

      const visited = new Set<string>([activeVersion]);
      let cursor: string | null = targetVersion;
      let targetPolicy: DiscoveryContainmentPolicyV1 | null = null;
      for (let depth = 0; cursor !== null; depth += 1) {
        if (depth >= MAX_ROLLBACK_DEPTH || visited.has(cursor)) {
          throw new DiscoveryContainmentError("CONTAINMENT_ROLLBACK_INVALID");
        }
        visited.add(cursor);
        const snapshot = await transaction.get(policyRef(this.db, input.environment, cursor));
        if (!snapshot.exists) {
          throw new DiscoveryContainmentError("CONTAINMENT_ROLLBACK_INVALID");
        }
        const policy = deserializePolicy(snapshot.data());
        if (policy.environment !== input.environment) {
          throw new DiscoveryContainmentError("CONTAINMENT_ROLLBACK_INVALID");
        }
        if (targetPolicy === null) targetPolicy = policy;
        cursor = policy.rollbackVersion;
      }
      if (!targetPolicy || targetPolicy.status !== "ACTIVE" ||
          targetPolicy.expiresAt <= input.timestamp ||
          input.actorRole !== activePolicy.ownerRole ||
          input.approverRole !== activePolicy.approvedByRole) {
        throw new DiscoveryContainmentError("CONTAINMENT_ROLLBACK_INVALID");
      }
      const auditId = buildDiscoveryContainmentAuditId({
        environment: input.environment, action: "ROLLBACK",
        policyVersion: targetPolicy.policyVersion,
        previousPolicyVersion: activePolicy.policyVersion,
      });
      const auditRef = this.db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION).doc(auditId);
      const auditSnapshot = await transaction.get(auditRef);
      if (auditSnapshot.exists) {
        return Object.freeze({ decision: "REPLAY" as const, policy: targetPolicy, auditId });
      }
      const audit = validateDiscoveryContainmentAuditV1({
        version: DISCOVERY_CONTAINMENT_AUDIT_SCHEMA_VERSION,
        auditId, policyVersion: targetPolicy.policyVersion,
        previousPolicyVersion: activePolicy.policyVersion,
        action: "ROLLBACK", environment: input.environment,
        actorRole: input.actorRole, approverRole: input.approverRole,
        reasonCode: input.reasonCode, timestamp: input.timestamp,
        expiresAt: targetPolicy.expiresAt,
        rollbackVersion: targetPolicy.rollbackVersion, result: "APPLIED",
      });
      transaction.set(activeRef, {
        version: ACTIVE_POINTER_VERSION,
        environment: input.environment,
        policyVersion: targetPolicy.policyVersion,
        updatedAt: Timestamp.fromMillis(input.timestamp),
      });
      transaction.create(auditRef, serializeAudit(audit));
      return Object.freeze({ decision: "APPLIED" as const, policy: targetPolicy, auditId });
    }, { maxAttempts: 100 });
    if (result.decision === "APPLIED") {
      await recordDiscoveryTelemetrySafe(this.db, {
        eventType: "containment.rollback_applied",
        source: "FirestoreDiscoveryContainmentRepository",
        component: "discovery.containment",
        outcome: "COMPLETED",
        reasonCode: input.reasonCode,
        durationMs: 0,
        environment: input.environment,
        correlationKey: result.auditId,
        requestKey: result.auditId,
      });
    }
    return result;
  }
}
