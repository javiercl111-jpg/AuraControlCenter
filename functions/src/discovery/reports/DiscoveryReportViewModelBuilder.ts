import type { DeliveryLevel, ReportViewModel } from "./types";

type UnknownRecord = Record<string, unknown>;

export interface BuildDiscoveryReportViewModelInput {
  readonly reportId: string;
  readonly deliveryLevel: DeliveryLevel;
  readonly folio: string;
  readonly generatedAt: string | Date;
  readonly sessionData: Readonly<Record<string, unknown>>;
  readonly advisor?: ReportViewModel["advisor"];
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

function realContent(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => {
    if (typeof entry !== "string" || entry.trim().length === 0) return false;
    const text = entry.trim();
    return !/^hallazgo\s+\d+$/i.test(text) && text.toUpperCase() !== "N/A";
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()))];
}

function defensibleScore(value: unknown, hasDiagnosticEvidence: boolean): number | undefined {
  return hasDiagnosticEvidence &&
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
    ? value
    : undefined;
}

/** Builds a report exclusively from the requested Discovery session. */
export function buildDiscoveryReportViewModel(
  input: BuildDiscoveryReportViewModelInput,
): ReportViewModel {
  const session = asRecord(input.sessionData);
  const companyName = nonEmptyString(session.companyName);
  const contactName = nonEmptyString(session.contactName);
  if (companyName === undefined || contactName === undefined) {
    throw new Error("DISCOVERY_SESSION_IDENTITY_MISSING");
  }

  const assessment = asRecord(session.businessAssessmentDraft);
  const briefing = asRecord(session.executiveBriefingDraft);
  const radiography = asRecord(session.radiografiaEmpresarialDraft);
  const painPoints = realContent(assessment.painPointsIdentified);
  const processGaps = realContent(assessment.processGaps);
  const diagnosticEvidence = unique([...painPoints, ...processGaps]);
  const keyFindings = unique([
    ...realContent(briefing.keyObservations),
    ...diagnosticEvidence,
  ]);
  const hasDiagnosticEvidence = diagnosticEvidence.length > 0;
  const potentialSavings = nonEmptyString(radiography.potentialSavings);
  const evidenceStatus = hasDiagnosticEvidence ? "SUFFICIENT" : "INSUFFICIENT";

  return {
    reportId: input.reportId,
    status: "GENERATING",
    deliveryLevel: input.deliveryLevel,
    folio: input.folio,
    generatedAt: input.generatedAt,
    companyName,
    contactName,
    ...(input.advisor === undefined ? {} : { advisor: input.advisor }),
    isPreliminary: true,
    diagnosisSource: "LEGACY_FALLBACK",
    evidenceStatus,
    overallStatus:
      evidenceStatus === "INSUFFICIENT"
        ? "Evidencia insuficiente"
        : nonEmptyString(radiography.overallStatus),
    maturityScore: defensibleScore(assessment.score, hasDiagnosticEvidence),
    keyFindings,
    operationalRisks:
      input.deliveryLevel === "ALLOW_FULL" ? diagnosticEvidence : undefined,
    opportunities:
      input.deliveryLevel === "ALLOW_FULL" && potentialSavings !== undefined
        ? [potentialSavings]
        : undefined,
    recommendedModules:
      input.deliveryLevel === "ALLOW_FULL"
        ? [...realContent(radiography.recommendedModules)]
        : undefined,
  };
}
