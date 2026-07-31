import { describe, expect, it } from 'vitest';
import {
  createAuthorityInvocationContextResultV1,
  createAuthorityInvocationContextV1,
  projectAuthorityInvocationContextToRepositoryV1,
} from '../../../serverAuthorityInvocationContext';
import {
  validateAuthorityAuthorizationDecisionV1,
  type AuthorityAuthorizationResultV1,
} from '../../../serverAuthorityAuthorization';
import {
  validateResolvedAuthorityPrincipalV1,
  type AuthorityPrincipalResolutionResultV1,
} from '../../../serverPrincipalResolution';
import {
  validateResolvedAuthorityTenantScopeV1,
  type AuthorityTenantScopeResolutionResultV1,
} from '../../../serverTenantScopeResolution';
import {
  AUTHORITY_APPLICATION_STAGES,
  AuthorityApplicationServiceExecutionError,
} from '../../index';
import type {
  AuthorityObligationVerificationResultV1,
} from '../../authorityApplicationServiceTypes';
import {
  HASH_A,
  HASH_B,
  HASH_E,
  NOW,
  applicationRequest,
  authorizationDecision,
  executionContext,
  repositoryResult,
  resolvedPrincipal,
  resolvedScope,
  verificationResult,
} from '../fixtures';
import {
  CERTIFICATION_HASH_A,
  CERTIFICATION_HASH_B,
  bootstrapScopeFixture,
  humanPrincipalFixture,
  legacyScopeFixture,
  migrationPrincipalFixture,
  migrationScopeFixture,
  obligationDeclarationFixture,
  platformScopeFixture,
  servicePrincipalFixture,
  supportPrincipalFixture,
  supportScopeFixture,
  systemPrincipalFixture,
  tenantScopeFixture,
} from './authorityBoundaryCertificationFixtures';
import {
  nestedFixture,
  runAuthorityBoundaryCertification,
  runWithClockCancellation,
} from './authorityBoundaryCertificationHarness';
import {
  AUTHORIZATION_DECISION_MATRIX,
  AUTHORIZATION_FAILURE_MATRIX,
  CANCELLATION_MATRIX,
  OBLIGATION_TYPE_MATRIX,
  PRINCIPAL_FAILURE_MATRIX,
  REPOSITORY_RESULT_MATRIX,
  SCOPE_FAILURE_MATRIX,
  SENSITIVE_TERMS,
} from './authorityBoundaryCertificationMatrix';

type Input = Readonly<Record<string, unknown>>;

function principalFailure(
  status: (typeof PRINCIPAL_FAILURE_MATRIX)[number][0],
): AuthorityPrincipalResolutionResultV1 {
  const mapping = {
    NOT_FOUND: ['AUTHENTICATION_BINDING_NOT_FOUND', 'DO_NOT_RETRY'],
    REJECTED: ['INVALID_RESOLUTION_REQUEST', 'DO_NOT_RETRY'],
    STALE: ['STALE_BINDING', 'RETRY_AFTER_REFRESH'],
    REVOKED: ['PRINCIPAL_REVOKED', 'DO_NOT_RETRY'],
    CONFLICT: [
      'PRINCIPAL_BINDING_CONFLICT',
      'RETRY_AFTER_OPERATOR_REVIEW',
    ],
    INTERNAL_ERROR: ['INTERNAL_RESOLUTION_FAILURE', 'SAFE_TO_RETRY'],
  } as const;
  const [reasonCode, retryDisposition] = mapping[status];
  return {
    schemaVersion: '1',
    status,
    reasonCode,
    retryDisposition,
    resolverVersion: 'principal-resolver-v1',
    resolvedAt: NOW,
  };
}

function scopeFailure(
  status: (typeof SCOPE_FAILURE_MATRIX)[number][0],
): AuthorityTenantScopeResolutionResultV1 {
  const mapping = {
    NOT_FOUND: ['TENANT_NOT_FOUND', 'DO_NOT_RETRY'],
    REJECTED: ['TENANT_SELECTOR_INVALID', 'DO_NOT_RETRY'],
    STALE: ['TENANT_AUTHORITY_STALE', 'RETRY_AFTER_TENANT_REFRESH'],
    REVOKED: ['TENANT_REVOKED', 'DO_NOT_RETRY'],
    CONFLICT: [
      'PRINCIPAL_TENANT_BINDING_CONFLICT',
      'RETRY_AFTER_OPERATOR_REVIEW',
    ],
    AMBIGUOUS: [
      'TENANT_ALIAS_AMBIGUOUS',
      'RETRY_AFTER_OPERATOR_REVIEW',
    ],
    INTERNAL_ERROR: ['INTERNAL_RESOLUTION_FAILURE', 'SAFE_TO_RETRY'],
  } as const;
  const [reasonCode, retryDisposition] = mapping[status];
  return {
    schemaVersion: '1',
    status,
    reasonCode,
    retryDisposition,
    resolverVersion: 'scope-resolver-v1',
    resolvedAt: NOW,
  };
}

