import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { calculatePricingQuote } from "./pricingEngineService";
import type {
  PlatformQuote,
  PricingQuoteInput,
  PricingQuoteResult,
} from "../types/quote";

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

  // Force recalculation using the most recent configuration & inputs
  const freshResult = await calculatePricingQuote(data.input);

  // Validate the calculated data before saving
  if (
    !freshResult.selectedModules ||
    freshResult.selectedModules.length === 0 ||
    freshResult.subtotal === undefined ||
    freshResult.subtotal === null ||
    freshResult.total === undefined ||
    freshResult.total === null ||
    freshResult.setupFeeBeforeDiscount === undefined ||
    freshResult.setupFeeBeforeDiscount === null ||
    freshResult.setupFee === undefined ||
    freshResult.setupFee === null ||
    freshResult.firstPaymentTotal === undefined ||
    freshResult.firstPaymentTotal === null ||
    freshResult.annualProjectedRevenue === undefined ||
    freshResult.annualProjectedRevenue === null
  ) {
    throw new Error(
      "Los resultados del recálculo no contienen todos los campos obligatorios requeridos (selectedModules, subtotal, total, setup, firstPaymentTotal, annualProjectedRevenue)."
    );
  }

  const quoteRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...freshResult,
    folio: buildQuoteFolio(),
    prospectName: data.input.prospectName,
    contactName: data.input.contactName,
    contactEmail: data.input.contactEmail,
    industry: data.input.industry,
    discountPercent: freshResult.discountPercent,
    employeesLimit: freshResult.employeesLimit,
    locationsLimit: freshResult.locationsLimit,
    companiesLimit: freshResult.companiesLimit,
    selectedModules: freshResult.selectedModules,
    billingCycle: freshResult.billingCycle,
    founderClient: data.input.founderClient || false,
    founderSetupDiscountMode: data.input.founderSetupDiscountMode || "NONE",
    status: "DRAFT",
    validUntil: addDays(today, 30),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return quoteRef.id;
}