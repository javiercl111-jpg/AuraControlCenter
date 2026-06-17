import {
    addDoc,
    collection,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
  } from "firebase/firestore";
  
  import { db } from "../config/firebase";
  import type { PlatformInvoice } from "../types/platformInvoice";
  
  const INVOICES_COLLECTION = "platform_invoices";
  
  export async function getInvoices(): Promise<PlatformInvoice[]> {
    const q = query(
      collection(db, INVOICES_COLLECTION),
      orderBy("createdAt", "desc")
    );
  
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((invoiceDoc) => ({
      id: invoiceDoc.id,
      ...(invoiceDoc.data() as Omit<PlatformInvoice, "id">),
    }));
  }
  
  export async function createInvoice(data: {
    clientId: string;
    clientName: string;
    invoiceNumber: string;
    planCode: string;
    periodStart: string;
    periodEnd: string;
    subtotal: number;
  }) {
    const ivaRate = 0.16;
    const ivaAmount = Number((data.subtotal * ivaRate).toFixed(2));
    const total = Number((data.subtotal + ivaAmount).toFixed(2));
  
    await addDoc(collection(db, INVOICES_COLLECTION), {
      clientId: data.clientId,
      clientName: data.clientName,
      invoiceNumber: data.invoiceNumber,
      planCode: data.planCode,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      subtotal: data.subtotal,
      ivaRate,
      ivaAmount,
      total,
      status: "PENDING",
      createdAt: serverTimestamp(),
    });
  }