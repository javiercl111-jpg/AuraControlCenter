import { EXECUTIVE_DISCOVERY_ADAPTER_VERSION } from "../adapter/DefaultExecutiveDiscoveryAdapter";
import type {
  ExecutiveDiscoveryAdapter,
  ExecutiveDiscoveryEvaluationInput,
} from "../contracts/ExecutiveDiscoveryAdapter";
import {
  EXECUTIVE_DISCOVERY_CAPABILITY_VERSION,
  DiscoveryEvidenceClassification,
  DiscoveryEvidenceSourceType,
  type DiscoveryJsonPrimitive,
  type ExecutiveDiscoveryConsentAssertion,
  type ExecutiveDiscoveryEvidence,
} from "../contracts/ExecutiveDiscoveryApiRequest";
import type { ExecutiveDiagnosis } from "../contracts/ExecutiveDiagnosis";
import {
  ExecutiveDiscoveryTransportError,
  ExecutiveDiscoveryTransportErrorCode,
} from "../contracts/ExecutiveDiscoveryTransportError";
import {
  DISCOVERY_LEGACY_DIAGNOSIS_VERSION,
  compareDiscoveryDiagnoses,
  type DiscoveryDiagnosisComparison,
  type LegacyDiscoveryDiagnosis,
} from "./DiscoveryDiagnosisComparison";
import type { DiscoveryEvaluationFeatureFlags } from "./discoveryEvaluationConfig";

export const DISCOVERY_DEFINITION_VERSION = "legacy-discovery-v1" as const;

