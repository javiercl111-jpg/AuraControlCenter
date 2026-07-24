export const DISCOVERY_CONVERSATION_DEFINITION_VERSION =
  "legacy-discovery-v1" as const;

export const DiscoveryHardRequirement = {
  COMPANY_OR_ORGANIZATION: "COMPANY_OR_ORGANIZATION",
  CONTACT_INFORMATION: "CONTACT_INFORMATION",
  REQUIRED_CONSENT: "REQUIRED_CONSENT",
  SUBSTANTIVE_CONVERSATION: "SUBSTANTIVE_CONVERSATION",
} as const;

export type DiscoveryHardRequirement =
  (typeof DiscoveryHardRequirement)[keyof typeof DiscoveryHardRequirement];

export const DiscoveryRequiredField = {
  ...DiscoveryHardRequirement,
  ACTIVITY_OR_OFFERING: "ACTIVITY_OR_OFFERING",
  PRIMARY_NEED: "PRIMARY_NEED",
  OBJECTIVE: "OBJECTIVE",
  ORGANIZATIONAL_CONTEXT: "ORGANIZATIONAL_CONTEXT",
} as const;

export type DiscoveryRequiredField =
  (typeof DiscoveryRequiredField)[keyof typeof DiscoveryRequiredField];

export interface ConversationMetrics {
  readonly userTurns: number;
  readonly substantiveUserTurns: number;
  readonly totalUserCharacters: number;
  readonly hasSubstantiveConversation: boolean;
}

export interface DiscoveryCompletionValidationInput {
  readonly dossierPayload: Readonly<Record<string, unknown>>;
  readonly linkData: Readonly<Record<string, unknown>>;
}

export interface DiscoveryCompletionValidationResult {
  readonly valid: boolean;
  readonly hardMissingFields: readonly string[];
  readonly evidenceGaps: readonly string[];
  readonly conversationMetrics: ConversationMetrics;
  readonly questionsAskedCount: number;
  readonly completionReason:
    | "REQUIRED_FIELDS_COMPLETE"
    | "BLOCKED_MISSING_REQUIRED_FIELDS";
  readonly missingRequiredFields: readonly string[];
  readonly conversationDefinitionVersion: typeof DISCOVERY_CONVERSATION_DEFINITION_VERSION;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as UnknownRecord;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function meaningfulString(value: unknown, placeholders: readonly string[]): boolean {
  const text = nonEmptyString(value);
  if (text === undefined) return false;
  const normalized = normalize(text);
  return !placeholders.some((placeholder) => normalized === normalize(placeholder));
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.trim().length > 0,
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function hasRequiredConsents(linkData: UnknownRecord): boolean {
  if (linkData.consent === true) return true;
  const consents = asRecord(linkData.consents);
  return (
    asRecord(consents.privacy).value === true &&
    asRecord(consents.diagnosticDelivery).value === true
  );
}

export function calculateConversationMetrics(historyValue: unknown): ConversationMetrics {
  if (!Array.isArray(historyValue)) {
    return {
      userTurns: 0,
      substantiveUserTurns: 0,
      totalUserCharacters: 0,
      hasSubstantiveConversation: false,
    };
  }

  const trivialRegex = /^(si|sí|no|ok|vale|correcto|no sé|no se|ninguno|ninguna|n\/a)$/i;

  let userTurns = 0;
  let substantiveUserTurns = 0;
  let totalUserCharacters = 0;

  for (const entry of historyValue) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const role = nonEmptyString(record.role);
    const content = nonEmptyString(record.content);

    if (role === "user" && content !== undefined) {
      userTurns += 1;
      totalUserCharacters += content.length;

      const words = content.split(/\s+/).filter(Boolean);
      const isTrivial = trivialRegex.test(content);
      const isSubstantive = !isTrivial && (words.length >= 2 || content.length >= 8);

      if (isSubstantive) {
        substantiveUserTurns += 1;
      }
    }
  }

  const hasSubstantiveConversation = userTurns >= 3 && substantiveUserTurns >= 2;

  return {
    userTurns,
    substantiveUserTurns,
    totalUserCharacters,
    hasSubstantiveConversation,
  };
}

export function validateDiscoveryCompletion(
  input: DiscoveryCompletionValidationInput,
): DiscoveryCompletionValidationResult {
  const payload = asRecord(input.dossierPayload);
  const linkData = asRecord(input.linkData);
  const dossier = asRecord(payload.dossier);
  const assessment = asRecord(payload.businessAssessmentDraft);

  const metrics = calculateConversationMetrics(payload.conversationHistory);

  const companyPresent = nonEmptyString(linkData.companyName) !== undefined;
  const contactPresent =
    nonEmptyString(linkData.contactName) !== undefined &&
    (nonEmptyString(linkData.email) !== undefined ||
      nonEmptyString(linkData.phone) !== undefined);
  const consentPresent = hasRequiredConsents(linkData);

  const hardMissingFields: string[] = [];
  if (!companyPresent) hardMissingFields.push(DiscoveryHardRequirement.COMPANY_OR_ORGANIZATION);
  if (!contactPresent) hardMissingFields.push(DiscoveryHardRequirement.CONTACT_INFORMATION);
  if (!consentPresent) hardMissingFields.push(DiscoveryHardRequirement.REQUIRED_CONSENT);
  if (!metrics.hasSubstantiveConversation) hardMissingFields.push(DiscoveryHardRequirement.SUBSTANTIVE_CONVERSATION);

  const activityPresent = meaningfulString(dossier.industry, ["Otros", "Industria General", "No especificado"]);
  const primaryNeedPresent =
    stringArray(assessment.painPointsIdentified).length > 0 ||
    stringArray(assessment.processGaps).length > 0;
  const objectivePresent = meaningfulString(dossier.priority, ["Sin prioridad definida", "No especificado"]);
  const organizationalContextPresent =
    (typeof dossier.employees === "number" &&
      Number.isFinite(dossier.employees) &&
      dossier.employees > 0) ||
    nonEmptyString(linkData.employeeRange) !== undefined;

  const evidenceGaps: string[] = [];
  if (!activityPresent) evidenceGaps.push("ACTIVITY_OR_OFFERING_NOT_STRUCTURED");
  if (!primaryNeedPresent) evidenceGaps.push("PRIMARY_NEED_NOT_STRUCTURED");
  if (!objectivePresent) evidenceGaps.push("OBJECTIVE_NOT_STRUCTURED");
  if (!organizationalContextPresent) evidenceGaps.push("ORGANIZATIONAL_CONTEXT_NOT_STRUCTURED");

  const valid = hardMissingFields.length === 0;

  const questionsAskedCount = Array.isArray(payload.conversationHistory)
    ? new Set(
        payload.conversationHistory
          .filter(
            (entry) =>
              entry &&
              typeof entry === "object" &&
              (entry as any).role === "aura" &&
              typeof (entry as any).content === "string" &&
              ((entry as any).content.includes("?") || (entry as any).content.includes("¿")),
          )
          .map((entry) => (entry as any).content.trim()),
      ).size
    : 0;

  return {
    valid,
    hardMissingFields,
    evidenceGaps,
    conversationMetrics: metrics,
    questionsAskedCount,
    completionReason: valid
      ? "REQUIRED_FIELDS_COMPLETE"
      : "BLOCKED_MISSING_REQUIRED_FIELDS",
    missingRequiredFields: hardMissingFields,
    conversationDefinitionVersion: DISCOVERY_CONVERSATION_DEFINITION_VERSION,
  };
}