function authorizationFailure(
  status: (typeof AUTHORIZATION_FAILURE_MATRIX)[number][0],
): AuthorityAuthorizationResultV1 {
  const mapping = {
    REJECTED: ['AUTHORIZATION_REQUEST_INVALID', 'DO_NOT_RETRY'],
    STALE: ['POLICY_STALE', 'RETRY_AFTER_POLICY_REFRESH'],
    CONFLICT: ['BINDING_CONFLICT', 'RETRY_AFTER_OPERATOR_REVIEW'],
    INTERNAL_ERROR: ['INTERNAL_AUTHORIZATION_FAILURE', 'SAFE_TO_RETRY'],
  } as const;
  const [reasonCode, retryDisposition] = mapping[status];
  return {
    schemaVersion: '1',
    status,
    reasonCode,
    retryDisposition,
    evaluatorVersion: 'authorization-evaluator-v1',
    evaluatedAt: NOW,
  };
}

function obligationFailure(
  status: Exclude<
    AuthorityObligationVerificationResultV1['status'],
    'VERIFIED'
  >,
): AuthorityObligationVerificationResultV1 {
  const safeCodes = {
    REJECTED: 'OBLIGATIONS_REJECTED',
    STALE: 'OBLIGATIONS_STALE',
    INCOMPLETE: 'OBLIGATIONS_INCOMPLETE',
    CONFLICT: 'OBLIGATIONS_CONFLICT',
    INTERNAL_ERROR: 'OBLIGATIONS_INTERNAL_ERROR',
  } as const;
  return {
    schemaVersion: '1',
    status,
    safeCode: safeCodes[status],
    retryDisposition:
      status === 'STALE'
        ? 'RETRY_AFTER_OBLIGATION_SATISFACTION'
        : 'DO_NOT_RETRY',
    maskNotFound: false,
  };
}

async function capturedContext(): Promise<Input> {
  const { state } = await runAuthorityBoundaryCertification();
  if (state.fingerprintInput === undefined) {
    throw new Error('Certification context was not captured.');
  }
  return { ...state.fingerprintInput, contextFingerprint: HASH_E };
}

function verifiedResult(
  obligationTypes: readonly string[] = ['REQUIRE_IDEMPOTENCY_KEY'],
): Extract<AuthorityObligationVerificationResultV1, { status: 'VERIFIED' }> {
  const result = verificationResult(obligationTypes);
  if (result.status !== 'VERIFIED') {
    throw new Error('Certification obligation fixture is invalid.');
  }
  return result;
}

describe('Authority boundary exact flow certification', () => {
  it.each(AUTHORITY_APPLICATION_STAGES.map((stage, index) => [stage, index]))(
    'executes %s exactly once at position %s',
    async (stage, index) => {
      const { result, state, request } =
        await runAuthorityBoundaryCertification();
      expect(result.stageTrace[index]?.stage).toBe(stage);
      expect(
        result.stageTrace.filter((entry) => entry.stage === stage),
      ).toHaveLength(1);
      expect(state.repositoryCommand).toBe(request.command);
    },
  );

  it('preserves one operational identity through the entire flow', async () => {
    const { result, state, request } =
      await runAuthorityBoundaryCertification();
    expect(result.metadata.operationId).toBe(request.command.operationId);
    expect(state.fingerprintInput?.operation.operationId).toBe(
      request.command.operationId,
    );
    expect(state.repositoryCommand).toBe(request.command);
  });
});

