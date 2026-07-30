const certifiedCapabilities = new WeakSet<object>();

export interface AuthorityDarkCompositionTestCapability {
  readonly assertInternalTestIntent: () => void;
}

export function createAuthorityDarkCompositionTestCapabilityForInternalTests():
  AuthorityDarkCompositionTestCapability {
  const capability = Object.freeze({
    assertInternalTestIntent: (): void => undefined,
  });
  certifiedCapabilities.add(capability);
  return capability;
}

export function isAuthorityDarkCompositionTestCapability(
  value: unknown,
): value is AuthorityDarkCompositionTestCapability {
  return (
    typeof value === "object" &&
    value !== null &&
    certifiedCapabilities.has(value)
  );
}
