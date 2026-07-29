import { describe, expect, it } from 'vitest';
import {
  createTrustedResourceScopeV1,
  createTrustedServerPrincipalV1,
} from '../../serverComposition/factories';
import {
  TRUSTED_RESOLVER_INPUT_VERSION,
  TRUSTED_SERVER_PRINCIPAL_VERSION,
} from '../../serverComposition/types';
import {
  VerifiedIdentityTenantBindingContractError,
} from '../errors';
import {
  assertUniqueTenantMembershipRecordsV1,
  createCanonicalTenantAuthorityV1,
  createCanonicalTenantMembershipKeyV1,
  createIdentityClaimsProjectionV1,
  createPrincipalResolutionInputV1,
  createPrincipalResolutionResultV1,
  createServerOwnedTenantMembershipRecordV1,
  createTenantMembershipResolutionInputV1,
  createTenantMembershipResolutionResultV1,
  createTenantSelectorHintV1,
  createTrustedServerPrincipalFromVerifiedBindingV1,
  createTrustedTenantMembershipFromAuthorityV1,
  createVerifiedAuthenticationSubjectV1,
  createVerifiedServiceIdentityBindingV1,
  createVerifiedSystemIdentityBindingV1,
  createVerifiedUserIdentityBindingV1,
  deriveBoundaryActorFromTrustedPrincipalV1,
  requireExplicitTenantSelectorV1,
} from '../factories';
import {
  IDENTITY_CLAIMS_PROJECTION_VERSION,
  IDENTITY_RESOLUTION_CONTRACT_VERSION,
  SERVER_OWNED_TENANT_MEMBERSHIP_VERSION,
  TENANT_SELECTOR_HINT_VERSION,
  VERIFIED_AUTHENTICATION_SUBJECT_VERSION,
  VERIFIED_IDENTITY_TENANT_BINDING_SCHEMA_VERSION,
  type CanonicalTenantAuthorityV1,
  type ServerOwnedTenantMembershipRecordV1,
  type TenantSelectorHintV1,
  type VerifiedAuthenticationSubjectV1,
  type VerifiedServiceIdentityBindingV1,
  type VerifiedSystemIdentityBindingV1,
  type VerifiedUserIdentityBindingV1,
} from '../types';

const AUTHENTICATED_AT = '2026-07-29T10:00:00.000Z';
const TOKEN_ISSUED_AT = '2026-07-29T10:01:00.000Z';
const VERIFIED_AT = '2026-07-29T10:02:00.000Z';
const INVOKED_AT = '2026-07-29T10:03:00.000Z';
const TOKEN_EXPIRES_AT = '2026-07-29T11:00:00.000Z';
const CREATED_AT = '2026-07-01T10:00:00.000Z';
const FINGERPRINT = `sha256:${'a'.repeat(64)}`;

function validUserSubject(): VerifiedAuthenticationSubjectV1 {
  return {
    schemaVersion: VERIFIED_AUTHENTICATION_SUBJECT_VERSION,
    subjectType: 'USER',
    provider: 'FIREBASE_AUTH',
    providerSubjectId: 'firebase_uid_123',
    authenticationMethod: 'FIREBASE_ID_TOKEN',
    authenticatedAt: AUTHENTICATED_AT,
    tokenIssuedAt: TOKEN_ISSUED_AT,
    tokenExpiresAt: TOKEN_EXPIRES_AT,
    revocationCheckedAt: VERIFIED_AT,
    credentialVersion: 'firebase-id-token-v1',
    assurance: 'STANDARD',
    claimsFingerprint: FINGERPRINT,
  };
}

function validUserBinding(): VerifiedUserIdentityBindingV1 {
  return {
    schemaVersion: VERIFIED_IDENTITY_TENANT_BINDING_SCHEMA_VERSION,
    bindingVersion: 'user-binding-v1',
    principalType: 'USER',
    provider: 'FIREBASE_AUTH',
    providerSubjectId: 'firebase_uid_123',
    firebaseUid: 'firebase_uid_123',
    canonicalPrincipalId: 'firebase_uid_123',
    bindingId: 'binding_user_123',
    status: 'ACTIVE',
    verifiedAt: VERIFIED_AT,
    resolverVersion: 'identity-resolver-v1',
  };
}

