import {
  validateAuthorityApplicationExecutionContextV1,
  validateAuthorityApplicationServiceRequestV1,
  validateAuthorityClockOutputV1,
  type AuthorityApplicationExecutionContextV1,
  type AuthorityApplicationServiceRequestV1,
  type AuthorityApplicationServiceV1,
} from "@aura/intelligence-os/server";

import {
  AuthorityDarkHandlerCompositionError,
  AuthorityDarkHandlerInvocationError,
  type AuthorityDarkHandlerCompositionErrorCode,
  type AuthorityDarkHandlerInvocationErrorCode,
} from "./authorityDarkHandlerCompositionErrors";
import {
  isAuthorityDarkHandlerTestCapabilityV1,
  type AuthorityDarkHandlerTestCapabilityV1,
} from "./authorityDarkHandlerTestCapability";
import {
  AUTHORITY_DARK_HANDLER_COMPOSITION_METADATA_VERSION,
  AUTHORITY_DARK_HANDLER_COMPOSITION_VERSION,
  type AuthorityDarkHandlerCompositionMetadataV1,
  type AuthorityDarkHandlerCompositionV1,
} from "./authorityDarkHandlerCompositionTypes";

const DISABLED_INPUT_KEYS = Object.freeze(["mode"]);
const TEST_ONLY_INPUT_KEYS = Object.freeze([
  "applicationService",
  "capability",
  "clock",
  "metadata",
  "mode",
]);
const METADATA_KEYS = Object.freeze([
  "compositionId",
  "purpose",
  "schemaVersion",
]);

function compositionFail(
  code: AuthorityDarkHandlerCompositionErrorCode,
): never {
  throw new AuthorityDarkHandlerCompositionError(code);
}

function invocationFail(
  code: AuthorityDarkHandlerInvocationErrorCode,
): never {
  throw new AuthorityDarkHandlerInvocationError(code);
}

function isRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function hasExactKeys(
  input: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
): boolean {
  const keys = Object.keys(input);
  return (
    keys.length === allowedKeys.length &&
    keys.every((key) => allowedKeys.includes(key))
  );
}

function isApplicationService(
  value: unknown,
): value is AuthorityApplicationServiceV1 {
  return (
    isRecord(value) &&
    Reflect.get(value, "version") === "1" &&
    typeof Reflect.get(value, "execute") === "function"
  );
}

function isClock(
  value: unknown,
): value is Readonly<{ nowIso(): string }> {
  return (
    isRecord(value) &&
    typeof Reflect.get(value, "nowIso") === "function"
  );
}

function validateMetadata(
  value: unknown,
): AuthorityDarkHandlerCompositionMetadataV1 {
  if (!isRecord(value) || !hasExactKeys(value, METADATA_KEYS)) {
    return compositionFail(
      "AUTHORITY_DARK_HANDLER_METADATA_INVALID",
    );
  }
  const compositionId = Reflect.get(value, "compositionId");
  if (
    Reflect.get(value, "schemaVersion") !==
      AUTHORITY_DARK_HANDLER_COMPOSITION_METADATA_VERSION ||
    Reflect.get(value, "purpose") !==
      "AUTHORITY_DARK_HANDLER_TEST" ||
    typeof compositionId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(compositionId)
  ) {
    return compositionFail(
      "AUTHORITY_DARK_HANDLER_METADATA_INVALID",
    );
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_DARK_HANDLER_COMPOSITION_METADATA_VERSION,
    compositionId,
    purpose: "AUTHORITY_DARK_HANDLER_TEST",
  });
}

function assertValidRequest(value: unknown): void {
  try {
    validateAuthorityApplicationServiceRequestV1(value);
  } catch {
    invocationFail(
      "AUTHORITY_DARK_HANDLER_INVOCATION_REQUEST_INVALID",
    );
  }
}

function assertValidContext(value: unknown): void {
  try {
    validateAuthorityApplicationExecutionContextV1(value);
  } catch {
    invocationFail(
      "AUTHORITY_DARK_HANDLER_INVOCATION_CONTEXT_INVALID",
    );
  }
}

