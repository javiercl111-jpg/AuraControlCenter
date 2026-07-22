import {
  DiscoveryEvidenceClassification,
  DiscoveryEvidenceSourceType,
  EXECUTIVE_DISCOVERY_SCHEMA_VERSION,
  type DiscoveryJsonValue,
  type DiscoveryMetadata,
  type ExecutiveDiscoveryApiRequest,
  type ExecutiveDiscoveryEvidence,
} from "../contracts/ExecutiveDiscoveryApiRequest";
import {
  ExecutiveActionStatus,
  ExecutiveConfidenceLevel,
  type ExecutiveDiagnosis,
  ExecutiveDiagnosisStatus,
  ExecutiveMaturityLevel,
  ExecutiveOpportunityHorizon,
  ExecutivePriority,
  ExecutiveRiskLikelihood,
  ExecutiveRiskSeverity,
} from "../contracts/ExecutiveDiagnosis";

type UnknownRecord = Record<string, unknown>;

const ISO_DATE_TIME_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const METADATA_KEY = /^[A-Za-z0-9_.-]{1,64}$/;

function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactShape(
  value: UnknownRecord,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function isNonEmptyString(value: unknown, maxLength = 4_096): value is string {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    value.trim().length > 0
  );
}

function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_DATE_TIME_WITH_OFFSET.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isFiniteNumber(value: unknown, minimum: number, maximum: number): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isCatalogValue(
  value: unknown,
  catalog: Readonly<Record<string, string>>,
): boolean {
  return typeof value === "string" && Object.values(catalog).includes(value);
}

function isStringArray(
  value: unknown,
  minimumLength = 0,
  maximumLength = 500,
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length >= minimumLength &&
    value.length <= maximumLength &&
    value.every((item) => isNonEmptyString(item))
  );
}

function isJsonValue(
  value: unknown,
  ancestors: Set<object> = new Set<object>(),
  depth = 0,
): value is DiscoveryJsonValue {
  if (depth > 50) return false;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;

  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, ancestors, depth + 1))
    : isRecord(value) &&
      Object.values(value).every((item) =>
        isJsonValue(item, ancestors, depth + 1),
      );
  ancestors.delete(value);
  return valid;
}

function isMetadata(value: unknown): value is DiscoveryMetadata {
  if (!isRecord(value) || Object.keys(value).length > 20) return false;

  return Object.entries(value).every(([key, item]) => {
    if (!METADATA_KEY.test(key)) return false;
    if (item === null || typeof item === "boolean") return true;
    if (typeof item === "number") return Number.isFinite(item);
    return typeof item === "string" && item.length <= 2_048;
  });
}

function isEvidence(value: unknown): value is ExecutiveDiscoveryEvidence {
  if (!isRecord(value)) return false;
  if (
    !hasExactShape(
      value,
      [
        "evidenceId",
        "sourceType",
        "sourceReference",
        "value",
        "capturedAt",
        "classification",
        "consentScope",
        "confidence",
      ],
      ["fieldId", "questionId", "normalizedValue", "hash", "metadata"],
    )
  ) {
    return false;
  }

  return (
    isNonEmptyString(value.evidenceId, 2_048) &&
    isCatalogValue(value.sourceType, DiscoveryEvidenceSourceType) &&
    isNonEmptyString(value.sourceReference, 2_048) &&
    (value.fieldId === undefined || isNonEmptyString(value.fieldId, 2_048)) &&
    (value.questionId === undefined ||
      isNonEmptyString(value.questionId, 2_048)) &&
    isJsonValue(value.value) &&
    (value.normalizedValue === undefined || isJsonValue(value.normalizedValue)) &&
    isIsoDateTime(value.capturedAt) &&
    isCatalogValue(value.classification, DiscoveryEvidenceClassification) &&
    isNonEmptyString(value.consentScope, 2_048) &&
    isFiniteNumber(value.confidence, 0, 1) &&
    (value.hash === undefined || isNonEmptyString(value.hash, 256)) &&
    (value.metadata === undefined || isMetadata(value.metadata))
  );
}