function validServiceSubject(): VerifiedAuthenticationSubjectV1 {
  return {
    schemaVersion: VERIFIED_AUTHENTICATION_SUBJECT_VERSION,
    subjectType: 'SERVICE',
    provider: 'GOOGLE_CLOUD_IAM',
    providerSubjectId: 'projects/aura/serviceAccounts/service_123',
    authenticationMethod: 'OIDC_SERVICE_ACCOUNT',
    authenticatedAt: AUTHENTICATED_AT,
    tokenIssuedAt: TOKEN_ISSUED_AT,
    tokenExpiresAt: TOKEN_EXPIRES_AT,
    revocationCheckedAt: VERIFIED_AT,
    credentialVersion: 'google-oidc-v1',
    assurance: 'WORKLOAD_ATTESTED',
  };
}

function validServiceBinding(): VerifiedServiceIdentityBindingV1 {
  return {
    schemaVersion: VERIFIED_IDENTITY_TENANT_BINDING_SCHEMA_VERSION,
    bindingVersion: 'service-binding-v1',
    principalType: 'SERVICE',
    provider: 'GOOGLE_CLOUD_IAM',
    providerSubjectId: 'projects/aura/serviceAccounts/service_123',
    canonicalPrincipalId: 'service_principal_123',
    bindingId: 'binding_service_123',
    status: 'ACTIVE',
    verifiedAt: VERIFIED_AT,
    resolverVersion: 'identity-resolver-v1',
    iamEvidenceFingerprint: FINGERPRINT,
  };
}

function validSystemSubject(): VerifiedAuthenticationSubjectV1 {
  return {
    schemaVersion: VERIFIED_AUTHENTICATION_SUBJECT_VERSION,
    subjectType: 'SYSTEM',
    provider: 'GOOGLE_CLOUD_IAM',
    providerSubjectId: 'projects/aura/workloadPools/system_123',
    authenticationMethod: 'WORKLOAD_IDENTITY',
    authenticatedAt: AUTHENTICATED_AT,
    tokenIssuedAt: TOKEN_ISSUED_AT,
    tokenExpiresAt: TOKEN_EXPIRES_AT,
    revocationCheckedAt: VERIFIED_AT,
    credentialVersion: 'workload-identity-v1',
    assurance: 'HARDWARE_BACKED',
  };
}

function validSystemBinding(): VerifiedSystemIdentityBindingV1 {
  return {
    schemaVersion: VERIFIED_IDENTITY_TENANT_BINDING_SCHEMA_VERSION,
    bindingVersion: 'system-binding-v1',
    principalType: 'SYSTEM',
    provider: 'GOOGLE_CLOUD_IAM',
    providerSubjectId: 'projects/aura/workloadPools/system_123',
    canonicalPrincipalId: 'system_core_123',
    bindingId: 'binding_system_123',
    status: 'ACTIVE',
    verifiedAt: VERIFIED_AT,
    resolverVersion: 'identity-resolver-v1',
  };
}

function validTenant(): CanonicalTenantAuthorityV1 {
  return {
    schemaVersion: VERIFIED_IDENTITY_TENANT_BINDING_SCHEMA_VERSION,
    tenantId: 'tenantDoc001',
    status: 'ACTIVE',
    authorityVersion: 'tenant-authority-v1',
    resolvedAt: VERIFIED_AT,
    tenantRecordVersion: 'tenant-record-v7',
    tenantSlug: 'tenant-alpha',
    organizationReference: 'organization/org_001',
    clientReference: 'client/client_001',
  };
}

