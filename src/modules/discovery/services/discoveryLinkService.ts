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

export async function createDiscoveryLink(data: any, advisorContext?: any) {
  const createDiscoveryLeadFn = httpsCallable(functions, "createDiscoveryLead");
  
  const payload: any = {
    companyName: data.companyName,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone || "",
    role: data.role || "",
    location: data.location || "",
    consent: data.consent,
    acquisitionSource: data.acquisitionSource || "DIRECT"
  };

  if (advisorContext) {
    payload.commercialCode = advisorContext.commercialCode;
  }

  const result = await createDiscoveryLeadFn(payload);
  return result.data as { linkId: string; oneTimeToken: string; trustScoreDecision: string; expiresAt: string };
}

export async function exchangeDiscoveryToken(linkId: string, oneTimeToken: string) {
  const exchangeFn = httpsCallable(functions, "exchangeDiscoveryToken");
  const result = await exchangeFn({ linkId, oneTimeToken });
  return result.data as { sessionAccessToken: string; linkId: string; trustScoreDecision: string; companyName: string; contactName: string };
}

export async function resolveDiscoverySession(linkId: string, sessionToken: string) {
  const resolveFn = httpsCallable(functions, "resolveDiscoverySession");
  const result = await resolveFn({ linkId, sessionToken });
  return result.data as any;
}
