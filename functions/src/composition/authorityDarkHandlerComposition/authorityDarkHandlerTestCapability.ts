const authorityDarkHandlerCapabilities = new WeakSet<object>();

export const AUTHORITY_DARK_HANDLER_TEST_CAPABILITY_VERSION = "1";

export interface AuthorityDarkHandlerTestCapabilityV1 {
  readonly version:
    typeof AUTHORITY_DARK_HANDLER_TEST_CAPABILITY_VERSION;
  readonly assertInternalTestIntent: () => void;
}

export function createAuthorityDarkHandlerTestCapabilityV1ForInternalTests():
  AuthorityDarkHandlerTestCapabilityV1 {
  const capability = Object.freeze({
    version: AUTHORITY_DARK_HANDLER_TEST_CAPABILITY_VERSION,
    assertInternalTestIntent: (): void => undefined,
  });
  authorityDarkHandlerCapabilities.add(capability);
  return capability;
}

export function isAuthorityDarkHandlerTestCapabilityV1(
  value: unknown,
): value is AuthorityDarkHandlerTestCapabilityV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    authorityDarkHandlerCapabilities.has(value)
  );
}
