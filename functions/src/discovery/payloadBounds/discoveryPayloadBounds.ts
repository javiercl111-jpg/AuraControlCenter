export const DISCOVERY_PAYLOAD_SCHEMA_VERSIONS = Object.freeze({
  intake: "PUBLIC_DISCOVERY_INTAKE_V1",
  conversation: "DISCOVERY_CONVERSATION_EVALUATION_V1",
  completion: "DISCOVERY_COMPLETION_PAYLOAD_V1",
  report: "DISCOVERY_REPORT_REQUEST_V1",
  download: "DISCOVERY_DOCUMENT_DOWNLOAD_V1",
  exchange: "DISCOVERY_CAPABILITY_EXCHANGE_REQUEST_V1",
  resolution: "DISCOVERY_SESSION_RESOLUTION_REQUEST_V1",
} as const);

export const DISCOVERY_COST_BOUND_POLICY_V1 = Object.freeze({
  version: "DISCOVERY_COST_BOUND_POLICY_V1",
  intakeMaxBytes: 4_096,
  conversationMaxBytes: 48_000,
  completionMaxBytes: 64_000,
  reportRequestMaxBytes: 2_048,
  downloadRequestMaxBytes: 2_048,
  maxDepth: 6,
  maxFields: 256,
  conversationHistoryMaxItems: 8,
  completionHistoryMaxItems: 40,
  historyMaxBytes: 32_000,
  maxConversationTurns: 16,
  maxGeminiAttemptsPerTurn: 2,
  maxGeminiAttemptsPerSession: 32,
  conversationLeaseMs: 15_000,
  maxPromptBytes: 24_000,
  maxModelOutputTokens: 512,
  reportDatasetMaxBytes: 128_000,
  reportPdfMaxBytes: 5 * 1_024 * 1_024,
  reportGenerationTimeoutMs: 20_000,
  reportMaxLogicalAttempts: 2,
  reportMaxForcedRegenerations: 1,
  downloadWindowMs: 15 * 60_000,
  maxDownloadsPerWindow: 3,
  notificationPayloadMaxBytes: 4_096,
  notificationMaxRecipients: 1,
  notificationChannels: ["INBOX", "PUSH"] as const,
  notificationMaxAttempts: 3,
});

export const DISCOVERY_PAYLOAD_ERROR_CODES = Object.freeze([
  "PAYLOAD_INVALID",
  "PAYLOAD_TOO_LARGE",
  "PAYLOAD_TOO_DEEP",
  "TOO_MANY_FIELDS",
  "TOO_MANY_ITEMS",
  "STRING_TOO_LONG",
  "UNKNOWN_FIELD",
  "SERVER_OWNED_FIELD",
  "CONVERSATION_BUDGET_EXCEEDED",
  "REPORT_BUDGET_EXCEEDED",
  "DOWNLOAD_LIMIT_EXCEEDED",
  "COST_BOUND_CONFIGURATION_ERROR",
] as const);

export type DiscoveryPayloadErrorCode =
  (typeof DISCOVERY_PAYLOAD_ERROR_CODES)[number];

export class DiscoveryPayloadError extends Error {
  constructor(readonly code: DiscoveryPayloadErrorCode) {
    super(code);
    this.name = "DiscoveryPayloadError";
  }
}

const SERVER_OWNED_FIELDS = new Set([
  "id", "sessionId", "dossierId", "prospectId", "advisorId", "tenantId",
  "organizationId", "status", "tokenHash", "capability", "capabilities",
  "capabilityGeneration", "createdAt", "updatedAt", "completedAt",
  "issuedAt", "expiresAt", "revokedAt", "correlationId", "trustDecision",
  "trustScore", "notificationId", "notificationKey", "eventId",
]);

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
const utf8 = (value: string): number => Buffer.byteLength(value, "utf8");

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  return value as Record<string, unknown>;
}