function isConsentAssertion(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    !hasExactShape(
      value,
      [
        "receiptId",
        "privacyConsent",
        "diagnosticProcessingConsent",
        "consentVersion",
        "capturedAt",
      ],
      ["marketingConsent"],
    )
  ) {
    return false;
  }

  return (
    isNonEmptyString(value.receiptId, 2_048) &&
    value.privacyConsent === true &&
    value.diagnosticProcessingConsent === true &&
    (value.marketingConsent === undefined ||
      typeof value.marketingConsent === "boolean") &&
    isNonEmptyString(value.consentVersion, 2_048) &&
    isIsoDateTime(value.capturedAt)
  );
}

export function isExecutiveDiscoveryApiRequest(
  input: unknown,
): input is ExecutiveDiscoveryApiRequest {
  if (!isRecord(input)) return false;
  if (
    !hasExactShape(
      input,
      [
        "schemaVersion",
        "capabilityVersion",
        "requestId",
        "correlationId",
        "idempotencyKey",
        "organizationId",
        "tenantId",
        "companyId",
        "sessionId",
        "discoveryDefinitionVersion",
        "locale",
        "requestedAt",
        "evidence",
        "consentAssertion",
      ],
      ["metadata"],
    )
  ) {
    return false;
  }

  if (
    input.schemaVersion !== EXECUTIVE_DISCOVERY_SCHEMA_VERSION ||
    !isNonEmptyString(input.capabilityVersion, 2_048) ||
    !isNonEmptyString(input.requestId, 2_048) ||
    !isNonEmptyString(input.correlationId, 2_048) ||
    !isNonEmptyString(input.idempotencyKey, 2_048) ||
    !isNonEmptyString(input.organizationId, 2_048) ||
    !isNonEmptyString(input.tenantId, 2_048) ||
    !isNonEmptyString(input.companyId, 2_048) ||
    !isNonEmptyString(input.sessionId, 2_048) ||
    !isNonEmptyString(input.discoveryDefinitionVersion, 2_048) ||
    !isNonEmptyString(input.locale, 32) ||
    !isIsoDateTime(input.requestedAt) ||
    !Array.isArray(input.evidence) ||
    input.evidence.length < 1 ||
    input.evidence.length > 500 ||
    !input.evidence.every(isEvidence) ||
    !isConsentAssertion(input.consentAssertion) ||
    (input.metadata !== undefined && !isMetadata(input.metadata))
  ) {
    return false;
  }

  const evidenceIds = input.evidence.map((evidence) => evidence.evidenceId);
  return new Set(evidenceIds).size === evidenceIds.length;
}

function isConfidence(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    !hasExactShape(
      value,
      ["level", "score", "basis", "evidenceCount", "missingEvidenceCount"],
      ["calibrationVersion"],
    )
  ) {
    return false;
  }

  return (
    isCatalogValue(value.level, ExecutiveConfidenceLevel) &&
    isFiniteNumber(value.score, 0, 1) &&
    isStringArray(value.basis, 1) &&
    typeof value.evidenceCount === "number" &&
    Number.isInteger(value.evidenceCount) &&
    value.evidenceCount >= 0 &&
    typeof value.missingEvidenceCount === "number" &&
    Number.isInteger(value.missingEvidenceCount) &&
    value.missingEvidenceCount >= 0 &&
    (value.calibrationVersion === undefined ||
      isNonEmptyString(value.calibrationVersion))
  );
}

function isBusinessFact(value: unknown, classification: string): boolean {
  if (!isRecord(value)) return false;
  return (
    hasExactShape(value, ["label", "value", "classification", "evidenceIds"]) &&
    isNonEmptyString(value.label) &&
    isJsonValue(value.value) &&
    value.classification === classification &&
    isStringArray(value.evidenceIds, 1)
  );
}

