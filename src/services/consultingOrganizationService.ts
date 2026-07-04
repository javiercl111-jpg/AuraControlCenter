import {
    addDoc,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
  } from "firebase/firestore";
  
  import { db } from "../config/firebase";
  import type {
    ConsultingStage,
    PlatformDiscoveryRequest,
    PlatformOrganization,
  } from "../types/platformOrganization";
  
  const ORGANIZATIONS_COLLECTION = "platform_organizations";
  const DISCOVERY_REQUESTS_COLLECTION = "platform_discovery_requests";
  
  type CreateOrganizationInput = Omit<
    PlatformOrganization,
    "id" | "createdAt" | "updatedAt"
  >;
  
  export async function createOrganization(input: CreateOrganizationInput) {
    const ref = await addDoc(collection(db, ORGANIZATIONS_COLLECTION), {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  
    return ref.id;
  }
  
  export async function getOrganizations(): Promise<PlatformOrganization[]> {
    const q = query(
      collection(db, ORGANIZATIONS_COLLECTION),
      orderBy("createdAt", "desc")
    );
  
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((item) => ({
      id: item.id,
      ...(item.data() as Omit<PlatformOrganization, "id">),
    }));
  }
  
  export async function getDiscoveryRequests(): Promise<
    PlatformDiscoveryRequest[]
  > {
    const q = query(
      collection(db, DISCOVERY_REQUESTS_COLLECTION),
      where("status", "==", "NEW"),
      orderBy("createdAt", "desc")
    );
  
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((item) => ({
      id: item.id,
      ...(item.data() as Omit<PlatformDiscoveryRequest, "id">),
    }));
  }
  
  export async function updateOrganizationStage(
    organizationId: string,
    stage: ConsultingStage
  ) {
    await updateDoc(doc(db, ORGANIZATIONS_COLLECTION, organizationId), {
      stage,
      updatedAt: serverTimestamp(),
    });
  }
  
  export async function convertDiscoveryRequestToOrganization(
    request: PlatformDiscoveryRequest
  ) {
    const organizationId = await createOrganization({
      companyName: request.companyName,
      contactName: request.contactName,
      email: request.email,
      phone: request.phone,
      industry: request.industry,
      companySize: request.companySize,
      mainChallenge: request.mainChallenge,
      interestAreas: request.interestAreas || [],
      stage: "DISCOVERY",
      priority: request.priority,
      recommendedNextStep: request.recommendedNextStep,
      notes: request.notes || "",
      source: request.source,
      discoveryRequestId: request.id,
    });
  
    await updateDoc(doc(db, DISCOVERY_REQUESTS_COLLECTION, request.id), {
      status: "CONVERTED",
      convertedAt: serverTimestamp(),
      convertedOrganizationId: organizationId,
      updatedAt: serverTimestamp(),
    });
  
    return organizationId;
  }
  
  export async function discardDiscoveryRequest(requestId: string) {
    await updateDoc(doc(db, DISCOVERY_REQUESTS_COLLECTION, requestId), {
      status: "DISCARDED",
      updatedAt: serverTimestamp(),
    });
  }