function structural(value: unknown, maxBytes: number): void {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  if (utf8(json) > maxBytes) throw new DiscoveryPayloadError("PAYLOAD_TOO_LARGE");
  let fields = 0;
  const visit = (child: unknown, depth: number): void => {
    if (depth > DISCOVERY_COST_BOUND_POLICY_V1.maxDepth) {
      throw new DiscoveryPayloadError("PAYLOAD_TOO_DEEP");
    }
    if (typeof child === "string" && CONTROL_CHARACTERS.test(child)) {
      throw new DiscoveryPayloadError("PAYLOAD_INVALID");
    }
    if (Array.isArray(child)) {
      if (child.length > DISCOVERY_COST_BOUND_POLICY_V1.completionHistoryMaxItems) {
        throw new DiscoveryPayloadError("TOO_MANY_ITEMS");
      }
      for (const item of child) visit(item, depth + 1);
      return;
    }
    if (child && typeof child === "object") {
      const entries = Object.entries(child as Record<string, unknown>);
      fields += entries.length;
      if (fields > DISCOVERY_COST_BOUND_POLICY_V1.maxFields) {
        throw new DiscoveryPayloadError("TOO_MANY_FIELDS");
      }
      for (const [, nested] of entries) visit(nested, depth + 1);
    }
  };
  visit(value, 1);
}

function exact(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  const object = record(value);
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      throw new DiscoveryPayloadError(
        SERVER_OWNED_FIELDS.has(key) ? "SERVER_OWNED_FIELD" : "UNKNOWN_FIELD",
      );
    }
  }
  return object;
}

function text(
  value: unknown,
  maxBytes: number,
  options: Readonly<{ required?: boolean; pattern?: RegExp }> = {},
): string {
  if (typeof value !== "string") throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  const normalized = value.normalize("NFC").trim();
  if (CONTROL_CHARACTERS.test(normalized)) throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  if (options.required && normalized.length === 0) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  if (utf8(normalized) > maxBytes) throw new DiscoveryPayloadError("STRING_TOO_LONG");
  if (options.pattern && !options.pattern.test(normalized)) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  return normalized;
}

function optionalText(value: unknown, maxBytes: number): string {
  return value === undefined ? "" : text(value, maxBytes);
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  return value;
}

function numberValue(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  return value;
}

function stringList(value: unknown, maxItems: number, maxBytes: number): string[] {
  if (!Array.isArray(value)) throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  if (value.length > maxItems) throw new DiscoveryPayloadError("TOO_MANY_ITEMS");
  return value.map((item) => text(item, maxBytes));
}

export interface PublicDiscoveryIntakeV1 {
  schemaVersion: typeof DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.intake;
  companyName: string; contactName: string; email: string; phone: string;
  jobTitle: string; state: string; city: string; employeeRange: string;
  commercialCode: string; origin: "WEBSITE" | "ADVISOR_SHARE" | "AURA_NEXUS";
  acquisitionSource: "DIRECT" | "AURA_NEXUS";
  privacyConsent: boolean; diagnosticDeliveryConsent: boolean;
  followUpConsent: boolean; marketingConsent: boolean;
  policyVersion: string; idempotencyKey: string;
}

export function parsePublicDiscoveryIntakeV1(value: unknown): PublicDiscoveryIntakeV1 {
  structural(value, DISCOVERY_COST_BOUND_POLICY_V1.intakeMaxBytes);
  const input = exact(value, [
    "schemaVersion", "companyName", "contactName", "email", "phone",
    "jobTitle", "state", "city", "employeeRange", "commercialCode", "origin",
    "acquisitionSource", "privacyConsent", "diagnosticDeliveryConsent",
    "followUpConsent", "marketingConsent", "policyVersion", "idempotencyKey",
  ]);
  if (input.schemaVersion !== DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.intake) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  const origin = text(input.origin, 32, { required: true });
  const acquisitionSource = text(input.acquisitionSource, 24, { required: true });
  if (!["WEBSITE", "ADVISOR_SHARE", "AURA_NEXUS"].includes(origin) ||
      !["DIRECT", "AURA_NEXUS"].includes(acquisitionSource)) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  const parsed: PublicDiscoveryIntakeV1 = {
    schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.intake,
    companyName: text(input.companyName, 160, { required: true }),
    contactName: text(input.contactName, 160, { required: true }),
    email: text(input.email, 254, {
      required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    }).toLowerCase(),
    phone: optionalText(input.phone, 32),
    jobTitle: optionalText(input.jobTitle, 100),
    state: optionalText(input.state, 100), city: optionalText(input.city, 100),
    employeeRange: optionalText(input.employeeRange, 64),
    commercialCode: optionalText(input.commercialCode, 32).toUpperCase(),
    origin: origin as PublicDiscoveryIntakeV1["origin"],
    acquisitionSource: acquisitionSource as PublicDiscoveryIntakeV1["acquisitionSource"],
    privacyConsent: bool(input.privacyConsent),
    diagnosticDeliveryConsent: bool(input.diagnosticDeliveryConsent),
    followUpConsent: bool(input.followUpConsent),
    marketingConsent: bool(input.marketingConsent),
    policyVersion: text(input.policyVersion, 64, { required: true }),
    idempotencyKey: text(input.idempotencyKey, 100, {
      required: true, pattern: /^[A-Za-z0-9._:-]{16,100}$/,
    }),
  };
  if (!parsed.privacyConsent || !parsed.diagnosticDeliveryConsent) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  return Object.freeze(parsed);
}

