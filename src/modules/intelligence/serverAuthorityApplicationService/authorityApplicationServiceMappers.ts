import type {
  AuthorityAuthorizationDecisionV1,
  AuthorityAuthorizationPrincipalBindingV1,
  AuthorityAuthorizationRequestV1,
  AuthorityAuthorizationResourceBindingV1,
  AuthorityAuthorizationScopeBindingV1,
} from '../serverAuthorityAuthorization/authorityAuthorizationTypes';
import type {
  AuthorityInvocationAuthorizationProjectionV1,
  AuthorityInvocationFreshnessV1,
  AuthorityInvocationIdempotencyV1,
  AuthorityInvocationOperationBindingV1,
  AuthorityInvocationPrincipalProjectionV1,
  AuthorityInvocationRequestMetadataV1,
  AuthorityInvocationScopeProjectionV1,
} from '../serverAuthorityInvocationContext/authorityInvocationContextTypes';
import type {
  AuthorityAdministrativeCommandV1,
  AuthorityRepositoryResultV1,
} from '../serverAuthorityPersistence/types';
import type {
  AuthorityPrincipalResolutionContextV1,
  ResolvedAuthorityPrincipalV1,
} from '../serverPrincipalResolution/principalResolutionTypes';
import type {
  AuthorityResolvedPrincipalReferenceV1,
  AuthorityTenantScopeResolutionContextV1,
  AuthorityTenantScopeResolutionRequestV1,
  ResolvedAuthorityTenantScopeV1,
} from '../serverTenantScopeResolution/tenantScopeResolutionTypes';
import type {
  AuthorityApplicationExecutionContextV1,
  AuthorityApplicationResultMetadataV1,
  AuthorityApplicationServiceRequestV1,
  AuthorityApplicationServiceResultV1,
  AuthorityApplicationStageTraceV1,
  AuthorityInvocationContextFingerprintInputV1,
  AuthorityObligationVerificationSuccessV1,
} from './authorityApplicationServiceTypes';

export function mapPrincipalResolutionContextV1(
  context: AuthorityApplicationExecutionContextV1,
  resolutionTime: string,
): AuthorityPrincipalResolutionContextV1 {
  return Object.freeze({
    schemaVersion: '1',
    requestId: context.requestId,
    correlationId: context.correlationId,
    channel: context.channel,
    resolverVersion: context.principalResolverVersion,
    resolutionTime,
  });
}

export function mapResolvedPrincipalReferenceV1(
  principal: ResolvedAuthorityPrincipalV1,
): AuthorityResolvedPrincipalReferenceV1 {
  return Object.freeze({
    schemaVersion: '1',
    principalId: principal.principalId,
    principalType: principal.principalType,
    principalBindingVersion:
      principal.resolutionEvidence.canonicalBindingVersion,
    principalEvidenceFingerprint:
      principal.resolutionEvidence.evidenceFingerprint,
    principalResolvedAt: principal.resolvedAt,
  });
}

export function mapTenantScopeResolutionRequestV1(
  request: AuthorityApplicationServiceRequestV1,
  context: AuthorityApplicationExecutionContextV1,
  principal: ResolvedAuthorityPrincipalV1,
  resolutionTime: string,
): AuthorityTenantScopeResolutionRequestV1 {
  return Object.freeze({
    schemaVersion: '1',
    principalReference: mapResolvedPrincipalReferenceV1(principal),
    selector: request.tenantSelector,
    channel: context.channel,
    requestId: context.requestId,
    correlationId: context.correlationId,
    resolutionTime,
    ...(request.scopeOperationCategory === undefined
      ? {}
      : { operationCategory: request.scopeOperationCategory }),
  });
}

export function mapTenantScopeResolutionContextV1(
  context: AuthorityApplicationExecutionContextV1,
  resolutionTime: string,
): AuthorityTenantScopeResolutionContextV1 {
  return Object.freeze({
    schemaVersion: '1',
    requestId: context.requestId,
    correlationId: context.correlationId,
    channel: context.channel,
    resolutionTime,
    resolverVersion: context.scopeResolverVersion,
    cancellationPolicy: 'EXTERNAL_EXECUTION_CONTEXT',
  });
}

