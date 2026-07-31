import type {
  AuthorityAuthorizationResultV1,
} from '../../serverAuthorityAuthorization/authorityAuthorizationTypes';
import type {
  AuthorityMutationRepositoryPort,
} from '../../serverAuthorityPersistence/ports';
import type {
  AuthorityRepositoryResultV1,
} from '../../serverAuthorityPersistence/types';
import type {
  AuthorityPrincipalResolutionResultV1,
} from '../../serverPrincipalResolution/principalResolutionTypes';
import type {
  AuthorityTenantScopeResolutionResultV1,
} from '../../serverTenantScopeResolution/tenantScopeResolutionTypes';
import type {
  AuthorityApplicationServiceDependenciesV1,
  AuthorityInvocationContextFingerprintPort,
} from '../authorityApplicationServicePorts';
import type {
  AuthorityApplicationExecutionContextV1,
  AuthorityApplicationServiceRequestV1,
  AuthorityObligationVerificationResultV1,
} from '../authorityApplicationServiceTypes';

export const PRINCIPAL_ID = 'apr_v1_human_binding_human_001';
export const TENANT_ID = 'tenant_001';
export const RECEIVED_AT = '2026-07-30T12:00:00.000Z';
export const RESOLVED_AT = '2026-07-30T12:00:10.000Z';
export const EVALUATED_AT = '2026-07-30T12:00:30.000Z';
export const CREATED_AT = '2026-07-30T12:01:00.000Z';
export const NOW = '2026-07-30T12:01:30.000Z';
export const OBLIGATION_VALID_UNTIL = '2026-07-30T12:04:30.000Z';
export const AUTHORIZATION_VALID_UNTIL = '2026-07-30T12:05:30.000Z';
export const SCOPE_VALID_UNTIL = '2026-07-30T12:08:30.000Z';
export const PRINCIPAL_VALID_UNTIL = '2026-07-30T12:10:30.000Z';
export const HASH_A = `sha256:${'a'.repeat(64)}`;
export const HASH_B = `sha256:${'b'.repeat(64)}`;
export const HASH_C = `sha256:${'c'.repeat(64)}`;
export const HASH_D = `sha256:${'d'.repeat(64)}`;
export const HASH_E = `sha256:${'e'.repeat(64)}`;
export const HASH_F = `sha256:${'f'.repeat(64)}`;

type Input = Readonly<Record<string, unknown>>;

export function principalRequest(): AuthorityApplicationServiceRequestV1['principalResolutionRequest'] {
  return {
    schemaVersion: '1',
    requestType: 'VERIFIED_FIREBASE_USER',
    authenticationMethod: 'FIREBASE_ID_TOKEN',
    firebaseUid: 'firebase_uid_001',
    tokenIssuedAt: '2026-07-30T11:59:30.000Z',
    tokenAuthTime: '2026-07-30T11:59:00.000Z',
    authenticatedAt: '2026-07-30T11:59:40.000Z',
    authProvider: 'FEDERATED_OIDC',
    tokenIdHash: HASH_A,
    claimsVersion: 'claims-v1',
    revocationCheckedAt: '2026-07-30T11:59:50.000Z',
    issuer: 'https://securetoken.example.test',
    audience: 'authority-project',
    appCheckEvidence: {
      schemaVersion: '1',
      status: 'REQUIRED_AND_VALID',
      applicationIdHash: HASH_B,
      attestationProvider: 'play_integrity',
      verifiedAt: '2026-07-30T11:59:45.000Z',
      replayProtection: 'ENFORCED',
    },
  };
}

export function resolvedPrincipal(
  overrides: Input = {},
): Extract<
  AuthorityPrincipalResolutionResultV1,
  { status: 'RESOLVED' }