export interface ConversationEvaluationV1 {
  schemaVersion: typeof DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.conversation;
  sessionToken: string;
  conversationPhase: "DISCOVERY";
  authoritativeIntent: string;
  authoritativeQuestion: string;
  engineInput: {
    companyName: string; industry: string; currentResponse: string;
    conversationHistory: Array<{ role: "user" | "aura" | "system"; content: string }>;
    partialDossier: Record<string, string | number | boolean>;
    confirmedFacts: string[]; pendingHypotheses: string[];
    criticalMissingInformation: string[]; discoveryObjective: string;
    confidenceLevel: number; askedQuestions: string[];
  };
}

function parseDossier(value: unknown): Record<string, string | number | boolean> {
  const input = exact(value ?? {}, [
    "industry", "employees", "schedulingMethod", "payrollIncidents", "priority",
  ]);
  const output: Record<string, string | number | boolean> = {};
  if (input.industry !== undefined) output.industry = text(input.industry, 120);
  if (input.employees !== undefined) output.employees = numberValue(input.employees, 0, 1_000_000);
  if (input.schedulingMethod !== undefined) output.schedulingMethod = text(input.schedulingMethod, 240);
  if (input.payrollIncidents !== undefined) output.payrollIncidents = bool(input.payrollIncidents);
  if (input.priority !== undefined) output.priority = text(input.priority, 240);
  return output;
}

function history(value: unknown, maxItems: number): Array<{
  role: "user" | "aura" | "system"; content: string;
}> {
  if (!Array.isArray(value)) throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  if (value.length > maxItems) throw new DiscoveryPayloadError("TOO_MANY_ITEMS");
  const parsed = value.map((entry) => {
    const item = exact(entry, ["role", "content"]);
    const role = text(item.role, 16, { required: true });
    if (!["user", "aura", "system"].includes(role)) {
      throw new DiscoveryPayloadError("PAYLOAD_INVALID");
    }
    return { role: role as "user" | "aura" | "system", content: text(item.content, 2_048, { required: true }) };
  });
  if (utf8(JSON.stringify(parsed)) > DISCOVERY_COST_BOUND_POLICY_V1.historyMaxBytes) {
    throw new DiscoveryPayloadError("PAYLOAD_TOO_LARGE");
  }
  return parsed;
}

