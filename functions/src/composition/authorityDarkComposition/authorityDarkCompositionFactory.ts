import type { Firestore } from "firebase-admin/firestore";

import {
  FirestoreAuthorityMutationRepository,
} from "../../infrastructure/firestore/authorityPersistence";
import {
  AuthorityDarkCompositionError,
  type AuthorityDarkCompositionErrorCode,
} from "./authorityDarkCompositionErrors";
import {
  isAuthorityDarkCompositionTestCapability,
} from "./authorityDarkCompositionTestCapability";
import {
  AUTHORITY_DARK_COMPOSITION_VERSION,
  type AuthorityDarkCompositionV1,
} from "./authorityDarkCompositionTypes";

const DISABLED_INPUT_KEYS = Object.freeze(["mode"]);
const TEST_ONLY_INPUT_KEYS = Object.freeze([
  "capability",
  "clock",
  "emulatorHost",
  "environmentSnapshot",
  "firestore",
  "mode",
  "projectId",
]);

function fail(
  code: AuthorityDarkCompositionErrorCode,
  message: string,
): never {
  throw new AuthorityDarkCompositionError(code, message);
}

function isRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function assertExactKeys(
  input: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  code: AuthorityDarkCompositionErrorCode,
): void {
  const unexpectedKey = Object.keys(input).find(
    (key) => !allowedKeys.includes(key),
  );
  if (unexpectedKey !== undefined) {
    fail(code, "Authority dark composition input is ambiguous.");
  }
}

function isFirestore(value: unknown): value is Firestore {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof Reflect.get(value, "collection") === "function" &&
    typeof Reflect.get(value, "runTransaction") === "function"
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

function validateEmulatorHost(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail(
      "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_REQUIRED",
      "A loopback Firestore Emulator host is required.",
    );
  }
  const match = /^127\.0\.0\.1:([1-9]\d{0,4})$/.exec(value);
  if (match === null) {
    return fail(
      "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_INVALID",
      "Firestore Emulator host must be an explicit loopback IP and port.",
    );
  }
  const port = Number(match[1]);
  if (!Number.isInteger(port) || port > 65_535) {
    return fail(
      "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_INVALID",
      "Firestore Emulator port is outside the valid range.",
    );
  }
  return value;
}

function validateDemoProject(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail(
      "AUTHORITY_DARK_COMPOSITION_DEMO_PROJECT_REQUIRED",
      "A demo Firestore project ID is required.",
    );
  }
  if (!/^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return fail(
      "AUTHORITY_DARK_COMPOSITION_DEMO_PROJECT_INVALID",
      "Firestore project ID must be an explicit demo project.",
    );
  }
  return value;
}

function assertCredentialFree(
  value: unknown,
): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    fail(
      "AUTHORITY_DARK_COMPOSITION_INVALID_INPUT",
      "Environment snapshot must be a closed record.",
    );
  }
  assertExactKeys(
    value,
    ["GOOGLE_APPLICATION_CREDENTIALS"],
    "AUTHORITY_DARK_COMPOSITION_INVALID_INPUT",
  );
  if (
    Object.prototype.hasOwnProperty.call(
      value,
      "GOOGLE_APPLICATION_CREDENTIALS",
    )
  ) {
    fail(
      "AUTHORITY_DARK_COMPOSITION_CREDENTIALS_FORBIDDEN",
      "Production credentials are forbidden in dark composition.",
    );
  }
}

export function createAuthorityDarkCompositionV1(
  inputValue: unknown,
): AuthorityDarkCompositionV1 {
  if (!isRecord(inputValue)) {
    return fail(
      "AUTHORITY_DARK_COMPOSITION_INVALID_INPUT",
      "Authority dark composition input must be a record.",
    );
  }

  const mode = Reflect.get(inputValue, "mode");
  if (mode === "DISABLED") {
    assertExactKeys(
      inputValue,
      DISABLED_INPUT_KEYS,
      "AUTHORITY_DARK_COMPOSITION_AMBIGUOUS_DISABLED_INPUT",
    );
    return Object.freeze({
      version: AUTHORITY_DARK_COMPOSITION_VERSION,
      mode: "DISABLED",
      status: "INERT",
      repository: null,
    });
  }
  if (mode !== "TEST_ONLY") {
    return fail(
      "AUTHORITY_DARK_COMPOSITION_UNKNOWN_MODE",
      "Authority dark composition mode is not certified.",
    );
  }

  assertExactKeys(
    inputValue,
    TEST_ONLY_INPUT_KEYS,
    "AUTHORITY_DARK_COMPOSITION_INVALID_INPUT",
  );
  const capability = Reflect.get(inputValue, "capability");
  if (!isAuthorityDarkCompositionTestCapability(capability)) {
    return fail(
      "AUTHORITY_DARK_COMPOSITION_TEST_CAPABILITY_REQUIRED",
      "Certified internal test capability is required.",
    );
  }
  const firestore = Reflect.get(inputValue, "firestore");
  if (!isFirestore(firestore)) {
    return fail(
      "AUTHORITY_DARK_COMPOSITION_FIRESTORE_REQUIRED",
      "An injected Firestore Admin instance is required.",
    );
  }
  const clock = Reflect.get(inputValue, "clock");
  if (!isClock(clock)) {
    return fail(
      "AUTHORITY_DARK_COMPOSITION_CLOCK_REQUIRED",
      "An injected authority clock is required.",
    );
  }
  validateEmulatorHost(
    Reflect.get(inputValue, "emulatorHost"),
  );
  validateDemoProject(Reflect.get(inputValue, "projectId"));
  assertCredentialFree(
    Reflect.get(inputValue, "environmentSnapshot"),
  );

  return Object.freeze({
    version: AUTHORITY_DARK_COMPOSITION_VERSION,
    mode: "TEST_ONLY",
    status: "READY_FOR_TEST",
    repository: new FirestoreAuthorityMutationRepository(
      firestore,
      clock,
    ),
  });
}
