import type { ExecutiveDiagnosis } from "../contracts/ExecutiveDiagnosis";

export const DISCOVERY_LEGACY_DIAGNOSIS_VERSION = "legacy-discovery-v1" as const;

export const DiscoveryDiagnosisComparisonCategory = {
  MATURITY: "MATURITY",
  RECOMMENDATIONS: "RECOMMENDATIONS",
  RISKS: "RISKS",
  OPPORTUNITIES: "OPPORTUNITIES",
  CONFIDENCE: "CONFIDENCE",
  MISSING_EVIDENCE: "MISSING_EVIDENCE",
  WARNINGS: "WARNINGS",
} as const;

export type DiscoveryDiagnosisComparisonCategory =
  (typeof DiscoveryDiagnosisComparisonCategory)[keyof typeof DiscoveryDiagnosisComparisonCategory];

export interface LegacyDiscoveryDiagnosis {
  readonly source: "LEGACY_DISCOVERY";
  readonly version: typeof DISCOVERY_LEGACY_DIAGNOSIS_VERSION;
  readonly maturity: number | null;
  readonly recommendations: readonly string[];
  readonly risks: readonly string[];
  readonly opportunities: readonly string[];
  readonly confidence: number | null;
  readonly missingEvidence: readonly string[];
  readonly warnings: readonly string[];
}

export interface ScalarDiagnosisComparison {
  readonly matches: boolean;
  readonly legacyValue: number | null;
  readonly shadowValue: number | null;
}

export interface ListDiagnosisComparison {
  readonly matches: boolean;
  readonly legacyCount: number;
  readonly shadowCount: number;
}

export interface DiscoveryDiagnosisComparison {
  readonly differences: readonly DiscoveryDiagnosisComparisonCategory[];
  readonly maturity: ScalarDiagnosisComparison;
  readonly recommendations: ListDiagnosisComparison;
  readonly risks: ListDiagnosisComparison;
  readonly opportunities: ListDiagnosisComparison;
  readonly confidence: ScalarDiagnosisComparison;
  readonly missingEvidence: ListDiagnosisComparison;
  readonly warnings: ListDiagnosisComparison;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as UnknownRecord;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function normalizeConfidence(value: unknown): number | null {
  const score = finiteNumber(value);
  if (score === null || score < 0) return null;
  if (score <= 1) return score;
  if (score <= 100) return score / 100;
  return null;
}

/** Captures only the already-official legacy diagnosis fields. */
export function buildLegacyDiscoveryDiagnosis(
  session: Readonly<Record<string, unknown>>,
): LegacyDiscoveryDiagnosis {
  const assessment = asRecord(session.businessAssessmentDraft);
  const briefing = asRecord(session.executiveBriefingDraft);
  const radiography = asRecord(session.radiografiaEmpresarialDraft);
  const advisorContext = asRecord(session.salesAdvisorContext);
  const conversationState = asRecord(session.conversationStateSnapshot);

  const potentialSavings = optionalString(radiography.potentialSavings);
  const partialCompletionReason = optionalString(
    conversationState.partialCompletionReason,
  );
  const fallbackCode = optionalString(conversationState.lastFallbackCode);

  return {
    source: "LEGACY_DISCOVERY",
    version: DISCOVERY_LEGACY_DIAGNOSIS_VERSION,
    maturity: finiteNumber(assessment.score),
    recommendations: unique([
      ...stringArray(briefing.suggestedNextSteps),
      ...stringArray(radiography.recommendedModules),
    ]),
    risks: unique([
      ...stringArray(assessment.painPointsIdentified),
      ...stringArray(assessment.processGaps),
      ...stringArray(advisorContext.alertFlags),
    ]),
    opportunities: potentialSavings === null ? [] : [potentialSavings],
    confidence: normalizeConfidence(conversationState.confidenceLevel),
    missingEvidence: stringArray(conversationState.missingEvidence),
    warnings: unique(
      [partialCompletionReason, fallbackCode].filter(
        (entry): entry is string => entry !== null,
      ),
    ),
  };
}

function normalizedStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim().toLocaleLowerCase("es-MX")))].sort();
}

function compareLists(
  legacyValues: readonly string[],
  shadowValues: readonly string[],
): ListDiagnosisComparison {
  const normalizedLegacy = normalizedStrings(legacyValues);
  const normalizedShadow = normalizedStrings(shadowValues);
  return {
    matches: JSON.stringify(normalizedLegacy) === JSON.stringify(normalizedShadow),
    legacyCount: legacyValues.length,
    shadowCount: shadowValues.length,
  };
}

function compareScalars(
  legacyValue: number | null,
  shadowValue: number | null,
): ScalarDiagnosisComparison {
  return {
    matches: legacyValue === shadowValue,
    legacyValue,
    shadowValue,
  };
}

/** Performs a neutral, exact comparison and does not rank either diagnosis. */
export function compareDiscoveryDiagnoses(
  legacy: LegacyDiscoveryDiagnosis,
  shadow: ExecutiveDiagnosis,
): DiscoveryDiagnosisComparison {
  const maturity = compareScalars(legacy.maturity, shadow.maturity.overallScore);
  const recommendations = compareLists(
    legacy.recommendations,
    shadow.recommendations.map((item) => item.title),
  );
  const risks = compareLists(
    legacy.risks,
    shadow.risks.map((item) => item.title),
  );
  const opportunities = compareLists(
    legacy.opportunities,
    shadow.opportunities.map((item) => item.title),
  );
  const confidence = compareScalars(legacy.confidence, shadow.confidence.score);
  const missingEvidence = compareLists(
    legacy.missingEvidence,
    shadow.businessSnapshot.missingInformation.map((item) => item.label),
  );
  const warnings = compareLists(legacy.warnings, shadow.warnings);

  const entries: readonly [
    DiscoveryDiagnosisComparisonCategory,
    { readonly matches: boolean },
  ][] = [
    [DiscoveryDiagnosisComparisonCategory.MATURITY, maturity],
    [DiscoveryDiagnosisComparisonCategory.RECOMMENDATIONS, recommendations],
    [DiscoveryDiagnosisComparisonCategory.RISKS, risks],
    [DiscoveryDiagnosisComparisonCategory.OPPORTUNITIES, opportunities],
    [DiscoveryDiagnosisComparisonCategory.CONFIDENCE, confidence],
    [DiscoveryDiagnosisComparisonCategory.MISSING_EVIDENCE, missingEvidence],
    [DiscoveryDiagnosisComparisonCategory.WARNINGS, warnings],
  ];

  return {
    differences: entries
      .filter(([, comparison]) => !comparison.matches)
      .map(([category]) => category),
    maturity,
    recommendations,
    risks,
    opportunities,
    confidence,
    missingEvidence,
    warnings,
  };
}
