export type AuthorityDarkCompositionErrorCode =
  | "AUTHORITY_DARK_COMPOSITION_INVALID_INPUT"
  | "AUTHORITY_DARK_COMPOSITION_UNKNOWN_MODE"
  | "AUTHORITY_DARK_COMPOSITION_AMBIGUOUS_DISABLED_INPUT"
  | "AUTHORITY_DARK_COMPOSITION_TEST_CAPABILITY_REQUIRED"
  | "AUTHORITY_DARK_COMPOSITION_FIRESTORE_REQUIRED"
  | "AUTHORITY_DARK_COMPOSITION_CLOCK_REQUIRED"
  | "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_REQUIRED"
  | "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_INVALID"
  | "AUTHORITY_DARK_COMPOSITION_DEMO_PROJECT_REQUIRED"
  | "AUTHORITY_DARK_COMPOSITION_DEMO_PROJECT_INVALID"
  | "AUTHORITY_DARK_COMPOSITION_CREDENTIALS_FORBIDDEN";

export class AuthorityDarkCompositionError extends Error {
  readonly code: AuthorityDarkCompositionErrorCode;

  constructor(
    code: AuthorityDarkCompositionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthorityDarkCompositionError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
