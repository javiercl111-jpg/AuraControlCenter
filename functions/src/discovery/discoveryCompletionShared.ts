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

export const DiscoveryKnowledgeGap = {
  ACTIVITY_OR_OFFERING: "ACTIVITY_OR_OFFERING",
  PRIMARY_NEED: "PRIMARY_NEED",
  OBJECTIVE: "OBJECTIVE",
  ORGANIZATIONAL_CONTEXT: "ORGANIZATIONAL_CONTEXT",
} as const;

export type DiscoveryKnowledgeGap =
  (typeof DiscoveryKnowledgeGap)[keyof typeof DiscoveryKnowledgeGap];

export const DiscoveryRequiredField = {
  ...DiscoveryHardRequirement,
  ...DiscoveryKnowledgeGap,
} as const;

export type DiscoveryRequiredField =
  (typeof DiscoveryRequiredField)[keyof typeof DiscoveryRequiredField];

export interface ConversationMetrics {
  readonly userTurns: number;
  readonly substantiveUserTurns: number;
  readonly totalUserCharacters: number;
  readonly hasSubstantiveConversation: boolean;
}

export interface DiscoveryCompletionState {
  readonly canComplete: boolean;
  readonly hardMissingFields: readonly DiscoveryHardRequirement[];
  readonly requiredKnowledgeGaps: readonly DiscoveryKnowledgeGap[];
  readonly optionalEvidenceGaps: readonly string[];
  readonly conversationMetrics: ConversationMetrics;
  readonly nextRequiredGap?: DiscoveryKnowledgeGap;
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
    const role = typeof record.role === "string" ? record.role.trim() : "";
    const content = typeof record.content === "string" ? record.content.trim() : "";

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

export function evaluateDiscoveryCompletionState(input: {
  dossierPayload: Record<string, unknown>;
  linkData: Record<string, unknown>;
}): DiscoveryCompletionState {
  const dossier = (input.dossierPayload.dossier as Record<string, unknown>) || {};
  const assessment = (input.dossierPayload.businessAssessmentDraft as Record<string, unknown>) || {};
  const metrics = calculateConversationMetrics(input.dossierPayload.conversationHistory);

  const companyPresent =
    typeof input.linkData.companyName === "string" && input.linkData.companyName.trim().length > 0;
  const contactPresent =
    typeof input.linkData.contactName === "string" &&
    input.linkData.contactName.trim().length > 0 &&
    ((typeof input.linkData.email === "string" && input.linkData.email.trim().length > 0) ||
      (typeof input.linkData.phone === "string" && input.linkData.phone.trim().length > 0));

  const hasConsent =
    input.linkData.consent === true ||
    (input.linkData.consents &&
      typeof input.linkData.consents === "object" &&
      (input.linkData.consents as any).privacy?.value === true &&
      (input.linkData.consents as any).diagnosticDelivery?.value === true);

  const hardMissingFields: DiscoveryHardRequirement[] = [];
  if (!companyPresent) hardMissingFields.push(DiscoveryHardRequirement.COMPANY_OR_ORGANIZATION);
  if (!contactPresent) hardMissingFields.push(DiscoveryHardRequirement.CONTACT_INFORMATION);
  if (!hasConsent) hardMissingFields.push(DiscoveryHardRequirement.REQUIRED_CONSENT);
  if (!metrics.hasSubstantiveConversation) hardMissingFields.push(DiscoveryHardRequirement.SUBSTANTIVE_CONVERSATION);

  const industryStr = typeof dossier.industry === "string" ? dossier.industry.trim() : "";
  const activityPresent =
    industryStr.length > 0 &&
    !["otros", "industria general", "no especificado"].includes(industryStr.toLowerCase());

  const painPoints = Array.isArray(assessment.painPointsIdentified) ? assessment.painPointsIdentified : [];
  const processGaps = Array.isArray(assessment.processGaps) ? assessment.processGaps : [];
  const primaryNeedPresent = painPoints.length > 0 || processGaps.length > 0;

  const priorityStr = typeof dossier.priority === "string" ? dossier.priority.trim() : "";
  const objectivePresent =
    priorityStr.length > 0 &&
    !["sin prioridad definida", "no especificado"].includes(priorityStr.toLowerCase());

  const employees = Number(dossier.employees);
  const organizationalContextPresent =
    (Number.isFinite(employees) && employees > 0) ||
    (typeof input.linkData.employeeRange === "string" && input.linkData.employeeRange.trim().length > 0);

  const requiredKnowledgeGaps: DiscoveryKnowledgeGap[] = [];
  if (!activityPresent) requiredKnowledgeGaps.push(DiscoveryKnowledgeGap.ACTIVITY_OR_OFFERING);
  if (!primaryNeedPresent) requiredKnowledgeGaps.push(DiscoveryKnowledgeGap.PRIMARY_NEED);
  if (!objectivePresent) requiredKnowledgeGaps.push(DiscoveryKnowledgeGap.OBJECTIVE);
  if (!organizationalContextPresent) requiredKnowledgeGaps.push(DiscoveryKnowledgeGap.ORGANIZATIONAL_CONTEXT);

  const canComplete = hardMissingFields.length === 0;

  const gapPriorityOrder: DiscoveryKnowledgeGap[] = [
    DiscoveryKnowledgeGap.ACTIVITY_OR_OFFERING,
    DiscoveryKnowledgeGap.PRIMARY_NEED,
    DiscoveryKnowledgeGap.OBJECTIVE,
    DiscoveryKnowledgeGap.ORGANIZATIONAL_CONTEXT,
  ];

  const nextRequiredGap = gapPriorityOrder.find((gap) => requiredKnowledgeGaps.includes(gap));

  return {
    canComplete,
    hardMissingFields,
    requiredKnowledgeGaps,
    optionalEvidenceGaps: requiredKnowledgeGaps.map((g) => `${g}_NOT_STRUCTURED`),
    conversationMetrics: metrics,
    nextRequiredGap,
  };
}
