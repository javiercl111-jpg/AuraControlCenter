export const PREVIEW_DISCOVERY_SUBMIT_OBSERVABILITY_SCHEMA_V1 =
  "PREVIEW_DISCOVERY_SUBMIT_OBSERVABILITY_V1" as const;

export const PREVIEW_DISCOVERY_SUBMIT_STAGES_V1 = Object.freeze([
  "DISCOVERY_SUBMIT_CLICK_OBSERVED",
  "DISCOVERY_NATIVE_SUBMIT_OBSERVED",
  "DISCOVERY_REACT_HANDLER_ENTERED",
  "DISCOVERY_VALIDATION_ACCEPTED",
  "DISCOVERY_VALIDATION_REJECTED",
  "DISCOVERY_APP_CHECK_READY",
  "DISCOVERY_APP_CHECK_REJECTED",
  "DISCOVERY_CLIENT_PRECONDITION_ACCEPTED",
  "DISCOVERY_CLIENT_PRECONDITION_REJECTED",
  "DISCOVERY_SERVICE_DISPATCH_STARTED",
  "DISCOVERY_SERVICE_DISPATCH_FAILED_PRE_NETWORK",
  "DISCOVERY_NETWORK_DISPATCH_OBSERVED",
] as const);

export type PreviewDiscoverySubmitStageV1 =
  (typeof PREVIEW_DISCOVERY_SUBMIT_STAGES_V1)[number];

export type PreviewDiscoverySubmitOutcomeV1 =
  | "OBSERVED"
  | "ACCEPTED"
  | "REJECTED"
  | "STARTED"
  | "SUCCEEDED"
  | "FAILED";

export type PreviewDiscoverySubmitDiagnosticEventV1 = Readonly<{
  schemaVersion: typeof PREVIEW_DISCOVERY_SUBMIT_OBSERVABILITY_SCHEMA_V1;
  sequence: number;
  stage: PreviewDiscoverySubmitStageV1;
  outcome: PreviewDiscoverySubmitOutcomeV1;
  timestamp: string;
  safeErrorCode?: string;
  durationMs?: number;
}>;

export type PreviewDiscoverySubmitDiagnosticDetailsV1 = Readonly<{
  safeErrorCode?: string;
  durationMs?: number;
}>;

export type PreviewDiscoverySubmitDiagnosticSinkV1 = (
  event: PreviewDiscoverySubmitDiagnosticEventV1,
) => void;

export interface PreviewDiscoverySubmitObserverV1 {
  readonly enabled: boolean;
  record(
    stage: PreviewDiscoverySubmitStageV1,
    outcome: PreviewDiscoverySubmitOutcomeV1,
    details?: PreviewDiscoverySubmitDiagnosticDetailsV1,
  ): void;
}

type PreviewDiscoverySubmitObserverOptionsV1 = Readonly<{
  environment?: string;
  sink?: PreviewDiscoverySubmitDiagnosticSinkV1;
  now?: () => Date;
}>;

const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;

function defaultSink(event: PreviewDiscoverySubmitDiagnosticEventV1): void {
  console.info("AURA_PREVIEW_DISCOVERY_SUBMIT_DIAGNOSTIC", event);
}

function safeDetails(
  details: PreviewDiscoverySubmitDiagnosticDetailsV1 | undefined,
): PreviewDiscoverySubmitDiagnosticDetailsV1 {
  const safeErrorCode = details?.safeErrorCode;
  const durationMs = details?.durationMs;
  return Object.freeze({
    ...(typeof safeErrorCode === "string" && SAFE_ERROR_CODE.test(safeErrorCode)
      ? { safeErrorCode }
      : safeErrorCode === undefined
        ? {}
        : { safeErrorCode: "UNCLASSIFIED_CLIENT_FAILURE" }),
    ...(typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0
      ? { durationMs: Math.floor(durationMs) }
      : {}),
  });
}

export function createPreviewDiscoverySubmitObserverV1(
  options: PreviewDiscoverySubmitObserverOptionsV1,
): PreviewDiscoverySubmitObserverV1 {
  const enabled = options.environment === "PREVIEW";
  const sink = options.sink ?? defaultSink;
  const now = options.now ?? (() => new Date());
  let sequence = 0;

  return Object.freeze({
    enabled,
    record(
      stage: PreviewDiscoverySubmitStageV1,
      outcome: PreviewDiscoverySubmitOutcomeV1,
      details?: PreviewDiscoverySubmitDiagnosticDetailsV1,
    ) {
      if (!enabled) return;
      const event = Object.freeze({
        schemaVersion: PREVIEW_DISCOVERY_SUBMIT_OBSERVABILITY_SCHEMA_V1,
        sequence: ++sequence,
        stage,
        outcome,
        timestamp: now().toISOString(),
        ...safeDetails(details),
      });
      sink(event);
    },
  });
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>).code;
  return typeof value === "string" ? value.trim() : null;
}

export function didPreviewDiscoveryNetworkDispatchV1(error: unknown): boolean {
  return errorCode(error)?.toLowerCase().startsWith("functions/") === true;
}

export function isPreviewDiscoveryAppCheckFailureV1(error: unknown): boolean {
  const code = errorCode(error)?.toLowerCase() ?? "";
  return code.startsWith("appcheck/") || code.startsWith("app-check/") ||
    code.includes("recaptcha");
}

export function previewDiscoverySafeErrorCodeV1(error: unknown): string {
  const code = errorCode(error);
  if (code) {
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]+/gu, "_")
      .replace(/^_+|_+$/gu, "").slice(0, 64);
    if (normalized.startsWith("FUNCTIONS_")) return normalized;
    if (normalized.startsWith("APPCHECK_") || normalized.startsWith("APP_CHECK_") ||
        normalized.includes("RECAPTCHA")) {
      return "APP_CHECK_PRECONDITION_FAILED";
    }
  }
  if (error instanceof Error && SAFE_ERROR_CODE.test(error.message)) {
    return error.message;
  }
  return "CLIENT_PRECONDITION_FAILED";
}
