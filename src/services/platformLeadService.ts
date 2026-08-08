import {
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
  } from "firebase/firestore";
  import { httpsCallable } from "firebase/functions";
  
  import { db, functions } from "../config/firebase";
  import type { LeadStage, PlatformLead, LeadSource } from "../types/platformLead";
  
  const COLLECTION_NAME = "platform_leads";
  
  export async function getLeads(): Promise<PlatformLead[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((leadDoc) => ({
      id: leadDoc.id,
      ...(leadDoc.data() as Omit<PlatformLead, "id">),
    }));
  }
  
  export interface CreateLeadInput {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    source?: LeadSource | string;
    leadSourceCode?: LeadSource | string;
    leadSourceLabel?: string;
    leadSourceDetail?: string;
    interestedModules: string[];
    estimatedValue?: number;
    notes: string;
    nextFollowUpDate?: string;
  }

  export interface CreateLeadResult {
    schemaVersion: "CreateCrmLeadResultV1";
    action: "CREATED" | "REUSED";
  }

  function createIdempotencyKey(): string {
    if (!globalThis.crypto?.randomUUID) {
      throw new Error("CRM_SECURE_RANDOM_UNAVAILABLE");
    }
    return globalThis.crypto.randomUUID();
  }

  function isCreateLeadResult(value: unknown): value is CreateLeadResult {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return candidate.schemaVersion === "CreateCrmLeadResultV1" &&
      (candidate.action === "CREATED" || candidate.action === "REUSED");
  }

  export function getCreateLeadSafeMessage(error: unknown): string {
    const code = typeof error === "object" && error !== null &&
      typeof Reflect.get(error, "code") === "string"
      ? String(Reflect.get(error, "code"))
      : "";
    if (code.includes("permission-denied")) {
      return "No tienes permiso para crear prospectos.";
    }
    if (code.includes("already-exists")) {
      return "La solicitud entra en conflicto con un intento anterior.";
    }
    if (code.includes("invalid-argument")) {
      return "Los datos del prospecto no son válidos.";
    }
    return "No se pudo crear el prospecto.";
  }

  export async function createLead(data: CreateLeadInput): Promise<CreateLeadResult> {
    const callable = httpsCallable(functions, "createCrmLead");
    const result = await callable({
      schemaVersion: "CreateCrmLeadRequestV1",
      idempotencyKey: createIdempotencyKey(),
      lead: {
        companyName: data.companyName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        interestedModules: data.interestedModules,
        notes: data.notes,
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.leadSourceCode !== undefined
          ? { leadSourceCode: data.leadSourceCode }
          : {}),
        ...(data.leadSourceLabel !== undefined
          ? { leadSourceLabel: data.leadSourceLabel }
          : {}),
        ...(data.leadSourceDetail !== undefined
          ? { leadSourceDetail: data.leadSourceDetail }
          : {}),
        ...(data.estimatedValue !== undefined
          ? { estimatedValue: data.estimatedValue }
          : {}),
        ...(data.nextFollowUpDate !== undefined
          ? { nextFollowUpDate: data.nextFollowUpDate }
          : {}),
      },
    });
    if (!isCreateLeadResult(result.data)) {
      throw new Error("CRM_CREATE_RESPONSE_INVALID");
    }
    return result.data;
  }
  
  export async function updateLeadStage(
    leadId: string,
    stage: LeadStage
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, leadId), {
      stage,
      updatedAt: serverTimestamp(),
    });
  }
  
  export async function markLeadAsConverted(data: {
    leadId: string;
    clientId: string;
    tenantId: string;
  }): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, data.leadId), {
      stage: "WON",
      convertedClientId: data.clientId,
      convertedTenantId: data.tenantId,
      convertedAt: new Date().toISOString().slice(0, 10),
      updatedAt: serverTimestamp(),
    });
  }
