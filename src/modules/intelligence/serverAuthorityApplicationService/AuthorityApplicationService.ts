import {
  createAuthorityInvocationContextV1,
} from '../serverAuthorityInvocationContext/authorityInvocationContextFactories';
import {
  projectAuthorityInvocationContextToRepositoryV1,
} from '../serverAuthorityInvocationContext/authorityInvocationContextProjectors';
import type {
  AuthorityRepositoryInvocationContextV1,
} from '../serverAuthorityPersistence/types';
import {
  validateAuthorityClockOutputV1,
  validateAuthorityRepositoryResultV1,
} from '../serverAuthorityPersistence/validators';
import {
  validateAuthorityAuthorizationResultV1,
} from '../serverAuthorityAuthorization/authorityAuthorizationValidators';
import type {
  AuthorityAuthorizationDecisionV1,
} from '../serverAuthorityAuthorization/authorityAuthorizationTypes';
import {
  validateAuthorityPrincipalResolutionResultV1,
} from '../serverPrincipalResolution/principalResolutionValidators';
import {
  validateAuthorityTenantScopeResolutionResultV1,
} from '../serverTenantScopeResolution/tenantScopeResolutionValidators';
import {
  AuthorityApplicationServiceExecutionError,
} from './authorityApplicationServiceErrors';
import {
  commandActorType,
  mapAuthorizationPrincipalBindingV1,
  mapAuthorizationRequestV1,
  mapInvocationContextFingerprintInputV1,
  mapPrincipalResolutionContextV1,
  mapRepositoryResultV1,
  mapTenantScopeResolutionContextV1,
  mapTenantScopeResolutionRequestV1,
} from './authorityApplicationServiceMappers';
import type {
  AuthorityApplicationServiceDependenciesV1,
} from './authorityApplicationServicePorts';
import {
  AUTHORITY_APPLICATION_SERVICE_VERSION,
  type AuthorityApplicationExecutionContextV1,
  type AuthorityApplicationResultStatus,
  type AuthorityApplicationRetryDisposition,
  type AuthorityApplicationSafeCode,
  type AuthorityApplicationServiceRequestV1,
  type AuthorityApplicationServiceResultV1,
  type AuthorityApplicationServiceV1,
  type AuthorityApplicationStage,
  type AuthorityApplicationStageStatus,
  type AuthorityApplicationStageTraceV1,
} from './authorityApplicationServiceTypes';
import {
  validateAuthorityApplicationExecutionContextV1,
  validateAuthorityApplicationServiceRequestV1,
  validateAuthorityApplicationServiceResultV1,
  validateAuthorityObligationVerificationResultV1,
} from './authorityApplicationServiceValidators';

type MutableTrace = AuthorityApplicationStageTraceV1[];

interface StopInput {
  readonly status: AuthorityApplicationResultStatus;
  readonly safeCode: AuthorityApplicationSafeCode;
  readonly retryDisposition: AuthorityApplicationRetryDisposition;
  readonly operationId: string;
  readonly correlationId: string;
  readonly trace: readonly AuthorityApplicationStageTraceV1[];
  readonly contextFingerprint?: string;
  readonly repositorySafeCode?: string;
  readonly maskNotFound?: boolean;
}

function now(
  dependencies: AuthorityApplicationServiceDependenciesV1,
): string {
  return validateAuthorityClockOutputV1(dependencies.clock.nowIso());
}

function appendTrace(
  trace: MutableTrace,
  input: {
    readonly stage: AuthorityApplicationStage;
    readonly status: AuthorityApplicationStageStatus;
    readonly startedAt: string;
    readonly completedAt: string;
    readonly safeCode?: AuthorityApplicationSafeCode;
    readonly retryDisposition?: AuthorityApplicationRetryDisposition;
  },
): void {
  trace.push(
    Object.freeze({
      schemaVersion: '1',
      ...input,
    }),
  );
}

function stop(input: StopInput): AuthorityApplicationServiceResultV1 {
  return validateAuthorityApplicationServiceResultV1({
    schemaVersion: '1',
    status: input.status,
    safeCode: input.safeCode,
    retryDisposition: input.retryDisposition,
    stageTrace: Object.freeze([...input.trace]),
    metadata: {
      operationId: input.operationId,
      correlationId: input.correlationId,
      ...(input.contextFingerprint === undefined
        ? {}
        : { contextFingerprint: input.contextFingerprint }),
      ...(input.repositorySafeCode === undefined
        ? {}
        : { repositorySafeCode: input.repositorySafeCode }),
      maskNotFound: input.maskNotFound ?? false,
    },
  });
}

function isCancelled(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const signal = Reflect.get(value, 'cancellationSignal');
  return (
    typeof signal === 'object' &&
    signal !== null &&
    Reflect.get(signal, 'aborted') === true
  );
}

function isTimedOut(
  context: AuthorityApplicationExecutionContextV1,
  currentTime: string,
): boolean {
  return (
    context.deadlineAt !== undefined &&
    Date.parse(currentTime) >= Date.parse(context.deadlineAt)
  );
}

