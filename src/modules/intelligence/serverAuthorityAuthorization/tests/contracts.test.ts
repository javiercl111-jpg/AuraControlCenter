import { describe, expect, it } from 'vitest';
import {
  AuthorityAuthorizationEvaluationError,
  AuthorityAuthorizationValidationError,
  createAuthorityAuthorizationDecisionV1,
  createAuthorityAuthorizationFreshnessV1,
  createAuthorityAuthorizationObligationV1,
  createAuthorityAuthorizationOperationBindingV1,
  createAuthorityAuthorizationPolicyEvidenceV1,
  createAuthorityAuthorizationPrincipalBindingV1,
  createAuthorityAuthorizationRequestV1,
  createAuthorityAuthorizationResourceBindingV1,
  createAuthorityAuthorizationResultV1,
  createAuthorityAuthorizationScopeBindingV1,
  validateAuthorityPermissionV1,
} from '../index';

const PRINCIPAL_ID = 'apr_v1_human_binding_human_001';
const TENANT_ID = 'tenant_001';
const PRINCIPAL_RESOLVED_AT = '2026-07-30T11:55:00.000Z';
const SCOPE_RESOLVED_AT = '2026-07-30T11:56:00.000Z';
const REQUESTED_AT = '2026-07-30T11:59:00.000Z';
const EVALUATED_AT = '2026-07-30T12:00:00.000Z';
const DECISION_VALID_UNTIL = '2026-07-30T12:05:00.000Z';
const POLICY_VALID_UNTIL = '2026-07-30T12:06:00.000Z';
const BINDING_VALID_UNTIL = '2026-07-30T12:10:00.000Z';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;
const HASH_E = `sha256:${'e'.repeat(64)}`;

function principalBinding(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    principalId: PRINCIPAL_ID,
    principalType: 'HUMAN_USER',
    principalStatus: 'ACTIVE',
    authenticationMethod: 'FIREBASE_ID_TOKEN',
    assuranceLevel: 'HIGH',
    principalBindingVersion: 'principal-binding-v1',
    principalEvidenceFingerprint: HASH_A,
    resolvedAt: PRINCIPAL_RESOLVED_AT,
    validUntil: BINDING_VALID_UNTIL,
    ...overrides,
  };
}

function tenantScopeBinding(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    scopeType: 'TENANT',
    scopeStatus: 'ACTIVE',
    tenantAuthorityVersion: 'tenant-v1',
    membershipBindingVersion: 'membership-binding-v1',
    scopeEvidenceFingerprint: HASH_B,
    principalId: PRINCIPAL_ID,
    resolvedAt: SCOPE_RESOLVED_AT,
    validUntil: BINDING_VALID_UNTIL,
    tenantId: TENANT_ID,
    ...overrides,
  };
}

function platformScopeBinding(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    scopeType: 'PLATFORM',
    scopeStatus: 'ACTIVE',
    tenantAuthorityVersion: 'platform-v1',
    scopeEvidenceFingerprint: HASH_B,
    principalId: PRINCIPAL_ID,
    resolvedAt: SCOPE_RESOLVED_AT,
    validUntil: BINDING_VALID_UNTIL,
    platformBoundary: 'AUTHORITY_CONTROL_PLANE',
  };
}

function tenantResource(
  tenantId = TENANT_ID,
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    resourceType: 'TENANT',
    tenantId,
  };
}

function membershipResource(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    resourceType: 'MEMBERSHIP',
    tenantId: TENANT_ID,
    membershipId: 'membership_001',
    targetPrincipalId: 'apr_v1_human_binding_target_001',
  };
}

function aliasResource(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    resourceType: 'ALIAS',
    tenantId: TENANT_ID,
    aliasKey: 'tenant_slug:tenant-alpha',
  };
}

function legacyResource(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    resourceType: 'LEGACY_TENANT_SOURCE',
    sourceType: 'PLATFORM_TENANTS',
    sourceLocatorKey: 'PLATFORM_TENANTS:legacy_tenant_001',
    canonicalTenantCandidate: TENANT_ID,
    ...overrides,
  };
}

