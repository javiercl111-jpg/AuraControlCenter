export type AuthorityDarkHandlerCompositionErrorCode =
  | "AUTHORITY_DARK_HANDLER_INVALID_INPUT"
  | "AUTHORITY_DARK_HANDLER_UNKNOWN_MODE"
  | "AUTHORITY_DARK_HANDLER_AMBIGUOUS_DISABLED_INPUT"
  | "AUTHORITY_DARK_HANDLER_TEST_CAPABILITY_REQUIRED"
  | "AUTHORITY_DARK_HANDLER_APPLICATION_SERVICE_REQUIRED"
  | "AUTHORITY_DARK_HANDLER_CLOCK_REQUIRED"
  | "AUTHORITY_DARK_HANDLER_METADATA_INVALID";

export type AuthorityDarkHandlerInvocationErrorCode =
  | "AUTHORITY_DARK_HANDLER_INVOCATION_CAPABILITY_INVALID"
  | "AUTHORITY_DARK_HANDLER_INVOCATION_REQUEST_INVALID"
  | "AUTHORITY_DARK_HANDLER_INVOCATION_CONTEXT_INVALID"
  | "AUTHORITY_DARK_HANDLER_INVOCATION_MODE_FORBIDDEN"
  | "AUTHORITY_DARK_HANDLER_INVOCATION_CANCELLED"
  | "AUTHORITY_DARK_HANDLER_INVOCATION_DEADLINE_EXPIRED"
  | "AUTHORITY_DARK_HANDLER_INVOCATION_CLOCK_INVALID"
  | "AUTHORITY_DARK_HANDLER_INVOCATION_SERVICE_FAILED";

interface SafeAuthorityDarkHandlerErrorV1 {
  readonly version: "1";
  readonly name:
    | "AuthorityDarkHandlerCompositionError"
    | "AuthorityDarkHandlerInvocationError";
  readonly code:
    | AuthorityDarkHandlerCompositionErrorCode
    | AuthorityDarkHandlerInvocationErrorCode;
  readonly message: string;
}

export class AuthorityDarkHandlerCompositionError extends Error {
  readonly code: AuthorityDarkHandlerCompositionErrorCode;

  constructor(code: AuthorityDarkHandlerCompositionErrorCode) {
    super("Authority dark handler composition rejected.");
    this.name = "AuthorityDarkHandlerCompositionError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): SafeAuthorityDarkHandlerErrorV1 {
    return Object.freeze({
      version: "1",
      name: "AuthorityDarkHandlerCompositionError",
      code: this.code,
      message: this.message,
    });
  }
}

export class AuthorityDarkHandlerInvocationError extends Error {
  readonly code: AuthorityDarkHandlerInvocationErrorCode;

  constructor(code: AuthorityDarkHandlerInvocationErrorCode) {
    super("Authority dark handler invocation rejected.");
    this.name = "AuthorityDarkHandlerInvocationError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): SafeAuthorityDarkHandlerErrorV1 {
    return Object.freeze({
      version: "1",
      name: "AuthorityDarkHandlerInvocationError",
      code: this.code,
      message: this.message,
    });
  }
}