function readClock(clock: Readonly<{ nowIso(): string }>): string {
  try {
    return validateAuthorityClockOutputV1(clock.nowIso());
  } catch {
    return invocationFail(
      "AUTHORITY_DARK_HANDLER_INVOCATION_CLOCK_INVALID",
    );
  }
}

function isCancelled(
  context: AuthorityApplicationExecutionContextV1,
): boolean {
  return context.cancellationSignal?.aborted === true;
}

export function createAuthorityDarkHandlerCompositionV1(
  inputValue: unknown,
): AuthorityDarkHandlerCompositionV1 {
  if (!isRecord(inputValue)) {
    return compositionFail("AUTHORITY_DARK_HANDLER_INVALID_INPUT");
  }

  const mode = Reflect.get(inputValue, "mode");
  if (mode === "DISABLED") {
    if (!hasExactKeys(inputValue, DISABLED_INPUT_KEYS)) {
      return compositionFail(
        "AUTHORITY_DARK_HANDLER_AMBIGUOUS_DISABLED_INPUT",
      );
    }
    return Object.freeze({
      version: AUTHORITY_DARK_HANDLER_COMPOSITION_VERSION,
      mode: "DISABLED",
      status: "INERT",
    });
  }
  if (mode !== "TEST_ONLY") {
    return compositionFail("AUTHORITY_DARK_HANDLER_UNKNOWN_MODE");
  }
  if (!hasExactKeys(inputValue, TEST_ONLY_INPUT_KEYS)) {
    return compositionFail("AUTHORITY_DARK_HANDLER_INVALID_INPUT");
  }

  const configuredCapability = Reflect.get(inputValue, "capability");
  if (!isAuthorityDarkHandlerTestCapabilityV1(configuredCapability)) {
    return compositionFail(
      "AUTHORITY_DARK_HANDLER_TEST_CAPABILITY_REQUIRED",
    );
  }
  const applicationService = Reflect.get(
    inputValue,
    "applicationService",
  );
  if (!isApplicationService(applicationService)) {
    return compositionFail(
      "AUTHORITY_DARK_HANDLER_APPLICATION_SERVICE_REQUIRED",
    );
  }
  const clock = Reflect.get(inputValue, "clock");
  if (!isClock(clock)) {
    return compositionFail("AUTHORITY_DARK_HANDLER_CLOCK_REQUIRED");
  }
  const metadata = validateMetadata(Reflect.get(inputValue, "metadata"));

  const invocation = Object.freeze({
    async invokeTestOnly(
      request: AuthorityApplicationServiceRequestV1,
      context: AuthorityApplicationExecutionContextV1,
      capability: AuthorityDarkHandlerTestCapabilityV1,
    ) {
      if (
        !isAuthorityDarkHandlerTestCapabilityV1(capability) ||
        capability !== configuredCapability
      ) {
        return invocationFail(
          "AUTHORITY_DARK_HANDLER_INVOCATION_CAPABILITY_INVALID",
        );
      }
      assertValidRequest(request);
      assertValidContext(context);
      if (context.executionMode !== "TEST_ONLY") {
        return invocationFail(
          "AUTHORITY_DARK_HANDLER_INVOCATION_MODE_FORBIDDEN",
        );
      }
      if (isCancelled(context)) {
        return invocationFail(
          "AUTHORITY_DARK_HANDLER_INVOCATION_CANCELLED",
        );
      }
      const invokedAt = readClock(clock);
      if (
        context.deadlineAt !== undefined &&
        context.deadlineAt <= invokedAt
      ) {
        return invocationFail(
          "AUTHORITY_DARK_HANDLER_INVOCATION_DEADLINE_EXPIRED",
        );
      }
      if (isCancelled(context)) {
        return invocationFail(
          "AUTHORITY_DARK_HANDLER_INVOCATION_CANCELLED",
        );
      }
      try {
        return await applicationService.execute(request, context);
      } catch {
        return invocationFail(
          "AUTHORITY_DARK_HANDLER_INVOCATION_SERVICE_FAILED",
        );
      }
    },
  });

  return Object.freeze({
    version: AUTHORITY_DARK_HANDLER_COMPOSITION_VERSION,
    mode: "TEST_ONLY",
    status: "READY_FOR_TEST",
    metadata,
    invocation,
  });
}