function operationBinding(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    operationType: 'UPDATE_TENANT_STATUS',
    permission: 'authority.tenant.status.update',
    commandVersion: '1',
    resourceType: 'TENANT',
    resourceId: TENANT_ID,
    operationId: 'operation_001',
    commandFingerprint: HASH_C,
    requestedAt: REQUESTED_AT,
    channel: 'FIREBASE_CALLABLE',
    ...overrides,
  };
}

function policyEvidence(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    policyId: 'authority_policy_001',
    policyVersion: 'policy-v1',
    evaluatorVersion: 'evaluator-v1',
    decisionRuleId: 'tenant_status_update_rule',
    evaluatedAt: EVALUATED_AT,
    validUntil: POLICY_VALID_UNTIL,
    evidenceFingerprint: HASH_C,
    inputFingerprint: HASH_D,
    principalEvidenceFingerprint: HASH_A,
    scopeEvidenceFingerprint: HASH_B,
    policySource: 'VERSIONED_POLICY_BUNDLE',
    matchedRuleReferences: ['rule_tenant_status_update'],
    roleSetVersion: 'role-set-v1',
    membershipVersion: 'membership-v1',
    ...overrides,
  };
}

function freshness(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    evaluatedAt: EVALUATED_AT,
    validUntil: DECISION_VALID_UNTIL,
    principalValidUntil: BINDING_VALID_UNTIL,
    scopeValidUntil: BINDING_VALID_UNTIL,
    policyVersion: 'policy-v1',
    inputFingerprint: HASH_D,
    staleAfterSeconds: 300,
    ...overrides,
  };
}

function mfaObligation(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    obligationType: 'REQUIRE_MFA',
    minimumFactors: 2,
  };
}

function decision(
  decisionValue = 'ALLOW',
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  const reasons: Readonly<Record<string, readonly string[]>> = {
    ALLOW: ['POLICY_RULE_MATCHED'],
    DENY: ['PERMISSION_NOT_GRANTED'],
    INDETERMINATE: ['POLICY_NOT_FOUND'],
    NOT_APPLICABLE: ['OPERATION_NOT_SUPPORTED'],
  };
  return {
    schemaVersion: '1',
    version: '1',
    decision: decisionValue,
    permission: 'authority.tenant.status.update',
    principalBinding: principalBinding(),
    scopeBinding: tenantScopeBinding(),
    operationBinding: operationBinding(),
    resourceBinding: tenantResource(),
    policyEvidence: policyEvidence(),
    obligations: [mfaObligation()],
    freshness: freshness(),
    reasonCodes: reasons[decisionValue],
    decisionFingerprint: HASH_E,
    evaluatedAt: EVALUATED_AT,
    ...overrides,
  };
}

function request(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    principalBinding: principalBinding(),
    scopeBinding: tenantScopeBinding(),
    operationBinding: operationBinding(),
    resourceBinding: tenantResource(),
    channel: 'FIREBASE_CALLABLE',
    requestId: 'request_001',
    correlationId: 'correlation_001',
    evaluatedAtInput: EVALUATED_AT,
    ...overrides,
  };
}

function failureResult(
  status: string,
  reasonCode: string,
  retryDisposition: string,
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    status,
    reasonCode,
    retryDisposition,
    evaluatorVersion: 'evaluator-v1',
    evaluatedAt: EVALUATED_AT,
  };
}