export const DiscoveryShadowStatus = {
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;

export type DiscoveryShadowStatus =
  (typeof DiscoveryShadowStatus)[keyof typeof DiscoveryShadowStatus];

export const DiscoveryComparisonStatus = {
  NOT_REQUESTED: "NOT_REQUESTED",
  SKIPPED_DISABLED: "SKIPPED_DISABLED",
  FAILED_TRANSPORT: "FAILED_TRANSPORT",
  FAILED_AUTHENTICATION: "FAILED_AUTHENTICATION",
  FAILED_AUTHORIZATION: "FAILED_AUTHORIZATION",
  FAILED_TIMEOUT: "FAILED_TIMEOUT",
  FAILED_INVALID_RESPONSE: "FAILED_INVALID_RESPONSE",
  COMPLETED: "COMPLETED",
} as const;

export type DiscoveryComparisonStatus =
  (typeof DiscoveryComparisonStatus)[keyof typeof DiscoveryComparisonStatus];

export const DiscoveryShadowAdapterStage = {
  NOT_STARTED: "NOT_STARTED",
  CONFIGURATION: "CONFIGURATION",
  AUTHENTICATION: "AUTHENTICATION",
  TRANSPORT: "TRANSPORT",
  VALIDATION: "VALIDATION",
  COMPARISON: "COMPARISON",
  COMPLETED: "COMPLETED",
  PERSISTENCE: "PERSISTENCE",
} as const;

export type DiscoveryShadowAdapterStage =
  (typeof DiscoveryShadowAdapterStage)[keyof typeof DiscoveryShadowAdapterStage];

export type DiscoveryShadowAuthenticationMode =
  | "DEVELOPMENT_BEARER"
  | "UNCONFIGURED";

interface ShadowExecutionBase {
  readonly correlationId: string;
  readonly durationMs: number;
  readonly adapterStage: DiscoveryShadowAdapterStage;
  readonly endpointConfigured: boolean;
  readonly authenticationMode: DiscoveryShadowAuthenticationMode;
  readonly comparisonStatus: DiscoveryComparisonStatus;
  readonly persisted: boolean;
  readonly httpStatus?: number;
}

interface ShadowExecutionSuccess extends ShadowExecutionBase {
  readonly status: "SUCCEEDED";
}

interface ShadowExecutionFailure extends ShadowExecutionBase {
  readonly status: "FAILED";
  readonly safeErrorCode: string;
}

interface ShadowExecutionSkipped extends ShadowExecutionBase {
  readonly status: "SKIPPED";
}

export type DiscoveryShadowExecution =
  | ShadowExecutionSuccess
  | ShadowExecutionFailure
  | ShadowExecutionSkipped;

export interface DiscoveryShadowMetadata {
  readonly mode: "SHADOW";
  readonly legacyDiagnosisVersion: typeof DISCOVERY_LEGACY_DIAGNOSIS_VERSION;
  readonly comparison: DiscoveryDiagnosisComparison | null;
  readonly comparisonStatus: DiscoveryComparisonStatus;
  readonly featureFlags: Readonly<DiscoveryEvaluationFeatureFlags>;
}

export interface DiscoveryShadowPersistenceRecord {
  readonly shadowStatus: DiscoveryShadowStatus;
  readonly shadowDiagnosis: ExecutiveDiagnosis | null;
  readonly shadowMetadata: DiscoveryShadowMetadata;
  readonly shadowExecution: DiscoveryShadowExecution;
  readonly shadowTimestamp: string;
  readonly adapterVersion: typeof EXECUTIVE_DISCOVERY_ADAPTER_VERSION;
  readonly capabilityVersion: typeof EXECUTIVE_DISCOVERY_CAPABILITY_VERSION;
  readonly shadowErrorCode?: string;
  readonly shadowSafeErrorCode?: string;
}

export interface DiscoveryShadowEvaluationContext {
  readonly sessionId: string;
  readonly linkId: string;
  readonly tenantId?: string;
  readonly organizationId?: string;
  readonly companyId?: string;
  readonly locale?: string;
  readonly trustDecision?: string;
  readonly capturedAt: string;
  readonly session: Readonly<Record<string, unknown>>;
  readonly consents?: unknown;
  readonly legacyDiagnosis: LegacyDiscoveryDiagnosis;
}

export interface DiscoveryShadowPersistence {
  readonly persist: (
    record: DiscoveryShadowPersistenceRecord,
  ) => Promise<void>;
}

export interface DiscoveryShadowSafeLog {
  readonly correlationId: string;
  readonly durationMs: number;
  readonly status: DiscoveryShadowStatus;
  readonly capabilityVersion: typeof EXECUTIVE_DISCOVERY_CAPABILITY_VERSION;
  readonly adapterVersion: typeof EXECUTIVE_DISCOVERY_ADAPTER_VERSION;
  readonly safeErrorCode?: string;
  readonly adapterStage: DiscoveryShadowAdapterStage;
  readonly httpStatus?: number;
  readonly endpointConfigured: boolean;
  readonly authenticationMode: DiscoveryShadowAuthenticationMode;
  readonly comparisonStatus: DiscoveryComparisonStatus;
  readonly persisted: boolean;
}

export interface DiscoveryShadowLogger {
  readonly log: (entry: DiscoveryShadowSafeLog) => void;
}

export interface DiscoveryShadowClock {
  readonly now: () => Date;
}

export interface RunDiscoveryShadowEvaluationOptions {
  readonly context: DiscoveryShadowEvaluationContext;
  readonly correlationId: string;
  readonly flags: DiscoveryEvaluationFeatureFlags;
  readonly endpointConfigured: boolean;
  readonly authenticationMode: DiscoveryShadowAuthenticationMode;
  readonly adapterFactory: () => ExecutiveDiscoveryAdapter;
  readonly persistence: DiscoveryShadowPersistence;
  readonly logger: DiscoveryShadowLogger;
  readonly clock?: DiscoveryShadowClock;
}

export interface DiscoveryShadowEvaluationOutcome {
  readonly status: DiscoveryShadowStatus;
  readonly errorCode?: string;
  readonly safeErrorCode?: string;
  readonly comparisonStatus: DiscoveryComparisonStatus;
  readonly persisted: boolean;
}

type UnknownRecord = Record<string, unknown>;

const systemClock: DiscoveryShadowClock = {
  now: () => new Date(),
};

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

function isoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function jsonPrimitive(value: unknown): DiscoveryJsonPrimitive | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function buildEvidence(
  context: DiscoveryShadowEvaluationContext,
): readonly ExecutiveDiscoveryEvidence[] {
  const dossier = asRecord(context.session.dossier);
  const assessment = asRecord(context.session.businessAssessmentDraft);
  const capturedAt = isoTimestamp(context.capturedAt, new Date().toISOString());
  const evidence: ExecutiveDiscoveryEvidence[] = [];

  const appendEvidence = (
    fieldId: string,
    value: unknown,
    classification: DiscoveryEvidenceClassification,
  ): void => {
    const primitive = jsonPrimitive(value);
    if (primitive === undefined) return;
    const evidenceId = `legacy-${fieldId}`;
    evidence.push({
      evidenceId,
      sourceType:
        classification === DiscoveryEvidenceClassification.USER_CONFIRMED
          ? DiscoveryEvidenceSourceType.STRUCTURED_FIELD
          : DiscoveryEvidenceSourceType.SYSTEM_OBSERVATION,
      sourceReference: `discovery_sessions/${context.sessionId}#${fieldId}`,
      fieldId,
      value: primitive,
      capturedAt,
      classification,
      consentScope: "executive-diagnosis",
      confidence:
        classification === DiscoveryEvidenceClassification.USER_CONFIRMED
          ? 1
          : 0.8,
    });
  };

  appendEvidence(
    "dossier.industry",
    dossier.industry,
    DiscoveryEvidenceClassification.USER_CONFIRMED,
  );
  appendEvidence(
    "dossier.employees",
    dossier.employees,
    DiscoveryEvidenceClassification.USER_CONFIRMED,
  );
  appendEvidence(
    "dossier.schedulingMethod",
    dossier.schedulingMethod,
    DiscoveryEvidenceClassification.USER_CONFIRMED,
  );
  appendEvidence(
    "dossier.payrollIncidents",
    dossier.payrollIncidents,
    DiscoveryEvidenceClassification.USER_CONFIRMED,
  );
  appendEvidence(
    "dossier.priority",
    dossier.priority,
    DiscoveryEvidenceClassification.USER_CONFIRMED,
  );
  appendEvidence(
    "businessAssessmentDraft.score",
    assessment.score,
    DiscoveryEvidenceClassification.SYSTEM_OBSERVED,
  );

  if (evidence.length === 0) {
    appendEvidence(
      "discovery.status",
      "COMPLETED",
      DiscoveryEvidenceClassification.SYSTEM_OBSERVED,
    );
  }

  return evidence;
}

function buildConsentAssertion(
  context: DiscoveryShadowEvaluationContext,
): ExecutiveDiscoveryConsentAssertion {
  const consents = asRecord(context.consents);
  const privacy = asRecord(consents.privacy);
  const diagnosticDelivery = asRecord(consents.diagnosticDelivery);
  const marketing = asRecord(consents.marketing);
  const capturedAt = isoTimestamp(
    privacy.capturedAt ?? diagnosticDelivery.capturedAt,
    isoTimestamp(context.capturedAt, new Date().toISOString()),
  );

  return {
    receiptId: `discovery-consent:${context.linkId}`,
    privacyConsent: privacy.value === true,
    diagnosticProcessingConsent: diagnosticDelivery.value === true,
    marketingConsent: marketing.value === true,
    consentVersion:
      nonEmptyString(privacy.policyVersion) ??
      nonEmptyString(diagnosticDelivery.policyVersion) ??
      "legacy-v1",
    capturedAt,
  };
}

export function buildExecutiveDiscoveryEvaluationInput(
  context: DiscoveryShadowEvaluationContext,
  correlationId: string,
): ExecutiveDiscoveryEvaluationInput {
  const tenantId = nonEmptyString(context.tenantId) ?? "aura_root";
  const organizationId =
    nonEmptyString(context.organizationId) ?? tenantId;
  const companyId =
    nonEmptyString(context.companyId) ?? `discovery-link:${context.linkId}`;

  return {
    requestId: `${correlationId}:request`,
    correlationId,
    idempotencyKey: `discovery-shadow:${context.sessionId}:${EXECUTIVE_DISCOVERY_CAPABILITY_VERSION}`,
    organizationId,
    tenantId,
    companyId,
    sessionId: context.sessionId,
    discoveryDefinitionVersion: DISCOVERY_DEFINITION_VERSION,
    locale: nonEmptyString(context.locale) ?? "es-MX",
    evidence: buildEvidence(context),
    consentAssertion: buildConsentAssertion(context),
    metadata: {
      source: "completeDiscoverySession",
      evaluationMode: "SHADOW",
      legacyDiagnosisVersion: DISCOVERY_LEGACY_DIAGNOSIS_VERSION,
      ...(nonEmptyString(context.trustDecision) === undefined
        ? {}
        : { trustDecision: nonEmptyString(context.trustDecision) as string }),
    },
  };
}

function durationMs(startedAt: Date, completedAt: Date): number {
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

function safeErrorCode(error: unknown): string {
  if (error instanceof ExecutiveDiscoveryTransportError) return error.code;
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { readonly code?: unknown }).code;
    if (typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)) {
      return code;
    }
  }
  return "SHADOW_EVALUATION_FAILED";
}

