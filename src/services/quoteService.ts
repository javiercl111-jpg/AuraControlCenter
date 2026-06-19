import {
    addDoc,
    collection,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
  } from "firebase/firestore";
  
  import { db } from "../config/firebase";
  import type { PlatformQuote, PricingQuoteInput, PricingQuoteResult } from "../types/quote";
  
  const COLLECTION_NAME = "platform_quotes";
  
  function todayInputValue(): string {
    return new Date().toISOString().slice(0, 10);
  }
  
  function addDays(dateValue: string, days: number): string {
    const date = new Date(`${dateValue}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }
  
  function buildQuoteFolio(): string {
    const now = new Date();
  
    return `AURA-Q-${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}${String(now.getDate()).padStart(2, "0")}-${String(now.getTime()).slice(
      -6
    )}`;
  }
  
  export async function getQuotes(): Promise<PlatformQuote[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((quoteDoc) => ({
      id: quoteDoc.id,
      ...(quoteDoc.data() as Omit<PlatformQuote, "id">),
    }));
  }
  
  export async function createQuote(data: {
    input: PricingQuoteInput;
    result: PricingQuoteResult;
  }): Promise<string> {
    const today = todayInputValue();
    const quoteRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data.result,
      folio: buildQuoteFolio(),
      prospectName: data.input.prospectName,
      contactName: data.input.contactName,
      contactEmail: data.input.contactEmail,
      status: "DRAFT",
      validUntil: addDays(today, 15),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  
    return quoteRef.id;
  }