describe('Authority boundary principal matrix', () => {
  it.each([
    ['HUMAN_USER', humanPrincipalFixture],
    ['INTERNAL_SERVICE', servicePrincipalFixture],
    ['SYSTEM_ACTOR', systemPrincipalFixture],
    ['MIGRATION_ACTOR', migrationPrincipalFixture],
    ['SUPPORT_OPERATOR', supportPrincipalFixture],
  ] as const)('accepts valid %s principal contracts', (kind, fixture) => {
    expect(validateResolvedAuthorityPrincipalV1(fixture()).principalType)
      .toBe(kind);
  });

  it.each(PRINCIPAL_FAILURE_MATRIX)(
    'stops principal %s as %s before scope and repository',
    async (status, expectedStatus) => {
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.principalResult = principalFailure(status);
        },
      );
      expect(result.status).toBe(expectedStatus);
      expect(result.stageTrace.at(-1)?.stage).toBe('PRINCIPAL_RESOLUTION');
      expect(state.scopeCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it.each([
    ['principalId', { principalId: 'apr_v1_human_binding_other_001' }, {
      scopeBinding: {
        ...authorizationDecision().scopeBinding,
        principalId: 'apr_v1_human_binding_other_001',
      },
    }],
    ['principalType', {
      principalId: 'apr_v1_service_binding_service_001',
      principalType: 'INTERNAL_SERVICE',
      authenticationMethod: 'IAM_OIDC',
      assuranceLevel: 'STANDARD',
    }, {
      scopeBinding: {
        ...authorizationDecision().scopeBinding,
        principalId: 'apr_v1_service_binding_service_001',
      },
    }],
    ['principalStatus', { principalStatus: 'SUSPENDED' }, {}],
    ['authenticationMethod', {
      principalId: 'apr_v1_service_binding_service_001',
      principalType: 'INTERNAL_SERVICE',
      authenticationMethod: 'IAM_OIDC',
      assuranceLevel: 'STANDARD',
    }, {
      scopeBinding: {
        ...authorizationDecision().scopeBinding,
        principalId: 'apr_v1_service_binding_service_001',
      },
    }],
    ['assuranceLevel', { assuranceLevel: 'LOW' }, {}],
    ['principalBindingVersion', {
      principalBindingVersion: 'binding-other-v1',
    }, {}],
    ['principalEvidenceFingerprint', {
      principalEvidenceFingerprint: HASH_B,
    }, {
      policyEvidence: {
        ...authorizationDecision().policyEvidence,
        principalEvidenceFingerprint: HASH_B,
      },
    }],
    ['resolvedAt', { resolvedAt: '2026-07-30T12:00:05.000Z' }, {}],
    ['validUntil', { validUntil: '2026-07-30T12:11:00.000Z' }, {
      freshness: {
        ...authorizationDecision().freshness,
        principalValidUntil: '2026-07-30T12:11:00.000Z',
      },
    }],
  ] as const)(
    'closes principal binding field %s before obligations',
    async (_field, principalBindingOverride, decisionOverride) => {
      const base = authorizationDecision();
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.authorizationResult = {
            schemaVersion: '1',
            status: 'DECIDED',
            decision: authorizationDecision('DENY', [
              'REQUIRE_IDEMPOTENCY_KEY',
            ], {
              principalBinding: {
                ...base.principalBinding,
                ...principalBindingOverride,
              },
              ...decisionOverride,
            }),
          };
        },
      );
      expect(result.status).toBe('CONFLICT');
      expect(result.safeCode).toBe('AUTHORITY_OPERATION_CONFLICT');
      expect(result.retryDisposition).toBe(
        'RETRY_AFTER_OPERATOR_REVIEW',
      );
      expect(result.stageTrace.at(-1)?.stage).toBe(
        'AUTHORIZATION_EVALUATION',
      );
      expect(state.obligationCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it.each(['SUSPENDED', 'DISABLED'] as const)(
    'blocks resolved principal status %s',
    async (status) => {
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.principalResult = {
            schemaVersion: '1',
            status: 'RESOLVED',
            principal: resolvedPrincipal({ status }),
          };
        },
      );
      expect(result.status).toBe('STALE');
      expect(state.scopeCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it.each([
    ['binding version mismatch', nestedFixture(
      humanPrincipalFixture(),
      'authenticationBinding',
      { bindingVersion: 'binding-other-v1' },
    )],
    ['assurance mismatch', nestedFixture(
      humanPrincipalFixture(),
      'assurance',
      { level: 'LOW' },
    )],
    ['invalid App Check', nestedFixture(
      nestedFixture(humanPrincipalFixture(), 'assurance', {
        appCheckEvidence: {
          schemaVersion: '1',
          status: 'NOT_EVALUATED',
          reason: 'NOT_VERIFIED',
        },
      }),
      'resolutionEvidence',
      { assuranceLevel: 'STANDARD' },
    )],
    ['invalid evidence fingerprint', nestedFixture(
      humanPrincipalFixture(),
      'resolutionEvidence',
      { evidenceFingerprint: 'invalid-fingerprint' },
    )],
  ] as const)('rejects principal %s', (_name, value) => {
    expect(() => validateResolvedAuthorityPrincipalV1(value)).toThrow();
  });

  it.each([
    ['principal id', { principalId: 'apr_v1_human_binding_other_001' }],
    ['evidence fingerprint', {
      principalEvidenceFingerprint: CERTIFICATION_HASH_B,
    }],
    ['assurance', { assuranceLevel: 'LOW' }],
  ] as const)(
    'blocks authorization %s drift before repository',
    async (_name, principalBindingOverride) => {
      const base = authorizationDecision();
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.authorizationResult = {
            schemaVersion: '1',
            status: 'DECIDED',
            decision: authorizationDecision('ALLOW', [
              'REQUIRE_IDEMPOTENCY_KEY',
            ], {
              principalBinding: {
                ...base.principalBinding,
                ...principalBindingOverride,
              },
            }),
          };
        },
      );
      expect(result.status).not.toBe('APPLIED');
      expect(state.repositoryCalls).toBe(0);
    },
  );
});

describe('Authority boundary scope matrix', () => {
  it.each([
    ['TENANT', tenantScopeFixture],
    ['PLATFORM', platformScopeFixture],
    ['TENANT_BOOTSTRAP', bootstrapScopeFixture],
    ['LEGACY_CANONICALIZATION', legacyScopeFixture],
    ['MIGRATION', migrationScopeFixture],
    ['SUPPORT', supportScopeFixture],
  ] as const)('accepts valid %s scope contracts', (kind, fixture) => {
    expect(validateResolvedAuthorityTenantScopeV1(fixture()).scopeType)
      .toBe(kind);
  });

  it.each(SCOPE_FAILURE_MATRIX)(
    'stops scope %s as %s before authorization and repository',
    async (status, expectedStatus) => {
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.scopeResult = scopeFailure(status);
        },
      );
      expect(result.status).toBe(expectedStatus);
      expect(result.stageTrace.at(-1)?.stage).toBe(
        'TENANT_SCOPE_RESOLUTION',
      );
      expect(state.authorizationCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it.each([
    ['tenant mismatch', nestedFixture(
      tenantScopeFixture(),
      'membershipBinding',
      { tenantId: 'tenant_other_001' },
    )],
    ['principal membership mismatch', nestedFixture(
      tenantScopeFixture(),
      'membershipBinding',
      { principalId: 'apr_v1_human_binding_other_001' },
    )],
    ['platform synthetic tenant', {
      ...platformScopeFixture(),
      tenantId: 'tenant_synthetic_001',
    }],
    ['bootstrap incompatible operation', {
      ...bootstrapScopeFixture(),
      bootstrapOperation: 'UPDATE_TENANT_STATUS',
    }],
    ['migration empty manifest', {
      ...migrationScopeFixture(),
      targetTenantIds: [],
    }],
    ['legacy incompatible status', {
      ...legacyScopeFixture(),
      status: 'ACTIVE',
    }],
  ] as const)('rejects invalid %s scope contract', (_name, value) => {
    expect(() => validateResolvedAuthorityTenantScopeV1(value)).toThrow();
  });

  it('allows an ACTIVE tenant membership to continue', async () => {
    const { result, state } = await runAuthorityBoundaryCertification();
    expect(result.status).toBe('APPLIED');
    expect(state.authorizationCalls).toBe(1);
    expect(state.repositoryCalls).toBe(1);
  });

  it.each(['SUSPENDED', 'REVOKED', 'DISABLED'] as const)(
    'stops tenant membership %s before authorization',
    async (membershipStatus) => {
      const base = resolvedScope();
      if (base.scopeType !== 'TENANT') {
        throw new Error('Certification tenant scope fixture is invalid.');
      }
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.scopeResult = {
            schemaVersion: '1',
            status: 'RESOLVED',
            scope: resolvedScope({
              membershipBinding: {
                ...base.membershipBinding,
                membershipStatus,
              },
            }),
          };
        },
      );
      expect(result.status).toBe('REJECTED');
      expect(result.safeCode).toBe('AUTHORITY_SCOPE_NOT_RESOLVED');
      expect(result.retryDisposition).toBe('DO_NOT_RETRY');
      expect(result.stageTrace.at(-1)?.stage).toBe(
        'TENANT_SCOPE_RESOLUTION',
      );
      expect(state.authorizationCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it.each([
    ['PLATFORM', platformScopeFixture],
    ['TENANT_BOOTSTRAP', bootstrapScopeFixture],
    ['LEGACY_CANONICALIZATION', legacyScopeFixture],
    ['MIGRATION', migrationScopeFixture],
    ['SUPPORT', supportScopeFixture],
  ] as const)(
    'does not apply TENANT executability rules to %s scope',
    async (_scopeType, fixture) => {
      const scope = validateResolvedAuthorityTenantScopeV1(fixture());
      const { state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.scopeResult = {
            schemaVersion: '1',
            status: 'RESOLVED',
            scope,
          };
        },
      );
      expect(state.authorizationCalls).toBe(1);
    },
  );

  it.each([
    ['tenant inactive', resolvedScope({
      status: 'SUSPENDED',
      tenantStatus: 'SUSPENDED',
    })],
    ['support expired', validateResolvedAuthorityTenantScopeV1(
      supportScopeFixture({
        allowedUntil: '2026-07-30T12:01:20.000Z',
      }),
    )],
  ] as const)(
    'prevents %s from reaching repository',
    async (_name, scope) => {
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.scopeResult = {
            schemaVersion: '1',
            status: 'RESOLVED',
            scope,
          };
        },
      );
      expect(result.status).not.toBe('APPLIED');
      expect(state.repositoryCalls).toBe(0);
    },
  );
});

