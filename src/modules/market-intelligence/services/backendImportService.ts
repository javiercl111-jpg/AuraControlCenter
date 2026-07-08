import { ref, uploadBytesResumable } from "firebase/storage";
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit } from "firebase/firestore";
import { db, storage, auth } from "../../../config/firebase";

export interface BackendImportJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  filename: string;
  storagePath: string;
  total: number;
  processed: number;
  added: number;
  overwritten: number;
  omitted: number;
  failed: number;
  progress: number;
  currentStage: string;
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
  createdBy: string;
  states: string[];
  errorMessage?: string;
  fingerprint?: string;
}

/**
 * Uploads a large file to Firebase Storage and creates a queue document in market_import_jobs.
 */
export async function uploadAndCreateImportJob(
  file: File,
  filename: string,
  states: string[],
  fingerprint: string,
  onUploadProgress?: (progress: number) => void
): Promise<string> {
  console.log(`[Aura Audit] [3] Upload a Storage iniciado. Archivo: ${file.name}, Tamaño: ${file.size} bytes`);
  const uniqueName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
  const fileRef = ref(storage, `market_imports/${uniqueName}`);

  // 1. Upload bytes to storage
  const uploadTask = uploadBytesResumable(fileRef, file);

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onUploadProgress) {
          onUploadProgress(percent);
        }
      },
      (error) => {
        console.error("[Aura Audit] Error durante la subida a Storage:", error);
        reject(error);
      },
      () => resolve()
    );
  });

  const storagePath = fileRef.fullPath;
  console.log(`[Aura Audit] [4] Upload a Storage completado. Path en Storage: ${storagePath}`);

  // 2. Add job doc in market_import_jobs
  const jobDoc = {
    status: "queued",
    filename,
    storagePath,
    total: 0,
    processed: 0,
    added: 0,
    overwritten: 0,
    omitted: 0,
    failed: 0,
    progress: 0,
    currentStage: "queued",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser?.email || "anonymous",
    states,
    fingerprint,
    errorMessage: "",
  };

  const collectionName = "market_import_jobs";
  console.log("[AUDIT] writing collection:", collectionName, jobDoc);
  try {
    const docRef = await addDoc(collection(db, "market_import_jobs"), jobDoc);
    console.log("[AUDIT] success:", collectionName, docRef.id);
    console.log(`[Aura Audit] [5] Documento market_import_jobs creado. ID del Job: ${docRef.id}`);
    return docRef.id;
  } catch (err: any) {
    console.error("[AUDIT FIRESTORE ERROR]", {
      collectionName,
      code: err.code,
      message: err.message,
      stack: err.stack,
      raw: err
    });
    throw new Error(`Falló escritura en: ${collectionName}. Detalle: ${err.message}`);
  }
}

/**
 * Retrieves the currently active job (queued or processing) for the current user.
 */
export async function getActiveBackendJob(): Promise<BackendImportJob | null> {
  const email = auth.currentUser?.email;
  if (!email) return null;

  const q = query(
    collection(db, "market_import_jobs"),
    where("createdBy", "==", email),
    where("status", "in", ["queued", "processing"]),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as BackendImportJob;
}