function validMembership(
  overrides: Partial<ServerOwnedTenantMembershipRecordV1> = {},
): ServerOwnedTenantMembershipRecordV1 {
  return {
    schemaVersion: SERVER_OWNED_TENANT_MEMBERSHIP_VERSION,
    membershipId: 'membership_001',
    principalType: 'USER',
    principalId: 'firebase_uid_123',
    tenantId: 'tenantDoc001',
    roles: ['TENANT_MEMBER'],
    status: 'ACTIVE',
    membershipVersion: 'membership-v4',
    createdAt: CREATED_AT,
    updatedAt: VERIFIED_AT,
    authorityVersion: 'membership-authority-v1',
    ...overrides,
  };
}

function validSelector(): TenantSelectorHintV1 {
  return {
    schemaVersion: TENANT_SELECTOR_HINT_VERSION,
    hintClassification: 'NON_AUTHORITATIVE',
    selectionStrategy: 'EXPLICIT_CANONICAL_ID',
    canonicalTenantIdCandidate: 'tenantDoc001',
  };
}

function validUserPrincipal() {
  return createTrustedServerPrincipalFromVerifiedBindingV1({
    subject: validUserSubject(),
    binding: validUserBinding(),
  });
}

function validInvocation() {
  return {
    schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
    invocationId: 'invocation_001',
    invokerType: 'SERVER_COMPONENT' as const,
    invokerId: 'principal_resolver',
    invokedAt: INVOKED_AT,
    resolverVersion: 'principal-resolver-v1',
  };
}