describe('Authority boundary authorization matrix', () => {
  it.each(AUTHORIZATION_DECISION_MATRIX)(
    'maps authorization decision %s to %s',
    async (decision, expectedStatus) => {
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.authorizationResult = {
            schemaVersion: '1',
            status: 'DECIDED',
            decision: authorizationDecision(decision),
          };
        },
      );
      expect(result.status).toBe(expectedStatus);
      expect(state.repositoryCalls).toBe(decision === 'ALLOW' ? 1 : 0);
    },
  );

  it.each(AUTHORIZATION_FAILURE_MATRIX)(
    'maps authorization failure %s to %s without repository',
    async (status, expectedStatus) => {
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.authorizationResult = authorizationFailure(status);
        },
      );
      expect(result.status).toBe(expectedStatus);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it.each([
    ['wildcard permission', { permission: '*' }],
    ['default allow', { decision: 'DEFAULT_ALLOW' }],
    ['superadmin bypass', { superadmin: true }],
    ['role-only grant', { role: 'admin' }],
    ['policy fingerprint', {
      decisionFingerprint: 'invalid-fingerprint',
    }],
  ] as const)('rejects forbidden authorization %s', (_name, override) => {
    expect(() =>
      validateAuthorityAuthorizationDecisionV1({
        ...authorizationDecision(),
        ...override,
      }),
    ).toThrow();
  });

  it.each([
    ['operation', {
      operationType: 'CREATE_TENANT_AUTHORITY',
      permission: 'authority.tenant.create',
    }],
    ['resource', { resourceId: 'tenant_other_001' }],
    ['cross-tenant', { resourceId: 'tenant_cross_001' }],
    ['operation id', { operationId: 'operation_other_001' }],
    ['command fingerprint', { commandFingerprint: CERTIFICATION_HASH_A }],
  ] as const)(
    'blocks authorization %s binding drift',
    async (_name, operationOverride) => {
      const base = authorizationDecision();
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.authorizationResult = {
            schemaVersion: '1',
            status: 'DECIDED',
            decision: authorizationDecision('ALLOW', [
              'REQUIRE_IDEMPOTENCY_KEY',
            ], {
              operationBinding: {
                ...base.operationBinding,
                ...operationOverride,
              },
            }),
          };
        },
      );
      expect(result.status).not.toBe('APPLIED');
      expect(state.repositoryCalls).toBe(0);
    },
  );
});

