import {
  AUTHORITY_REPOSITORY_RESULT_VERSION,
  createAuthorityRepositoryResultV1,
  type AuthorityAdministrativeCommandV1,
  type AuthorityRepositoryResultStatus,
  type AuthorityRepositoryResultV1,
  type AuthorityRetryDisposition,
} from "@aura/intelligence-os/server";

const CANCELLATION_ERROR_MESSAGE =
  "Authority Firestore execution was cancelled.";

export class FirestoreAuthorityCancellationError extends Error {
  readonly code = "AUTHORITY_FIRESTORE_EXECUTION_CANCELLED";

  constructor() {
    super(CANCELLATION_ERROR_MESSAGE);
    this.name = "FirestoreAuthorityCancellationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface SafeErrorMapping {
  readonly status: AuthorityRepositoryResultStatus;
  readonly safeCode: string;
  readonly retryDisposition: AuthorityRetryDisposition;
}

function createSafeResult(
  command: AuthorityAdministrativeCommandV1,
  completedAt: string,
  mapping: SafeErrorMapping,
): AuthorityRepositoryResultV1 {
  return createAuthorityRepositoryResultV1({
    schemaVersion: AUTHORITY_REPOSITORY_RESULT_VERSION,
    operationId: command.operationId,
    correlationId: command.correlationId,
    status: mapping.status,
    safeCode: mapping.safeCode,
    completedAt,
    retryDisposition: mapping.retryDisposition,
  });
}

function readErrorCode(error: unknown): string | number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  try {
    const code = Reflect.get(error, "code");
    return typeof code === "string" || typeof code === "number"
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeErrorCode(error: unknown): string {
  const code = readErrorCode(error);
  if (typeof code === "number") {
    const numericCodes: Readonly<Record<number, string>> = {
      2: "unknown",
      4: "deadline-exceeded",
      5: "not-found",
      6: "already-exists",
      7: "permission-denied",
      9: "failed-precondition",
      10: "aborted",
      13: "internal",
      14: "unavailable",
      16: "unauthenticated",
    };
    return numericCodes[code] ?? "unknown";
  }
  if (code === undefined) {
    return "unknown";
  }
  return code
    .toLowerCase()
    .replace(/^firestore\//, "")
    .replace(/^grpc\//, "");
}

function mappingForError(error: unknown): SafeErrorMapping {
  if (error instanceof FirestoreAuthorityCancellationError) {
    return {
      status: "REJECTED",
      safeCode: "OPERATION_CANCELLED",
      retryDisposition: "DO_NOT_RETRY",
    };
  }
  switch (normalizeErrorCode(error)) {
    case "already-exists":
      return {
        status: "CONFLICT",
        safeCode: "AUTHORITY_FIRESTORE_ALREADY_EXISTS",
        retryDisposition: "RETRY_AFTER_READ",
      };
    case "aborted":
    case "failed-precondition":
      return {
        status: "CONFLICT",
        safeCode: "AUTHORITY_FIRESTORE_TRANSACTION_CONFLICT",
        retryDisposition: "RETRY_AFTER_READ",
      };
    case "not-found":
      return {
        status: "NOT_FOUND",
        safeCode: "AUTHORITY_FIRESTORE_DOCUMENT_NOT_FOUND",
        retryDisposition: "DO_NOT_RETRY",
      };
    case "deadline-exceeded":
    case "unavailable":
      return {
        status: "INTERNAL_ERROR",
        safeCode: "AUTHORITY_FIRESTORE_TEMPORARILY_UNAVAILABLE",
        retryDisposition: "SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY",
      };
    case "permission-denied":
    case "unauthenticated":
      return {
        status: "INTERNAL_ERROR",
        safeCode: "AUTHORITY_FIRESTORE_ACCESS_ERROR",
        retryDisposition: "DO_NOT_RETRY",
      };
    case "internal":
    case "unknown":
      return {
        status: "INTERNAL_ERROR",
        safeCode: "AUTHORITY_REPOSITORY_INTERNAL_ERROR",
        retryDisposition: "SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY",
      };
    default:
      return {
        status: "INTERNAL_ERROR",
        safeCode: "AUTHORITY_REPOSITORY_INTERNAL_ERROR",
        retryDisposition: "SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY",
      };
  }
}

export function createFirestoreAuthorityCancellationResult(
  command: AuthorityAdministrativeCommandV1,
  completedAt: string,
): AuthorityRepositoryResultV1 {
  return createSafeResult(command, completedAt, {
    status: "REJECTED",
    safeCode: "OPERATION_CANCELLED",
    retryDisposition: "DO_NOT_RETRY",
  });
}

export function mapFirestoreAuthorityError(
  error: unknown,
  command: AuthorityAdministrativeCommandV1,
  completedAt: string,
): AuthorityRepositoryResultV1 {
  return createSafeResult(
    command,
    completedAt,
    mappingForError(error),
  );
}