function metadata(
  flags: DiscoveryEvaluationFeatureFlags,
  comparison: DiscoveryDiagnosisComparison | null,
  comparisonStatus: DiscoveryComparisonStatus,
): DiscoveryShadowMetadata {
  return {
    mode: "SHADOW",
    legacyDiagnosisVersion: DISCOVERY_LEGACY_DIAGNOSIS_VERSION,
    comparison,
    comparisonStatus,
    featureFlags: flags,
  };
}

function safeLog(
  logger: DiscoveryShadowLogger,
  execution: DiscoveryShadowExecution,
): void {
  try {
    logger.log({
      correlationId: execution.correlationId,
      durationMs: execution.durationMs,
      status: execution.status,
      capabilityVersion: EXECUTIVE_DISCOVERY_CAPABILITY_VERSION,
      adapterVersion: EXECUTIVE_DISCOVERY_ADAPTER_VERSION,
      adapterStage: execution.adapterStage,
      endpointConfigured: execution.endpointConfigured,
      authenticationMode: execution.authenticationMode,
      comparisonStatus: execution.comparisonStatus,
      persisted: execution.persisted,
      ...(execution.httpStatus === undefined
        ? {}
        : { httpStatus: execution.httpStatus }),
      ...(execution.status === DiscoveryShadowStatus.FAILED
        ? { safeErrorCode: execution.safeErrorCode }
        : {}),
    });
  } catch {
    return;
  }
}