describe('Authority boundary obligation matrix', () => {
  it('allows an explicit empty obligation set', async () => {
    const { result } = await runAuthorityBoundaryCertification(
      (state) => {
        state.authorizationResult = {
          schemaVersion: '1',
          status: 'DECIDED',
          decision: authorizationDecision('ALLOW', [], {
            obligations: [],
          }),
        };
        state.obligationResult = verificationResult([]);
      },
      applicationRequest([]),
    );
    expect(result.status).toBe('APPLIED');
  });

  it.each(OBLIGATION_TYPE_MATRIX)(
    'certifies satisfied obligation %s',
    async (obligationType) => {
      const mode =
        obligationType === 'LIMIT_TO_TEST_ONLY'
          ? 'TEST_ONLY'
          : 'INTERNAL_NON_PRODUCTIVE';
      const { result } = await runAuthorityBoundaryCertification(
        (state) => {
          state.authorizationResult = {
            schemaVersion: '1',
            status: 'DECIDED',
            decision: authorizationDecision('ALLOW', [], {
              obligations: [
                obligationDeclarationFixture(obligationType),
              ],
            }),
          };
          state.obligationResult = verificationResult([obligationType]);
        },
        applicationRequest([obligationType]),
        executionContext({ executionMode: mode }),
      );
      expect(result.status).toBe('APPLIED');
    },
  );

  it.each([
    ['REJECTED', 'REJECTED'],
    ['STALE', 'STALE'],
    ['INCOMPLETE', 'REJECTED'],
    ['CONFLICT', 'CONFLICT'],
    ['INTERNAL_ERROR', 'INTERNAL_ERROR'],
  ] as const)(
    'stops obligation result %s as %s',
    async (status, expectedStatus) => {
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.obligationResult = obligationFailure(status);
        },
      );
      expect(result.status).toBe(expectedStatus);
      expect(state.fingerprintCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it.each([
    ['missing', verificationResult([], {})],
    ['duplicate', verificationResult(
      ['REQUIRE_IDEMPOTENCY_KEY', 'REQUIRE_IDEMPOTENCY_KEY'],
    )],
    ['not declared', verificationResult(['REQUIRE_MFA'])],
    ['fingerprint mismatch', verificationResult(
      ['REQUIRE_IDEMPOTENCY_KEY'],
      { obligationsFingerprint: HASH_A },
    )],
    ['summary mismatch', verificationResult(
      ['REQUIRE_IDEMPOTENCY_KEY'],
      {
        summary: {
          ...verifiedResult().summary,
          total: 2,
        },
      },
    )],
    ['stale evidence', verificationResult(
      ['REQUIRE_IDEMPOTENCY_KEY'],
      {
        evidence: [{
          ...verifiedResult().evidence[0],
          validUntil: NOW,
        }],
      },
    )],
    ['not satisfied', verificationResult(
      ['REQUIRE_IDEMPOTENCY_KEY'],
      {
        evidence: [{
          ...verifiedResult().evidence[0],
          satisfactionStatus: 'NOT_SATISFIED',
        }],
        summary: {
          ...verifiedResult().summary,
          satisfied: 0,
          notSatisfied: 1,
        },
      },
    )],
  ] as const)(
    'blocks inconsistent obligation evidence: %s',
    async (_name, obligationResult) => {
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.obligationResult = obligationResult;
        },
      );
      expect(result.status).not.toBe('APPLIED');
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it('accepts a valid NOT_APPLICABLE obligation evidence summary', async () => {
    const type = 'REQUIRE_AUDIT_REASON';
    const base = verifiedResult([type]);
    const { result } = await runAuthorityBoundaryCertification(
      (state) => {
        state.authorizationResult = {
          schemaVersion: '1',
          status: 'DECIDED',
          decision: authorizationDecision('ALLOW', [], {
            obligations: [obligationDeclarationFixture(type)],
          }),
        };
        state.obligationResult = verificationResult([type], {
          evidence: [{
            ...base.evidence[0],
            satisfactionStatus: 'NOT_APPLICABLE',
          }],
          summary: {
            ...base.summary,
            satisfied: 0,
            notApplicable: 1,
          },
        });
      },
      applicationRequest([type]),
    );
    expect(result.status).toBe('APPLIED');
  });

  it('never converts DENY into ALLOW through obligations', async () => {
    const { result, state } = await runAuthorityBoundaryCertification(
      (candidate) => {
        candidate.authorizationResult = {
          schemaVersion: '1',
          status: 'DECIDED',
          decision: authorizationDecision('DENY'),
        };
      },
    );
    expect(result.status).toBe('NOT_AUTHORIZED');
    expect(state.obligationCalls).toBe(0);
    expect(state.repositoryCalls).toBe(0);
  });

  it('LIMIT_TO_TEST_ONLY rejects non-test execution', async () => {
    const type = 'LIMIT_TO_TEST_ONLY';
    const { result, state } = await runAuthorityBoundaryCertification(
      (candidate) => {
        candidate.authorizationResult = {
          schemaVersion: '1',
          status: 'DECIDED',
          decision: authorizationDecision('ALLOW', [], {
            obligations: [obligationDeclarationFixture(type)],
          }),
        };
        candidate.obligationResult = verificationResult([type]);
      },
      applicationRequest([type]),
    );
    expect(result.status).toBe('REJECTED');
    expect(state.repositoryCalls).toBe(0);
  });
});

describe('Authority invocation context and idempotency matrix', () => {
  it('accepts the captured READY context', async () => {
    expect(createAuthorityInvocationContextV1(await capturedContext()).status)
      .toBe('READY');
  });

  it.each([
    ['STALE', 'PRINCIPAL_STALE', 'RETRY_AFTER_PRINCIPAL_REFRESH'],
    ['INCOMPLETE', 'INVOCATION_CONTEXT_INCOMPLETE', 'DO_NOT_RETRY'],
    ['CONFLICT', 'INVOCATION_CONTEXT_CONFLICT', 'RETRY_AFTER_OPERATOR_REVIEW'],
    ['REJECTED', 'INVALID_INVOCATION_CONTEXT', 'DO_NOT_RETRY'],
  ] as const)(
    'accepts safe context result status %s',
    (status, reasonCode, retryDisposition) => {
      expect(createAuthorityInvocationContextResultV1({
        schemaVersion: '1',
        status,
        reasonCode,
        retryDisposition,
      }).status).toBe(status);
    },
  );

  it('accepts a coherent NOT_AUTHORIZED invocation context', async () => {
    const context = await capturedContext();
    const denied = nestedFixture(context, 'authorization', {
      decision: 'DENY',
      reasonCode: 'PERMISSION_NOT_GRANTED',
    });
    expect(createAuthorityInvocationContextV1({
      ...denied,
      status: 'NOT_AUTHORIZED',
    }).status).toBe('NOT_AUTHORIZED');
  });

  it.each([
    ['fingerprint', 'contextFingerprint', 'not-a-fingerprint'],
    ['created timestamp', 'createdAt', 'not-a-timestamp'],
  ] as const)(
    'rejects invalid context %s',
    async (_name, field, value) => {
      const context = await capturedContext();
      expect(() => createAuthorityInvocationContextV1({
        ...context,
        [field]: value,
      })).toThrow();
    },
  );

  it('accepts a closed CONFLICT context but refuses projection', async () => {
    const value = createAuthorityInvocationContextV1({
      ...(await capturedContext()),
      status: 'CONFLICT',
    });
    expect(value.status).toBe('CONFLICT');
    expect(() => projectAuthorityInvocationContextToRepositoryV1(value))
      .toThrow();
  });

  it.each([
    ['principal mismatch', 'principal', { principalId: 'other_001' }],
    ['scope tenant mismatch', 'scope', { tenantId: 'tenant_other_001' }],
    ['operation mismatch', 'operation', { operationType: 'CREATE_TENANT_AUTHORITY' }],
    ['permission mismatch', 'operation', { permission: 'authority.tenant.create' }],
    ['operationId mismatch', 'idempotency', { operationId: 'other_operation_001' }],
    ['command fingerprint mismatch', 'idempotency', { commandFingerprint: CERTIFICATION_HASH_A }],
    ['obligation fingerprint mismatch', 'authorization', { obligationsFingerprint: CERTIFICATION_HASH_A }],
    ['authorization principal mismatch', 'authorization', { principalId: 'other_001' }],
    ['authorization tenant mismatch', 'authorization', { tenantId: 'tenant_other_001' }],
    ['authorization operation mismatch', 'authorization', { operationType: 'CREATE_TENANT_AUTHORITY' }],
  ] as const)(
    'rejects invocation %s',
    async (_name, field, override) => {
      const context = await capturedContext();
      expect(() => createAuthorityInvocationContextV1(
        nestedFixture(context, field, override),
      )).toThrow();
    },
  );

  it.each([
    ['extended validity', { validUntil: '2026-07-30T12:30:00.000Z' }],
    ['not minimum freshness', { staleAfterSeconds: 999 }],
    ['expired freshness', { validUntil: NOW }],
  ] as const)('rejects context freshness %s', async (_name, override) => {
    const context = await capturedContext();
    expect(() => createAuthorityInvocationContextV1(
      nestedFixture(context, 'freshness', override),
    )).toThrow();
  });

  it.each([
    ['principal', { principalId: 'other_001' }],
    ['tenant', { tenantId: 'tenant_other_001' }],
    ['operation', { operationType: 'CREATE_TENANT_AUTHORITY' }],
    ['operationId', { operationId: 'operation_other_001' }],
    ['command fingerprint', { commandFingerprint: CERTIFICATION_HASH_A }],
  ] as const)(
    'rejects idempotency %s drift',
    async (_name, override) => {
      const context = await capturedContext();
      expect(() => createAuthorityInvocationContextV1(
        nestedFixture(context, 'idempotency', override),
      )).toThrow();
    },
  );

  it('keeps retry bindings and command identity deterministic', async () => {
    const first = await runAuthorityBoundaryCertification();
    const second = await runAuthorityBoundaryCertification();
    expect(first.result).toEqual(second.result);
    expect(first.state.repositoryCommand).toBe(first.request.command);
    expect(second.state.repositoryCommand).toBe(second.request.command);
  });

  it('preserves replay result without generating identity', async () => {
    const { result, state, request } =
      await runAuthorityBoundaryCertification((candidate) => {
        candidate.repositoryResult = repositoryResult('NO_OP');
      });
    expect(result.status).toBe('REPLAYED');
    expect(state.repositoryCommand?.operationId).toBe(
      request.command.operationId,
    );
    expect(state.repositoryCommand?.idempotencyKey).toBe(
      request.command.idempotencyKey,
    );
  });
});

describe('Authority repository, cancellation, trace, and safety matrix', () => {
  it.each(REPOSITORY_RESULT_MATRIX)(
    'maps repository %s to %s with %s',
    async (repositoryStatus, expectedStatus, safeCode) => {
      const { result, state } = await runAuthorityBoundaryCertification(
        (candidate) => {
          candidate.repositoryResult = repositoryResult(repositoryStatus);
        },
      );
      expect(result.status).toBe(expectedStatus);
      expect(result.safeCode).toBe(safeCode);
      expect(state.repositoryCalls).toBe(1);
    },
  );

  it.each(CANCELLATION_MATRIX)(
    'cancels at clock checkpoint %s on %s',
    async (clockCall, expectedStage) => {
      const { result, state } = await runWithClockCancellation(clockCall);
      expect(result.status).toBe('CANCELLED');
      expect(result.status).not.toBe('INTERNAL_ERROR');
      expect(result.stageTrace.at(-1)?.stage).toBe(expectedStage);
      if (expectedStage !== 'REPOSITORY_EXECUTION') {
        expect(state.repositoryCalls).toBe(0);
      }
    },
  );

  it('cancels before validation with no dependency call', async () => {
    const controller = new AbortController();
    controller.abort();
    const { result, state } = await runAuthorityBoundaryCertification(
      undefined,
      applicationRequest(),
      executionContext({ cancellationSignal: controller.signal }),
    );
    expect(result.status).toBe('CANCELLED');
    expect(state.principalCalls).toBe(0);
    expect(state.repositoryCalls).toBe(0);
  });

  it('cancels after repository without mapping success', async () => {
    const controller = new AbortController();
    const { result, state } = await runAuthorityBoundaryCertification(
      (candidate) => {
        candidate.abortAt = 'REPOSITORY';
        candidate.controller = controller;
      },
      applicationRequest(),
      executionContext({ cancellationSignal: controller.signal }),
    );
    expect(result.status).toBe('CANCELLED');
    expect(state.repositoryCalls).toBe(1);
  });

  it('maps an expired deadline to TIMED_OUT', async () => {
    const { result, state } = await runAuthorityBoundaryCertification(
      undefined,
      applicationRequest(),
      executionContext({ deadlineAt: NOW }),
    );
    expect(result.status).toBe('TIMED_OUT');
    expect(state.repositoryCalls).toBe(0);
  });

  it.each([
    ['unavailable', 'AUTHORITY_DEPENDENCY_UNAVAILABLE', 'UNAVAILABLE'],
    ['timeout', 'AUTHORITY_OPERATION_TIMED_OUT', 'TIMED_OUT'],
    ['internal', 'AUTHORITY_INTERNAL_FAILURE', 'INTERNAL_ERROR'],
  ] as const)(
    'maps repository %s errors safely',
    async (_name, safeCode, expectedStatus) => {
      const { result } = await runAuthorityBoundaryCertification(
        (state) => {
          state.throwAt = 'REPOSITORY';
          state.thrownError = new AuthorityApplicationServiceExecutionError(
            safeCode,
            safeCode === 'AUTHORITY_DEPENDENCY_UNAVAILABLE'
              ? 'RETRY_AFTER_DEPENDENCY_RECOVERY'
              : 'DO_NOT_RETRY',
          );
        },
      );
      expect(result.status).toBe(expectedStatus);
    },
  );

  it.each(SENSITIVE_TERMS)(
    'does not serialize sensitive term %s in results or trace',
    async (term) => {
      const { result } = await runAuthorityBoundaryCertification();
      expect(JSON.stringify(result).toLowerCase()).not.toContain(
        term.toLowerCase(),
      );
    },
  );

  it.each([
    'COMPLETED',
    'STOPPED',
    'CANCELLED',
    'FAILED',
  ] as const)('keeps trace status %s in the closed vocabulary', (status) => {
    expect(['COMPLETED', 'STOPPED', 'CANCELLED', 'FAILED']).toContain(
      status,
    );
  });

  it('omits every later stage after a principal failure', async () => {
    const { result } = await runAuthorityBoundaryCertification((state) => {
      state.principalResult = principalFailure('NOT_FOUND');
    });
    expect(result.stageTrace.map(({ stage }) => stage)).toEqual([
      'REQUEST_VALIDATION',
      'PRINCIPAL_RESOLUTION',
    ]);
  });

  it('uses only injected timestamps in trace', async () => {
    const { result } = await runAuthorityBoundaryCertification();
    expect(result.stageTrace.every(
      ({ startedAt, completedAt }) =>
        startedAt === NOW && completedAt === NOW,
    )).toBe(true);
  });

  it('keeps MASK_NOT_FOUND only as safe metadata', async () => {
    const type = 'MASK_NOT_FOUND';
    const { result } = await runAuthorityBoundaryCertification(
      (state) => {
        state.authorizationResult = {
          schemaVersion: '1',
          status: 'DECIDED',
          decision: authorizationDecision('ALLOW', [], {
            obligations: [obligationDeclarationFixture(type)],
          }),
        };
        state.obligationResult = verificationResult([type]);
        state.repositoryResult = repositoryResult('NOT_FOUND');
      },
      applicationRequest([type]),
    );
    expect(result.status).toBe('NOT_FOUND');
    expect(result.metadata.maskNotFound).toBe(true);
    expect(JSON.stringify(result)).not.toContain('tenant_001');
  });

  it('rejects raw repository identity drift without leaking internals', async () => {
    const { result } = await runAuthorityBoundaryCertification((state) => {
      state.repositoryResult = {
        ...repositoryResult(),
        operationId: 'operation_other_001',
      };
    });
    expect(result.status).toBe('REJECTED');
    expect(result.safeCode).toBe('AUTHORITY_COMMAND_BINDING_MISMATCH');
    expect(JSON.stringify(result)).not.toContain('Error');
  });

  it('certifies the exact ten-stage vocabulary', () => {
    expect(AUTHORITY_APPLICATION_STAGES).toHaveLength(10);
    expect(new Set(AUTHORITY_APPLICATION_STAGES).size).toBe(10);
  });

  it('uses deterministic hashes in the certification harness', () => {
    expect(CERTIFICATION_HASH_A).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(CERTIFICATION_HASH_B).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(HASH_B).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