export function mapAuthorizationPrincipalBindingV1(
  principal: ResolvedAuthorityPrincipalV1,
): AuthorityAuthorizationPrincipalBindingV1 {
  return Object.freeze({
    schemaVersion: '1',
    principalId: principal.principalId,
    principalType: principal.principalType,
    principalStatus: principal.status,
    authenticationMethod:
      principal.authenticationBinding.authenticationMethod,
    assuranceLevel: principal.assurance.level,
    principalBindingVersion:
      principal.resolutionEvidence.canonicalBindingVersion,
    principalEvidenceFingerprint:
      principal.resolutionEvidence.evidenceFingerprint,
    resolvedAt: principal.resolvedAt,
    validUntil: principal.freshness.validUntil,
  });
}

function resourceTenantId(
  resource: AuthorityAuthorizationResourceBindingV1,
): string | undefined {
  switch (resource.resourceType) {
    case 'TENANT':
    case 'MEMBERSHIP':
    case 'ALIAS':
      return resource.tenantId;
    case 'LEGACY_TENANT_SOURCE':
      return resource.canonicalTenantCandidate;
  }
}

function resourceId(
  resource: AuthorityAuthorizationResourceBindingV1,
): string {
  switch (resource.resourceType) {
    case 'TENANT':
      return resource.tenantId;
    case 'MEMBERSHIP':
      return resource.membershipId;
    case 'ALIAS':
      return resource.aliasKey;
    case 'LEGACY_TENANT_SOURCE':
      return resource.sourceLocatorKey;
  }
}

export function mapAuthorizationScopeBindingV1(
  scope: ResolvedAuthorityTenantScopeV1,
  principalId: string,
  resource: AuthorityAuthorizationResourceBindingV1,
): AuthorityAuthorizationScopeBindingV1 {
  const base = {
    schemaVersion: '1' as const,
    scopeType: scope.scopeType,
    scopeStatus: scope.status,
    tenantAuthorityVersion: scope.freshness.tenantAuthorityVersion,
    scopeEvidenceFingerprint:
      scope.resolutionEvidence.evidenceFingerprint,
    principalId,
    resolvedAt: scope.resolvedAt,
    validUntil: scope.freshness.validUntil,
  };
  switch (scope.scopeType) {
    case 'TENANT':
      return Object.freeze({
        ...base,
        scopeType: 'TENANT',
        tenantId: scope.tenantId,
        membershipBindingVersion:
          scope.membershipBinding.bindingVersion,
      });
    case 'PLATFORM':
      return Object.freeze({
        ...base,
        scopeType: 'PLATFORM',
        platformBoundary: scope.platformBoundary,
      });
    case 'TENANT_BOOTSTRAP':
      return Object.freeze({
        ...base,
        scopeType: 'TENANT_BOOTSTRAP',
        tenantIdCandidate: scope.tenantIdCandidate,
        bootstrapRequestId: scope.bootstrapRequestId,
      });
    case 'LEGACY_CANONICALIZATION':
      return Object.freeze({
        ...base,
        scopeType: 'LEGACY_CANONICALIZATION',
        canonicalTenantCandidate: scope.canonicalTenantCandidate,
        legacySourceFingerprint:
          scope.legacySourceDescriptor.expectedSourceFingerprint ??
          scope.resolutionEvidence.evidenceFingerprint,
      });
    case 'MIGRATION': {
      const targetTenantId = resourceTenantId(resource);
      return Object.freeze({
        ...base,
        scopeType: 'MIGRATION',
        targetTenantId:
          targetTenantId ?? scope.targetTenantIds[0],
        migrationId: scope.migrationId,
        migrationRunId: scope.migrationRunId,
      });
    }
    case 'SUPPORT':
      return Object.freeze({
        ...base,
        scopeType: 'SUPPORT',
        tenantId: scope.requestedTenantId,
        supportSessionId: scope.supportSessionId,
      });
  }
}

export function mapAuthorizationRequestV1(
  request: AuthorityApplicationServiceRequestV1,
  context: AuthorityApplicationExecutionContextV1,
  principal: ResolvedAuthorityPrincipalV1,
  scope: ResolvedAuthorityTenantScopeV1,
): AuthorityAuthorizationRequestV1 {
  return Object.freeze({
    schemaVersion: '1',
    principalBinding: mapAuthorizationPrincipalBindingV1(principal),
    scopeBinding: mapAuthorizationScopeBindingV1(
      scope,
      principal.principalId,
      request.authorizationResource,
    ),
    operationBinding: request.authorizationOperation,
    resourceBinding: request.authorizationResource,
    channel: context.channel,
    requestId: context.requestId,
    correlationId: context.correlationId,
    evaluatedAtInput: context.evaluatedAt,
    ...(request.priorDecisionReference === undefined
      ? {}
      : { priorDecisionReference: request.priorDecisionReference }),
  });
}