function lifecycleStop(
  dependencies: AuthorityApplicationServiceDependenciesV1,
  context: AuthorityApplicationExecutionContextV1,
  stage: AuthorityApplicationStage,
  trace: MutableTrace,
  operationId: string,
): AuthorityApplicationServiceResultV1 | undefined {
  const checkpoint = now(dependencies);
  if (isCancelled(context)) {
    appendTrace(trace, {
      stage,
      status: 'CANCELLED',
      startedAt: checkpoint,
      completedAt: checkpoint,
      safeCode: 'AUTHORITY_OPERATION_CANCELLED',
      retryDisposition: 'DO_NOT_RETRY',
    });
    return stop({
      status: 'CANCELLED',
      safeCode: 'AUTHORITY_OPERATION_CANCELLED',
      retryDisposition: 'DO_NOT_RETRY',
      operationId,
      correlationId: context.correlationId,
      trace,
    });
  }
  if (isTimedOut(context, checkpoint)) {
    appendTrace(trace, {
      stage,
      status: 'STOPPED',
      startedAt: checkpoint,
      completedAt: checkpoint,
      safeCode: 'AUTHORITY_OPERATION_TIMED_OUT',
      retryDisposition: 'DO_NOT_RETRY',
    });
    return stop({
      status: 'TIMED_OUT',
      safeCode: 'AUTHORITY_OPERATION_TIMED_OUT',
      retryDisposition: 'DO_NOT_RETRY',
      operationId,
      correlationId: context.correlationId,
      trace,
    });
  }
  return undefined;
}

function mapDependencyError(
  error: unknown,
): Readonly<{
  status: AuthorityApplicationResultStatus;
  safeCode: AuthorityApplicationSafeCode;
  retryDisposition: AuthorityApplicationRetryDisposition;
}> {
  if (error instanceof AuthorityApplicationServiceExecutionError) {
    if (error.safeCode === 'AUTHORITY_OPERATION_TIMED_OUT') {
      return Object.freeze({
        status: 'TIMED_OUT',
        safeCode: error.safeCode,
        retryDisposition: error.retryDisposition ?? 'DO_NOT_RETRY',
      });
    }
    if (error.safeCode === 'AUTHORITY_DEPENDENCY_UNAVAILABLE') {
      return Object.freeze({
        status: 'UNAVAILABLE',
        safeCode: error.safeCode,
        retryDisposition:
          error.retryDisposition ??
          'RETRY_AFTER_DEPENDENCY_RECOVERY',
      });
    }
    if (error.safeCode === 'AUTHORITY_CONTEXT_NOT_READY') {
      return Object.freeze({
        status: 'REJECTED',
        safeCode: error.safeCode,
        retryDisposition: error.retryDisposition ?? 'DO_NOT_RETRY',
      });
    }
    if (
      error.safeCode === 'AUTHORITY_COMMAND_BINDING_MISMATCH' ||
      error.safeCode === 'AUTHORITY_IDEMPOTENCY_BINDING_MISMATCH'
    ) {
      return Object.freeze({
        status: 'REJECTED',
        safeCode: error.safeCode,
        retryDisposition: error.retryDisposition ?? 'DO_NOT_RETRY',
      });
    }
  }
  if (typeof error === 'object' && error !== null) {
    const code = Reflect.get(error, 'code');
    if (typeof code === 'string' && /TIME(?:D)?_?OUT/i.test(code)) {
      return Object.freeze({
        status: 'TIMED_OUT',
        safeCode: 'AUTHORITY_OPERATION_TIMED_OUT',
        retryDisposition: 'DO_NOT_RETRY',
      });
    }
    if (
      typeof code === 'string' &&
      /UNAVAILABLE|TEMPORARILY_UNAVAILABLE/i.test(code)
    ) {
      return Object.freeze({
        status: 'UNAVAILABLE',
        safeCode: 'AUTHORITY_DEPENDENCY_UNAVAILABLE',
        retryDisposition: 'RETRY_AFTER_DEPENDENCY_RECOVERY',
      });
    }
  }
  return Object.freeze({
    status: 'INTERNAL_ERROR',
    safeCode: 'AUTHORITY_INTERNAL_FAILURE',
    retryDisposition: 'RETRY_AFTER_OPERATOR_REVIEW',
  });
}

function upstreamFailure(
  status: string,
): Readonly<{
  resultStatus: AuthorityApplicationResultStatus;
  safeCode: AuthorityApplicationSafeCode;
  retryDisposition: AuthorityApplicationRetryDisposition;
}> {
  switch (status) {
    case 'NOT_FOUND':
      return Object.freeze({
        resultStatus: 'NOT_FOUND',
        safeCode: 'AUTHORITY_RESOURCE_NOT_AVAILABLE',
        retryDisposition: 'DO_NOT_RETRY',
      });
    case 'STALE':
    case 'REVOKED':
      return Object.freeze({
        resultStatus: 'STALE',
        safeCode: 'AUTHORITY_OPERATION_STALE',
        retryDisposition: 'RETRY_AFTER_OPERATOR_REVIEW',
      });
    case 'CONFLICT':
    case 'AMBIGUOUS':
      return Object.freeze({
        resultStatus: 'CONFLICT',
        safeCode: 'AUTHORITY_OPERATION_CONFLICT',
        retryDisposition: 'RETRY_AFTER_OPERATOR_REVIEW',
      });
    case 'REJECTED':
      return Object.freeze({
        resultStatus: 'REJECTED',
        safeCode: 'AUTHORITY_OPERATION_REJECTED',
        retryDisposition: 'DO_NOT_RETRY',
      });
    default:
      return Object.freeze({
        resultStatus: 'INTERNAL_ERROR',
        safeCode: 'AUTHORITY_INTERNAL_FAILURE',
        retryDisposition: 'RETRY_AFTER_OPERATOR_REVIEW',
      });
  }
}

