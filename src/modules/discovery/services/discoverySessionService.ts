import { collection, query, orderBy, limit, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { DiscoverySession } from "../types/discoveryTypes";

const COLLECTION_NAME = "discovery_sessions";

export async function getDiscoverySessions(): Promise<DiscoverySession[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((docSnap) => ({
    ...(docSnap.data() as DiscoverySession),
    id: docSnap.id,
  }));
}

export async function updateDiscoverySessionStatus(sessionId: string, status: string): Promise<void> {
  const sessionRef = doc(db, COLLECTION_NAME, sessionId);
  await updateDoc(sessionRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

const DiscoverySessionService = {
  getDiscoverySessions,
  updateDiscoverySessionStatus,
};

export default DiscoverySessionService;