function isMissingInformation(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactShape(value, ["label", "evidenceIds"]) &&
    isNonEmptyString(value.label) &&
    isStringArray(value.evidenceIds, 1)
  );
}

function isBusinessSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasExactShape(value, [
      "confirmedFacts",
      "inferredFacts",
      "systemObservations",
      "missingInformation",
    ]) &&
    Array.isArray(value.confirmedFacts) &&
    value.confirmedFacts.every((fact) =>
      isBusinessFact(fact, DiscoveryEvidenceClassification.USER_CONFIRMED),
    ) &&
    Array.isArray(value.inferredFacts) &&
    value.inferredFacts.every((fact) =>
      isBusinessFact(fact, DiscoveryEvidenceClassification.INFERRED),
    ) &&
    Array.isArray(value.systemObservations) &&
    value.systemObservations.every((fact) =>
      isBusinessFact(fact, DiscoveryEvidenceClassification.SYSTEM_OBSERVED),
    ) &&
    Array.isArray(value.missingInformation) &&
    value.missingInformation.every(isMissingInformation)
  );
}

function isMaturityDimension(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasExactShape(value, [
      "dimensionId",
      "name",
      "score",
      "rationale",
      "evidenceIds",
      "confidence",
    ]) &&
    isNonEmptyString(value.dimensionId) &&
    isNonEmptyString(value.name) &&
    isFiniteNumber(value.score, 0, 100) &&
    isNonEmptyString(value.rationale) &&
    isStringArray(value.evidenceIds, 1) &&
    isConfidence(value.confidence)
  );
}

function isMaturity(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasExactShape(value, [
      "overallScore",
      "level",
      "dimensions",
      "rationale",
      "evidenceIds",
      "confidence",
    ]) &&
    isFiniteNumber(value.overallScore, 0, 100) &&
    isCatalogValue(value.level, ExecutiveMaturityLevel) &&
    Array.isArray(value.dimensions) &&
    value.dimensions.every(isMaturityDimension) &&
    isNonEmptyString(value.rationale) &&
    isStringArray(value.evidenceIds) &&
    isConfidence(value.confidence)
  );
}

function isRisk(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasExactShape(
      value,
      [
        "riskId",
        "category",
        "title",
        "description",
        "severity",
        "likelihood",
        "impact",
        "confidence",
        "evidenceIds",
      ],
      ["mitigation"],
    ) &&
    isNonEmptyString(value.riskId) &&
    isNonEmptyString(value.category) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isCatalogValue(value.severity, ExecutiveRiskSeverity) &&
    isCatalogValue(value.likelihood, ExecutiveRiskLikelihood) &&
    isNonEmptyString(value.impact) &&
    (value.mitigation === undefined || isNonEmptyString(value.mitigation)) &&
    isConfidence(value.confidence) &&
    isStringArray(value.evidenceIds, 1)
  );
}

function isOpportunity(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasExactShape(value, [
      "opportunityId",
      "category",
      "title",
      "description",
      "expectedValue",
      "feasibility",
      "horizon",
      "confidence",
      "evidenceIds",
    ]) &&
    isNonEmptyString(value.opportunityId) &&
    isNonEmptyString(value.category) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.expectedValue) &&
    isFiniteNumber(value.feasibility, 0, 1) &&
    isCatalogValue(value.horizon, ExecutiveOpportunityHorizon) &&
    isConfidence(value.confidence) &&
    isStringArray(value.evidenceIds, 1)
  );
}

function isRecommendation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasExactShape(value, [
      "recommendationId",
      "title",
      "description",
      "rationale",
      "priority",
      "confidence",
      "evidenceIds",
      "expectedImpact",
      "timeframe",
      "linkedActionIds",
    ]) &&
    isNonEmptyString(value.recommendationId) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.rationale) &&
    isCatalogValue(value.priority, ExecutivePriority) &&
    isConfidence(value.confidence) &&
    isStringArray(value.evidenceIds, 1) &&
    isNonEmptyString(value.expectedImpact) &&
    isNonEmptyString(value.timeframe) &&
    isStringArray(value.linkedActionIds)
  );
}