export function mapInvocationPrincipalProjectionV1(
  principal: ResolvedAuthorityPrincipalV1,
): AuthorityInvocationPrincipalProjectionV1 {
  return Object.freeze({
    schemaVersion: '1',
    principalId: principal.principalId,
    principalType: principal.principalType,
    principalStatus: principal.status,
    authenticationMethod:
      principal.authenticationBinding.authenticationMethod,
    assuranceLevel: principal.assurance.level,
    principalBindingVersion:
      principal.resolutionEvidence.canonicalBindingVersion,
    principalEvidenceFingerprint:
      principal.resolutionEvidence.evidenceFingerprint,
    principalResolvedAt: principal.resolvedAt,
    principalValidUntil: principal.freshness.validUntil,
  });
}

export function mapInvocationScopeProjectionV1(
  scope: ResolvedAuthorityTenantScopeV1,
): AuthorityInvocationScopeProjectionV1 {
  const base = {
    schemaVersion: '1' as const,
    scopeType: scope.scopeType,
    scopeStatus: scope.status,
    scopeEvidenceFingerprint:
      scope.resolutionEvidence.evidenceFingerprint,
    scopeResolvedAt: scope.resolvedAt,
    scopeValidUntil: scope.freshness.validUntil,
    bindingVersion: scope.freshness.bindingVersion,
  };
  switch (scope.scopeType) {
    case 'TENANT':
      return Object.freeze({
        ...base,
        scopeType: 'TENANT',
        tenantId: scope.tenantId,
        tenantAuthorityVersion:
          scope.canonicalTenantAuthorityVersion,
        membershipBindingVersion:
          scope.membershipBinding.bindingVersion,
      });
    case 'PLATFORM':
      return Object.freeze({
        ...base,
        scopeType: 'PLATFORM',
        platformBoundary: scope.platformBoundary,
        operationCategory: scope.platformOperationCategory,
      });
    case 'TENANT_BOOTSTRAP':
      return Object.freeze({
        ...base,
        scopeType: 'TENANT_BOOTSTRAP',
        bootstrapRequestId: scope.bootstrapRequestId,
        tenantIdCandidate: scope.tenantIdCandidate,
        candidateFingerprint:
          scope.resolutionEvidence.evidenceFingerprint,
      });
    case 'LEGACY_CANONICALIZATION':
      return Object.freeze({
        ...base,
        scopeType: 'LEGACY_CANONICALIZATION',
        sourceLocatorKey: `${scope.legacySourceDescriptor.sourceCollection}:${scope.legacySourceDescriptor.sourceDocumentId}`,
        canonicalTenantCandidateId:
          scope.canonicalTenantCandidate,
        sourceFingerprint:
          scope.legacySourceDescriptor.expectedSourceFingerprint ??
          scope.resolutionEvidence.evidenceFingerprint,
      });
    case 'MIGRATION':
      return Object.freeze({
        ...base,
        scopeType: 'MIGRATION',
        migrationId: scope.migrationId,
        migrationRunId: scope.migrationRunId,
        manifestVersion: scope.manifestVersion,
        scopeFingerprint: scope.scopeFingerprint,
        targetTenantIds: Object.freeze([...scope.targetTenantIds]),
      });
    case 'SUPPORT':
      return Object.freeze({
        ...base,
        scopeType: 'SUPPORT',
        supportSessionId: scope.supportSessionId,
        targetTenantId: scope.requestedTenantId,
        sessionValidUntil: scope.allowedUntil,
        impersonationMode: scope.impersonationMode,
      });
  }
}

export function mapInvocationAuthorizationProjectionV1(
  decision: AuthorityAuthorizationDecisionV1,
  verification: AuthorityObligationVerificationSuccessV1,
): AuthorityInvocationAuthorizationProjectionV1 {
  const tenantId = resourceTenantId(decision.resourceBinding);
  return Object.freeze({
    schemaVersion: '1',
    decision: decision.decision,
    permission: decision.permission,
    principalId: decision.principalBinding.principalId,
    scopeType: decision.scopeBinding.scopeType,
    ...(decision.scopeBinding.scopeType === 'PLATFORM' ||
    tenantId === undefined
      ? {}
      : { tenantId }),
    operationType: decision.operationBinding.operationType,
    resourceType: decision.resourceBinding.resourceType,
    resourceId: resourceId(decision.resourceBinding),
    ...(decision.scopeBinding.scopeType === 'PLATFORM' ||
    tenantId === undefined
      ? {}
      : { resourceTenantId: tenantId }),
    policyId: decision.policyEvidence.policyId,
    policyVersion: decision.policyEvidence.policyVersion,
    decisionRuleId: decision.policyEvidence.decisionRuleId,
    authorizationFingerprint: decision.decisionFingerprint,
    authorizationInputFingerprint:
      decision.policyEvidence.inputFingerprint,
    evaluatedAt: decision.evaluatedAt,
    validUntil: decision.freshness.validUntil,
    declaredObligationTypes: Object.freeze(
      decision.obligations.map((item) => item.obligationType),
    ),
    obligationsFingerprint: verification.obligationsFingerprint,
    reasonCode: decision.reasonCodes[0],
    status: 'CURRENT',
  });
}

