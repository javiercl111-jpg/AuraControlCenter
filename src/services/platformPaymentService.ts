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
  import { createCommissionFromPaidInvoice } from "./platformCommissionService";
  import { updateClientStatus } from "./platformClientUpdateService";
  import { syncTenantFromClientStatus } from "./platformTenantService";
  import type { PaymentMethod, PlatformPayment } from "../types/platformPayment";
  
  const PAYMENTS_COLLECTION = "platform_payments";
  const INVOICES_COLLECTION = "platform_invoices";
  
  export async function getPayments(): Promise<PlatformPayment[]> {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      orderBy("createdAt", "desc")
    );
  
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((paymentDoc) => ({
      id: paymentDoc.id,
      ...(paymentDoc.data() as Omit<PlatformPayment, "id">),
    }));
  }
  
  export async function registerInvoicePayment(data: {
    invoiceId: string;
    clientId: string;
    clientName: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    reference: string;
    tenantId?: string;
  }) {
    await addDoc(collection(db, PAYMENTS_COLLECTION), {
      invoiceId: data.invoiceId,
      clientId: data.clientId,
      clientName: data.clientName,
      invoiceNumber: data.invoiceNumber,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentDate: data.paymentDate,
      reference: data.reference,
      tenantId: data.tenantId || "",
      createdAt: serverTimestamp(),
    });
  
    await updateDoc(doc(db, INVOICES_COLLECTION, data.invoiceId), {
      status: "PAID",
      paidAt: data.paymentDate,
    });
  
    await updateClientStatus(data.clientId, "ACTIVE");
  
    await syncTenantFromClientStatus({
      tenantDocumentId: data.tenantId,
      clientStatus: "ACTIVE",
    });
  
    await createCommissionFromPaidInvoice({
      clientId: data.clientId,
      clientName: data.clientName,
      invoiceId: data.invoiceId,
      invoiceNumber: data.invoiceNumber,
      invoiceAmount: data.amount,
      commissionType: "FIRST_YEAR",
    });
  }