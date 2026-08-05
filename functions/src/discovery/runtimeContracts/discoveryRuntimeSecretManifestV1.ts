export const PREVIEW_RUNTIME_SECRET_MANIFEST_V1 = Object.freeze({
  version: "PREVIEW_RUNTIME_SECRET_MANIFEST_V1",
  mappings: Object.freeze([
    Object.freeze({
      handler: "createDiscoveryLead",
      runtimeIdentity: "preview-public-intake-runtime",
      secretResource: "discovery-idempotency-secret-preview",
      runtimeEnvName: "IDEMPOTENCY_SECRET",
      status: "REQUIRED",
    }),
    Object.freeze({
      handler: "completeDiscoverySession",
      runtimeIdentity: "preview-discovery-completion-runtime",
      secretResource: "discovery-hmac-secret-preview",
      runtimeEnvName: "DISCOVERY_HMAC_SECRET",
      status: "REQUIRED",
    }),
    Object.freeze({
      handler: "evaluateConversation",
      runtimeIdentity: "preview-conversation-runtime",
      secretResource: "discovery-gemini-api-key-preview",
      runtimeEnvName: "GEMINI_API_KEY",
      status: "REQUIRED",
    }),
  ]),
  secretlessHandlers: Object.freeze([
    "exchangeDiscoveryToken",
    "resolveDiscoverySession",
  ]),
  deferred: Object.freeze([
    Object.freeze({
      secretResource: "discovery-ip-hash-salt-preview",
      reason: "NO_CONSUMER_IN_PREVIEW_DISCOVERY_MVP",
      consumers: Object.freeze([]),
    }),
  ]),
} as const);