function isAction(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasExactShape(
      value,
      [
        "actionId",
        "title",
        "description",
        "priority",
        "timeframe",
        "dependencies",
        "successCriteria",
        "evidenceIds",
        "status",
      ],
      ["ownerRole"],
    ) &&
    isNonEmptyString(value.actionId) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isCatalogValue(value.priority, ExecutivePriority) &&
    (value.ownerRole === undefined || isNonEmptyString(value.ownerRole)) &&
    isNonEmptyString(value.timeframe) &&
    isStringArray(value.dependencies) &&
    isStringArray(value.successCriteria, 1) &&
    isStringArray(value.evidenceIds, 1) &&
    isCatalogValue(value.status, ExecutiveActionStatus)
  );
}

function isGenerationMetadata(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasExactShape(value, [
      "requestId",
      "correlationId",
      "providerId",
      "providerVersion",
      "deterministic",
    ]) &&
    isNonEmptyString(value.requestId) &&
    isNonEmptyString(value.correlationId) &&
    isNonEmptyString(value.providerId) &&
    isNonEmptyString(value.providerVersion) &&
    typeof value.deterministic === "boolean"
  );
}

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function isExecutiveDiagnosisStructure(input: unknown): input is ExecutiveDiagnosis {
  if (!isRecord(input)) return false;
  if (
    !hasExactShape(input, [
      "diagnosisId",
      "schemaVersion",
      "capabilityVersion",
      "organizationId",
      "tenantId",
      "companyId",
      "sessionId",
      "status",
      "executiveSummary",
      "businessSnapshot",
      "maturity",
      "risks",
      "opportunities",
      "recommendations",
      "actions",
      "confidence",
      "evidenceIds",
      "warnings",
      "generatedAt",
      "generationMetadata",
    ])
  ) {
    return false;
  }

  if (
    !isNonEmptyString(input.diagnosisId) ||
    input.schemaVersion !== EXECUTIVE_DISCOVERY_SCHEMA_VERSION ||
    !isNonEmptyString(input.capabilityVersion) ||
    !isNonEmptyString(input.organizationId) ||
    !isNonEmptyString(input.tenantId) ||
    !isNonEmptyString(input.companyId) ||
    !isNonEmptyString(input.sessionId) ||
    !isCatalogValue(input.status, ExecutiveDiagnosisStatus) ||
    !isNonEmptyString(input.executiveSummary) ||
    !isBusinessSnapshot(input.businessSnapshot) ||
    !isMaturity(input.maturity) ||
    !Array.isArray(input.risks) ||
    !input.risks.every(isRisk) ||
    !Array.isArray(input.opportunities) ||
    !input.opportunities.every(isOpportunity) ||
    !Array.isArray(input.recommendations) ||
    !input.recommendations.every(isRecommendation) ||
    !Array.isArray(input.actions) ||
    !input.actions.every(isAction) ||
    !isConfidence(input.confidence) ||
    !isStringArray(input.evidenceIds) ||
    !isStringArray(input.warnings) ||
    !isIsoDateTime(input.generatedAt) ||
    !isGenerationMetadata(input.generationMetadata)
  ) {
    return false;
  }

  return (
    hasUniqueValues(input.risks.map((risk) => risk.riskId)) &&
    hasUniqueValues(
      input.opportunities.map((opportunity) => opportunity.opportunityId),
    ) &&
    hasUniqueValues(
      input.recommendations.map(
        (recommendation) => recommendation.recommendationId,
      ),
    ) &&
    hasUniqueValues(input.actions.map((action) => action.actionId))
  );
}