describe('VerifiedAuthenticationSubjectV1', () => {
  it('1 accepts a valid Firebase UID subject', () => {
    const result = createVerifiedAuthenticationSubjectV1(validUserSubject());
    expect(result.providerSubjectId).toBe('firebase_uid_123');
  });

  it('2 rejects email as Firebase identity', () => {
    expect(() =>
      createVerifiedAuthenticationSubjectV1({
        ...validUserSubject(),
        providerSubjectId: 'person@example.com',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('3 rejects an unknown provider', () => {
    expect(() =>
      createVerifiedAuthenticationSubjectV1({
        ...validUserSubject(),
        provider: 'UNKNOWN_PROVIDER',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('4 rejects USER with a service provider', () => {
    expect(() =>
      createVerifiedAuthenticationSubjectV1({
        ...validUserSubject(),
        provider: 'GOOGLE_CLOUD_IAM',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('5 rejects a subject expired at revocation verification', () => {
    expect(() =>
      createVerifiedAuthenticationSubjectV1({
        ...validUserSubject(),
        revocationCheckedAt: TOKEN_EXPIRES_AT,
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('6 rejects a subject without explicit revocation verification', () => {
    const withoutRevocationCheck = { ...validUserSubject() };
    Reflect.deleteProperty(withoutRevocationCheck, 'revocationCheckedAt');
    expect(() =>
      createVerifiedAuthenticationSubjectV1(withoutRevocationCheck),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('7 rejects an incompatible subject contract version', () => {
    expect(() =>
      createVerifiedAuthenticationSubjectV1({
        ...validUserSubject(),
        schemaVersion: '2',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('8 rejects an anonymous subject type', () => {
    expect(() =>
      createVerifiedAuthenticationSubjectV1({
        ...validUserSubject(),
        subjectType: 'ANONYMOUS',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('9 accepts a valid service subject', () => {
    expect(
      createVerifiedAuthenticationSubjectV1(validServiceSubject()).subjectType,
    ).toBe('SERVICE');
  });

  it('10 accepts a valid system subject', () => {
    expect(
      createVerifiedAuthenticationSubjectV1(validSystemSubject()).subjectType,
    ).toBe('SYSTEM');
  });

  it('11 rejects resolution after token expiry', () => {
    expect(() =>
      createPrincipalResolutionInputV1({
        schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
        verifiedSubject: validUserSubject(),
        resolverInvocation: {
          ...validInvocation(),
          invokedAt: TOKEN_EXPIRES_AT,
        },
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });
});

describe('verified identity bindings', () => {
  it('12 accepts a valid user binding', () => {
    expect(
      createVerifiedUserIdentityBindingV1(validUserBinding())
        .canonicalPrincipalId,
    ).toBe('firebase_uid_123');
  });

  it('13 rejects email as canonical user identity', () => {
    expect(() =>
      createVerifiedUserIdentityBindingV1({
        ...validUserBinding(),
        providerSubjectId: 'person@example.com',
        firebaseUid: 'person@example.com',
        canonicalPrincipalId: 'person@example.com',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it.each(['DISABLED', 'DELETED', 'REVOKED'])(
    '14 rejects a %s user binding',
    (status) => {
      expect(() =>
        createVerifiedUserIdentityBindingV1({
          ...validUserBinding(),
          status,
        }),
      ).toThrow(VerifiedIdentityTenantBindingContractError);
    },
  );

  it('15 rejects provider subject and Firebase UID mismatch', () => {
    expect(() =>
      createVerifiedUserIdentityBindingV1({
        ...validUserBinding(),
        firebaseUid: 'firebase_uid_456',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('16 accepts a valid service binding', () => {
    expect(
      createVerifiedServiceIdentityBindingV1(validServiceBinding())
        .principalType,
    ).toBe('SERVICE');
  });

  it('17 rejects isolated service email as provider identity', () => {
    expect(() =>
      createVerifiedServiceIdentityBindingV1({
        ...validServiceBinding(),
        providerSubjectId: 'service@example.com',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('18 rejects the literal system as a canonical principal', () => {
    expect(() =>
      createVerifiedSystemIdentityBindingV1({
        ...validSystemBinding(),
        canonicalPrincipalId: 'system',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('19 accepts a valid system binding', () => {
    expect(
      createVerifiedSystemIdentityBindingV1(validSystemBinding())
        .canonicalPrincipalId,
    ).toBe('system_core_123');
  });

  it('20 rejects unknown binding fields', () => {
    expect(() =>
      createVerifiedServiceIdentityBindingV1({
        ...validServiceBinding(),
        email: 'service@example.com',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('21 rejects a binding for a different authenticated subject', () => {
    expect(() =>
      createTrustedServerPrincipalFromVerifiedBindingV1({
        subject: validServiceSubject(),
        binding: {
          ...validServiceBinding(),
          providerSubjectId: 'projects/aura/serviceAccounts/other_123',
        },
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('22 converts a verified service binding to a trusted principal', () => {
    const principal = createTrustedServerPrincipalFromVerifiedBindingV1({
      subject: validServiceSubject(),
      binding: validServiceBinding(),
    });
    expect(principal).toMatchObject({
      principalType: 'SERVICE',
      principalId: 'service_principal_123',
      provider: 'GOOGLE_CLOUD_IAM',
    });
  });

  it('23 converts a verified system binding to a trusted principal', () => {
    const principal = createTrustedServerPrincipalFromVerifiedBindingV1({
      subject: validSystemSubject(),
      binding: validSystemBinding(),
    });
    expect(principal.principalType).toBe('SYSTEM');
  });
});

describe('canonical tenant authority and selector hints', () => {
  it('24 preserves the canonical tenant document ID exactly', () => {
    expect(createCanonicalTenantAuthorityV1(validTenant()).tenantId).toBe(
      'tenantDoc001',
    );
  });

  it('25 rejects aura_root case-insensitively', () => {
    expect(() =>
      createCanonicalTenantAuthorityV1({
        ...validTenant(),
        tenantId: 'AURA_ROOT',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('26 rejects a slug presented as the canonical tenant ID', () => {
    expect(() =>
      createCanonicalTenantAuthorityV1({
        ...validTenant(),
        tenantId: 'tenant-alpha',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it.each(['SUSPENDED', 'DELETED', 'PENDING'])(
    '27 rejects a %s tenant',
    (status) => {
      expect(() =>
        createCanonicalTenantAuthorityV1({
          ...validTenant(),
          status,
        }),
      ).toThrow(VerifiedIdentityTenantBindingContractError);
    },
  );

  it('28 rejects multiple purported canonical tenant IDs', () => {
    expect(() =>
      createCanonicalTenantAuthorityV1({
        ...validTenant(),
        companyId: 'company_001',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('29 retains organization and client references as derived aliases', () => {
    const tenant = createCanonicalTenantAuthorityV1(validTenant());
    expect(tenant).toMatchObject({
      tenantId: 'tenantDoc001',
      organizationReference: 'organization/org_001',
      clientReference: 'client/client_001',
    });
  });

  it('30 accepts an explicit non-authoritative selector', () => {
    expect(createTenantSelectorHintV1(validSelector()).hintClassification).toBe(
      'NON_AUTHORITATIVE',
    );
  });

  it('31 rejects FIRST_TENANT as an implicit selection strategy', () => {
    expect(() =>
      createTenantSelectorHintV1({
        ...validSelector(),
        selectionStrategy: 'FIRST_TENANT',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('32 rejects a selector with two candidate identities', () => {
    expect(() =>
      createTenantSelectorHintV1({
        ...validSelector(),
        tenantSlugCandidate: 'tenant-alpha',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('33 cannot validate a selector as tenant authority', () => {
    expect(() => createCanonicalTenantAuthorityV1(validSelector())).toThrow(
      VerifiedIdentityTenantBindingContractError,
    );
  });
});

describe('server-owned tenant membership authority', () => {
  it('34 accepts an ACTIVE server-owned membership record', () => {
    expect(
      createServerOwnedTenantMembershipRecordV1(validMembership()).status,
    ).toBe('ACTIVE');
  });

  it('35 rejects SUSPENDED membership conversion to trusted authority', () => {
    expect(() =>
      createTrustedTenantMembershipFromAuthorityV1({
        principal: validUserPrincipal(),
        tenant: validTenant(),
        membership: validMembership({ status: 'SUSPENDED' }),
        resolvedAt: INVOKED_AT,
        resolverVersion: 'membership-resolver-v1',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('36 rejects REVOKED membership conversion to trusted authority', () => {
    expect(() =>
      createTrustedTenantMembershipFromAuthorityV1({
        principal: validUserPrincipal(),
        tenant: validTenant(),
        membership: validMembership({
          status: 'REVOKED',
          revokedAt: VERIFIED_AT,
        }),
        resolvedAt: INVOKED_AT,
        resolverVersion: 'membership-resolver-v1',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('37 rejects a global role for a user', () => {
    expect(() =>
      createServerOwnedTenantMembershipRecordV1({
        ...validMembership(),
        roles: ['GLOBAL_ADMIN'],
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('38 rejects human tenant roles for a system principal', () => {
    expect(() =>
      createServerOwnedTenantMembershipRecordV1({
        ...validMembership(),
        principalType: 'SYSTEM',
        principalId: 'system_core_123',
        roles: ['TENANT_ADMIN'],
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('39 rejects a global role for a service principal', () => {
    expect(() =>
      createServerOwnedTenantMembershipRecordV1({
        ...validMembership(),
        principalType: 'SERVICE',
        principalId: 'service_principal_123',
        roles: ['PLATFORM_ADMIN'],
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('40 rejects membership inconsistent with the trusted principal', () => {
    expect(() =>
      createTrustedTenantMembershipFromAuthorityV1({
        principal: validUserPrincipal(),
        tenant: validTenant(),
        membership: validMembership({ principalId: 'firebase_uid_456' }),
        resolvedAt: INVOKED_AT,
        resolverVersion: 'membership-resolver-v1',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('41 rejects membership inconsistent with the canonical tenant', () => {
    expect(() =>
      createTrustedTenantMembershipFromAuthorityV1({
        principal: validUserPrincipal(),
        tenant: validTenant(),
        membership: validMembership({ tenantId: 'tenantDoc002' }),
        resolvedAt: INVOKED_AT,
        resolverVersion: 'membership-resolver-v1',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('42 detects duplicate logical membership records', () => {
    expect(() =>
      assertUniqueTenantMembershipRecordsV1([
        validMembership(),
        { ...validMembership(), membershipId: 'membership_002' },
      ]),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('43 rejects multitenant membership without an explicit selector', () => {
    expect(() =>
      requireExplicitTenantSelectorV1(undefined, [
        validMembership(),
        validMembership({
          membershipId: 'membership_002',
          tenantId: 'tenantDoc002',
        }),
      ]),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('44 allows candidate processing to continue with a matching selector', () => {
    const result = requireExplicitTenantSelectorV1(validSelector(), [
      validMembership(),
      validMembership({
        membershipId: 'membership_002',
        tenantId: 'tenantDoc002',
      }),
    ]);
    expect(result).toEqual(validSelector());
  });

  it('45 converts only exact ACTIVE authority to trusted membership', () => {
    const membership = createTrustedTenantMembershipFromAuthorityV1({
      principal: validUserPrincipal(),
      tenant: validTenant(),
      membership: validMembership(),
      resolvedAt: INVOKED_AT,
      resolverVersion: 'membership-resolver-v1',
    });
    expect(membership).toMatchObject({
      tenantId: 'tenantDoc001',
      principalId: 'firebase_uid_123',
      status: 'ACTIVE',
    });
  });
});

describe('canonical membership lookup keys', () => {
  it('46 is deterministic', () => {
    const input = {
      principalType: 'USER' as const,
      principalId: 'principal_ab',
      tenantId: 'tenant_c',
    };
    expect(createCanonicalTenantMembershipKeyV1(input)).toBe(
      createCanonicalTenantMembershipKeyV1(input),
    );
  });

  it('47 uses length framing to avoid ambiguous concatenation collisions', () => {
    const first = createCanonicalTenantMembershipKeyV1({
      principalType: 'USER',
      principalId: 'principal_ab',
      tenantId: 'tenant_c',
    });
    const second = createCanonicalTenantMembershipKeyV1({
      principalType: 'USER',
      principalId: 'principal_a',
      tenantId: 'btenant_c',
    });
    expect(first).not.toBe(second);
  });

  it('48 rejects malformed identifiers', () => {
    expect(() =>
      createCanonicalTenantMembershipKeyV1({
        principalType: 'USER',
        principalId: 'person@example.com',
        tenantId: 'tenantDoc001',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });
});

describe('closed, immutable contracts', () => {
  it('49 rejects raw token contract fields', () => {
    expect(() =>
      createVerifiedAuthenticationSubjectV1({
        ...validUserSubject(),
        rawToken: 'secret-token',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('50 rejects raw claims contract fields', () => {
    expect(() =>
      createVerifiedAuthenticationSubjectV1({
        ...validUserSubject(),
        rawClaims: { admin: true },
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('51 rejects accessors instead of evaluating them', () => {
    const value = validUserSubject();
    const subjectWithGetter = Object.defineProperty(
      { ...value },
      'rawToken',
      {
        enumerable: true,
        get: () => 'secret-token',
      },
    );
    expect(() =>
      createVerifiedAuthenticationSubjectV1(subjectWithGetter),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('52 returns frozen subjects', () => {
    expect(
      Object.isFrozen(
        createVerifiedAuthenticationSubjectV1(validUserSubject()),
      ),
    ).toBe(true);
  });

  it('53 returns frozen role arrays', () => {
    const membership =
      createServerOwnedTenantMembershipRecordV1(validMembership());
    expect(Object.isFrozen(membership.roles)).toBe(true);
  });

  it('54 clones caller-owned role arrays', () => {
    const roles = ['TENANT_MEMBER'] as const;
    const membership = createServerOwnedTenantMembershipRecordV1({
      ...validMembership(),
      roles,
    });
    expect(membership.roles).not.toBe(roles);
  });

  it('55 subsequent caller mutation does not alter a contract', () => {
    const roles: string[] = ['TENANT_MEMBER'];
    const membership = createServerOwnedTenantMembershipRecordV1({
      ...validMembership(),
      roles,
    });
    roles[0] = 'TENANT_ADMIN';
    expect(membership.roles).toEqual(['TENANT_MEMBER']);
  });

  it('56 uses a generic error message without authority values', () => {
    try {
      createCanonicalTenantAuthorityV1({
        ...validTenant(),
        tenantId: 'aura_root',
      });
      throw new Error('Expected contract rejection');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(
        VerifiedIdentityTenantBindingContractError,
      );
      expect((error as Error).message).toBe(
        'Verified identity and tenant binding contract is invalid.',
      );
      expect((error as Error).message).not.toContain('aura_root');
    }
  });
});

describe('neutral resolver inputs and closed results', () => {
  it('51 accepts a valid principal resolution input', () => {
    const input = createPrincipalResolutionInputV1({
      schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
      verifiedSubject: validUserSubject(),
      resolverInvocation: validInvocation(),
      authenticationContext: {
        schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
        transport: 'HTTPS_CALLABLE',
        authenticationEventId: 'auth_event_001',
      },
    });
    expect(input.verifiedSubject.subjectType).toBe('USER');
  });

  it('52 accepts a neutral tenant-membership resolution input', () => {
    const input = createTenantMembershipResolutionInputV1({
      schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
      trustedPrincipal: validUserPrincipal(),
      tenantSelector: validSelector(),
      consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
      source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
      resourceScope: createTrustedResourceScopeV1({
        schemaVersion: TRUSTED_RESOLVER_INPUT_VERSION,
        resourceType: 'TENANT_RESOURCE',
        resourceId: 'tenantDoc001',
      }),
      resolverInvocation: validInvocation(),
    });
    expect(input.tenantSelector.hintClassification).toBe('NON_AUTHORITATIVE');
  });

  it('53 validates a resolved principal result', () => {
    const result = createPrincipalResolutionResultV1({
      schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
      status: 'RESOLVED',
      principal: validUserPrincipal(),
      bindingVersion: 'user-binding-v1',
      resolverVersion: 'principal-resolver-v1',
      resolvedAt: INVOKED_AT,
    });
    expect(result.status).toBe('RESOLVED');
  });

  it('54 validates a rejected principal result without raw identity', () => {
    const result = createPrincipalResolutionResultV1({
      schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
      status: 'REJECTED',
      reasonCode: 'SUBJECT_INVALID',
      resolverVersion: 'principal-resolver-v1',
      resolvedAt: INVOKED_AT,
    });
    expect(result).toEqual({
      schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
      status: 'REJECTED',
      reasonCode: 'SUBJECT_INVALID',
      resolverVersion: 'principal-resolver-v1',
      resolvedAt: INVOKED_AT,
    });
  });

  it('55 validates a resolved tenant-membership result', () => {
    const trustedMembership =
      createTrustedTenantMembershipFromAuthorityV1({
        principal: validUserPrincipal(),
        tenant: validTenant(),
        membership: validMembership(),
        resolvedAt: INVOKED_AT,
        resolverVersion: 'membership-resolver-v1',
      });
    const result = createTenantMembershipResolutionResultV1({
      schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
      status: 'RESOLVED',
      tenant: validTenant(),
      membership: trustedMembership,
      membershipVersion: 'membership-v4',
      resolverVersion: 'membership-resolver-v1',
      resolvedAt: INVOKED_AT,
    });
    expect(result.status).toBe('RESOLVED');
  });

  it('56 validates an ambiguous tenant result without candidate values', () => {
    const result = createTenantMembershipResolutionResultV1({
      schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
      status: 'AMBIGUOUS',
      reasonCode: 'TENANT_AMBIGUOUS',
      resolverVersion: 'membership-resolver-v1',
      resolvedAt: INVOKED_AT,
    });
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('candidates');
  });

  it('57 rejects authority fields in a rejected result', () => {
    expect(() =>
      createPrincipalResolutionResultV1({
        schemaVersion: IDENTITY_RESOLUTION_CONTRACT_VERSION,
        status: 'REJECTED',
        reasonCode: 'SUBJECT_INVALID',
        principal: validUserPrincipal(),
        resolverVersion: 'principal-resolver-v1',
        resolvedAt: INVOKED_AT,
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });
});

describe('derived claims projection and actor derivation', () => {
  function validClaimsProjection() {
    return {
      schemaVersion: IDENTITY_CLAIMS_PROJECTION_VERSION,
      classification: 'DERIVED' as const,
      authorityUse: 'PROHIBITED' as const,
      principalType: 'USER' as const,
      canonicalPrincipalId: 'firebase_uid_123',
      projectionVersion: 'claims-projection-v1',
      sourceBindingVersion: 'user-binding-v1',
      issuedAt: VERIFIED_AT,
      expiresAt: TOKEN_EXPIRES_AT,
      claimsFingerprint: FINGERPRINT,
      tenantId: 'tenantDoc001',
      roles: ['TENANT_MEMBER'] as const,
    };
  }

  it('58 explicitly classifies claims as DERIVED', () => {
    expect(
      createIdentityClaimsProjectionV1(validClaimsProjection())
        .classification,
    ).toBe('DERIVED');
  });

  it('59 makes claims projection explicitly expirable', () => {
    expect(
      createIdentityClaimsProjectionV1(validClaimsProjection()).expiresAt,
    ).toBe(TOKEN_EXPIRES_AT);
  });

  it('60 rejects a claims projection without a paired tenant and roles', () => {
    const withoutTenant = { ...validClaimsProjection() };
    Reflect.deleteProperty(withoutTenant, 'tenantId');
    expect(() => createIdentityClaimsProjectionV1(withoutTenant)).toThrow(
      VerifiedIdentityTenantBindingContractError,
    );
  });

  it('61 cannot validate a claims projection as a membership record', () => {
    expect(() =>
      createServerOwnedTenantMembershipRecordV1(validClaimsProjection()),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it('62 rejects use of claims projection as membership authority', () => {
    expect(() =>
      createTrustedTenantMembershipFromAuthorityV1({
        principal: validUserPrincipal(),
        tenant: validTenant(),
        membership: validClaimsProjection(),
        resolvedAt: INVOKED_AT,
        resolverVersion: 'membership-resolver-v1',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });

  it.each(['USER', 'SERVICE', 'SYSTEM'] as const)(
    '63 derives a %s Boundary actor only from a trusted principal',
    (principalType) => {
      const principal =
        principalType === 'USER'
          ? validUserPrincipal()
          : createTrustedServerPrincipalV1({
              schemaVersion: TRUSTED_SERVER_PRINCIPAL_VERSION,
              principalId:
                principalType === 'SERVICE'
                  ? 'service_principal_123'
                  : 'system_core_123',
              principalType,
              authenticationMethod:
                principalType === 'SERVICE'
                  ? 'OIDC_SERVICE_ACCOUNT'
                  : 'WORKLOAD_IDENTITY',
              provider: 'GOOGLE_CLOUD_IAM',
              authenticatedAt: AUTHENTICATED_AT,
            });
      expect(deriveBoundaryActorFromTrustedPrincipalV1(principal)).toEqual({
        actorType: principalType,
        actorId: principal.principalId,
      });
    },
  );

  it('64 rejects actor derivation from arbitrary payload identity', () => {
    expect(() =>
      deriveBoundaryActorFromTrustedPrincipalV1({
        actorType: 'USER',
        actorId: 'firebase_uid_123',
      }),
    ).toThrow(VerifiedIdentityTenantBindingContractError);
  });
});
