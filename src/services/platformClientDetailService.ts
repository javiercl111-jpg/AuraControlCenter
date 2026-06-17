import { doc, getDoc } from "firebase/firestore";

import { db } from "../config/firebase";
import type { PlatformClient } from "../types/platformClient";

const COLLECTION_NAME = "platform_clients";

export async function getClientById(
  clientId: string
): Promise<PlatformClient | null> {
  const clientRef = doc(db, COLLECTION_NAME, clientId);
  const snapshot = await getDoc(clientRef);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<PlatformClient, "id">),
  };
}