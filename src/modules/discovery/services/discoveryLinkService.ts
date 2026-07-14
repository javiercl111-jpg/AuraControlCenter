import { collection, query, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../config/firebase";

export async function resolveAdvisorByCode(commercialCode: string) {
  const q = query(collection(db, "platform_sales_advisors"), where("commercialCode", "==", commercialCode), where("advisorStatus", "==", "ACTIVE"));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
}

export interface CreateDiscoveryLeadResponse {
  status: string;
  nextAction: string;
  discoveryUrl: string;
  linkId: string;
  oneTimeToken: string;
  advisorDisplayName?: string;
  organizationProfile: string;
  requiresManualReview: boolean;
}

export function isCreateDiscoveryLeadResponse(value: unknown): value is CreateDiscoveryLeadResponse {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.status === "string" &&
    typeof obj.nextAction === "string" &&
    typeof obj.discoveryUrl === "string" &&
    typeof obj.linkId === "string" && obj.linkId.trim() !== "" &&
    typeof obj.oneTimeToken === "string" && obj.oneTimeToken.trim() !== ""
  );
}

export async function createDiscoveryLink(data: any, advisorContext?: any): Promise<CreateDiscoveryLeadResponse> {
  const createDiscoveryLeadFn = httpsCallable(functions, "createDiscoveryLead");
  
  const payload: any = {
    companyName: data.companyName,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone || "",
    role: data.role || "",
    location: data.location || "",
    consent: data.consent,
    acquisitionSource: data.acquisitionSource || "DIRECT",
    idempotencyKey: data.idempotencyKey
  };

  if (advisorContext) {
    payload.commercialCode = advisorContext.commercialCode;
  }

  const result = await createDiscoveryLeadFn(payload);

  if (!isCreateDiscoveryLeadResponse(result.data)) {
    throw new Error("DISCOVERY_LINK_RESPONSE_INVALID");
  }

  return result.data;
}

export interface ExchangeDiscoveryTokenResponse {
  sessionAccessToken: string;
  linkId: string;
  trustScoreDecision: string;
  companyName: string;
  contactName: string;
}

export function isExchangeDiscoveryTokenResponse(value: unknown): value is ExchangeDiscoveryTokenResponse {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.sessionAccessToken === "string" && obj.sessionAccessToken.trim() !== "" &&
    typeof obj.linkId === "string" && obj.linkId.trim() !== "" &&
    typeof obj.trustScoreDecision === "string" &&
    typeof obj.companyName === "string" &&
    typeof obj.contactName === "string"
  );
}

export async function exchangeDiscoveryToken(linkId: string, oneTimeToken: string): Promise<ExchangeDiscoveryTokenResponse> {
  const exchangeFn = httpsCallable(functions, "exchangeDiscoveryToken");
  const result = await exchangeFn({ linkId, oneTimeToken });

  if (!isExchangeDiscoveryTokenResponse(result.data)) {
    throw new Error("EXCHANGE_TOKEN_RESPONSE_INVALID");
  }

  return result.data;
}

export async function resolveDiscoverySession(linkId: string, sessionToken: string) {
  const resolveFn = httpsCallable(functions, "resolveDiscoverySession");
  const result = await resolveFn({ linkId, sessionToken });
  return result.data as any;
}
