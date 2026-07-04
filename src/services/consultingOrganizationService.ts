import {
    Timestamp,
    addDoc,
    arrayUnion,
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
    OrganizationTimelineEvent,
    PlatformDiscoveryRequest,
    PlatformOrganization,
  } from "../types/platformOrganization";
  
  const ORGANIZATIONS_COLLECTION = "platform_organizations";
  const DISCOVERY_REQUESTS_COLLECTION = "platform_discovery_requests";
  
  const DEFAULT_CONSULTANT = {
    id: "jcuellar",
    name: "Javier Cuéllar Lazarini",
    email: "jcuellar@aura-hcm.com",
  };
  
  type CreateOrganizationInput = Omit<
    PlatformOrganization,
    "id" | "createdAt" | "updatedAt"
  >;
  
  function createTimelineEvent(
    type: OrganizationTimelineEvent["type"],
    title: string,
    description: string
  ): OrganizationTimelineEvent {
    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      title,
      description,
      createdAt: Timestamp.now(),
    };
  }
  
  export async function createOrganization(input: CreateOrganizationInput) {
    const timeline = input.timeline?.length
      ? input.timeline
      : [
          createTimelineEvent(
            "ORGANIZATION_CREATED",
            "Organización creada",
            "El expediente fue creado manualmente en Aura Consulting Center."
          ),
        ];
  
    const ref = await addDoc(collection(db, ORGANIZATIONS_COLLECTION), {
      ...input,
      timeline,
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
      timeline: arrayUnion(
        createTimelineEvent(
          "STAGE_UPDATED",
          "Etapa actualizada",
          `La organización avanzó a la etapa ${stage}.`
        )
      ),
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
      assignedConsultantId: DEFAULT_CONSULTANT.id,
      assignedConsultantName: DEFAULT_CONSULTANT.name,
      assignedConsultantEmail: DEFAULT_CONSULTANT.email,
      assignedAt: Timestamp.now(),
      timeline: [
        createTimelineEvent(
          "DISCOVERY_REQUEST_RECEIVED",
          "Solicitud recibida",
          `La organización ingresó desde ${request.source}.`
        ),
        createTimelineEvent(
          "CONSULTANT_ASSIGNED",
          "Consultor asignado",
          `${DEFAULT_CONSULTANT.name} fue asignado para iniciar el acompañamiento.`
        ),
        createTimelineEvent(
          "DISCOVERY_STARTED",
          "Diagnóstico iniciado",
          "La solicitud fue convertida en expediente Aura."
        ),
      ],
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