interface FailureClassification {
  readonly adapterStage: DiscoveryShadowAdapterStage;
  readonly comparisonStatus: DiscoveryComparisonStatus;
  readonly httpStatus?: number;
}

function classifyFailure(
  error: unknown,
  currentStage: DiscoveryShadowAdapterStage,
): FailureClassification {
  if (!(error instanceof ExecutiveDiscoveryTransportError)) {
    return {
      adapterStage: currentStage,
      comparisonStatus:
        currentStage === DiscoveryShadowAdapterStage.COMPARISON
          ? DiscoveryComparisonStatus.FAILED_INVALID_RESPONSE
          : DiscoveryComparisonStatus.FAILED_TRANSPORT,
    };
  }

  const withHttpStatus =
    error.httpStatus === undefined ? {} : { httpStatus: error.httpStatus };
  switch (error.code) {
    case ExecutiveDiscoveryTransportErrorCode.ENDPOINT_NOT_CONFIGURED:
      return {
        adapterStage: DiscoveryShadowAdapterStage.CONFIGURATION,
        comparisonStatus: DiscoveryComparisonStatus.NOT_REQUESTED,
        ...withHttpStatus,
      };
    case ExecutiveDiscoveryTransportErrorCode.AUTHENTICATION_REQUIRED:
      return {
        adapterStage: DiscoveryShadowAdapterStage.AUTHENTICATION,
        comparisonStatus: DiscoveryComparisonStatus.FAILED_AUTHENTICATION,
        ...withHttpStatus,
      };
    case ExecutiveDiscoveryTransportErrorCode.ACCESS_FORBIDDEN:
      return {
        adapterStage: DiscoveryShadowAdapterStage.TRANSPORT,
        comparisonStatus: DiscoveryComparisonStatus.FAILED_AUTHORIZATION,
        ...withHttpStatus,
      };
    case ExecutiveDiscoveryTransportErrorCode.TIMEOUT:
      return {
        adapterStage: DiscoveryShadowAdapterStage.TRANSPORT,
        comparisonStatus: DiscoveryComparisonStatus.FAILED_TIMEOUT,
        ...withHttpStatus,
      };
    case ExecutiveDiscoveryTransportErrorCode.INVALID_RESPONSE:
    case ExecutiveDiscoveryTransportErrorCode.INVALID_DIAGNOSIS:
      return {
        adapterStage: DiscoveryShadowAdapterStage.VALIDATION,
        comparisonStatus: DiscoveryComparisonStatus.FAILED_INVALID_RESPONSE,
        ...withHttpStatus,
      };
    default:
      return {
        adapterStage: DiscoveryShadowAdapterStage.TRANSPORT,
        comparisonStatus: DiscoveryComparisonStatus.FAILED_TRANSPORT,
        ...withHttpStatus,
      };
  }
}