export function mapInvocationOperationBindingV1(
  decision: AuthorityAuthorizationDecisionV1,
): AuthorityInvocationOperationBindingV1 {
  const tenantId = resourceTenantId(decision.resourceBinding);
  return Object.freeze({
    schemaVersion: '1',
    operationType: decision.operationBinding.operationType,
    permission: decision.permission,
    resourceType: decision.resourceBinding.resourceType,
    resourceId: resourceId(decision.resourceBinding),
    ...(decision.scopeBinding.scopeType === 'PLATFORM' ||
    tenantId === undefined
      ? {}
      : { resourceTenantId: tenantId }),
    operationId: decision.operationBinding.operationId ?? '',
    commandFingerprint:
      decision.operationBinding.commandFingerprint ?? '',
    authorizationInputFingerprint:
      decision.policyEvidence.inputFingerprint,
    consumerId: 'authority_application_service',
    source: 'authority_application_service',
  });
}

export function mapInvocationRequestMetadataV1(
  context: AuthorityApplicationExecutionContextV1,
): AuthorityInvocationRequestMetadataV1 {
  return Object.freeze({
    schemaVersion: '1',
    requestId: context.requestId,
    correlationId: context.correlationId,
    ...(context.causationId === undefined
      ? {}
      : { causationId: context.causationId }),
    channel: context.channel,
    receivedAt: context.receivedAt,
    createdAt: context.createdAt,
    ...(context.traceId === undefined ? {} : { traceId: context.traceId }),
    ...(context.clientRequestIdHash === undefined
      ? {}
      : { clientRequestIdHash: context.clientRequestIdHash }),
  });
}

export function mapInvocationIdempotencyV1(
  request: AuthorityApplicationServiceRequestV1,
  principal: ResolvedAuthorityPrincipalV1,
  scope: ResolvedAuthorityTenantScopeV1,
): AuthorityInvocationIdempotencyV1 {
  const tenantId = resourceTenantId(request.authorizationResource);
  return Object.freeze({
    schemaVersion: '1',
    callerKeyHash: request.idempotency.callerKeyHash,
    namespaceVersion: request.idempotency.namespaceVersion,
    scopeFingerprint: scope.resolutionEvidence.evidenceFingerprint,
    principalId: principal.principalId,
    ...(scope.scopeType === 'PLATFORM' || tenantId === undefined
      ? {}
      : { tenantId }),
    operationType: request.command.operationType,
    operationId: request.command.operationId,
    commandFingerprint: request.idempotency.commandFingerprint,
    createdAt: request.command.requestedAt,
  });
}

function minimumTimestamp(values: readonly string[]): string {
  return values.reduce((minimum, candidate) =>
    Date.parse(candidate) < Date.parse(minimum) ? candidate : minimum,
  );
}

export function mapInvocationFreshnessV1(
  principal: ResolvedAuthorityPrincipalV1,
  scope: ResolvedAuthorityTenantScopeV1,
  decision: AuthorityAuthorizationDecisionV1,
  verification: AuthorityObligationVerificationSuccessV1,
): AuthorityInvocationFreshnessV1 {
  const obligationLimits = verification.evidence
    .map((item) => item.validUntil)
    .filter((item): item is string => item !== undefined);
  const obligationValidUntil =
    obligationLimits.length === 0
      ? undefined
      : minimumTimestamp(obligationLimits);
  const limits = [
    principal.freshness.validUntil,
    scope.freshness.validUntil,
    decision.freshness.validUntil,
    ...(obligationValidUntil === undefined
      ? []
      : [obligationValidUntil]),
  ];
  const validUntil = minimumTimestamp(limits);
  return Object.freeze({
    schemaVersion: '1',
    evaluatedAt: decision.evaluatedAt,
    validUntil,
    principalValidUntil: principal.freshness.validUntil,
    scopeValidUntil: scope.freshness.validUntil,
    authorizationValidUntil: decision.freshness.validUntil,
    ...(obligationValidUntil === undefined
      ? {}
      : { obligationValidUntil }),
    staleAfterSeconds:
      (Date.parse(validUntil) - Date.parse(decision.evaluatedAt)) / 1_000,
  });
}

