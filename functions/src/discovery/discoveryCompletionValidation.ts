export const DISCOVERY_CONVERSATION_DEFINITION_VERSION =
  "legacy-discovery-v1" as const;

export const DiscoveryRequiredField = {
  COMPANY_OR_ORGANIZATION: "COMPANY_OR_ORGANIZATION",
  ACTIVITY_OR_OFFERING: "ACTIVITY_OR_OFFERING",
  PRIMARY_NEED: "PRIMARY_NEED",
  OBJECTIVE: "OBJECTIVE",
  ORGANIZATIONAL_CONTEXT: "ORGANIZATIONAL_CONTEXT",
  CONTACT_INFORMATION: "CONTACT_INFORMATION",
  REQUIRED_CONSENT: "REQUIRED_CONSENT",
} as const;

export type DiscoveryRequiredField =
  (typeof DiscoveryRequiredField)[keyof typeof DiscoveryRequiredField];

export interface DiscoveryCompletionValidationInput {
  readonly dossierPayload: Readonly<Record<string, unknown>>;
  readonly linkData: Readonly<Record<string, unknown>>;
}

export interface DiscoveryCompletionValidationResult {
  readonly questionsAskedCount: number;
  readonly completionReason:
    | "REQUIRED_FIELDS_COMPLETE"
    | "BLOCKED_MISSING_REQUIRED_FIELDS";
  readonly missingRequiredFields: readonly DiscoveryRequiredField[];
  readonly conversationDefinitionVersion: typeof DISCOVERY_CONVERSATION_DEFINITION_VERSION;
}

type UnknownRecord = Record<string, unknown>;

interface ConversationMessage {
  readonly role: string;
  readonly content: string;
}

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

function conversationMessages(value: unknown): readonly ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    const role = nonEmptyString(record.role);
    const content = nonEmptyString(record.content);
    return role === undefined || content === undefined ? [] : [{ role, content }];
  });
}

function hasMeaningfulAnswer(values: readonly string[]): boolean {
  return values.some((value) => {
    const text = value.trim();
    return text.length >= 4 && !/^(ok|vale|correcto)$/i.test(text);
  });
}

function hasSubstantiveAnswer(values: readonly string[]): boolean {
  return values.some((value) => {
    const text = value.trim();
    const words = text.split(/\s+/).filter(Boolean);
    return (
      !/^(si|sí|no|ok|vale|correcto)$/i.test(text) &&
      (words.length >= 3 || text.length >= 12)
    );
  });
}

function answersForQuestion(
  messages: readonly ConversationMessage[],
  questionMatches: (normalizedQuestion: string) => boolean,
): readonly string[] {
  const answers: string[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== "aura" || !questionMatches(normalize(message.content))) {
      continue;
    }
    const answer = messages
      .slice(index + 1)
      .find((candidate) => candidate.role === "user");
    if (answer !== undefined) answers.push(answer.content);
  }
  return answers;
}

function hasRequiredConsents(linkData: UnknownRecord): boolean {
  if (linkData.consent === true) return true;
  const consents = asRecord(linkData.consents);
  return (
    asRecord(consents.privacy).value === true &&
    asRecord(consents.diagnosticDelivery).value === true
  );
}

/**
 * Validates the minimum evidence needed to close the current commercial
 * Discovery. It derives booleans only and never returns free-form evidence.
 */
export function validateDiscoveryCompletion(
  input: DiscoveryCompletionValidationInput,
): DiscoveryCompletionValidationResult {
  const payload = asRecord(input.dossierPayload);
  const linkData = asRecord(input.linkData);
  const dossier = asRecord(payload.dossier);
  const assessment = asRecord(payload.businessAssessmentDraft);
  const history = conversationMessages(payload.conversationHistory);

  const activityAnswers = answersForQuestion(
    history,
    (question) =>
      question.includes("giro de tu empresa") ||
      question.includes("a que se dedica") ||
      question.includes("actividad principal"),
  );
  const needAnswers = answersForQuestion(
    history,
    (question) =>
      question.includes("reto administrativo") ||
      question.includes("problema") ||
      question.includes("consume mas tiempo") ||
      question.includes("dolores de cabeza"),
  );
  const objectiveAnswers = answersForQuestion(
    history,
    (question) =>
      question.includes("principal prioridad") || question.includes("objetivo"),
  );
  const contextAnswers = answersForQuestion(
    history,
    (question) =>
      question.includes("doble de operaciones") ||
      question.includes("cuantos colaboradores") ||
      question.includes("tamano de la organizacion"),
  );

  const companyPresent = nonEmptyString(linkData.companyName) !== undefined;
  const activityPresent =
    meaningfulString(dossier.industry, ["Otros", "Industria General", "No especificado"]) ||
    hasMeaningfulAnswer(activityAnswers);
  const primaryNeedPresent =
    stringArray(assessment.painPointsIdentified).length > 0 ||
    stringArray(assessment.processGaps).length > 0 ||
    hasSubstantiveAnswer(needAnswers);
  const objectivePresent =
    meaningfulString(dossier.priority, ["Sin prioridad definida", "No especificado"]) ||
    hasSubstantiveAnswer(objectiveAnswers);
  const organizationalContextPresent =
    (typeof dossier.employees === "number" &&
      Number.isFinite(dossier.employees) &&
      dossier.employees > 0) ||
    nonEmptyString(linkData.employeeRange) !== undefined ||
    hasMeaningfulAnswer(contextAnswers);
  const contactPresent =
    nonEmptyString(linkData.contactName) !== undefined &&
    (nonEmptyString(linkData.email) !== undefined ||
      nonEmptyString(linkData.phone) !== undefined);

  const requirements: readonly [DiscoveryRequiredField, boolean][] = [
    [DiscoveryRequiredField.COMPANY_OR_ORGANIZATION, companyPresent],
    [DiscoveryRequiredField.ACTIVITY_OR_OFFERING, activityPresent],
    [DiscoveryRequiredField.PRIMARY_NEED, primaryNeedPresent],
    [DiscoveryRequiredField.OBJECTIVE, objectivePresent],
    [DiscoveryRequiredField.ORGANIZATIONAL_CONTEXT, organizationalContextPresent],
    [DiscoveryRequiredField.CONTACT_INFORMATION, contactPresent],
    [DiscoveryRequiredField.REQUIRED_CONSENT, hasRequiredConsents(linkData)],
  ];
  const missingRequiredFields = requirements
    .filter(([, present]) => !present)
    .map(([field]) => field);
  const questionsAskedCount = new Set(
    history
      .filter(
        (message) =>
          message.role === "aura" &&
          (message.content.includes("?") || message.content.includes("¿")),
      )
      .map((message) => message.content.trim()),
  ).size;

  return {
    questionsAskedCount,
    completionReason:
      missingRequiredFields.length === 0
        ? "REQUIRED_FIELDS_COMPLETE"
        : "BLOCKED_MISSING_REQUIRED_FIELDS",
    missingRequiredFields,
    conversationDefinitionVersion: DISCOVERY_CONVERSATION_DEFINITION_VERSION,
  };
}