>['principal'] {
  return {
    schemaVersion: '1',
    version: '1',
    principalId: PRINCIPAL_ID,
    principalType: 'HUMAN_USER',
    firebaseUid: 'firebase_uid_001',
    platformUserId: 'platform_user_001',
    status: 'ACTIVE',
    authenticationBinding: {
      schemaVersion: '1',
      bindingType: 'FIREBASE_USER',
      bindingId: 'binding_human_001',
      bindingVersion: 'binding-v1',
      authenticationMethod: 'FIREBASE_ID_TOKEN',
      firebaseUid: 'firebase_uid_001',
      platformUserId: 'platform_user_001',
      tokenIssuedAt: '2026-07-30T11:59:30.000Z',
      tokenAuthTime: '2026-07-30T11:59:00.000Z',
      authProvider: 'FEDERATED_OIDC',
      tokenIdHash: HASH_A,
      claimsVersion: 'claims-v1',
    },
    assurance: {
      schemaVersion: '1',
      level: 'HIGH',
      authenticationMethod: 'FIREBASE_ID_TOKEN',
      authenticatedAt: '2026-07-30T11:59:40.000Z',
      freshnessWindowSeconds: 300,
      secondFactorSatisfied: true,
      appCheckEvidence: {
        schemaVersion: '1',
        status: 'REQUIRED_AND_VALID',
        applicationIdHash: HASH_B,
        attestationProvider: 'play_integrity',
        verifiedAt: '2026-07-30T11:59:45.000Z',
        replayProtection: 'ENFORCED',
      },
      tokenRevocationChecked: true,
      issuerValidated: true,
      audienceValidated: true,
    },
    resolutionEvidence: {
      schemaVersion: '1',
      authenticationSource: 'FIREBASE_AUTH',
      bindingSource: 'PLATFORM_IDENTITY_REGISTRY',
      canonicalBindingVersion: 'binding-v1',
      claimsVersion: 'claims-v1',
      claimsSnapshot: {
        schemaVersion: '1',
        claimsVersion: 'claims-v1',
        tokenIssuedAt: '2026-07-30T11:59:30.000Z',
        tokenAuthTime: '2026-07-30T11:59:00.000Z',
        tokenExpiresAt: '2026-07-30T13:00:00.000Z',
        issuer: 'https://securetoken.example.test',
        audience: 'authority-project',
        subjectFingerprint: HASH_A,
        snapshotFingerprint: HASH_B,
      },
      revocationCheckStatus: 'CHECKED_VALID',
      assuranceLevel: 'HIGH',
      resolverVersion: 'principal-resolver-v1',
      resolvedAt: RESOLVED_AT,
      evidenceFingerprint: HASH_C,
    },
    resolvedAt: RESOLVED_AT,
    freshness: {
      schemaVersion: '1',
      resolvedAt: RESOLVED_AT,
      validUntil: PRINCIPAL_VALID_UNTIL,
      sourceVersion: 'identity-source-v1',
      claimsVersion: 'claims-v1',
      bindingVersion: 'binding-v1',
      revocationCheckedAt: '2026-07-30T11:59:50.000Z',
      staleAfterSeconds: 620,
    },
    ...overrides,
  } as Extract<
    AuthorityPrincipalResolutionResultV1,
    { status: 'RESOLVED' }
  >['principal'];
}

export function resolvedScope(
  overrides: Input = {},
): Extract<
  AuthorityTenantScopeResolutionResultV1,
  { status: 'RESOLVED' }
