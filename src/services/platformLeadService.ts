import {
    addDoc,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
  } from "firebase/firestore";
  
  import { db } from "../config/firebase";
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
  
  export async function createLead(data: {
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
    stage: LeadStage;
    notes: string;
    nextFollowUpDate?: string;
  }): Promise<void> {
    const payload: any = {
      companyName: data.companyName,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      interestedModules: data.interestedModules,
      stage: data.stage,
      notes: data.notes,
      nextFollowUpDate: data.nextFollowUpDate || "",
      convertedClientId: "",
      convertedTenantId: "",
      convertedAt: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (data.source !== undefined) payload.source = data.source;
    if (data.leadSourceCode !== undefined) payload.leadSourceCode = data.leadSourceCode;
    if (data.leadSourceLabel !== undefined) payload.leadSourceLabel = data.leadSourceLabel;
    if (data.leadSourceDetail !== undefined) payload.leadSourceDetail = data.leadSourceDetail;
    if (data.estimatedValue !== undefined) payload.estimatedValue = data.estimatedValue;

    await addDoc(collection(db, COLLECTION_NAME), payload);
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