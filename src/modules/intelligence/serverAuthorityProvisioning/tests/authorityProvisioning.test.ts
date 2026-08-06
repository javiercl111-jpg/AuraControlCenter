import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUTHORITY_PROVISIONING_RECORD_VERSION,
  AUTHORITY_PROVISIONING_REQUEST_VERSION,
  AUTHORITY_RESOLUTION_REQUEST_VERSION,
  CONTROLLED_PREVIEW_HAPPY_PATH,
  PREVIEW_SYNTHETIC_AUTHORITY_RETENTION_POLICY_VERSION,
  AuthorityProvisioningError,
  createAuthorityProvisioningServiceV1,
  type AuthorityProvisioningAuditRecordV1,
  type AuthorityProvisioningDependenciesV1,
  type AuthorityProvisioningUnitOfWorkV1,
  type PlatformPrincipalV1,
  type PlatformTenantV1,
  type TenantMembershipV1,
} from '..';

const FIXED_TIME = '2026-08-06T12:00:00.000Z';
const ids = Object.freeze({
  principal: 'principal-0000000000000000000000000000000000000001',
  tenant: 'tenant-0000000000000000000000000000000000000001',
  membership: 'membership-00000000000000000000000000000000000001',
  audit: 'authority-audit-0000000000000000000000000000000000001',
});

interface Store {
  principals: Map<string, PlatformPrincipalV1>;
  tenants: Map<string, PlatformTenantV1>;
  memberships: Map<string, TenantMembershipV1>;
  audit: Map<string, AuthorityProvisioningAuditRecordV1>;
}

function emptyStore(): Store {
  return { principals: new Map(), tenants: new Map(), memberships: new Map(), audit: new Map() };
}

function cloneStore(store: Store): Store {
  return {
    principals: new Map(store.principals),
    tenants: new Map(store.tenants),
    memberships: new Map(store.memberships),
    audit: new Map(store.audit),
  };
}

function unit(store: Store, failAt?: 'principal' | 'tenant' | 'membership' | 'audit'): AuthorityProvisioningUnitOfWorkV1 {
  return {
    principals: {
      getByAuthUid: async (uid) => store.principals.get(uid) ?? null,
      create: async (record) => { if (failAt === 'principal') throw new Error('write rejected'); store.principals.set(record.authUid, record); },
    },
    tenants: {
      getByTenantId: async (id) => store.tenants.get(id) ?? null,
      create: async (record) => { if (failAt === 'tenant') throw new Error('write rejected'); store.tenants.set(record.tenantId, record); },
    },
    memberships: {
      getByMembershipId: async (id) => store.memberships.get(id) ?? null,
      listByPrincipalId: async (id) => [...store.memberships.values()].filter((item) => item.principalId === id),
      create: async (record) => { if (failAt === 'membership') throw new Error('write rejected'); store.memberships.set(record.membershipId, record); },
    },
    audit: {
      getByAuditId: async (id) => store.audit.get(id) ?? null,
      create: async (record) => { if (failAt === 'audit') throw new Error('write rejected'); store.audit.set(record.auditId, record); },
    },
  };
}

function harness(options: { store?: Store; failAt?: 'principal' | 'tenant' | 'membership' | 'audit'; clock?: string } = {}) {
  const store = options.store ?? emptyStore();
  const dependencies: AuthorityProvisioningDependenciesV1 = {
    transaction: {
      run: async (operation) => {
        const draft = cloneStore(store);
        const result = await operation(unit(draft, options.failAt));
        store.principals = draft.principals;
        store.tenants = draft.tenants;
        store.memberships = draft.memberships;
        store.audit = draft.audit;
        return result;
      },
    },
    clock: { now: () => options.clock ?? FIXED_TIME },
    ids: {
      principalId: () => ids.principal,
      tenantId: () => ids.tenant,
      membershipId: () => ids.membership,
      auditId: () => ids.audit,
    },
    fingerprints: { fingerprint: () => `sha256:${'a'.repeat(64)}` },
  };
  return { store, dependencies, service: createAuthorityProvisioningServiceV1(dependencies) };
}

function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: AUTHORITY_PROVISIONING_REQUEST_VERSION,
    requestId: 'request-preview-0001',
    correlationId: 'correlation-preview-0001',
    idempotencyKey: 'idempotency-preview-0001',
    authUid: 'synthetic-preview-uid-0001',
    identityLabel: 'AI02H2-PREVIEW-SYNTHETIC-IDENTITY-01',
    tenantLabel: 'AI02H2-PREVIEW-SYNTHETIC-TENANT-01',
    requestedCapabilities: [],
    environment: 'PREVIEW',
    retentionPolicy: {
      version: PREVIEW_SYNTHETIC_AUTHORITY_RETENTION_POLICY_VERSION,
      principalRetention: 'PERMANENT_PREVIEW_FIXTURE',
      tenantRetention: 'PERMANENT_PREVIEW_FIXTURE',
      membershipRetention: 'PREVIEW_ENVIRONMENT_LIFETIME',
      happyPathDataRetentionDays: 30,
      cleanup: 'VERSIONED_AUTHORIZED_PROCEDURE',
      approvedUse: CONTROLLED_PREVIEW_HAPPY_PATH,
    },
    requestedAt: FIXED_TIME,
    ...overrides,
  };
}

