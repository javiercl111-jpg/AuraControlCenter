export const DISCOVERY_CAPABILITY_POLICY_V1 = Object.freeze({
  version: "DISCOVERY_CAPABILITY_POLICY_V1" as const,
  audience: "PUBLIC_DISCOVERY" as const,
  sessionGeneration: 1,
  reportGeneration: 1,
  reportTtlMs: 24 * 60 * 60 * 1_000,
  documentSignedUrlTtlMinutes: 5,
});