>['scope'] {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'TENANT',
    status: 'ACTIVE',
    tenantId: TENANT_ID,
    canonicalTenantAuthorityVersion: 'tenant-v1',
    membershipBinding: {
      schemaVersion: '1',
      membershipId: 'membership_001',
      tenantId: TENANT_ID,
      principalId: PRINCIPAL_ID,
      membershipStatus: 'ACTIVE',
      membershipVersion: 'membership-v1',
      tenantAuthorityVersion: 'tenant-v1',
      roleSetVersion: 'role-set-v1',
      bindingVersion: 'membership-binding-v1',
      resolvedAt: RESOLVED_AT,
      source: 'CANONICAL_MEMBERSHIP',
      evidenceFingerprint: HASH_D,
    },
    tenantStatus: 'ACTIVE',
    requestedTenantSelector: {
      schemaVersion: '1',
      selectorType: 'TENANT_ID',
      requestedTenantId: TENANT_ID,
    },
    source: 'CANONICAL_MEMBERSHIP',
    resolvedAt: RESOLVED_AT,
    freshness: {
      schemaVersion: '1',
      resolvedAt: RESOLVED_AT,
      validUntil: SCOPE_VALID_UNTIL,
      tenantAuthorityVersion: 'tenant-v1',
      membershipVersion: 'membership-v1',
      bindingVersion: 'binding-v1',
      staleAfterSeconds: 500,
    },
    resolutionEvidence: {
      schemaVersion: '1',
      selectorType: 'TENANT_ID',
      source: 'CANONICAL_MEMBERSHIP',
      tenantAuthorityVersion: 'tenant-v1',
      membershipBindingVersion: 'membership-binding-v1',
      resolverVersion: 'scope-resolver-v1',
      resolvedAt: RESOLVED_AT,
      evidenceFingerprint: HASH_D,
      principalId: PRINCIPAL_ID,
      principalBindingVersion: 'binding-v1',
      sourceVersions: [
        {
          source: 'CANONICAL_MEMBERSHIP',
          version: 'membership-v1',
        },
        {
          source: 'CANONICAL_TENANT_AUTHORITY',
          version: 'tenant-v1',
        },
      ],
    },
    ...overrides,
  } as Extract<
    AuthorityTenantScopeResolutionResultV1,
    { status: 'RESOLVED' }
  >['scope'];
}

function authorizationObligations(
  obligationTypes: readonly string[],
): AuthorityAuthorizationResultV1 extends never
  ? never
  : readonly Input[] {
  return obligationTypes.map((obligationType) => {
    if (obligationType === 'REQUIRE_IDEMPOTENCY_KEY') {
      return {
        schemaVersion: '1',
        obligationType,
        namespace: 'PRINCIPAL_SCOPE_OPERATION',
      };
    }
    if (obligationType === 'REQUIRE_EXPECTED_VERSION') {
      return {
        schemaVersion: '1',
        obligationType,
        versionSource: 'RESOURCE_AUTHORITY_VERSION',
      };
    }
    if (obligationType === 'LIMIT_TO_TEST_ONLY') {
      return {
        schemaVersion: '1',
        obligationType,
        executionMode: 'TEST_ONLY',
      };
    }
    return {
      schemaVersion: '1',
      obligationType: 'MASK_NOT_FOUND',
      externalCode: 'PERMISSION_DENIED',
    };
  });
}

export function authorizationDecision(
  decisionValue:
    | 'ALLOW'
    | 'DENY'
    | 'INDETERMINATE'
    | 'NOT_APPLICABLE' = 'ALLOW',
  obligationTypes: readonly string[] = ['REQUIRE_IDEMPOTENCY_KEY'],
  overrides: Input = {},
): Extract<
  AuthorityAuthorizationResultV1,
  { status: 'DECIDED' }
