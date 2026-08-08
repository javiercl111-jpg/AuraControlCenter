import { createHash } from "node:crypto";

import * as logger from "firebase-functions/logger";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

import {
  CRM_LEAD_CREATE_CAPABILITY_V1,
  CrmLeadCreateErrorV1,
  PREVIEW_CRM_ENVIRONMENT_V1,
  type CreateCrmLeadInputV1,
} from "./createCrmLeadContractV1";
import type {
  CrmLeadCreateAuthorityPortV1,
  CrmLeadCreatePersistenceCommandV1,
  CrmLeadCreatePersistencePortV1,
} from "./createCrmLeadCoreV1";

const PRINCIPALS = "platform_global_admins";
const CAPABILITY_GRANTS = "platform_global_admin_capability_grants";
const LEADS = "platform_leads";
const IDEMPOTENCY = "crm_lead_create_idempotency";
const AUDIT = "platform_audit_logs";
const GRANT_SCHEMA = "PlatformGlobalAdminCapabilityGrantV1";
const IDEMPOTENCY_SCHEMA = "CrmLeadCreateIdempotencyV1";
const AUDIT_SCHEMA = "CrmLeadCreateAuditEventV1";
const ADMIN_ROLES = new Set([
  "PLATFORM_OWNER",
  "PLATFORM_PARTNER",
  "SUPER_ADMIN",
  "FOUNDER",
  "SALES_DIRECTOR",
  "CONSULTANT",
  "SALES_ADVISOR",
  "VIEWER",
  "ADMIN",
  "SUPPORT",
]);

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index]);
}

export class FirestoreCrmLeadCreateAuthorityV1
implements CrmLeadCreateAuthorityPortV1 {
  constructor(private readonly db: Firestore) {}

  async resolve(uid: string) {
    const [principalSnapshot, grantSnapshot] = await this.db.getAll(
      this.db.collection(PRINCIPALS).doc(uid),
      this.db.collection(CAPABILITY_GRANTS).doc(uid),
    );
    if (!principalSnapshot.exists || !grantSnapshot.exists) return null;
    const principal = principalSnapshot.data() ?? {};
    const grant = grantSnapshot.data() ?? {};
    const role = typeof principal.role === "string" ? principal.role : "";
    if (principal.isActive !== true || !ADMIN_ROLES.has(role)) return null;
    if (!hasExactKeys(grant, [
      "capabilities",
      "environment",
      "isActive",
      "schemaVersion",
    ])) return null;
    if (
      grant.schemaVersion !== GRANT_SCHEMA ||
      grant.environment !== PREVIEW_CRM_ENVIRONMENT_V1 ||
      grant.isActive !== true ||
      !Array.isArray(grant.capabilities) ||
      grant.capabilities.length !== 1 ||
      grant.capabilities[0] !== CRM_LEAD_CREATE_CAPABILITY_V1
    ) return null;
    return Object.freeze({
      role,
      isActive: true,
      capabilities: Object.freeze([CRM_LEAD_CREATE_CAPABILITY_V1]),
    });
  }
}

function contractualLead(input: CreateCrmLeadInputV1): Record<string, unknown> {
  return {
    companyName: input.companyName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    interestedModules: [...input.interestedModules],
    stage: "NEW_LEAD",
    notes: input.notes,
    nextFollowUpDate: input.nextFollowUpDate ?? "",
    convertedClientId: "",
    convertedTenantId: "",
    convertedAt: "",
    ...(input.source !== undefined ? { source: input.source } : {}),
    ...(input.leadSourceCode !== undefined
      ? { leadSourceCode: input.leadSourceCode }
      : {}),
    ...(input.leadSourceLabel !== undefined
      ? { leadSourceLabel: input.leadSourceLabel }
      : {}),
    ...(input.leadSourceDetail !== undefined
      ? { leadSourceDetail: input.leadSourceDetail }
      : {}),
    ...(input.estimatedValue !== undefined
      ? { estimatedValue: input.estimatedValue }
      : {}),
  };
}

export class FirestoreCrmLeadCreatePersistenceV1
implements CrmLeadCreatePersistencePortV1 {
  constructor(private readonly db: Firestore) {}

  async create(command: CrmLeadCreatePersistenceCommandV1) {
    const recordId = digest(
      `crm.leads.create\u0000${command.actorUid}\u0000${command.idempotencyKey}`,
    );
    const requestHash = digest(JSON.stringify(command.lead));
    const idempotencyRef = this.db.collection(IDEMPOTENCY).doc(recordId);
    const leadRef = this.db.collection(LEADS).doc();
    const auditRef = this.db.collection(AUDIT).doc(`crm-lead-create-${recordId}`);

    const action = await this.db.runTransaction(async (transaction) => {
      const existingSnapshot = await transaction.get(idempotencyRef);
      if (existingSnapshot.exists) {
        const existing = existingSnapshot.data() ?? {};
        if (
          existing.schemaVersion !== IDEMPOTENCY_SCHEMA ||
          existing.environment !== PREVIEW_CRM_ENVIRONMENT_V1 ||
          existing.requestHash !== requestHash ||
          typeof existing.leadId !== "string" ||
          existing.leadId.length === 0
        ) {
          throw new CrmLeadCreateErrorV1("IDEMPOTENCY_CONFLICT");
        }
        const existingLead = await transaction.get(
          this.db.collection(LEADS).doc(existing.leadId),
        );
        if (!existingLead.exists) {
          throw new CrmLeadCreateErrorV1("INTERNAL_SAFE_FAILURE");
        }
        return Object.freeze({
          action: "REUSED" as const,
          leadId: existing.leadId,
        });
      }

      const timestamp = FieldValue.serverTimestamp();
      transaction.create(leadRef, {
        ...contractualLead(command.lead),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      transaction.create(idempotencyRef, {
        schemaVersion: IDEMPOTENCY_SCHEMA,
        environment: PREVIEW_CRM_ENVIRONMENT_V1,
        requestHash,
        leadId: leadRef.id,
        createdAt: timestamp,
      });
      transaction.create(auditRef, {
        schemaVersion: AUDIT_SCHEMA,
        operation: CRM_LEAD_CREATE_CAPABILITY_V1,
        actorLocator: `actor-${digest(command.actorUid).slice(0, 24)}`,
        leadLocator: `lead-${digest(leadRef.id).slice(0, 24)}`,
        environment: PREVIEW_CRM_ENVIRONMENT_V1,
        outcome: "CREATED",
        timestamp,
        correlationLocator: `correlation-${recordId.slice(0, 24)}`,
        idempotencyOutcome: "CREATED",
      });
      return Object.freeze({
        action: "CREATED" as const,
        leadId: leadRef.id,
      });
    });

    logger.info("crm.leads.create", {
      operation: CRM_LEAD_CREATE_CAPABILITY_V1,
      environment: PREVIEW_CRM_ENVIRONMENT_V1,
      outcome: action.action,
      actorLocator: `actor-${digest(command.actorUid).slice(0, 24)}`,
      leadLocator: `lead-${digest(action.leadId).slice(0, 24)}`,
      correlationLocator: `correlation-${recordId.slice(0, 24)}`,
      idempotencyOutcome: action.action,
    });
    return action.action;
  }
}
