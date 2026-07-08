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
      (error) => reject(error),
      () => resolve()
    );
  });

  const storagePath = fileRef.fullPath;

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

  const docRef = await addDoc(collection(db, "market_import_jobs"), jobDoc);
  return docRef.id;
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