function isFreshAt(validUntil: string, currentTime: string): boolean {
  return Date.parse(currentTime) < Date.parse(validUntil);
}

function containsObligation(
  decision: AuthorityAuthorizationDecisionV1,
  obligationType: string,
): boolean {
  return decision.obligations.some(
    (item) => item.obligationType === obligationType,
  );
}

export function buildAuthorityApplicationServiceV1(
  dependencies: AuthorityApplicationServiceDependenciesV1,
): AuthorityApplicationServiceV1 {
  const service: AuthorityApplicationServiceV1 = Object.freeze({
    version: AUTHORITY_APPLICATION_SERVICE_VERSION,
    async execute(
      requestValue: AuthorityApplicationServiceRequestV1,
      contextValue: AuthorityApplicationExecutionContextV1,
    ): Promise<AuthorityApplicationServiceResultV1> {
      const trace: MutableTrace = [];
      const rawStart = now(dependencies);
      if (isCancelled(contextValue)) {
        appendTrace(trace, {
          stage: 'REQUEST_VALIDATION',
          status: 'CANCELLED',
          startedAt: rawStart,
          completedAt: rawStart,
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'CANCELLED',
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: 'unknown_operation',
          correlationId: 'unknown_correlation',
          trace,
        });
      }

      let request: AuthorityApplicationServiceRequestV1;
      let context: AuthorityApplicationExecutionContextV1;
      try {
        context =
          validateAuthorityApplicationExecutionContextV1(contextValue);
        request = validateAuthorityApplicationServiceRequestV1(
          requestValue,
        );
        if (
          request.command.requestId !== context.requestId ||
          request.command.correlationId !== context.correlationId ||
          request.authorizationOperation.resourceType !==
            request.authorizationResource.resourceType
        ) {
          throw new AuthorityApplicationServiceExecutionError(
            'AUTHORITY_COMMAND_BINDING_MISMATCH',
            'DO_NOT_RETRY',
          );
        }
      } catch {
        const completedAt = now(dependencies);
        appendTrace(trace, {
          stage: 'REQUEST_VALIDATION',
          status: 'STOPPED',
          startedAt: rawStart,
          completedAt,
          safeCode: 'AUTHORITY_REQUEST_INVALID',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'REJECTED',
          safeCode: 'AUTHORITY_REQUEST_INVALID',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: 'unknown_operation',
          correlationId: 'unknown_correlation',
          trace,
        });
      }
      appendTrace(trace, {
        stage: 'REQUEST_VALIDATION',
        status: 'COMPLETED',
        startedAt: rawStart,
        completedAt: now(dependencies),
      });

      const principalStop = lifecycleStop(
        dependencies,
        context,
        'PRINCIPAL_RESOLUTION',
        trace,
        request.command.operationId,
      );
      if (principalStop !== undefined) {
        return principalStop;
      }
      const principalStartedAt = now(dependencies);
      let principalResult;
      try {
        principalResult = validateAuthorityPrincipalResolutionResultV1(
          await dependencies.principalResolver.resolve(
            request.principalResolutionRequest,
            mapPrincipalResolutionContextV1(
              context,
              principalStartedAt,
            ),
          ),
        );
      } catch (error) {
        const mapped = mapDependencyError(error);
        const completedAt = now(dependencies);
        appendTrace(trace, {
          stage: 'PRINCIPAL_RESOLUTION',
          status: 'FAILED',
          startedAt: principalStartedAt,
          completedAt,
          safeCode: mapped.safeCode,
          retryDisposition: mapped.retryDisposition,
        });
        return stop({
          ...mapped,
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      const principalCompletedAt = now(dependencies);
      if (isCancelled(context)) {
        appendTrace(trace, {
          stage: 'PRINCIPAL_RESOLUTION',
          status: 'CANCELLED',
          startedAt: principalStartedAt,
          completedAt: principalCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'CANCELLED',
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      if (principalResult.status !== 'RESOLVED') {
        const mapped = upstreamFailure(principalResult.status);
        appendTrace(trace, {
          stage: 'PRINCIPAL_RESOLUTION',
          status: 'STOPPED',
          startedAt: principalStartedAt,
          completedAt: principalCompletedAt,
          safeCode: mapped.safeCode,
          retryDisposition: mapped.retryDisposition,
        });
        return stop({
          status: mapped.resultStatus,
          safeCode: 'AUTHORITY_PRINCIPAL_NOT_RESOLVED',
          retryDisposition: mapped.retryDisposition,
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      const principal = principalResult.principal;
      if (
        principal.status !== 'ACTIVE' ||
        !isFreshAt(principal.freshness.validUntil, principalCompletedAt)
      ) {
        appendTrace(trace, {
          stage: 'PRINCIPAL_RESOLUTION',
          status: 'STOPPED',
          startedAt: principalStartedAt,
          completedAt: principalCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_STALE',
          retryDisposition: 'RETRY_AFTER_PRINCIPAL_REFRESH',
        });
        return stop({
          status: 'STALE',
          safeCode: 'AUTHORITY_OPERATION_STALE',
          retryDisposition: 'RETRY_AFTER_PRINCIPAL_REFRESH',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      if (
        request.command.actor.actorId !== principal.principalId ||
        request.command.actor.actorType !== commandActorType(principal)
      ) {
        appendTrace(trace, {
          stage: 'PRINCIPAL_RESOLUTION',
          status: 'STOPPED',
          startedAt: principalStartedAt,
          completedAt: principalCompletedAt,
          safeCode: 'AUTHORITY_COMMAND_BINDING_MISMATCH',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'REJECTED',
          safeCode: 'AUTHORITY_COMMAND_BINDING_MISMATCH',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      appendTrace(trace, {
        stage: 'PRINCIPAL_RESOLUTION',
        status: 'COMPLETED',
        startedAt: principalStartedAt,
        completedAt: principalCompletedAt,
      });

      const scopeStop = lifecycleStop(
        dependencies,
        context,
        'TENANT_SCOPE_RESOLUTION',
        trace,
        request.command.operationId,
      );
      if (scopeStop !== undefined) {
        return scopeStop;
      }
      const scopeStartedAt = now(dependencies);
      let scopeResult;
      try {
        scopeResult = validateAuthorityTenantScopeResolutionResultV1(
          await dependencies.tenantScopeResolver.resolve(
            mapTenantScopeResolutionRequestV1(
              request,
              context,
              principal,
              scopeStartedAt,
            ),
            mapTenantScopeResolutionContextV1(
              context,
              scopeStartedAt,
            ),
          ),
        );
      } catch (error) {
        const mapped = mapDependencyError(error);
        const completedAt = now(dependencies);
        appendTrace(trace, {
          stage: 'TENANT_SCOPE_RESOLUTION',
          status: 'FAILED',
          startedAt: scopeStartedAt,
          completedAt,
          safeCode: mapped.safeCode,
          retryDisposition: mapped.retryDisposition,
        });
        return stop({
          ...mapped,
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      const scopeCompletedAt = now(dependencies);
      if (isCancelled(context)) {
        appendTrace(trace, {
          stage: 'TENANT_SCOPE_RESOLUTION',
          status: 'CANCELLED',
          startedAt: scopeStartedAt,
          completedAt: scopeCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'CANCELLED',
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      if (scopeResult.status !== 'RESOLVED') {
        const mapped = upstreamFailure(scopeResult.status);
        appendTrace(trace, {
          stage: 'TENANT_SCOPE_RESOLUTION',
          status: 'STOPPED',
          startedAt: scopeStartedAt,
          completedAt: scopeCompletedAt,
          safeCode: mapped.safeCode,
          retryDisposition: mapped.retryDisposition,
        });
        return stop({
          status: mapped.resultStatus,
          safeCode: 'AUTHORITY_SCOPE_NOT_RESOLVED',
          retryDisposition: mapped.retryDisposition,
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      const scope = scopeResult.scope;
      if (!isFreshAt(scope.freshness.validUntil, scopeCompletedAt)) {
        appendTrace(trace, {
          stage: 'TENANT_SCOPE_RESOLUTION',
          status: 'STOPPED',
          startedAt: scopeStartedAt,
          completedAt: scopeCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_STALE',
          retryDisposition: 'RETRY_AFTER_SCOPE_REFRESH',
        });
        return stop({
          status: 'STALE',
          safeCode: 'AUTHORITY_OPERATION_STALE',
          retryDisposition: 'RETRY_AFTER_SCOPE_REFRESH',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      if (
        scope.scopeType === 'TENANT' &&
        (scope.status !== 'ACTIVE' ||
          scope.tenantStatus !== 'ACTIVE' ||
          scope.membershipBinding.membershipStatus !== 'ACTIVE')
      ) {
        appendTrace(trace, {
          stage: 'TENANT_SCOPE_RESOLUTION',
          status: 'STOPPED',
          startedAt: scopeStartedAt,
          completedAt: scopeCompletedAt,
          safeCode: 'AUTHORITY_SCOPE_NOT_RESOLVED',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'REJECTED',
          safeCode: 'AUTHORITY_SCOPE_NOT_RESOLVED',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      if (
        scope.scopeType === 'TENANT' &&
        (scope.membershipBinding.principalId !== principal.principalId ||
          scope.membershipBinding.tenantId !== scope.tenantId)
      ) {
        appendTrace(trace, {
          stage: 'TENANT_SCOPE_RESOLUTION',
          status: 'STOPPED',
          startedAt: scopeStartedAt,
          completedAt: scopeCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_CONFLICT',
          retryDisposition: 'RETRY_AFTER_OPERATOR_REVIEW',
        });
        return stop({
          status: 'CONFLICT',
          safeCode: 'AUTHORITY_OPERATION_CONFLICT',
          retryDisposition: 'RETRY_AFTER_OPERATOR_REVIEW',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      appendTrace(trace, {
        stage: 'TENANT_SCOPE_RESOLUTION',
        status: 'COMPLETED',
        startedAt: scopeStartedAt,
        completedAt: scopeCompletedAt,
      });

      const authorizationStop = lifecycleStop(
        dependencies,
        context,
        'AUTHORIZATION_EVALUATION',
        trace,
        request.command.operationId,
      );
      if (authorizationStop !== undefined) {
        return authorizationStop;
      }
      const authorizationStartedAt = now(dependencies);
      let authorizationResult;
      try {
        authorizationResult = validateAuthorityAuthorizationResultV1(
          await dependencies.authorizationEvaluator.evaluate(
            mapAuthorizationRequestV1(
              request,
              context,
              principal,
              scope,
            ),
            Object.freeze({
              schemaVersion: '1',
              requestId: context.requestId,
              correlationId: context.correlationId,
              evaluatedAt: context.evaluatedAt,
              channel: context.channel,
              evaluatorVersion:
                context.authorizationEvaluatorVersion,
              cancellationPolicy: 'EXTERNAL_EXECUTION_CONTEXT',
            }),
          ),
        );
      } catch (error) {
        const mapped = mapDependencyError(error);
        const completedAt = now(dependencies);
        appendTrace(trace, {
          stage: 'AUTHORIZATION_EVALUATION',
          status: 'FAILED',
          startedAt: authorizationStartedAt,
          completedAt,
          safeCode: mapped.safeCode,
          retryDisposition: mapped.retryDisposition,
        });
        return stop({
          ...mapped,
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      const authorizationCompletedAt = now(dependencies);
      if (isCancelled(context)) {
        appendTrace(trace, {
          stage: 'AUTHORIZATION_EVALUATION',
          status: 'CANCELLED',
          startedAt: authorizationStartedAt,
          completedAt: authorizationCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'CANCELLED',
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      if (authorizationResult.status !== 'DECIDED') {
        const mapped = upstreamFailure(authorizationResult.status);
        appendTrace(trace, {
          stage: 'AUTHORIZATION_EVALUATION',
          status: 'STOPPED',
          startedAt: authorizationStartedAt,
          completedAt: authorizationCompletedAt,
          safeCode: mapped.safeCode,
          retryDisposition: mapped.retryDisposition,
        });
        return stop({
          status: mapped.resultStatus,
          safeCode: 'AUTHORITY_AUTHORIZATION_NOT_EXECUTABLE',
          retryDisposition: mapped.retryDisposition,
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      const decision = authorizationResult.decision;
      const expectedPrincipalBinding =
        mapAuthorizationPrincipalBindingV1(principal);
      if (
        decision.principalBinding.principalId !==
          expectedPrincipalBinding.principalId ||
        decision.principalBinding.principalType !==
          expectedPrincipalBinding.principalType ||
        decision.principalBinding.principalStatus !==
          expectedPrincipalBinding.principalStatus ||
        decision.principalBinding.authenticationMethod !==
          expectedPrincipalBinding.authenticationMethod ||
        decision.principalBinding.assuranceLevel !==
          expectedPrincipalBinding.assuranceLevel ||
        decision.principalBinding.principalBindingVersion !==
          expectedPrincipalBinding.principalBindingVersion ||
        decision.principalBinding.principalEvidenceFingerprint !==
          expectedPrincipalBinding.principalEvidenceFingerprint ||
        decision.principalBinding.resolvedAt !==
          expectedPrincipalBinding.resolvedAt ||
        decision.principalBinding.validUntil !==
          expectedPrincipalBinding.validUntil
      ) {
        appendTrace(trace, {
          stage: 'AUTHORIZATION_EVALUATION',
          status: 'STOPPED',
          startedAt: authorizationStartedAt,
          completedAt: authorizationCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_CONFLICT',
          retryDisposition: 'RETRY_AFTER_OPERATOR_REVIEW',
        });
        return stop({
          status: 'CONFLICT',
          safeCode: 'AUTHORITY_OPERATION_CONFLICT',
          retryDisposition: 'RETRY_AFTER_OPERATOR_REVIEW',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      if (decision.decision !== 'ALLOW') {
        const notAuthorized = decision.decision === 'DENY';
        appendTrace(trace, {
          stage: 'AUTHORIZATION_EVALUATION',
          status: 'STOPPED',
          startedAt: authorizationStartedAt,
          completedAt: authorizationCompletedAt,
          safeCode: notAuthorized
            ? 'AUTHORITY_NOT_AUTHORIZED'
            : 'AUTHORITY_AUTHORIZATION_NOT_EXECUTABLE',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: notAuthorized ? 'NOT_AUTHORIZED' : 'REJECTED',
          safeCode: notAuthorized
            ? 'AUTHORITY_NOT_AUTHORIZED'
            : 'AUTHORITY_AUTHORIZATION_NOT_EXECUTABLE',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      if (
        !isFreshAt(
          decision.freshness.validUntil,
          authorizationCompletedAt,
        )
      ) {
        appendTrace(trace, {
          stage: 'AUTHORIZATION_EVALUATION',
          status: 'STOPPED',
          startedAt: authorizationStartedAt,
          completedAt: authorizationCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_STALE',
          retryDisposition: 'RETRY_AFTER_AUTHORIZATION_REFRESH',
        });
        return stop({
          status: 'STALE',
          safeCode: 'AUTHORITY_OPERATION_STALE',
          retryDisposition: 'RETRY_AFTER_AUTHORIZATION_REFRESH',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      if (
        decision.principalBinding.principalId !== principal.principalId ||
        decision.scopeBinding.principalId !== principal.principalId ||
        decision.operationBinding.operationType !==
          request.authorizationOperation.operationType ||
        decision.operationBinding.commandVersion !==
          request.authorizationOperation.commandVersion ||
        decision.operationBinding.resourceType !==
          request.authorizationOperation.resourceType ||
        decision.operationBinding.resourceId !==
          request.authorizationOperation.resourceId ||
        decision.operationBinding.operationId !==
          request.authorizationOperation.operationId ||
        decision.operationBinding.commandFingerprint !==
          request.authorizationOperation.commandFingerprint ||
        decision.operationBinding.requestedAt !==
          request.authorizationOperation.requestedAt ||
        decision.operationBinding.channel !==
          request.authorizationOperation.channel
      ) {
        appendTrace(trace, {
          stage: 'AUTHORIZATION_EVALUATION',
          status: 'STOPPED',
          startedAt: authorizationStartedAt,
          completedAt: authorizationCompletedAt,
          safeCode: 'AUTHORITY_COMMAND_BINDING_MISMATCH',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'REJECTED',
          safeCode: 'AUTHORITY_COMMAND_BINDING_MISMATCH',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      appendTrace(trace, {
        stage: 'AUTHORIZATION_EVALUATION',
        status: 'COMPLETED',
        startedAt: authorizationStartedAt,
        completedAt: authorizationCompletedAt,
      });

      const obligationStop = lifecycleStop(
        dependencies,
        context,
        'OBLIGATION_VERIFICATION',
        trace,
        request.command.operationId,
      );
      if (obligationStop !== undefined) {
        return obligationStop;
      }
      const obligationStartedAt = now(dependencies);
      let obligationResult;
      try {
        obligationResult =
          validateAuthorityObligationVerificationResultV1(
            await dependencies.obligationVerifier.verify(
              decision,
              request.obligationEvidence,
              Object.freeze({
                command: request.command,
                principal,
                scope,
                evaluatedAt: context.evaluatedAt,
                executionMode: context.executionMode,
              }),
            ),
          );
      } catch (error) {
        const mapped = mapDependencyError(error);
        const completedAt = now(dependencies);
        appendTrace(trace, {
          stage: 'OBLIGATION_VERIFICATION',
          status: 'FAILED',
          startedAt: obligationStartedAt,
          completedAt,
          safeCode: mapped.safeCode,
          retryDisposition: mapped.retryDisposition,
        });
        return stop({
          ...mapped,
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      const obligationCompletedAt = now(dependencies);
      if (isCancelled(context)) {
        appendTrace(trace, {
          stage: 'OBLIGATION_VERIFICATION',
          status: 'CANCELLED',
          startedAt: obligationStartedAt,
          completedAt: obligationCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'CANCELLED',
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
        });
      }
      if (obligationResult.status !== 'VERIFIED') {
        const status =
          obligationResult.status === 'STALE'
            ? 'STALE'
            : obligationResult.status === 'CONFLICT'
              ? 'CONFLICT'
              : obligationResult.status === 'INTERNAL_ERROR'
                ? 'INTERNAL_ERROR'
                : 'REJECTED';
        appendTrace(trace, {
          stage: 'OBLIGATION_VERIFICATION',
          status: 'STOPPED',
          startedAt: obligationStartedAt,
          completedAt: obligationCompletedAt,
          safeCode: 'AUTHORITY_OBLIGATIONS_NOT_VERIFIED',
          retryDisposition: obligationResult.retryDisposition,
        });
        return stop({
          status,
          safeCode: 'AUTHORITY_OBLIGATIONS_NOT_VERIFIED',
          retryDisposition: obligationResult.retryDisposition,
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
          maskNotFound: obligationResult.maskNotFound,
        });
      }
      const hasExpectedVersion = containsObligation(
        decision,
        'REQUIRE_EXPECTED_VERSION',
      );
      const hasIdempotency = containsObligation(
        decision,
        'REQUIRE_IDEMPOTENCY_KEY',
      );
      const testOnly = containsObligation(
        decision,
        'LIMIT_TO_TEST_ONLY',
      );
      const maskNotFound = containsObligation(
        decision,
        'MASK_NOT_FOUND',
      );
      const declaredObligationTypes = decision.obligations.map(
        (item) => item.obligationType,
      );
      const verifiedObligationTypes = obligationResult.evidence.map(
        (item) => item.obligationType,
      );
      const obligationIntegrityValid =
        obligationResult.obligationsFingerprint ===
          obligationResult.summary.fingerprint &&
        declaredObligationTypes.length ===
          verifiedObligationTypes.length &&
        declaredObligationTypes.every((obligationType) =>
          verifiedObligationTypes.includes(obligationType),
        ) &&
        obligationResult.summary.total ===
          obligationResult.evidence.length &&
        obligationResult.summary.satisfied +
          obligationResult.summary.notApplicable ===
          obligationResult.summary.total &&
        obligationResult.summary.stale === 0 &&
        obligationResult.summary.notSatisfied === 0 &&
        obligationResult.evidence.every(
          (item) =>
            item.validUntil === undefined ||
            isFreshAt(item.validUntil, obligationCompletedAt),
        ) &&
        (!hasExpectedVersion ||
          request.command.precondition.type ===
            'MUST_EXIST_AT_VERSION' ||
          request.command.precondition.type ===
            'MUST_MATCH_AUTHORITY_VERSION') &&
        (!hasIdempotency ||
          request.idempotency.idempotencyKey ===
            request.command.idempotencyKey) &&
        (!testOnly || context.executionMode === 'TEST_ONLY') &&
        (!maskNotFound || obligationResult.maskNotFound);
      if (!obligationIntegrityValid) {
        appendTrace(trace, {
          stage: 'OBLIGATION_VERIFICATION',
          status: 'STOPPED',
          startedAt: obligationStartedAt,
          completedAt: obligationCompletedAt,
          safeCode: 'AUTHORITY_OBLIGATIONS_NOT_VERIFIED',
          retryDisposition:
            'RETRY_AFTER_OBLIGATION_SATISFACTION',
        });
        return stop({
          status: 'REJECTED',
          safeCode: 'AUTHORITY_OBLIGATIONS_NOT_VERIFIED',
          retryDisposition:
            'RETRY_AFTER_OBLIGATION_SATISFACTION',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
          maskNotFound: obligationResult.maskNotFound,
        });
      }
      appendTrace(trace, {
        stage: 'OBLIGATION_VERIFICATION',
        status: 'COMPLETED',
        startedAt: obligationStartedAt,
        completedAt: obligationCompletedAt,
      });

      const contextStop = lifecycleStop(
        dependencies,
        context,
        'CONTEXT_CONSTRUCTION',
        trace,
        request.command.operationId,
      );
      if (contextStop !== undefined) {
        return contextStop;
      }
      const contextStartedAt = now(dependencies);
      let contextInput;
      try {
        contextInput = mapInvocationContextFingerprintInputV1(
          request,
          context,
          principal,
          scope,
          decision,
          obligationResult,
        );
      } catch {
        const completedAt = now(dependencies);
        appendTrace(trace, {
          stage: 'CONTEXT_CONSTRUCTION',
          status: 'FAILED',
          startedAt: contextStartedAt,
          completedAt,
          safeCode: 'AUTHORITY_CONTEXT_NOT_READY',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'REJECTED',
          safeCode: 'AUTHORITY_CONTEXT_NOT_READY',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
          maskNotFound,
        });
      }
      appendTrace(trace, {
        stage: 'CONTEXT_CONSTRUCTION',
        status: 'COMPLETED',
        startedAt: contextStartedAt,
        completedAt: now(dependencies),
      });

      const fingerprintStop = lifecycleStop(
        dependencies,
        context,
        'CONTEXT_FINGERPRINT',
        trace,
        request.command.operationId,
      );
      if (fingerprintStop !== undefined) {
        return fingerprintStop;
      }
      const fingerprintStartedAt = now(dependencies);
      let contextFingerprint: string;
      try {
        contextFingerprint =
          await dependencies.contextFingerprintProvider.fingerprint(
            contextInput,
          );
        if (!/^sha256:[a-f0-9]{64}$/.test(contextFingerprint)) {
          throw new AuthorityApplicationServiceExecutionError(
            'AUTHORITY_CONTEXT_NOT_READY',
            'DO_NOT_RETRY',
          );
        }
      } catch (error) {
        const mapped = mapDependencyError(error);
        const completedAt = now(dependencies);
        appendTrace(trace, {
          stage: 'CONTEXT_FINGERPRINT',
          status: 'FAILED',
          startedAt: fingerprintStartedAt,
          completedAt,
          safeCode: mapped.safeCode,
          retryDisposition: mapped.retryDisposition,
        });
        return stop({
          ...mapped,
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
          maskNotFound,
        });
      }
      const fingerprintCompletedAt = now(dependencies);
      if (isCancelled(context)) {
        appendTrace(trace, {
          stage: 'CONTEXT_FINGERPRINT',
          status: 'CANCELLED',
          startedAt: fingerprintStartedAt,
          completedAt: fingerprintCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'CANCELLED',
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
          contextFingerprint,
          maskNotFound,
        });
      }
      let invocationContext;
      try {
        invocationContext = createAuthorityInvocationContextV1({
          ...contextInput,
          contextFingerprint,
        });
      } catch {
        appendTrace(trace, {
          stage: 'CONTEXT_FINGERPRINT',
          status: 'FAILED',
          startedAt: fingerprintStartedAt,
          completedAt: fingerprintCompletedAt,
          safeCode: 'AUTHORITY_CONTEXT_NOT_READY',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'REJECTED',
          safeCode: 'AUTHORITY_CONTEXT_NOT_READY',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
          contextFingerprint,
          maskNotFound,
        });
      }
      appendTrace(trace, {
        stage: 'CONTEXT_FINGERPRINT',
        status: 'COMPLETED',
        startedAt: fingerprintStartedAt,
        completedAt: fingerprintCompletedAt,
      });

      const projectionStop = lifecycleStop(
        dependencies,
        context,
        'PERSISTENCE_PROJECTION',
        trace,
        request.command.operationId,
      );
      if (projectionStop !== undefined) {
        return projectionStop;
      }
      const projectionStartedAt = now(dependencies);
      let repositoryContext: AuthorityRepositoryInvocationContextV1;
      try {
        const projected =
          projectAuthorityInvocationContextToRepositoryV1(
            invocationContext,
          );
        repositoryContext =
          context.cancellationSignal === undefined
            ? projected
            : Object.freeze({
                ...projected,
                cancellationSignal: context.cancellationSignal,
              });
      } catch {
        const completedAt = now(dependencies);
        appendTrace(trace, {
          stage: 'PERSISTENCE_PROJECTION',
          status: 'FAILED',
          startedAt: projectionStartedAt,
          completedAt,
          safeCode: 'AUTHORITY_CONTEXT_PROJECTION_FAILED',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'REJECTED',
          safeCode: 'AUTHORITY_CONTEXT_PROJECTION_FAILED',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
          contextFingerprint,
          maskNotFound,
        });
      }
      appendTrace(trace, {
        stage: 'PERSISTENCE_PROJECTION',
        status: 'COMPLETED',
        startedAt: projectionStartedAt,
        completedAt: now(dependencies),
      });

      const repositoryStop = lifecycleStop(
        dependencies,
        context,
        'REPOSITORY_EXECUTION',
        trace,
        request.command.operationId,
      );
      if (repositoryStop !== undefined) {
        return repositoryStop;
      }
      const repositoryStartedAt = now(dependencies);
      let repositoryResult;
      try {
        repositoryResult = validateAuthorityRepositoryResultV1(
          await dependencies.repository.execute(
            request.command,
            repositoryContext,
          ),
        );
        if (
          repositoryResult.operationId !== request.command.operationId ||
          repositoryResult.correlationId !== context.correlationId
        ) {
          throw new AuthorityApplicationServiceExecutionError(
            'AUTHORITY_COMMAND_BINDING_MISMATCH',
            'DO_NOT_RETRY',
          );
        }
      } catch (error) {
        const mapped =
          isCancelled(context)
            ? {
                status: 'CANCELLED' as const,
                safeCode: 'AUTHORITY_OPERATION_CANCELLED' as const,
                retryDisposition: 'DO_NOT_RETRY' as const,
              }
            : mapDependencyError(error);
        const completedAt = now(dependencies);
        appendTrace(trace, {
          stage: 'REPOSITORY_EXECUTION',
          status:
            mapped.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
          startedAt: repositoryStartedAt,
          completedAt,
          safeCode: mapped.safeCode,
          retryDisposition: mapped.retryDisposition,
        });
        return stop({
          ...mapped,
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
          contextFingerprint,
          maskNotFound,
        });
      }
      const repositoryCompletedAt = now(dependencies);
      if (isCancelled(context)) {
        appendTrace(trace, {
          stage: 'REPOSITORY_EXECUTION',
          status: 'CANCELLED',
          startedAt: repositoryStartedAt,
          completedAt: repositoryCompletedAt,
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
        });
        return stop({
          status: 'CANCELLED',
          safeCode: 'AUTHORITY_OPERATION_CANCELLED',
          retryDisposition: 'DO_NOT_RETRY',
          operationId: request.command.operationId,
          correlationId: context.correlationId,
          trace,
          contextFingerprint,
          maskNotFound,
        });
      }
      appendTrace(trace, {
        stage: 'REPOSITORY_EXECUTION',
        status: 'COMPLETED',
        startedAt: repositoryStartedAt,
        completedAt: repositoryCompletedAt,
      });

      const mappingStartedAt = now(dependencies);
      appendTrace(trace, {
        stage: 'RESULT_MAPPING',
        status: 'COMPLETED',
        startedAt: mappingStartedAt,
        completedAt: now(dependencies),
      });
      return validateAuthorityApplicationServiceResultV1(
        mapRepositoryResultV1(
          repositoryResult,
          trace,
          contextFingerprint,
          maskNotFound,
        ),
      );
    },
  });
  return service;
}