export function parseConversationEvaluationV1(value: unknown): ConversationEvaluationV1 {
  structural(value, DISCOVERY_COST_BOUND_POLICY_V1.conversationMaxBytes);
  const input = exact(value, [
    "schemaVersion", "sessionToken", "engineInput", "conversationPhase",
    "authoritativeIntent", "authoritativeQuestion",
  ]);
  if (input.schemaVersion !== DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.conversation ||
      input.conversationPhase !== "DISCOVERY") {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  const engine = exact(input.engineInput, [
    "companyName", "industry", "currentResponse", "conversationHistory",
    "partialDossier", "confirmedFacts", "pendingHypotheses",
    "criticalMissingInformation", "discoveryObjective", "confidenceLevel",
    "askedQuestions",
  ]);
  return Object.freeze({
    schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.conversation,
    sessionToken: text(input.sessionToken, 128, { required: true, pattern: /^[a-f0-9]{64}$/i }),
    conversationPhase: "DISCOVERY" as const,
    authoritativeIntent: text(input.authoritativeIntent, 64, { required: true }),
    authoritativeQuestion: text(input.authoritativeQuestion, 2_048, { required: true }),
    engineInput: {
      companyName: text(engine.companyName, 160, { required: true }),
      industry: text(engine.industry, 120, { required: true }),
      currentResponse: text(engine.currentResponse, 2_048, { required: true }),
      conversationHistory: history(engine.conversationHistory, DISCOVERY_COST_BOUND_POLICY_V1.conversationHistoryMaxItems),
      partialDossier: parseDossier(engine.partialDossier),
      confirmedFacts: stringList(engine.confirmedFacts, 6, 240),
      pendingHypotheses: stringList(engine.pendingHypotheses, 5, 240),
      criticalMissingInformation: stringList(engine.criticalMissingInformation, 4, 240),
      discoveryObjective: text(engine.discoveryObjective, 320, { required: true }),
      confidenceLevel: numberValue(engine.confidenceLevel, 0, 100),
      askedQuestions: stringList(engine.askedQuestions, 8, 400),
    },
  });
}

export interface DiscoveryCompletionPayloadV1 {
  schemaVersion: typeof DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.completion;
  sessionToken: string;
  completion: Record<string, unknown>;
}

function boundedDraft(value: unknown, shape: Record<string, "text" | "number" | "boolean" | "list">): Record<string, unknown> {
  const input = exact(value, Object.keys(shape));
  const result: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(shape)) {
    const child = input[key];
    if (child === undefined) throw new DiscoveryPayloadError("PAYLOAD_INVALID");
    result[key] = kind === "text" ? text(child, 2_048) :
      kind === "number" ? numberValue(child, 0, 100) :
        kind === "boolean" ? bool(child) : stringList(child, 12, 512);
  }
  return result;
}

export function parseDiscoveryCompletionPayloadV1(value: unknown): DiscoveryCompletionPayloadV1 {
  structural(value, DISCOVERY_COST_BOUND_POLICY_V1.completionMaxBytes);
  const input = exact(value, ["schemaVersion", "sessionToken", "completion"]);
  if (input.schemaVersion !== DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.completion) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  const completion = exact(input.completion, [
    "dossier", "conversationHistory", "conversationStateSnapshot",
    "executiveBriefingDraft", "businessAssessmentDraft",
    "radiografiaEmpresarialDraft", "salesAdvisorContext",
  ]);
  const snapshot = exact(completion.conversationStateSnapshot, [
    "industry", "hypotheses", "confidenceLevel", "usefulResponsesCount",
    "turnCount", "askedIntents", "askedQuestions", "conversationPhase",
    "fallbackConsecutiveCount", "lastFallbackCode", "lastFallbackMessage",
    "llmModeForSession", "partialCompletionReason",
  ]);
  const normalizedSnapshot: Record<string, unknown> = {
    industry: text(snapshot.industry, 120),
    hypotheses: stringList(snapshot.hypotheses, 16, 240),
    confidenceLevel: numberValue(snapshot.confidenceLevel, 0, 100),
    usefulResponsesCount: numberValue(snapshot.usefulResponsesCount, 0, 40),
    turnCount: numberValue(snapshot.turnCount, 0, DISCOVERY_COST_BOUND_POLICY_V1.maxConversationTurns),
    askedIntents: stringList(snapshot.askedIntents, 24, 64),
    askedQuestions: stringList(snapshot.askedQuestions, 24, 400),
    conversationPhase: text(snapshot.conversationPhase, 32, { required: true }),
    fallbackConsecutiveCount: numberValue(snapshot.fallbackConsecutiveCount, 0, 16),
    llmModeForSession: text(snapshot.llmModeForSession, 32, { required: true }),
  };
  for (const key of ["lastFallbackCode", "lastFallbackMessage", "partialCompletionReason"]) {
    if (snapshot[key] !== undefined) normalizedSnapshot[key] = text(snapshot[key], 256);
  }
  const normalized = {
    dossier: parseDossier(completion.dossier),
    conversationHistory: history(completion.conversationHistory, DISCOVERY_COST_BOUND_POLICY_V1.completionHistoryMaxItems),
    conversationStateSnapshot: normalizedSnapshot,
    executiveBriefingDraft: boundedDraft(completion.executiveBriefingDraft, {
      summary: "text", keyObservations: "list", suggestedNextSteps: "list",
    }),
    businessAssessmentDraft: boundedDraft(completion.businessAssessmentDraft, {
      score: "number", painPointsIdentified: "list", processGaps: "list",
    }),
    radiografiaEmpresarialDraft: boundedDraft(completion.radiografiaEmpresarialDraft, {
      overallStatus: "text", recommendedModules: "list", potentialSavings: "text",
    }),
    salesAdvisorContext: boundedDraft(completion.salesAdvisorContext, {
      recommendedOpeningLine: "text", alertFlags: "list", qualificationStatus: "text",
    }),
  };
  return Object.freeze({
    schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.completion,
    sessionToken: text(input.sessionToken, 128, { required: true, pattern: /^[a-f0-9]{64}$/i }),
    completion: normalized,
  });
}