>['decision'] {
  const reasons = {
    ALLOW: ['POLICY_RULE_MATCHED'],
    DENY: ['PERMISSION_NOT_GRANTED'],
    INDETERMINATE: ['POLICY_NOT_FOUND'],
    NOT_APPLICABLE: ['OPERATION_NOT_SUPPORTED'],
  } as const;
  return {
    schemaVersion: '1',
    version: '1',
    decision: decisionValue,
    permission: 'authority.tenant.status.update',
    principalBinding: {
      schemaVersion: '1',
      principalId: PRINCIPAL_ID,
      principalType: 'HUMAN_USER',
      principalStatus: 'ACTIVE',
      authenticationMethod: 'FIREBASE_ID_TOKEN',
      assuranceLevel: 'HIGH',
      principalBindingVersion: 'binding-v1',
      principalEvidenceFingerprint: HASH_C,
      resolvedAt: RESOLVED_AT,
      validUntil: PRINCIPAL_VALID_UNTIL,
    },
    scopeBinding: {
      schemaVersion: '1',
      scopeType: 'TENANT',
      scopeStatus: 'ACTIVE',
      tenantAuthorityVersion: 'tenant-v1',
      membershipBindingVersion: 'membership-binding-v1',
      scopeEvidenceFingerprint: HASH_D,
      principalId: PRINCIPAL_ID,
      resolvedAt: RESOLVED_AT,
      validUntil: SCOPE_VALID_UNTIL,
      tenantId: TENANT_ID,
    },
    operationBinding: {
      schemaVersion: '1',
      operationType: 'UPDATE_TENANT_STATUS',
      permission: 'authority.tenant.status.update',
      commandVersion: '1',
      resourceType: 'TENANT',
      resourceId: TENANT_ID,
      operationId: 'operation_001',
      commandFingerprint: HASH_B,
      requestedAt: CREATED_AT,
      channel: 'FIREBASE_CALLABLE',
    },
    resourceBinding: {
      schemaVersion: '1',
      resourceType: 'TENANT',
      tenantId: TENANT_ID,
    },
    policyEvidence: {
      schemaVersion: '1',
      policyId: 'authority_policy_001',
      policyVersion: 'policy-v1',
      evaluatorVersion: 'authorization-evaluator-v1',
      decisionRuleId: 'tenant_status_update_rule',
      evaluatedAt: EVALUATED_AT,
      validUntil: AUTHORIZATION_VALID_UNTIL,
      evidenceFingerprint: HASH_A,
      inputFingerprint: HASH_E,
      principalEvidenceFingerprint: HASH_C,
      scopeEvidenceFingerprint: HASH_D,
      policySource: 'VERSIONED_POLICY_BUNDLE',
      matchedRuleReferences: ['rule_tenant_status_update'],
      roleSetVersion: 'role-set-v1',
      membershipVersion: 'membership-v1',
    },
    obligations: authorizationObligations(
      obligationTypes,
    ) as Extract<
      AuthorityAuthorizationResultV1,
      { status: 'DECIDED' }
    >['decision']['obligations'],
    freshness: {
      schemaVersion: '1',
      evaluatedAt: EVALUATED_AT,
      validUntil: AUTHORIZATION_VALID_UNTIL,
      principalValidUntil: PRINCIPAL_VALID_UNTIL,
      scopeValidUntil: SCOPE_VALID_UNTIL,
      policyVersion: 'policy-v1',
      inputFingerprint: HASH_E,
      staleAfterSeconds: 300,
    },
    reasonCodes: reasons[decisionValue],
    decisionFingerprint: HASH_F,
    evaluatedAt: EVALUATED_AT,
    ...overrides,
  } as Extract<
    AuthorityAuthorizationResultV1,
    { status: 'DECIDED' }
  >['decision'];
}

export function verificationResult(
  obligationTypes: readonly string[] = ['REQUIRE_IDEMPOTENCY_KEY'],
  overrides: Input = {},
): AuthorityObligationVerificationResultV1 {
  const evidence = obligationTypes.map((obligationType, index) => ({
    schemaVersion: '1' as const,
    obligationType:
      obligationType as Extract<
        AuthorityObligationVerificationResultV1,
        { status: 'VERIFIED' }
      >['evidence'][number]['obligationType'],
    satisfactionStatus: 'SATISFIED' as const,
    satisfiedAt: CREATED_AT,
    evidenceFingerprint:
      index % 2 === 0 ? HASH_A : HASH_B,
    verifierVersion: 'obligation-verifier-v1',
    validUntil: OBLIGATION_VALID_UNTIL,
  }));
  return {
    schemaVersion: '1',
    status: 'VERIFIED',
    evidence,
    summary: {
      schemaVersion: '1',
      total: evidence.length,
      satisfied: evidence.length,
      notApplicable: 0,
      stale: 0,
      notSatisfied: 0,
      fingerprint: HASH_F,
    },
    obligationsFingerprint: HASH_F,
    safeCode: 'OBLIGATIONS_VERIFIED',
    retryDisposition: 'DO_NOT_RETRY',
    maskNotFound: obligationTypes.includes('MASK_NOT_FOUND'),
    ...overrides,
  } as AuthorityObligationVerificationResultV1;
}