async function persistWithoutBreakingLegacy(
  persistence: DiscoveryShadowPersistence,
  logger: DiscoveryShadowLogger,
  record: DiscoveryShadowPersistenceRecord,
  startedAt: Date,
  clock: DiscoveryShadowClock,
): Promise<DiscoveryShadowEvaluationOutcome> {
  try {
    await persistence.persist(record);
    safeLog(logger, record.shadowExecution);
    return record.shadowExecution.status === DiscoveryShadowStatus.FAILED
      ? {
          status: record.shadowExecution.status,
          errorCode: record.shadowExecution.safeErrorCode,
          safeErrorCode: record.shadowExecution.safeErrorCode,
          comparisonStatus: record.shadowExecution.comparisonStatus,
          persisted: true,
        }
      : {
          status: record.shadowExecution.status,
          comparisonStatus: record.shadowExecution.comparisonStatus,
          persisted: true,
        };
  } catch {
    const execution: ShadowExecutionFailure = {
      status: DiscoveryShadowStatus.FAILED,
      correlationId: record.shadowExecution.correlationId,
      durationMs: durationMs(startedAt, clock.now()),
      safeErrorCode: "SHADOW_PERSISTENCE_FAILED",
      adapterStage: DiscoveryShadowAdapterStage.PERSISTENCE,
      endpointConfigured: record.shadowExecution.endpointConfigured,
      authenticationMode: record.shadowExecution.authenticationMode,
      comparisonStatus: record.shadowExecution.comparisonStatus,
      persisted: false,
      ...(record.shadowExecution.httpStatus === undefined
        ? {}
        : { httpStatus: record.shadowExecution.httpStatus }),
    };
    safeLog(logger, execution);
    return {
      status: execution.status,
      errorCode: execution.safeErrorCode,
      safeErrorCode: execution.safeErrorCode,
      comparisonStatus: execution.comparisonStatus,
      persisted: false,
    };
  }
}

