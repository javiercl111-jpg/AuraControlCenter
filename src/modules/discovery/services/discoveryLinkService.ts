import { collection, query, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../config/firebase";

export interface DiscoveryAdvisor extends Record<string, unknown> {
  id: string;
  commercialCode?: string;
  name?: string;
}

export async function resolveAdvisorByCode(commercialCode: string): Promise<DiscoveryAdvisor | null> {
  const q = query(collection(db, "platform_sales_advisors"), where("commercialCode", "==", commercialCode), where("advisorStatus", "==", "ACTIVE"));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
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

export interface CreateDiscoveryLeadRequest {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  state?: string;
  city?: string;
  employeeRange?: string;
  commercialCode?: string;
  origin: "WEBSITE" | "ADVISOR_SHARE" | "AURA_NEXUS";
  acquisitionSource: "DIRECT" | "AURA_NEXUS";
  privacyConsent: boolean;
  diagnosticDeliveryConsent: boolean;
  followUpConsent: boolean;
  marketingConsent: boolean;
  policyVersion: string;
  idempotencyKey: string;
}

export function createDiscoveryIdempotencyKey(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("SECURE_RANDOM_UNAVAILABLE");
  }
  return globalThis.crypto.randomUUID();
}

export function isValidDiscoveryIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{16,100}$/.test(value);
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

export function getDiscoveryNavigationTarget(response: CreateDiscoveryLeadResponse): string {
  const url = new URL(response.discoveryUrl);
  const accessToken = new URLSearchParams(url.hash.slice(1)).get("access");
  const encodedLinkId = url.pathname.split("/").filter(Boolean).at(-1);

  if (
    url.protocol !== "https:" ||
    !encodedLinkId ||
    decodeURIComponent(encodedLinkId) !== response.linkId ||
    url.searchParams.has("access") ||
    accessToken !== response.oneTimeToken
  ) {
    throw new Error("DISCOVERY_LINK_RESPONSE_INVALID");
  }

  return `${url.pathname}${url.hash}`;
}

export async function createDiscoveryLink(
  data: CreateDiscoveryLeadRequest,
  advisorContext?: Record<string, unknown>
): Promise<CreateDiscoveryLeadResponse> {
  if (!isValidDiscoveryIdempotencyKey(data.idempotencyKey)) {
    throw new Error("DISCOVERY_IDEMPOTENCY_KEY_INVALID");
  }

  const createDiscoveryLeadFn = httpsCallable(functions, "createDiscoveryLead");
  
  const payload: Record<string, unknown> = {
    schemaVersion: "PUBLIC_DISCOVERY_INTAKE_V1",
    companyName: data.companyName,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone || "",
    jobTitle: data.jobTitle || "",
    state: data.state || "",
    city: data.city || "",
    employeeRange: data.employeeRange || "",
    commercialCode: data.commercialCode || "",
    origin: data.origin,
    acquisitionSource: data.acquisitionSource,
    privacyConsent: data.privacyConsent,
    diagnosticDeliveryConsent: data.diagnosticDeliveryConsent,
    followUpConsent: data.followUpConsent,
    marketingConsent: data.marketingConsent,
    policyVersion: data.policyVersion,
    idempotencyKey: data.idempotencyKey
  };

  if (advisorContext && typeof advisorContext.commercialCode === "string") {
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
  const result = await exchangeFn({
    schemaVersion: "DISCOVERY_CAPABILITY_EXCHANGE_REQUEST_V1",
    linkId,
    oneTimeToken,
  });

  if (!isExchangeDiscoveryTokenResponse(result.data)) {
    throw new Error("EXCHANGE_TOKEN_RESPONSE_INVALID");
  }

  return result.data;
}

export interface ResolveDiscoverySessionResponse {
  id: string;
  companyName: string;
  contactName: string;
  status: string;
  trustScoreDecision: string;
}

export async function resolveDiscoverySession(
  linkId: string,
  sessionToken: string
): Promise<ResolveDiscoverySessionResponse> {
  const resolveFn = httpsCallable(functions, "resolveDiscoverySession");
  const result = await resolveFn({
    schemaVersion: "DISCOVERY_SESSION_RESOLUTION_REQUEST_V1",
    linkId,
    sessionToken,
  });
  return result.data as ResolveDiscoverySessionResponse;
}