export function applicationRequest(
  obligationTypes: readonly string[] = ['REQUIRE_IDEMPOTENCY_KEY'],
  overrides: Input = {},
): AuthorityApplicationServiceRequestV1 {
  return {
    schemaVersion: '1',
    principalResolutionRequest: principalRequest(),
    tenantSelector: {
      schemaVersion: '1',
      selectorType: 'TENANT_ID',
      requestedTenantId: TENANT_ID,
    },
    scopeOperationCategory: 'TENANT_OPERATION',
    authorizationOperation: {
      schemaVersion: '1',
      operationType: 'UPDATE_TENANT_STATUS',
      permission: 'authority.tenant.status.update',
      commandVersion: '1',
      resourceType: 'TENANT',
      resourceId: TENANT_ID,
      operationId: 'operation_001',
      commandFingerprint: HASH_B,
      requestedAt: CREATED_AT,
      channel: 'FIREBASE_CALLABLE',
    },
    authorizationResource: {
      schemaVersion: '1',
      resourceType: 'TENANT',
      tenantId: TENANT_ID,
    },
    command: {
      schemaVersion: '1',
      operationType: 'UPDATE_TENANT_STATUS',
      operationId: 'operation_001',
      idempotencyKey: 'idempotency_001',
      actor: {
        actorType: 'USER',
        actorId: PRINCIPAL_ID,
      },
      requestedAt: CREATED_AT,
      precondition: {
        schemaVersion: '1',
        type: 'MUST_EXIST_AT_VERSION',
        recordVersion: 1,
      },
      reasonCode: 'TENANT_STATUS_CHANGE',
      requestId: 'request_001',
      correlationId: 'correlation_001',
      payload: {
        tenantId: TENANT_ID,
        currentStatus: 'ACTIVE',
        targetStatus: 'SUSPENDED',
      },
    },
    idempotency: {
      schemaVersion: '1',
      idempotencyKey: 'idempotency_001',
      callerKeyHash: HASH_A,
      namespaceVersion: 'principal-scope-operation-v1',
      commandFingerprint: HASH_B,
    },
    obligationEvidence: obligationTypes.map((obligationType) => ({
      schemaVersion: '1',
      obligationType:
        obligationType as AuthorityApplicationServiceRequestV1['obligationEvidence'][number]['obligationType'],
      evidenceFingerprint: HASH_A,
      observedAt: CREATED_AT,
      validUntil: OBLIGATION_VALID_UNTIL,
      verifierReference: 'evidence_reference_001',
    })),
    ...overrides,
  } as AuthorityApplicationServiceRequestV1;
}

export function executionContext(
  overrides: Input = {},
): AuthorityApplicationExecutionContextV1 {
  return {
    schemaVersion: '1',
    requestId: 'request_001',
    correlationId: 'correlation_001',
    causationId: 'causation_001',
    channel: 'FIREBASE_CALLABLE',
    receivedAt: RECEIVED_AT,
    evaluatedAt: EVALUATED_AT,
    createdAt: CREATED_AT,
    deadlineAt: '2026-07-30T12:03:00.000Z',
    traceId: 'trace_001',
    clientRequestIdHash: HASH_A,
    principalResolverVersion: 'principal-resolver-v1',
    scopeResolverVersion: 'scope-resolver-v1',
    authorizationEvaluatorVersion: 'authorization-evaluator-v1',
    executionMode: 'INTERNAL_NON_PRODUCTIVE',
    ...overrides,
  } as AuthorityApplicationExecutionContextV1;
}

export function repositoryResult(
  status: AuthorityRepositoryResultV1['status'] = 'APPLIED',
): AuthorityRepositoryResultV1 {
  const base = {
    schemaVersion: '1' as const,
    operationId: 'operation_001',
    correlationId: 'correlation_001',
    safeCode:
      status === 'NO_OP' ? 'IDEMPOTENT_REPLAY' : `RESULT_${status}`,
    completedAt: '2026-07-30T12:01:40.000Z',
    retryDisposition:
      status === 'CONFLICT'
        ? ('RETRY_AFTER_READ' as const)
        : ('DO_NOT_RETRY' as const),
  };
  if (status === 'APPLIED') {
    return {
      ...base,
      status,
      resultingVersion: 2,
      resourceReference: TENANT_ID,
    };
  }
  if (status === 'NO_OP') {
    return {
      ...base,
      status,
      resultingVersion: 1,
      resourceReference: TENANT_ID,
    };
  }
  return { ...base, status };
}