function collectEvidenceReferences(diagnosis: ExecutiveDiagnosis): readonly string[] {
  return [
    ...diagnosis.evidenceIds,
    ...diagnosis.businessSnapshot.confirmedFacts.flatMap(
      (fact) => fact.evidenceIds,
    ),
    ...diagnosis.businessSnapshot.inferredFacts.flatMap(
      (fact) => fact.evidenceIds,
    ),
    ...diagnosis.businessSnapshot.systemObservations.flatMap(
      (fact) => fact.evidenceIds,
    ),
    ...diagnosis.businessSnapshot.missingInformation.flatMap(
      (item) => item.evidenceIds,
    ),
    ...diagnosis.maturity.evidenceIds,
    ...diagnosis.maturity.dimensions.flatMap(
      (dimension) => dimension.evidenceIds,
    ),
    ...diagnosis.risks.flatMap((risk) => risk.evidenceIds),
    ...diagnosis.opportunities.flatMap((opportunity) => opportunity.evidenceIds),
    ...diagnosis.recommendations.flatMap(
      (recommendation) => recommendation.evidenceIds,
    ),
    ...diagnosis.actions.flatMap((action) => action.evidenceIds),
  ];
}

export function isExecutiveDiagnosisForRequest(
  input: unknown,
  request: ExecutiveDiscoveryApiRequest,
): input is ExecutiveDiagnosis {
  if (!isExecutiveDiagnosisStructure(input)) return false;

  if (
    input.organizationId !== request.organizationId ||
    input.tenantId !== request.tenantId ||
    input.companyId !== request.companyId ||
    input.sessionId !== request.sessionId ||
    input.capabilityVersion !== request.capabilityVersion ||
    input.generationMetadata.requestId !== request.requestId ||
    input.generationMetadata.correlationId !== request.correlationId
  ) {
    return false;
  }

  const availableEvidenceIds = new Set(
    request.evidence.map((evidence) => evidence.evidenceId),
  );
  if (
    collectEvidenceReferences(input).some(
      (evidenceId) => !availableEvidenceIds.has(evidenceId),
    )
  ) {
    return false;
  }

  const actionIds = new Set(input.actions.map((action) => action.actionId));
  const actionReferencesValid = input.actions.every((action) =>
    action.dependencies.every(
      (dependencyId) =>
        dependencyId !== action.actionId && actionIds.has(dependencyId),
    ),
  );
  const recommendationReferencesValid = input.recommendations.every(
    (recommendation) =>
      recommendation.linkedActionIds.every((actionId) => actionIds.has(actionId)),
  );

  return actionReferencesValid && recommendationReferencesValid;
}

function isSafeDetailValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

/** Validates only the HTTP envelope; diagnosis validation remains the adapter's job. */
export function isExecutiveDiscoveryApiEnvelopeShape(input: unknown): boolean {
  if (!isRecord(input) || typeof input.success !== "boolean") return false;

  if (input.success) {
    if (!hasExactShape(input, ["success", "data", "meta"])) return false;
    if (!isRecord(input.data) || !isRecord(input.meta)) return false;
    return (
      hasExactShape(input.meta, ["correlationId", "warnings"]) &&
      isNonEmptyString(input.meta.correlationId) &&
      isStringArray(input.meta.warnings)
    );
  }

  if (!hasExactShape(input, ["success", "error"], ["correlationId"])) {
    return false;
  }
  if (!isRecord(input.error)) return false;
  if (
    !hasExactShape(input.error, ["code", "message"], ["details"]) ||
    !isNonEmptyString(input.error.code) ||
    !isNonEmptyString(input.error.message) ||
    (input.correlationId !== undefined &&
      !isNonEmptyString(input.correlationId))
  ) {
    return false;
  }

  return (
    input.error.details === undefined ||
    (isRecord(input.error.details) &&
      Object.values(input.error.details).every(isSafeDetailValue))
  );
}