export interface ReportRequestV1 {
  schemaVersion: typeof DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.report;
  sessionId: string; prospectId: string; linkId: string;
  reportCapabilityToken: string; isInternalOnly: boolean;
}

export function parseReportRequestV1(value: unknown): ReportRequestV1 {
  structural(value, DISCOVERY_COST_BOUND_POLICY_V1.reportRequestMaxBytes);
  const input = exact(value, [
    "schemaVersion", "sessionId", "prospectId", "linkId",
    "reportCapabilityToken", "isInternalOnly",
  ]);
  if (input.schemaVersion !== DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.report) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  return Object.freeze({
    schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.report,
    sessionId: text(input.sessionId, 256, { required: true }),
    prospectId: text(input.prospectId, 128, { required: true }),
    linkId: optionalText(input.linkId, 128),
    reportCapabilityToken: optionalText(input.reportCapabilityToken, 128),
    isInternalOnly: bool(input.isInternalOnly),
  });
}

export interface DocumentDownloadRequestV1 {
  schemaVersion: typeof DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.download;
  reportId: string; linkId: string; reportCapabilityToken: string;
  forceRegenerate: boolean;
}

export function parseDocumentDownloadRequestV1(value: unknown): DocumentDownloadRequestV1 {
  structural(value, DISCOVERY_COST_BOUND_POLICY_V1.downloadRequestMaxBytes);
  const input = exact(value, [
    "schemaVersion", "reportId", "linkId", "reportCapabilityToken",
    "forceRegenerate",
  ]);
  if (input.schemaVersion !== DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.download) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  return Object.freeze({
    schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.download,
    reportId: text(input.reportId, 384, { required: true }),
    linkId: optionalText(input.linkId, 128),
    reportCapabilityToken: optionalText(input.reportCapabilityToken, 128),
    forceRegenerate: input.forceRegenerate === undefined ? false : bool(input.forceRegenerate),
  });
}

export function payloadBytes(value: unknown): number {
  try { return utf8(JSON.stringify(value)); } catch { return Number.POSITIVE_INFINITY; }
}

export function parseCapabilityExchangeRequestV1(value: unknown): Readonly<{
  schemaVersion: typeof DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.exchange;
  linkId: string;
  oneTimeToken: string;
}> {
  structural(value, 1_024);
  const input = exact(value, ["schemaVersion", "linkId", "oneTimeToken"]);
  if (input.schemaVersion !== DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.exchange) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  return Object.freeze({
    schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.exchange,
    linkId: text(input.linkId, 128, { required: true, pattern: /^[^/]+$/ }),
    oneTimeToken: text(input.oneTimeToken, 128, {
      required: true, pattern: /^[a-f0-9]{64}$/i,
    }),
  });
}

export function parseSessionResolutionRequestV1(value: unknown): Readonly<{
  schemaVersion: typeof DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.resolution;
  linkId: string;
  sessionToken: string;
}> {
  structural(value, 1_024);
  const input = exact(value, ["schemaVersion", "linkId", "sessionToken"]);
  if (input.schemaVersion !== DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.resolution) {
    throw new DiscoveryPayloadError("PAYLOAD_INVALID");
  }
  return Object.freeze({
    schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.resolution,
    linkId: text(input.linkId, 128, { required: true, pattern: /^[^/]+$/ }),
    sessionToken: text(input.sessionToken, 128, {
      required: true, pattern: /^[a-f0-9]{64}$/i,
    }),
  });
}