export interface DependencyState {
  principalResult: AuthorityPrincipalResolutionResultV1;
  scopeResult: AuthorityTenantScopeResolutionResultV1;
  authorizationResult: AuthorityAuthorizationResultV1;
  obligationResult: AuthorityObligationVerificationResultV1;
  repositoryResult: AuthorityRepositoryResultV1;
  principalCalls: number;
  scopeCalls: number;
  authorizationCalls: number;
  obligationCalls: number;
  fingerprintCalls: number;
  repositoryCalls: number;
  clockCalls: number;
  repositoryCommand?: Parameters<
    AuthorityMutationRepositoryPort['execute']
  >[0];
  repositoryContext?: Parameters<
    AuthorityMutationRepositoryPort['execute']
  >[1];
  fingerprintInput?: Parameters<
    AuthorityInvocationContextFingerprintPort['fingerprint']
  >[0];
  abortAt?:
    | 'PRINCIPAL'
    | 'SCOPE'
    | 'AUTHORIZATION'
    | 'OBLIGATION'
    | 'FINGERPRINT'
    | 'REPOSITORY';
  controller?: AbortController;
  throwAt?: 'PRINCIPAL' | 'SCOPE' | 'AUTHORIZATION' | 'OBLIGATION' | 'FINGERPRINT' | 'REPOSITORY';
  thrownError?: unknown;
}

export function dependencyState(): DependencyState {
  return {
    principalResult: {
      schemaVersion: '1',
      status: 'RESOLVED',
      principal: resolvedPrincipal(),
    },
    scopeResult: {
      schemaVersion: '1',
      status: 'RESOLVED',
      scope: resolvedScope(),
    },
    authorizationResult: {
      schemaVersion: '1',
      status: 'DECIDED',
      decision: authorizationDecision(),
    },
    obligationResult: verificationResult(),
    repositoryResult: repositoryResult(),
    principalCalls: 0,
    scopeCalls: 0,
    authorizationCalls: 0,
    obligationCalls: 0,
    fingerprintCalls: 0,
    repositoryCalls: 0,
    clockCalls: 0,
  };
}

function maybeAbort(state: DependencyState, stage: DependencyState['abortAt']): void {
  if (state.abortAt === stage) {
    state.controller?.abort();
  }
}

function maybeThrow(state: DependencyState, stage: DependencyState['throwAt']): void {
  if (state.throwAt === stage) {
    throw state.thrownError ?? new Error('safe test failure');
  }
}

export function dependencies(
  state: DependencyState,
): AuthorityApplicationServiceDependenciesV1 {
  return {
    principalResolver: {
      async resolve() {
        state.principalCalls += 1;
        maybeThrow(state, 'PRINCIPAL');
        maybeAbort(state, 'PRINCIPAL');
        return state.principalResult;
      },
    },
    tenantScopeResolver: {
      async resolve() {
        state.scopeCalls += 1;
        maybeThrow(state, 'SCOPE');
        maybeAbort(state, 'SCOPE');
        return state.scopeResult;
      },
    },
    authorizationEvaluator: {
      async evaluate() {
        state.authorizationCalls += 1;
        maybeThrow(state, 'AUTHORIZATION');
        maybeAbort(state, 'AUTHORIZATION');
        return state.authorizationResult;
      },
    },
    obligationVerifier: {
      async verify() {
        state.obligationCalls += 1;
        maybeThrow(state, 'OBLIGATION');
        maybeAbort(state, 'OBLIGATION');
        return state.obligationResult;
      },
    },
    contextFingerprintProvider: {
      async fingerprint(input) {
        state.fingerprintCalls += 1;
        state.fingerprintInput = input;
        maybeThrow(state, 'FINGERPRINT');
        maybeAbort(state, 'FINGERPRINT');
        return HASH_E;
      },
    },
    repository: {
      async execute(command, context) {
        state.repositoryCalls += 1;
        state.repositoryCommand = command;
        state.repositoryContext = context;
        maybeThrow(state, 'REPOSITORY');
        maybeAbort(state, 'REPOSITORY');
        return state.repositoryResult;
      },
    },
    clock: {
      nowIso() {
        state.clockCalls += 1;
        return NOW;
      },
    },
  };
}