export function mapInvocationContextFingerprintInputV1(
  request: AuthorityApplicationServiceRequestV1,
  context: AuthorityApplicationExecutionContextV1,
  principal: ResolvedAuthorityPrincipalV1,
  scope: ResolvedAuthorityTenantScopeV1,
  decision: AuthorityAuthorizationDecisionV1,
  verification: AuthorityObligationVerificationSuccessV1,
): AuthorityInvocationContextFingerprintInputV1 {
  const input: AuthorityInvocationContextFingerprintInputV1 =
    Object.freeze({
    version: '1',
    principal: mapInvocationPrincipalProjectionV1(principal),
    scope: mapInvocationScopeProjectionV1(scope),
    authorization: mapInvocationAuthorizationProjectionV1(
      decision,
      verification,
    ),
    operation: mapInvocationOperationBindingV1(decision),
    request: mapInvocationRequestMetadataV1(context),
    idempotency: mapInvocationIdempotencyV1(
      request,
      principal,
      scope,
    ),
    obligationSatisfaction: verification.evidence,
    obligationSummary: verification.summary,
    freshness: mapInvocationFreshnessV1(
      principal,
      scope,
      decision,
      verification,
    ),
    createdAt: context.createdAt,
    status: 'READY',
    });
  return input;
}

export function commandActorType(
  principal: ResolvedAuthorityPrincipalV1,
): AuthorityAdministrativeCommandV1['actor']['actorType'] {
  switch (principal.principalType) {
    case 'HUMAN_USER':
    case 'SUPPORT_OPERATOR':
      return 'USER';
    case 'INTERNAL_SERVICE':
    case 'MIGRATION_ACTOR':
      return 'SERVICE';
    case 'SYSTEM_ACTOR':
      return 'SYSTEM';
  }
}

export function mapRepositoryResultV1(
  repositoryResult: AuthorityRepositoryResultV1,
  trace: readonly AuthorityApplicationStageTraceV1[],
  contextFingerprint: string,
  maskNotFound: boolean,
): AuthorityApplicationServiceResultV1 {
  const metadata: AuthorityApplicationResultMetadataV1 = Object.freeze({
    operationId: repositoryResult.operationId,
    correlationId: repositoryResult.correlationId,
    contextFingerprint,
    repositorySafeCode: repositoryResult.safeCode,
    ...('resultingVersion' in repositoryResult &&
    repositoryResult.resultingVersion !== undefined
      ? { resultingVersion: repositoryResult.resultingVersion }
      : {}),
    maskNotFound,
  });
  const mapping = Object.freeze({
    APPLIED: {
      status: 'APPLIED',
      safeCode: 'AUTHORITY_OPERATION_APPLIED',
      retryDisposition: 'DO_NOT_RETRY',
    },
    NO_OP: {
      status: 'REPLAYED',
      safeCode: 'AUTHORITY_OPERATION_REPLAYED',
      retryDisposition: 'DO_NOT_RETRY',
    },
    REJECTED: {
      status: 'REJECTED',
      safeCode: 'AUTHORITY_OPERATION_REJECTED',
      retryDisposition: 'DO_NOT_RETRY',
    },
    CONFLICT: {
      status: 'CONFLICT',
      safeCode: 'AUTHORITY_OPERATION_CONFLICT',
      retryDisposition: 'SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY',
    },
    NOT_FOUND: {
      status: 'NOT_FOUND',
      safeCode: 'AUTHORITY_RESOURCE_NOT_AVAILABLE',
      retryDisposition: 'DO_NOT_RETRY',
    },
    INTERNAL_ERROR: {
      status: 'INTERNAL_ERROR',
      safeCode: 'AUTHORITY_INTERNAL_FAILURE',
      retryDisposition: 'RETRY_AFTER_DEPENDENCY_RECOVERY',
    },
  } as const);
  const selected = mapping[repositoryResult.status];
  return Object.freeze({
    schemaVersion: '1',
    ...selected,
    stageTrace: Object.freeze([...trace]),
    metadata,
  });
}