/** Runs after the legacy transaction and never rejects into the legacy response path. */
export async function runDiscoveryShadowEvaluation(
  options: RunDiscoveryShadowEvaluationOptions,
): Promise<DiscoveryShadowEvaluationOutcome> {
  const clock = options.clock ?? systemClock;
  const startedAt = clock.now();

  if (!options.flags.shadowEvaluation) {
    const completedAt = clock.now();
    const execution: ShadowExecutionSkipped = {
      status: DiscoveryShadowStatus.SKIPPED,
      correlationId: options.correlationId,
      durationMs: durationMs(startedAt, completedAt),
      adapterStage: DiscoveryShadowAdapterStage.NOT_STARTED,
      endpointConfigured: options.endpointConfigured,
      authenticationMode: options.authenticationMode,
      comparisonStatus: DiscoveryComparisonStatus.SKIPPED_DISABLED,
      persisted: true,
    };
    return persistWithoutBreakingLegacy(
      options.persistence,
      options.logger,
      {
        shadowStatus: execution.status,
        shadowDiagnosis: null,
        shadowMetadata: metadata(
          options.flags,
          null,
          DiscoveryComparisonStatus.SKIPPED_DISABLED,
        ),
        shadowExecution: execution,
        shadowTimestamp: completedAt.toISOString(),
        adapterVersion: EXECUTIVE_DISCOVERY_ADAPTER_VERSION,
        capabilityVersion: EXECUTIVE_DISCOVERY_CAPABILITY_VERSION,
      },
      startedAt,
      clock,
    );
  }

  if (!options.endpointConfigured) {
    const completedAt = clock.now();
    const execution: ShadowExecutionFailure = {
      status: DiscoveryShadowStatus.FAILED,
      correlationId: options.correlationId,
      durationMs: durationMs(startedAt, completedAt),
      safeErrorCode: ExecutiveDiscoveryTransportErrorCode.ENDPOINT_NOT_CONFIGURED,
      adapterStage: DiscoveryShadowAdapterStage.CONFIGURATION,
      endpointConfigured: false,
      authenticationMode: options.authenticationMode,
      comparisonStatus: DiscoveryComparisonStatus.NOT_REQUESTED,
      persisted: true,
    };
    return persistWithoutBreakingLegacy(
      options.persistence,
      options.logger,
      {
        shadowStatus: execution.status,
        shadowDiagnosis: null,
        shadowMetadata: metadata(
          options.flags,
          null,
          DiscoveryComparisonStatus.NOT_REQUESTED,
        ),
        shadowExecution: execution,
        shadowTimestamp: completedAt.toISOString(),
        adapterVersion: EXECUTIVE_DISCOVERY_ADAPTER_VERSION,
        capabilityVersion: EXECUTIVE_DISCOVERY_CAPABILITY_VERSION,
        shadowErrorCode: execution.safeErrorCode,
        shadowSafeErrorCode: execution.safeErrorCode,
      },
      startedAt,
      clock,
    );
  }

  let record: DiscoveryShadowPersistenceRecord;
  let currentStage: DiscoveryShadowAdapterStage =
    DiscoveryShadowAdapterStage.TRANSPORT;
  try {
    const adapter = options.adapterFactory();
    const request = buildExecutiveDiscoveryEvaluationInput(
      options.context,
      options.correlationId,
    );
    const diagnosis = await adapter.evaluate(request);
    currentStage = DiscoveryShadowAdapterStage.COMPARISON;
    const comparison = compareDiscoveryDiagnoses(
      options.context.legacyDiagnosis,
      diagnosis,
    );
    const completedAt = clock.now();
    const execution: ShadowExecutionSuccess = {
      status: DiscoveryShadowStatus.SUCCEEDED,
      correlationId: options.correlationId,
      durationMs: durationMs(startedAt, completedAt),
      adapterStage: DiscoveryShadowAdapterStage.COMPLETED,
      endpointConfigured: options.endpointConfigured,
      authenticationMode: options.authenticationMode,
      comparisonStatus: DiscoveryComparisonStatus.COMPLETED,
      persisted: true,
    };
    record = {
      shadowStatus: execution.status,
      shadowDiagnosis: diagnosis,
      shadowMetadata: metadata(
        options.flags,
        comparison,
        DiscoveryComparisonStatus.COMPLETED,
      ),
      shadowExecution: execution,
      shadowTimestamp: completedAt.toISOString(),
      adapterVersion: EXECUTIVE_DISCOVERY_ADAPTER_VERSION,
      capabilityVersion: EXECUTIVE_DISCOVERY_CAPABILITY_VERSION,
    };
  } catch (error: unknown) {
    const completedAt = clock.now();
    const errorCode = safeErrorCode(error);
    const classification = classifyFailure(error, currentStage);
    const execution: ShadowExecutionFailure = {
      status: DiscoveryShadowStatus.FAILED,
      correlationId: options.correlationId,
      durationMs: durationMs(startedAt, completedAt),
      safeErrorCode: errorCode,
      adapterStage: classification.adapterStage,
      endpointConfigured: options.endpointConfigured,
      authenticationMode: options.authenticationMode,
      comparisonStatus: classification.comparisonStatus,
      persisted: true,
      ...(classification.httpStatus === undefined
        ? {}
        : { httpStatus: classification.httpStatus }),
    };
    record = {
      shadowStatus: execution.status,
      shadowDiagnosis: null,
      shadowMetadata: metadata(
        options.flags,
        null,
        classification.comparisonStatus,
      ),
      shadowExecution: execution,
      shadowTimestamp: completedAt.toISOString(),
      adapterVersion: EXECUTIVE_DISCOVERY_ADAPTER_VERSION,
      capabilityVersion: EXECUTIVE_DISCOVERY_CAPABILITY_VERSION,
      shadowErrorCode: errorCode,
      shadowSafeErrorCode: errorCode,
    };
  }

  return persistWithoutBreakingLegacy(
    options.persistence,
    options.logger,
    record,
    startedAt,
    clock,
  );
}