describe('Authority authorization decision contracts', () => {
  it('1 validates ALLOW', () => {
    expect(createAuthorityAuthorizationDecisionV1(decision())).toMatchObject({
      decision: 'ALLOW',
    });
  });

  it('2 validates DENY as a decision', () => {
    expect(
      createAuthorityAuthorizationDecisionV1(decision('DENY')),
    ).toMatchObject({ decision: 'DENY' });
  });

  it('3 validates INDETERMINATE', () => {
    expect(
      createAuthorityAuthorizationDecisionV1(
        decision('INDETERMINATE'),
      ),
    ).toMatchObject({ decision: 'INDETERMINATE' });
  });

  it('4 validates NOT_APPLICABLE only with its closed reason', () => {
    expect(
      createAuthorityAuthorizationDecisionV1(
        decision('NOT_APPLICABLE'),
      ),
    ).toMatchObject({ reasonCodes: ['OPERATION_NOT_SUPPORTED'] });
  });

  it('5 rejects unknown decisions', () => {
    expect(() =>
      createAuthorityAuthorizationDecisionV1(decision('UNKNOWN')),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('6 has no default allow', () => {
    const { decision: omitted, ...withoutDecision } = decision();
    expect(omitted).toBe('ALLOW');
    expect(() =>
      createAuthorityAuthorizationDecisionV1(withoutDecision),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('7 rejects bypass decisions', () => {
    expect(() =>
      createAuthorityAuthorizationDecisionV1(decision('BYPASS')),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('8 rejects superadmin allow decisions', () => {
    expect(() =>
      createAuthorityAuthorizationDecisionV1(
        decision('SUPERADMIN_ALLOW'),
      ),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  for (const [number, permission] of [
    [9, 'authority.tenant.create'],
    [10, 'authority.tenant.status.update'],
    [11, 'authority.membership.create'],
    [12, 'authority.membership.roles.update'],
    [13, 'authority.membership.status.update'],
    [14, 'authority.alias.reserve'],
    [15, 'authority.alias.tombstone'],
    [16, 'authority.legacy.canonicalize'],
  ] as const) {
    it(`${number} validates the closed permission ${permission}`, () => {
      expect(validateAuthorityPermissionV1(permission)).toBe(permission);
    });
  }

  it('17 rejects wildcard permission', () => {
    expect(() => validateAuthorityPermissionV1('authority.*')).toThrow(
      AuthorityAuthorizationValidationError,
    );
  });

  it('18 rejects arbitrary permission', () => {
    expect(() =>
      validateAuthorityPermissionV1('authority.tenant.delete'),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('19 rejects role names as permission', () => {
    expect(() => validateAuthorityPermissionV1('PLATFORM_ADMIN')).toThrow(
      AuthorityAuthorizationValidationError,
    );
  });

  it('20 rejects operation and permission mismatch', () => {
    expect(() =>
      createAuthorityAuthorizationOperationBindingV1(
        operationBinding({ permission: 'authority.alias.reserve' }),
      ),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('21 validates principal binding', () => {
    expect(
      createAuthorityAuthorizationPrincipalBindingV1(principalBinding()),
    ).toMatchObject({ principalId: PRINCIPAL_ID });
  });

  it('22 represents inactive principal without granting permission', () => {
    expect(
      createAuthorityAuthorizationPrincipalBindingV1(
        principalBinding({ principalStatus: 'SUSPENDED' }),
      ).principalStatus,
    ).toBe('SUSPENDED');
  });

  it('23 rejects principal evidence mismatch', () => {
    expect(() =>
      createAuthorityAuthorizationDecisionV1(
        decision('ALLOW', {
          principalBinding: principalBinding({
            principalEvidenceFingerprint: HASH_E,
          }),
        }),
      ),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('24 validates tenant scope binding', () => {
    expect(
      createAuthorityAuthorizationScopeBindingV1(tenantScopeBinding()),
    ).toMatchObject({ tenantId: TENANT_ID });
  });

  it('25 keeps platform scope free of a synthetic tenant', () => {
    const scope = createAuthorityAuthorizationScopeBindingV1(
      platformScopeBinding(),
    );
    expect(Object.keys(scope)).not.toContain('tenantId');
  });

  it('26 rejects scope evidence mismatch', () => {
    expect(() =>
      createAuthorityAuthorizationDecisionV1(
        decision('ALLOW', {
          scopeBinding: tenantScopeBinding({
            scopeEvidenceFingerprint: HASH_E,
          }),
        }),
      ),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('27 validates tenant resource', () => {
    expect(
      createAuthorityAuthorizationResourceBindingV1(tenantResource()),
    ).toMatchObject({ resourceType: 'TENANT' });
  });

  it('28 validates membership resource', () => {
    expect(
      createAuthorityAuthorizationResourceBindingV1(
        membershipResource(),
      ),
    ).toMatchObject({ resourceType: 'MEMBERSHIP' });
  });

  it('29 validates alias resource', () => {
    expect(
      createAuthorityAuthorizationResourceBindingV1(aliasResource()),
    ).toMatchObject({ resourceType: 'ALIAS' });
  });

  it('30 validates legacy resource', () => {
    expect(
      createAuthorityAuthorizationResourceBindingV1(legacyResource()),
    ).toMatchObject({ resourceType: 'LEGACY_TENANT_SOURCE' });
  });

  it('31 rejects Firestore paths', () => {
    expect(() =>
      createAuthorityAuthorizationResourceBindingV1(
        legacyResource({
          sourceLocatorKey: 'platform_tenants/legacy_tenant_001',
        }),
      ),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('32 rejects wildcard resources', () => {
    expect(() =>
      createAuthorityAuthorizationResourceBindingV1(
        legacyResource({ sourceLocatorKey: '*' }),
      ),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('33 rejects cross-tenant resource mismatch', () => {
    expect(() =>
      createAuthorityAuthorizationRequestV1(
        request({
          resourceBinding: tenantResource('tenant_002'),
          operationBinding: operationBinding({
            resourceId: 'tenant_002',
          }),
        }),
      ),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('34 validates policy evidence', () => {
    expect(
      createAuthorityAuthorizationPolicyEvidenceV1(policyEvidence()),
    ).toMatchObject({ policyVersion: 'policy-v1' });
  });

  it('35 requires a policy version', () => {
    const { policyVersion: omitted, ...withoutVersion } = policyEvidence();
    expect(omitted).toBe('policy-v1');
    expect(() =>
      createAuthorityAuthorizationPolicyEvidenceV1(withoutVersion),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('36 rejects raw policy source', () => {
    expect(() =>
      createAuthorityAuthorizationPolicyEvidenceV1({
        ...policyEvidence(),
        policyCode: 'allow if role == admin',
      }),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('37 validates MFA obligation', () => {
    expect(
      createAuthorityAuthorizationObligationV1(mfaObligation()),
    ).toEqual(mfaObligation());
  });

  it('38 validates App Check obligation', () => {
    expect(
      createAuthorityAuthorizationObligationV1({
        schemaVersion: '1',
        obligationType: 'REQUIRE_APP_CHECK',
        requiredStatus: 'REQUIRED_AND_VALID',
      }),
    ).toMatchObject({ obligationType: 'REQUIRE_APP_CHECK' });
  });

  it('39 validates idempotency obligation', () => {
    expect(
      createAuthorityAuthorizationObligationV1({
        schemaVersion: '1',
        obligationType: 'REQUIRE_IDEMPOTENCY_KEY',
        namespace: 'PRINCIPAL_SCOPE_OPERATION',
      }),
    ).toMatchObject({ obligationType: 'REQUIRE_IDEMPOTENCY_KEY' });
  });

  it('40 rejects skip-audit obligation', () => {
    expect(() =>
      createAuthorityAuthorizationObligationV1({
        schemaVersion: '1',
        obligationType: 'SKIP_AUDIT',
      }),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('41 rejects bypass obligation', () => {
    expect(() =>
      createAuthorityAuthorizationObligationV1({
        schemaVersion: '1',
        obligationType: 'BYPASS',
      }),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('42 rejects cross-tenant obligation', () => {
    expect(() =>
      createAuthorityAuthorizationObligationV1({
        schemaVersion: '1',
        obligationType: 'ALLOW_CROSS_TENANT',
      }),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('43 validates authorization freshness', () => {
    expect(
      createAuthorityAuthorizationFreshnessV1(freshness()),
    ).toMatchObject({ staleAfterSeconds: 300 });
  });

  it('44 rejects decision beyond principal freshness', () => {
    expect(() =>
      createAuthorityAuthorizationFreshnessV1(
        freshness({ principalValidUntil: '2026-07-30T12:04:00.000Z' }),
      ),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('45 rejects decision beyond scope freshness', () => {
    expect(() =>
      createAuthorityAuthorizationFreshnessV1(
        freshness({ scopeValidUntil: '2026-07-30T12:04:00.000Z' }),
      ),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('46 validates stale result', () => {
    expect(
      createAuthorityAuthorizationResultV1(
        failureResult(
          'STALE',
          'POLICY_STALE',
          'RETRY_AFTER_POLICY_REFRESH',
        ),
      ),
    ).toMatchObject({ status: 'STALE' });
  });

  it('47 validates rejected result', () => {
    expect(
      createAuthorityAuthorizationResultV1(
        failureResult(
          'REJECTED',
          'AUTHORIZATION_REQUEST_INVALID',
          'DO_NOT_RETRY',
        ),
      ),
    ).toMatchObject({ status: 'REJECTED' });
  });

  it('48 validates conflict result', () => {
    expect(
      createAuthorityAuthorizationResultV1(
        failureResult(
          'CONFLICT',
          'BINDING_CONFLICT',
          'RETRY_AFTER_OPERATOR_REVIEW',
        ),
      ),
    ).toMatchObject({ status: 'CONFLICT' });
  });

  it('49 serializes internal errors safely', () => {
    const error = new AuthorityAuthorizationEvaluationError(
      'SAFE_TO_RETRY',
    );
    expect(error.toJSON()).toEqual({
      version: '1',
      code: 'AUTHORITY_AUTHORIZATION_EVALUATION_FAILED',
      safeMessage: 'Authority authorization evaluation failed.',
      retryDisposition: 'SAFE_TO_RETRY',
    });
    expect(JSON.stringify(error)).not.toMatch(
      /stack|tenant_001|policyCode|claims/i,
    );
  });

  it('50 keeps DENY distinct from a technical result error', () => {
    const result = createAuthorityAuthorizationResultV1({
      schemaVersion: '1',
      status: 'DECIDED',
      decision: decision('DENY'),
    });
    expect(result).toMatchObject({
      status: 'DECIDED',
      decision: { decision: 'DENY' },
    });
  });

  for (const [number, field, value] of [
    [51, 'role', 'PLATFORM_ADMIN'],
    [52, 'isAdmin', true],
    [53, 'isSuperAdmin', true],
    [54, 'decision', 'ALLOW'],
    [55, 'rawToken', 'header.payload.signature'],
    [56, 'claims', { role: 'PLATFORM_ADMIN' }],
    [57, 'arbitraryField', 'value'],
  ] as const) {
    it(`${number} rejects forbidden request field ${field}`, () => {
      expect(() =>
        createAuthorityAuthorizationRequestV1({
          ...request(),
          [field]: value,
        }),
      ).toThrow(AuthorityAuthorizationValidationError);
    });
  }

  it('58 accepts plain null-prototype records', () => {
    const value = Object.assign(Object.create(null), tenantResource());
    expect(createAuthorityAuthorizationResourceBindingV1(value)).toEqual(
      tenantResource(),
    );
  });

  it('59 rejects class instances', () => {
    class ResourceBinding {
      readonly schemaVersion = '1';
      readonly resourceType = 'TENANT';
      readonly tenantId = TENANT_ID;
    }
    expect(() =>
      createAuthorityAuthorizationResourceBindingV1(
        new ResourceBinding(),
      ),
    ).toThrow(AuthorityAuthorizationValidationError);
  });

  it('60 returns deeply immutable outputs', () => {
    const output = createAuthorityAuthorizationDecisionV1(decision());
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.principalBinding)).toBe(true);
    expect(Object.isFrozen(output.obligations)).toBe(true);
    expect(Object.isFrozen(output.policyEvidence.matchedRuleReferences)).toBe(
      true,
    );
  });

  it('61 produces deterministic factory output', () => {
    expect(createAuthorityAuthorizationDecisionV1(decision())).toEqual(
      createAuthorityAuthorizationDecisionV1(decision()),
    );
  });
});
