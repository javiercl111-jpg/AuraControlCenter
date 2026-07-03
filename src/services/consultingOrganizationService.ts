import {
    addDoc,
    collection,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    doc,
  } from "firebase/firestore";
  
  import { db } from "../config/firebase";
  import type {
    ConsultingStage,
    PlatformOrganization,
  } from "../types/platformOrganization";
  
  const COLLECTION_NAME = "platform_organizations";
  
  type CreateOrganizationInput = Omit<
    PlatformOrganization,
    "id" | "createdAt" | "updatedAt"
  >;
  
  export async function createOrganization(input: CreateOrganizationInput) {
    const ref = await addDoc(collection(db, COLLECTION_NAME), {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  
    return ref.id;
  }
  
  export async function getOrganizations(): Promise<PlatformOrganization[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((item) => ({
      id: item.id,
      ...(item.data() as Omit<PlatformOrganization, "id">),
    }));
  }
  
  export async function updateOrganizationStage(
    organizationId: string,
    stage: ConsultingStage
  ) {
    await updateDoc(doc(db, COLLECTION_NAME, organizationId), {
      stage,
      updatedAt: serverTimestamp(),
    });
  }