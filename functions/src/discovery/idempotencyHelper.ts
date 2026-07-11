import * as crypto from "crypto";

export function generateIdempotencyHash(idempotencyKey: string): string {
  // Use a stable, private server-side salt. In a real app this should be in Secret Manager
  // but for Sprint L1, we use a constant to avoid extra setup unless secrets are already configured.
  // The user says: "calcular: idempotencyHash = HMAC_SHA256(idempotencyKey, secret)"
  const secret = process.env.IDEMPOTENCY_SECRET || "AURA_NEXUS_DEFAULT_IDEMPOTENCY_SECRET";
  return crypto.createHmac("sha256", secret).update(idempotencyKey).digest("hex");
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