function resolution(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { version: AUTHORITY_RESOLUTION_REQUEST_VERSION, authUid: 'synthetic-preview-uid-0001', environment: 'PREVIEW', ...overrides };
}

async function expectCode(action: Promise<unknown> | (() => unknown), code: string): Promise<void> {
  try {
    await (typeof action === 'function' ? action() : action);
    throw new Error('expected rejection');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(AuthorityProvisioningError);
    expect((error as AuthorityProvisioningError).code).toBe(code);
  }
}

async function provisioned() {
  const state = harness();
  await state.service.provisionSyntheticIdentityAuthority(request());
  return state;
}

describe('Preview Authority Provisioning certification matrix', () => {
  it('1. provisions the closed principal, tenant, membership, and audit transaction', async () => {
    const state = harness();
    const result = await state.service.provisionSyntheticIdentityAuthority(request());
    expect(result.status).toBe('PROVISIONED');
    expect([...state.store.principals]).toHaveLength(1);
    expect([...state.store.tenants]).toHaveLength(1);
    expect([...state.store.memberships]).toHaveLength(1);
    expect([...state.store.audit]).toHaveLength(1);
  });
  it('2. replays the same idempotent request without writes', async () => {
    const state = harness();
    await state.service.provisionSyntheticIdentityAuthority(request());
    expect((await state.service.provisionSyntheticIdentityAuthority(request())).idempotencyResult).toBe('REPLAYED');
  });
  it('3. rejects a duplicate UID bound to a different principal', async () => {
    const state = harness();
    state.store.principals.set('synthetic-preview-uid-0001', principal({ principalId: 'principal-conflicting-00000000000000000000000000001' }));
    await expectCode(state.service.provisionSyntheticIdentityAuthority(request()), 'PRINCIPAL_CONFLICT');
  });
  it('4. rejects a duplicate tenant with conflicting certified label', async () => {
    const state = harness();
    state.store.tenants.set(ids.tenant, tenant({ testMetadata: metadata('AI02H2-PREVIEW-SYNTHETIC-OTHER-01') }));
    await expectCode(state.service.provisionSyntheticIdentityAuthority(request()), 'TENANT_CONFLICT');
  });
  it('5. rejects a duplicate membership with a different principal', async () => {
    const state = harness();
    state.store.memberships.set(ids.membership, membership({ principalId: 'principal-other-000000000000000000000000000001' }));
    await expectCode(state.service.provisionSyntheticIdentityAuthority(request()), 'MEMBERSHIP_CONFLICT');
  });
  it('6. rejects a non-Preview environment', async () => { await expectCode(harness().service.provisionSyntheticIdentityAuthority(request({ environment: 'STAGING' })), 'ENVIRONMENT_NOT_PREVIEW'); });
  it('7. rejects an empty UID', async () => { await expectCode(harness().service.provisionSyntheticIdentityAuthority(request({ authUid: '' })), 'UID_REQUIRED'); });
  it('8. rejects a capability outside the empty certified allowlist', async () => { await expectCode(harness().service.provisionSyntheticIdentityAuthority(request({ requestedCapabilities: ['discovery.write'] })), 'CAPABILITY_NOT_ALLOWED'); });
  it('9. rejects a requested global privilege', async () => { await expectCode(harness().service.provisionSyntheticIdentityAuthority(request({ requestedCapabilities: ['platform.admin'] })), 'CAPABILITY_NOT_ALLOWED'); });
  it('10. rejects a cross-tenant resolution constraint', async () => { const state = await provisioned(); await expectCode(state.service.resolveAuthority(resolution({ expectedTenantId: 'tenant-other-000000000000000000000000000000000001' })), 'CROSS_TENANT_FORBIDDEN'); });
  it('11. rejects a disabled principal', async () => { const state = await provisioned(); const current = state.store.principals.values().next().value as PlatformPrincipalV1; state.store.principals.set(current.authUid, { ...current, status: 'DISABLED' }); await expectCode(state.service.resolveAuthority(resolution()), 'PRINCIPAL_DISABLED'); });
  it('12. rejects a disabled tenant', async () => { const state = await provisioned(); const current = state.store.tenants.get(ids.tenant)!; state.store.tenants.set(ids.tenant, { ...current, status: 'DISABLED' }); await expectCode(state.service.resolveAuthority(resolution()), 'TENANT_DISABLED'); });
  it('13. rejects a disabled membership', async () => { const state = await provisioned(); const current = state.store.memberships.get(ids.membership)!; state.store.memberships.set(ids.membership, { ...current, status: 'DISABLED' }); await expectCode(state.service.resolveAuthority(resolution()), 'MEMBERSHIP_DISABLED'); });
  it('14. rejects ambiguous active memberships', async () => { const state = await provisioned(); state.store.memberships.set('membership-other-000000000000000000000000000000001', membership({ membershipId: 'membership-other-000000000000000000000000000000001' })); await expectCode(state.service.resolveAuthority(resolution()), 'AMBIGUOUS_MEMBERSHIP'); });
  it('15. rejects pre-existing partial state', async () => { const state = harness(); state.store.principals.set('synthetic-preview-uid-0001', principal()); await expectCode(state.service.provisionSyntheticIdentityAuthority(request()), 'PARTIAL_STATE_DETECTED'); });
  it('16. rolls back every staged write when the transaction fails', async () => { const state = harness({ failAt: 'membership' }); await expect(state.service.provisionSyntheticIdentityAuthority(request())).rejects.toThrow('write rejected'); expect(state.store.principals.size + state.store.tenants.size + state.store.memberships.size).toBe(0); });
  it('17. fails closed when the injected timestamp is invalid', async () => { await expectCode(harness({ clock: '' }).service.provisionSyntheticIdentityAuthority(request()), 'INVALID_REQUEST'); });
  it('18. fails closed when the ID provider is not injected', async () => { const state = harness(); await expectCode(() => createAuthorityProvisioningServiceV1({ ...state.dependencies, ids: undefined } as unknown as AuthorityProvisioningDependenciesV1), 'INVALID_DEPENDENCIES'); });
  it('19. rejects email as an authority field', async () => { await expectCode(harness().service.provisionSyntheticIdentityAuthority(request({ email: 'synthetic@example.invalid' })), 'INVALID_REQUEST'); });
  it('20. rejects claims as the sole authority input', async () => { await expectCode(harness().service.resolveAuthority({ version: AUTHORITY_RESOLUTION_REQUEST_VERSION, environment: 'PREVIEW', claims: { tenantId: ids.tenant } }), 'INVALID_REQUEST'); });
  it('21. rejects unexpected document fields', async () => { const state = await provisioned(); const current = state.store.tenants.get(ids.tenant)!; state.store.tenants.set(ids.tenant, { ...current, legacyRole: 'owner' } as unknown as PlatformTenantV1); await expectCode(state.service.resolveAuthority(resolution()), 'INVALID_REQUEST'); });
  it('22. rejects Production references in authoritative identifiers', async () => { await expectCode(harness().service.provisionSyntheticIdentityAuthority(request({ authUid: 'aura-control-center-debb3-user-0001' })), 'PRODUCTION_REFERENCE_FORBIDDEN'); });
  it('23. keeps the composition out of the Preview Discovery exports', () => { const source = fs.readFileSync(path.resolve('functions/src/previewDiscoveryIndex.ts'), 'utf8'); expect(source).not.toContain('AuthorityProvisioning'); });
  it('24. exposes no callable or HTTP transport', () => { const source = fs.readFileSync(path.resolve('functions/src/composition/authorityProvisioning/previewAuthorityProvisioningComposition.ts'), 'utf8'); expect(source).not.toMatch(/onCall|onRequest|https\.on|express\s*\(/); });
  it('25. emits no logs containing PII, secrets, or tokens', () => { const source = fs.readFileSync(path.resolve('src/modules/intelligence/serverAuthorityProvisioning/AuthorityProvisioningService.ts'), 'utf8'); expect(source).not.toMatch(/console\.|logger\.|secret|token|email/i); });
});

function metadata(label = 'AI02H2-PREVIEW-SYNTHETIC-IDENTITY-01') {
  return { label, approvedUse: CONTROLLED_PREVIEW_HAPPY_PATH, synthetic: true } as const;
}
function principal(overrides: Partial<PlatformPrincipalV1> = {}): PlatformPrincipalV1 {
  return { schemaVersion: AUTHORITY_PROVISIONING_RECORD_VERSION, principalId: ids.principal, authUid: 'synthetic-preview-uid-0001', status: 'ACTIVE', environment: 'PREVIEW', createdAt: FIXED_TIME, updatedAt: FIXED_TIME, testMetadata: metadata(), ...overrides };
}
function tenant(overrides: Partial<PlatformTenantV1> = {}): PlatformTenantV1 {
  return { schemaVersion: AUTHORITY_PROVISIONING_RECORD_VERSION, tenantId: ids.tenant, status: 'ACTIVE', environment: 'PREVIEW', tenantType: 'SYNTHETIC_TEST', createdAt: FIXED_TIME, updatedAt: FIXED_TIME, testMetadata: metadata('AI02H2-PREVIEW-SYNTHETIC-TENANT-01'), ...overrides };
}
function membership(overrides: Partial<TenantMembershipV1> = {}): TenantMembershipV1 {
  return { schemaVersion: AUTHORITY_PROVISIONING_RECORD_VERSION, membershipId: ids.membership, principalId: ids.principal, tenantId: ids.tenant, status: 'ACTIVE', environment: 'PREVIEW', capabilities: [], createdAt: FIXED_TIME, updatedAt: FIXED_TIME, ...overrides };
}
