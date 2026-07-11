import * as crypto from "crypto";

export function generateIdempotencyHash(idempotencyKey: string, secretValue: string): string {
  // Use a stable, private server-side salt.
  return crypto.createHmac("sha256", secretValue).update(idempotencyKey).digest("hex");
}

export function generateRequestHash(payload: Record<string, any>): string {
  // Extract strictly the fields that determine if it's a new request
  const relevantData = {
    companyName: payload.companyName || "",
    contactName: payload.contactName || "",
    email: (payload.email || "").toLowerCase().trim(),
    phone: payload.phone || "",
    jobTitle: payload.jobTitle || payload.role || "",
    state: payload.state || "",
    city: payload.city || "",
    employeeRange: payload.employeeRange || "",
    commercialCode: payload.commercialCode || "",
    origin: payload.origin || "",
    acquisitionSource: payload.acquisitionSource || "",
    privacyConsent: payload.privacyConsent ?? false,
    diagnosticDeliveryConsent: payload.diagnosticDeliveryConsent ?? false,
    followUpConsent: payload.followUpConsent ?? false,
    marketingConsent: payload.marketingConsent ?? false,
    policyVersion: payload.policyVersion || "",
  };

  const str = JSON.stringify(relevantData);
  return crypto.createHash("sha256").update(str).digest("hex");
}
