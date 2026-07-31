import type {
  AuthorityRepositoryAuthorizationDecisionV1,
  AuthorityRepositoryInvocationContextV1,
} from '../serverAuthorityPersistence/types';
import type {
  TrustedAuthenticationMethod,
  TrustedAuthenticationProvider,
  TrustedServerPrincipalType,
  TrustedServerPrincipalV1,
} from '../serverComposition/types';
import { AuthorityInvocationContextProjectionError } from './authorityInvocationContextErrors';
import type {
  AuthorityInvocationContextV1,
  AuthorityInvocationPrincipalProjectionV1,
} from './authorityInvocationContextTypes';
import { validateAuthorityInvocationContextV1 } from './authorityInvocationContextValidators';

interface TrustedPrincipalProjection {
  readonly principalType: TrustedServerPrincipalType;
  readonly authenticationMethod: TrustedAuthenticationMethod;
  readonly provider: TrustedAuthenticationProvider;
}

function trustedPrincipalProjection(
  principal: AuthorityInvocationPrincipalProjectionV1,
): TrustedPrincipalProjection {
  switch (principal.principalType) {
    case 'HUMAN_USER':
    case 'SUPPORT_OPERATOR':
      return Object.freeze({
        principalType: 'USER',
        authenticationMethod: 'FIREBASE_ID_TOKEN',
        provider: 'FIREBASE_AUTH',
      });
    case 'INTERNAL_SERVICE':
      return Object.freeze({
        principalType: 'SERVICE',
        authenticationMethod:
          principal.authenticationMethod === 'IAM_OIDC'
            ? 'OIDC_SERVICE_ACCOUNT'
            : 'WORKLOAD_IDENTITY',
        provider: 'GOOGLE_CLOUD_IAM',
      });
    case 'MIGRATION_ACTOR':
      return Object.freeze({
        principalType: 'SERVICE',
        authenticationMethod: 'WORKLOAD_IDENTITY',
        provider: 'GOOGLE_CLOUD_IAM',
      });
    case 'SYSTEM_ACTOR':
      return Object.freeze({
        principalType: 'SYSTEM',
        authenticationMethod: 'WORKLOAD_IDENTITY',
        provider: 'GOOGLE_CLOUD_IAM',
      });
  }
}

function projectPrincipal(
  principal: AuthorityInvocationPrincipalProjectionV1,
): TrustedServerPrincipalV1 {
  const projection = trustedPrincipalProjection(principal);
  return Object.freeze({
    schemaVersion: '1',
    principalId: principal.principalId,
    principalType: projection.principalType,
    authenticationMethod: projection.authenticationMethod,
    provider: projection.provider,
    authenticatedAt: principal.principalResolvedAt,
    claimsFingerprint: principal.principalEvidenceFingerprint,
  });
}

function projectionReason(
  context: AuthorityInvocationContextV1,
): ConstructorParameters<typeof AuthorityInvocationContextProjectionError>[0] {
  if (context.authorization.decision !== 'ALLOW') {
    return 'AUTHORIZATION_NOT_ALLOW';
  }
  if (
    context.status === 'STALE' ||
    context.authorization.status === 'STALE'
  ) {
    return 'AUTHORIZATION_STALE';
  }
  if (context.obligationSummary.stale > 0) {
    return 'OBLIGATION_STALE';
  }
  if (context.obligationSummary.notSatisfied > 0) {
    return 'OBLIGATION_NOT_SATISFIED';
  }
  return 'INVALID_INVOCATION_CONTEXT';
}

export function projectAuthorityInvocationContextToRepositoryV1(
  value: unknown,
): AuthorityRepositoryInvocationContextV1 {
  let context: AuthorityInvocationContextV1;
  try {
    context = validateAuthorityInvocationContextV1(value);
  } catch {
    throw new AuthorityInvocationContextProjectionError(
      'INVALID_INVOCATION_CONTEXT',
    );
  }
  if (
    context.status !== 'READY' ||
    context.authorization.decision !== 'ALLOW' ||
    context.authorization.status !== 'CURRENT' ||
    context.principal.principalStatus !== 'ACTIVE' ||
    context.obligationSummary.stale !== 0 ||
    context.obligationSummary.notSatisfied !== 0
  ) {
    throw new AuthorityInvocationContextProjectionError(
      projectionReason(context),
    );
  }
  const principal = projectPrincipal(context.principal);
  const actor = Object.freeze({
    actorType: principal.principalType,
    actorId: principal.principalId,
  });
  const authorizationDecision: AuthorityRepositoryAuthorizationDecisionV1 =
    Object.freeze({
      schemaVersion: '1',
      decisionVersion: '1',
      decision: 'ALLOWED',
      authorizationVersion: context.authorization.policyVersion,
      operationTypes: Object.freeze([
        context.authorization.operationType,
      ]),
      principalType: principal.principalType,
      principalId: principal.principalId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      decidedAt: context.authorization.evaluatedAt,
      expiresAt: context.freshness.validUntil,
      safeReasonCode: context.authorization.reasonCode,
    });
  return Object.freeze({
    schemaVersion: '1',
    principal,
    actor,
    authorizationDecision,
    authorizedOperationTypes: Object.freeze([
      context.operation.operationType,
    ]),
    consumerId: context.operation.consumerId,
    source: context.operation.source,
    requestId: context.request.requestId,
    correlationId: context.request.correlationId,
    initiatedAt: context.createdAt,
    authorizationVersion: context.authorization.policyVersion,
  });
}
