import type {
  AuthoritativeBoundaryExecutionModeV1,
  AuthoritativeBoundaryPolicyDecisionV1,
  AuthoritativeBoundaryPolicyDenialReasonCodeV1,
  BoundaryInvocationContextV1,
  BoundaryPublicError,
  BoundaryPublicWarning,
  BoundaryStatus,
  GovernedExecutionRequest,
  GovernedExecutionResponse,
} from './types';
import {
  AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
  AUTHORITATIVE_EXECUTION_CONTEXT_VERSION,
  BOUNDARY_RESERVED_AUTHORITY_FIELDS,
} from './types';
import type {
  BoundaryAuditPort,
  BoundaryClockPort,
  BoundaryExecutionPort,
  BoundarySemanticProjectionPortV1,
  FeaturePolicyPort,
  InternalExecutionInput,
  ShadowComparisonPort,
} from './ports';
import {
  BoundaryContextContractError,
  BoundaryPolicyContractError,
  GovernedBoundaryError,
  type BoundaryContextContractIssue,
} from './errors';
import {
  createSafeInternalPayload,
  validateAuthoritativeBoundaryPolicyDecisionV1,
  validateAuthoritativeBoundaryPolicyQueryV1,
  validateAuthoritativeExecutionContextV1,
  validateBoundaryInvocationContextV1,
  validateGovernedRequest,
} from './validators';
import {
  sanitizeComparisonSummary,
  sanitizeMetadata,
  sanitizePublicError,
  sanitizeResultSummary,
} from './sanitizers';

export interface GovernedExecutionBoundaryConfig {
  readonly featurePolicyPort?: FeaturePolicyPort;
  readonly clockPort: BoundaryClockPort;
  readonly executionPort: BoundaryExecutionPort;
  readonly shadowComparisonPort?: ShadowComparisonPort;
  readonly auditPort?: BoundaryAuditPort;
  readonly semanticProjectionPort?: BoundarySemanticProjectionPortV1;
}

interface AuthorityConflict {
  readonly field: string;
  readonly issue: BoundaryContextContractIssue;
}

interface ExpectedPayloadAuthority {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorType: string;
  readonly consumerId: string;
  readonly source: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly requestedMode: string;
  readonly executionMode?: string;
  readonly authoritativeDeadlineAt?: string;
  readonly authorizationPolicyVersion?: string;
}

export class GovernedExecutionBoundary {
  private readonly featurePolicyPort?: FeaturePolicyPort;
  private readonly clockPort: BoundaryClockPort;
  private readonly executionPort: BoundaryExecutionPort;
  private readonly shadowComparisonPort?: ShadowComparisonPort;
  private readonly auditPort?: BoundaryAuditPort;
  private readonly semanticProjectionPort?: BoundarySemanticProjectionPortV1;

  constructor(config: GovernedExecutionBoundaryConfig) {
    this.featurePolicyPort = config.featurePolicyPort;
    this.clockPort = config.clockPort;
    this.executionPort = config.executionPort;
    this.shadowComparisonPort = config.shadowComparisonPort;
    this.auditPort = config.auditPort;
    this.semanticProjectionPort = config.semanticProjectionPort;
  }

  public async execute(
    rawRequest: GovernedExecutionRequest,
    invocationContext?: BoundaryInvocationContextV1
  ): Promise<GovernedExecutionResponse>;
  public async execute(
    rawRequest: unknown,
    invocationContext?: BoundaryInvocationContextV1
  ): Promise<GovernedExecutionResponse>;
  public async execute(
    rawRequest: unknown,
    invocationContext?: BoundaryInvocationContextV1
  ): Promise<GovernedExecutionResponse> {
    const receivedAt = this.clockPort.now();
    let request: GovernedExecutionRequest;

    try {
      request = validateGovernedRequest(rawRequest);
    } catch (error: unknown) {
      return this.buildErrorResponse({
        requestId:
          this.extractString(rawRequest, 'requestId') ?? 'UNKNOWN_ID',
        correlationId:
          this.extractString(rawRequest, 'correlationId') ??
          'UNKNOWN_ID',
        mode: 'DISABLED',
        status: 'REJECTED',
        startedAt: receivedAt,
        error,
      });
    }

    const internalPayload = createSafeInternalPayload(request.payload);
    const cleanMetadata = sanitizeMetadata(request.metadata);
    const safeMetadata =
      cleanMetadata === undefined
        ? undefined
        : Object.freeze({ ...cleanMetadata });
    this.tryAuditLog('BOUNDARY_REQUEST_RECEIVED', {
      requestId: request.requestId,
      correlationId: request.correlationId,
      requestedMode: request.requestedMode,
    });

    let context: BoundaryInvocationContextV1 | undefined;
    let effectiveMode:
      | AuthoritativeBoundaryExecutionModeV1
      | undefined;
    let rejectionReason: string | undefined;
    let deadlineExceeded = false;

    try {
      if (request.cancellationSignal?.aborted) {
        throw new GovernedBoundaryError(
          'CANCELLED',
          'Request was cancelled before context validation',
          false
        );
      }
      if (this.hasTimedOut(receivedAt, request.timeoutMs)) {
        deadlineExceeded = true;
        throw new GovernedBoundaryError(
          'TIMEOUT',
          'Request timed out before policy evaluation',
          false
        );
      }
      if (invocationContext === undefined) {
        throw new BoundaryContextContractError(
          'BOUNDARY_CONTEXT_MISSING'
        );
      }

      context =
        validateBoundaryInvocationContextV1(invocationContext);
      this.tryAuditLog('BOUNDARY_CONTEXT_VALIDATED', {
        requestId: context.requestId,
        correlationId: context.correlationId,
        tenantId: context.tenantId,
        actorType: context.actor.actorType,
        consumerId: context.consumerId,
        source: context.source,
      });

      const initiatedAt = this.clockPort.now();
      const requestConflict = this.findRequestContextConflict(
        request,
        context
      );
      if (requestConflict) {
        this.auditConflict(request, context, requestConflict);
        throw new BoundaryContextContractError(
          requestConflict.issue
        );
      }

      this.tryAuditLog('BOUNDARY_TENANT_BOUND', {
        requestId: context.requestId,
        correlationId: context.correlationId,
        tenantId: context.tenantId,
        consumerId: context.consumerId,
        source: context.source,
      });
      this.tryAuditLog('BOUNDARY_ACTOR_BOUND', {
        requestId: context.requestId,
        correlationId: context.correlationId,
        tenantId: context.tenantId,
        actorType: context.actor.actorType,
        consumerId: context.consumerId,
        source: context.source,
      });

      const initialPayloadConflict =
        this.findPayloadAuthorityConflict(internalPayload, {
          tenantId: context.tenantId,
          actorId: context.actor.actorId,
          actorType: context.actor.actorType,
          consumerId: context.consumerId,
          source: context.source,
          requestId: context.requestId,
          correlationId: context.correlationId,
          requestedMode: request.requestedMode,
        });
      if (initialPayloadConflict) {
        this.auditConflict(
          request,
          context,
          initialPayloadConflict
        );
        throw new BoundaryContextContractError(
          initialPayloadConflict.issue
        );
      }

      if (request.requestedMode === 'PRODUCTIVE') {
        throw new BoundaryContextContractError(
          'BOUNDARY_MODE_ESCALATION'
        );
      }
      if (request.requestedMode === 'DISABLED') {
        throw new GovernedBoundaryError(
          'BOUNDARY_DISABLED',
          'Requested mode is disabled',
          false
        );
      }
      if (
        !this.featurePolicyPort?.evaluateAuthoritativePolicy
      ) {
        throw new GovernedBoundaryError(
          'BOUNDARY_DISABLED',
          'Authoritative boundary policy is unavailable',
          false
        );
      }

      const policyQuery =
        validateAuthoritativeBoundaryPolicyQueryV1({
          schemaVersion:
            AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
          tenantId: context.tenantId,
          consumerId: context.consumerId,
          source: context.source,
          requestedMode: request.requestedMode,
          actor: context.actor,
        });
      const rawPolicyDecision =
        await this.featurePolicyPort.evaluateAuthoritativePolicy(
          policyQuery
        );

      if (request.cancellationSignal?.aborted) {
        throw new GovernedBoundaryError(
          'CANCELLED',
          'Request was cancelled after policy evaluation',
          false
        );
      }

      const policyDecision =
        validateAuthoritativeBoundaryPolicyDecisionV1(
          rawPolicyDecision
        );
      const policyConflictField =
        this.findPolicyDecisionConflict(
        policyDecision,
        policyQuery
      );
      if (policyConflictField) {
        this.tryAuditLog('BOUNDARY_CONTEXT_CONFLICT', {
          requestId: context.requestId,
          correlationId: context.correlationId,
          tenantId: context.tenantId,
          actorType: context.actor.actorType,
          consumerId: context.consumerId,
          source: context.source,
          requestedMode: request.requestedMode,
          reasonCode: 'BOUNDARY_POLICY_CONTEXT_INVALID',
          conflictField: policyConflictField,
        });
        throw new BoundaryPolicyContractError(
          'BOUNDARY_POLICY_CONTEXT_INVALID'
        );
      }

      if (policyDecision.decision === 'DENIED') {
        rejectionReason = policyDecision.reasonCode;
        throw this.policyDenialError(policyDecision.reasonCode);
      }

      effectiveMode = policyDecision.effectiveExecutionMode;
      if (effectiveMode !== request.requestedMode) {
        this.auditConflict(request, context, {
          field: 'executionMode',
          issue: 'BOUNDARY_MODE_ESCALATION',
        });
        throw new BoundaryContextContractError(
          'BOUNDARY_MODE_ESCALATION'
        );
      }

      if (
        request.timeoutMs !== undefined &&
        request.timeoutMs > policyDecision.effectiveTimeoutMs
      ) {
        throw new GovernedBoundaryError(
          'TIMEOUT',
          'Requested timeout exceeds the authoritative policy limit',
          false
        );
      }
      const authoritativeDeadlineAt =
        this.calculateAuthoritativeDeadlineAt(
          initiatedAt,
          policyDecision.effectiveTimeoutMs
        );
      if (
        this.hasAuthoritativeDeadlineExpired(
          authoritativeDeadlineAt
        )
      ) {
        deadlineExceeded = true;
        throw new GovernedBoundaryError(
          'TIMEOUT',
          'Request timed out before execution dispatch',
          false
        );
      }

      const finalPayloadConflict =
        this.findPayloadAuthorityConflict(internalPayload, {
          tenantId: context.tenantId,
          actorId: context.actor.actorId,
          actorType: context.actor.actorType,
          consumerId: context.consumerId,
          source: context.source,
          requestId: context.requestId,
          correlationId: context.correlationId,
          requestedMode: request.requestedMode,
          executionMode: effectiveMode,
          authoritativeDeadlineAt,
          authorizationPolicyVersion:
            policyDecision.authorizationPolicyVersion,
        });
      if (finalPayloadConflict) {
        this.auditConflict(
          request,
          context,
          finalPayloadConflict
        );
        throw new BoundaryContextContractError(
          finalPayloadConflict.issue
        );
      }

      const authoritativeContext =
        validateAuthoritativeExecutionContextV1({
          schemaVersion: AUTHORITATIVE_EXECUTION_CONTEXT_VERSION,
          tenantId: context.tenantId,
          actor: context.actor,
          consumerId: context.consumerId,
          source: context.source,
          requestId: context.requestId,
          correlationId: context.correlationId,
          executionMode: effectiveMode,
          initiatedAt,
          authoritativeDeadlineAt,
          authorizationPolicyVersion:
            policyDecision.authorizationPolicyVersion,
        });

      if (
        this.hasAuthoritativeDeadlineExpired(
          authoritativeContext.authoritativeDeadlineAt
        )
      ) {
        deadlineExceeded = true;
        throw new GovernedBoundaryError(
          'TIMEOUT',
          'Request timed out before execution dispatch',
          false
        );
      }

      this.tryAuditLog('BOUNDARY_MODE_RESOLVED', {
        requestId: context.requestId,
        correlationId: context.correlationId,
        tenantId: context.tenantId,
        actorType: context.actor.actorType,
        consumerId: context.consumerId,
        source: context.source,
        requestedMode: request.requestedMode,
        effectiveMode,
        authorizationPolicyVersion:
          authoritativeContext.authorizationPolicyVersion,
      });

      const internalInput: InternalExecutionInput = Object.freeze({
        sessionId: context.correlationId,
        payload: internalPayload,
        ...(safeMetadata !== undefined
          ? { metadata: safeMetadata }
          : {}),
        authoritativeContext,
      });
      this.tryAuditLog('BOUNDARY_EXECUTION_DISPATCHED', {
        requestId: context.requestId,
        correlationId: context.correlationId,
        tenantId: context.tenantId,
        actorType: context.actor.actorType,
        consumerId: context.consumerId,
        source: context.source,
        requestedMode: request.requestedMode,
        effectiveMode,
        authorizationPolicyVersion:
          authoritativeContext.authorizationPolicyVersion,
      });

      if (
        this.hasAuthoritativeDeadlineExpired(
          authoritativeContext.authoritativeDeadlineAt
        )
      ) {
        deadlineExceeded = true;
        throw new GovernedBoundaryError(
          'TIMEOUT',
          'Request timed out before execution dispatch',
          false
        );
      }

      return await this.dispatch(
        request,
        context,
        internalInput,
        internalPayload,
        effectiveMode,
        receivedAt
      );
    } catch (error: unknown) {
      const reasonCode =
        rejectionReason ?? this.getInternalReasonCode(error);
      this.tryAuditLog('BOUNDARY_INVOCATION_REJECTED', {
        requestId: context?.requestId ?? request.requestId,
        correlationId:
          context?.correlationId ?? request.correlationId,
        ...(context
          ? {
              tenantId: context.tenantId,
              actorType: context.actor.actorType,
              consumerId: context.consumerId,
              source: context.source,
            }
          : {}),
        requestedMode: request.requestedMode,
        ...(effectiveMode ? { effectiveMode } : {}),
        reasonCode,
      });
      const publicError = sanitizePublicError(error);
      const status: BoundaryStatus =
        publicError.code === 'CANCELLED'
          ? 'CANCELLED'
          : deadlineExceeded
            ? 'TIMED_OUT'
            : 'REJECTED';
      return this.buildErrorResponse({
        requestId: context?.requestId ?? request.requestId,
        correlationId:
          context?.correlationId ?? request.correlationId,
        mode: effectiveMode ?? 'DISABLED',
        status,
        startedAt: receivedAt,
        error,
      });
    }
  }

  private async dispatch(
    request: GovernedExecutionRequest,
    context: BoundaryInvocationContextV1,
    internalInput: InternalExecutionInput,
    internalPayload: InternalExecutionInput['payload'],
    effectiveMode: AuthoritativeBoundaryExecutionModeV1,
    startedAt: string
  ): Promise<GovernedExecutionResponse> {
    try {
      const internalResult = await this.executionPort.execute(
        internalInput,
        request.cancellationSignal
      );
      const completedAt = this.clockPort.now();
      const resultSummary = sanitizeResultSummary(internalResult);
      let comparisonSummary: Record<string, unknown> | undefined;

      if (
        effectiveMode === 'EVALUATION' &&
        this.shadowComparisonPort
      ) {
        try {
          const comparison =
            await this.shadowComparisonPort.compare(
              internalPayload,
              internalResult.rawData ?? internalResult
            );
          comparisonSummary =
            sanitizeComparisonSummary(comparison);
        } catch {
          // Comparison remains best-effort.
        }
      }

      let semanticProjection: Readonly<Record<string, unknown>> | undefined;
      let projectionFailed = false;

      if (this.semanticProjectionPort && internalResult.rawData !== undefined) {
        try {
          const projected = this.semanticProjectionPort.project(internalResult.rawData, {
            requestId: context.requestId,
            correlationId: context.correlationId,
            tenantId: context.tenantId,
            actorId: context.actor.actorId,
            mode: effectiveMode,
            source: context.source,
            capability: request.capability,
            operation: request.operation,
          });

          if (projected === internalResult.rawData) {
            projectionFailed = true;
            semanticProjection = undefined;
          } else {
            semanticProjection = projected;
          }
        } catch {
          projectionFailed = true;
          semanticProjection = undefined;
        }
      }

      const responseStatus: BoundaryStatus =
        internalResult.status === 'SUCCEEDED' ||
        internalResult.status === 'SUCCESS' ||
        internalResult.status === 'COMPLETED'
          ? 'COMPLETED'
          : internalResult.status === 'PARTIAL'
            ? 'PARTIAL'
            : internalResult.status === 'TIMED_OUT'
              ? 'TIMED_OUT'
              : internalResult.status === 'CANCELLED'
                ? 'CANCELLED'
                : 'FAILED';
      const errors: BoundaryPublicError[] = [];
      for (const error of internalResult.errors ?? []) {
        errors.push(sanitizePublicError(new Error(error.message)));
      }
      const warnings: BoundaryPublicWarning[] = (internalResult.warnings ?? []).map((warning) => ({
        code: 'WARN',
        message: warning,
      }));
      if (projectionFailed) {
        warnings.push({
          code: 'WARN',
          message: 'Semantic projection failed or returned invalid reference',
        });
      }

      const response = this.buildResponse({
        requestId: context.requestId,
        correlationId: context.correlationId,
        mode: effectiveMode,
        status: responseStatus,
        startedAt,
        completedAt,
        durationMs: this.calculateDuration(
          startedAt,
          completedAt
        ),
        resultSummary,
        comparisonSummary,
        semanticProjection,
        warnings,
        errors,
      });
      this.tryAuditLog('BOUNDARY_EXECUTION_COMPLETED', {
        requestId: context.requestId,
        correlationId: context.correlationId,
        tenantId: context.tenantId,
        actorType: context.actor.actorType,
        consumerId: context.consumerId,
        source: context.source,
        effectiveMode,
        status: responseStatus,
        executionId: internalResult.executionId,
        authorizationPolicyVersion:
          internalInput.authoritativeContext
            ?.authorizationPolicyVersion,
      });
      return response;
    } catch (error: unknown) {
      const completedAt = this.clockPort.now();
      this.tryAuditLog('BOUNDARY_EXECUTION_COMPLETED', {
        requestId: context.requestId,
        correlationId: context.correlationId,
        tenantId: context.tenantId,
        actorType: context.actor.actorType,
        consumerId: context.consumerId,
        source: context.source,
        effectiveMode,
        status: 'FAILED',
        authorizationPolicyVersion:
          internalInput.authoritativeContext
            ?.authorizationPolicyVersion,
      });
      return this.buildResponse({
        requestId: context.requestId,
        correlationId: context.correlationId,
        mode: effectiveMode,
        status: 'FAILED',
        startedAt,
        completedAt,
        durationMs: this.calculateDuration(
          startedAt,
          completedAt
        ),
        warnings: [],
        errors: [sanitizePublicError(error)],
      });
    }
  }

  private findRequestContextConflict(
    request: GovernedExecutionRequest,
    context: BoundaryInvocationContextV1
  ): AuthorityConflict | undefined {
    if (request.requestId !== context.requestId) {
      return {
        field: 'requestId',
        issue: 'BOUNDARY_REQUEST_CONTEXT_MISMATCH',
      };
    }
    if (request.correlationId !== context.correlationId) {
      return {
        field: 'correlationId',
        issue: 'BOUNDARY_REQUEST_CONTEXT_MISMATCH',
      };
    }
    if (request.tenant.tenantId !== context.tenantId) {
      return {
        field: 'tenantId',
        issue: 'BOUNDARY_TENANT_MISMATCH',
      };
    }
    if (
      request.actor.actorId !== context.actor.actorId ||
      request.actor.actorType !== context.actor.actorType
    ) {
      return {
        field:
          request.actor.actorId !== context.actor.actorId
            ? 'actorId'
            : 'actorType',
        issue: 'BOUNDARY_ACTOR_MISMATCH',
      };
    }
    if (request.source !== context.source) {
      return {
        field: 'source',
        issue: 'BOUNDARY_SOURCE_INVALID',
      };
    }
    return undefined;
  }

  /**
   * Authority duplicates are recognized only at payload root, plus canonical
   * root tenant/actor objects. Recursive scanning would collide with valid
   * business fields, so nested business objects remain ordinary data.
   */
  private findPayloadAuthorityConflict(
    payload: InternalExecutionInput['payload'],
    expected: ExpectedPayloadAuthority
  ): AuthorityConflict | undefined {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      return undefined;
    }
    const record = payload as Readonly<Record<string, unknown>>;
    for (const field of BOUNDARY_RESERVED_AUTHORITY_FIELDS) {
      if (
        !Object.prototype.hasOwnProperty.call(record, field) ||
        (
          field === 'executionMode' &&
          expected.executionMode === undefined
        ) ||
        (
          field === 'authoritativeDeadlineAt' &&
          expected.authoritativeDeadlineAt === undefined
        ) ||
        (
          field === 'authorizationPolicyVersion' &&
          expected.authorizationPolicyVersion === undefined
        )
      ) {
        continue;
      }
      if (
        !this.payloadAuthorityValueMatches(
          field,
          record[field],
          expected
        )
      ) {
        return {
          field,
          issue: this.issueForAuthorityField(field),
        };
      }
    }
    return undefined;
  }

  private payloadAuthorityValueMatches(
    field: string,
    actual: unknown,
    expected: ExpectedPayloadAuthority
  ): boolean {
    if (field === 'tenant') {
      return this.hasExactPrimitiveShape(actual, {
        tenantId: expected.tenantId,
      });
    }
    if (field === 'actor') {
      return this.hasExactPrimitiveShape(actual, {
        actorId: expected.actorId,
        actorType: expected.actorType,
      });
    }
    const expectedValues: Readonly<Record<string, unknown>> = {
      tenantId: expected.tenantId,
      actorId: expected.actorId,
      actorType: expected.actorType,
      consumerId: expected.consumerId,
      source: expected.source,
      requestId: expected.requestId,
      correlationId: expected.correlationId,
      requestedMode: expected.requestedMode,
      executionMode: expected.executionMode,
      authoritativeDeadlineAt:
        expected.authoritativeDeadlineAt,
      authorizationPolicyVersion:
        expected.authorizationPolicyVersion,
    };
    return actual === expectedValues[field];
  }

  private hasExactPrimitiveShape(
    actual: unknown,
    expected: Readonly<Record<string, string>>
  ): boolean {
    if (
      typeof actual !== 'object' ||
      actual === null ||
      Array.isArray(actual) ||
      Object.getPrototypeOf(actual) !== Object.prototype
    ) {
      return false;
    }
    const record = actual as Readonly<Record<string, unknown>>;
    const keys = Object.keys(record);
    const expectedKeys = Object.keys(expected);
    return (
      keys.length === expectedKeys.length &&
      expectedKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(record, key) &&
          record[key] === expected[key]
      )
    );
  }

  private issueForAuthorityField(
    field: string
  ): BoundaryContextContractIssue {
    if (field === 'tenant' || field === 'tenantId') {
      return 'BOUNDARY_TENANT_MISMATCH';
    }
    if (
      field === 'actor' ||
      field === 'actorId' ||
      field === 'actorType'
    ) {
      return 'BOUNDARY_ACTOR_MISMATCH';
    }
    if (field === 'consumerId') {
      return 'BOUNDARY_CONSUMER_UNAUTHORIZED';
    }
    if (field === 'source') {
      return 'BOUNDARY_SOURCE_INVALID';
    }
    if (
      field === 'requestedMode' ||
      field === 'executionMode'
    ) {
      return 'BOUNDARY_MODE_ESCALATION';
    }
    if (
      field === 'authoritativeDeadlineAt' ||
      field === 'authorizationPolicyVersion'
    ) {
      return 'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID';
    }
    return 'BOUNDARY_REQUEST_CONTEXT_MISMATCH';
  }

  private findPolicyDecisionConflict(
    decision: AuthoritativeBoundaryPolicyDecisionV1,
    query: {
      readonly tenantId: string;
      readonly consumerId: string;
      readonly source: string;
      readonly requestedMode: string;
      readonly actor: {
        readonly actorId: string;
        readonly actorType: string;
      };
    }
  ): string | undefined {
    if (decision.evaluatedTenantId !== query.tenantId) {
      return 'tenantId';
    }
    if (decision.evaluatedConsumerId !== query.consumerId) {
      return 'consumerId';
    }
    if (decision.evaluatedSource !== query.source) {
      return 'source';
    }
    if (decision.requestedMode !== query.requestedMode) {
      return 'requestedMode';
    }
    if (decision.evaluatedActor.actorId !== query.actor.actorId) {
      return 'actorId';
    }
    if (
      decision.evaluatedActor.actorType !== query.actor.actorType
    ) {
      return 'actorType';
    }
    return undefined;
  }

  private policyDenialError(
    reasonCode: AuthoritativeBoundaryPolicyDenialReasonCodeV1
  ): GovernedBoundaryError {
    if (reasonCode === 'TENANT_NOT_ALLOWED') {
      return new BoundaryContextContractError(
        'BOUNDARY_TENANT_MISMATCH'
      );
    }
    if (reasonCode === 'ACTOR_NOT_ALLOWED') {
      return new BoundaryContextContractError(
        'BOUNDARY_ACTOR_MISMATCH'
      );
    }
    if (reasonCode === 'CONSUMER_NOT_ALLOWED') {
      return new BoundaryContextContractError(
        'BOUNDARY_CONSUMER_UNAUTHORIZED'
      );
    }
    if (reasonCode === 'SOURCE_NOT_ALLOWED') {
      return new BoundaryContextContractError(
        'BOUNDARY_SOURCE_INVALID'
      );
    }
    if (reasonCode === 'MODE_NOT_ALLOWED') {
      return new BoundaryContextContractError(
        'BOUNDARY_MODE_ESCALATION'
      );
    }
    return new GovernedBoundaryError(
      'BOUNDARY_DISABLED',
      'Authoritative boundary policy denied execution',
      false
    );
  }

  private auditConflict(
    request: GovernedExecutionRequest,
    context: BoundaryInvocationContextV1,
    conflict: AuthorityConflict
  ): void {
    this.tryAuditLog('BOUNDARY_CONTEXT_CONFLICT', {
      requestId: context.requestId,
      correlationId: context.correlationId,
      tenantId: context.tenantId,
      actorType: context.actor.actorType,
      consumerId: context.consumerId,
      source: context.source,
      requestedMode: request.requestedMode,
      reasonCode: conflict.issue,
      conflictField: conflict.field,
    });
  }

  private calculateAuthoritativeDeadlineAt(
    initiatedAt: string,
    effectiveTimeoutMs: number
  ): string {
    const initiatedAtMilliseconds =
      this.parseCanonicalTimestamp(initiatedAt);
    if (
      initiatedAtMilliseconds === undefined ||
      !Number.isSafeInteger(effectiveTimeoutMs) ||
      effectiveTimeoutMs <= 0
    ) {
      throw new BoundaryContextContractError(
        'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
      );
    }

    const deadlineAtMilliseconds =
      initiatedAtMilliseconds + effectiveTimeoutMs;
    if (
      !Number.isSafeInteger(deadlineAtMilliseconds) ||
      deadlineAtMilliseconds < 0 ||
      deadlineAtMilliseconds < initiatedAtMilliseconds
    ) {
      throw new BoundaryContextContractError(
        'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
      );
    }

    try {
      const authoritativeDeadlineAt = new Date(
        deadlineAtMilliseconds
      ).toISOString();
      if (
        this.parseCanonicalTimestamp(
          authoritativeDeadlineAt
        ) !== deadlineAtMilliseconds
      ) {
        throw new BoundaryContextContractError(
          'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
        );
      }
      return authoritativeDeadlineAt;
    } catch (error) {
      if (error instanceof BoundaryContextContractError) {
        throw error;
      }
      throw new BoundaryContextContractError(
        'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
      );
    }
  }

  private hasAuthoritativeDeadlineExpired(
    authoritativeDeadlineAt: string
  ): boolean {
    const deadlineAtMilliseconds = this.parseCanonicalTimestamp(
      authoritativeDeadlineAt
    );
    const currentMilliseconds = this.parseCanonicalTimestamp(
      this.clockPort.now()
    );
    if (
      deadlineAtMilliseconds === undefined ||
      currentMilliseconds === undefined
    ) {
      throw new BoundaryContextContractError(
        'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
      );
    }
    return currentMilliseconds >= deadlineAtMilliseconds;
  }

  private parseCanonicalTimestamp(
    value: string
  ): number | undefined {
    const milliseconds = Date.parse(value);
    if (
      !Number.isSafeInteger(milliseconds) ||
      milliseconds < 0
    ) {
      return undefined;
    }
    try {
      return new Date(milliseconds).toISOString() === value
        ? milliseconds
        : undefined;
    } catch {
      return undefined;
    }
  }

  private hasTimedOut(
    startedAt: string,
    timeoutMs: number | undefined
  ): boolean {
    if (timeoutMs === undefined) {
      return false;
    }
    return (
      this.calculateDuration(startedAt, this.clockPort.now()) >=
      timeoutMs
    );
  }

  private getInternalReasonCode(error: unknown): string {
    if (error instanceof BoundaryContextContractError) {
      return error.issue;
    }
    if (error instanceof BoundaryPolicyContractError) {
      return error.issue;
    }
    if (error instanceof GovernedBoundaryError) {
      return error.code;
    }
    return 'EXECUTION_FAILED';
  }

  private extractString(
    object: unknown,
    key: string
  ): string | undefined {
    try {
      if (typeof object !== 'object' || object === null) {
        return undefined;
      }
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      return descriptor &&
        Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
        typeof descriptor.value === 'string'
        ? descriptor.value
        : undefined;
    } catch {
      return undefined;
    }
  }

  private calculateDuration(
    startedAt: string,
    completedAt: string
  ): number {
    const startMs = Date.parse(startedAt);
    const endMs = Date.parse(completedAt);
    return Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(0, endMs - startMs)
      : 0;
  }

  private tryAuditLog(
    eventName: string,
    data: Readonly<Record<string, unknown>>
  ): void {
    if (!this.auditPort) {
      return;
    }
    try {
      void Promise.resolve(
        this.auditPort.logEvent(eventName, Object.freeze({ ...data }))
      ).catch(() => undefined);
    } catch {
      // Audit remains best-effort.
    }
  }

  private buildErrorResponse(params: {
    readonly requestId: string;
    readonly correlationId: string;
    readonly mode: GovernedExecutionResponse['mode'];
    readonly status: BoundaryStatus;
    readonly startedAt: string;
    readonly error: unknown;
  }): GovernedExecutionResponse {
    const completedAt = this.clockPort.now();
    return this.buildResponse({
      requestId: params.requestId,
      correlationId: params.correlationId,
      mode: params.mode,
      status: params.status,
      startedAt: params.startedAt,
      completedAt,
      durationMs: this.calculateDuration(
        params.startedAt,
        completedAt
      ),
      warnings: [],
      errors: [sanitizePublicError(params.error)],
    });
  }

  private buildResponse(params: {
    readonly requestId: string;
    readonly correlationId: string;
    readonly mode: GovernedExecutionResponse['mode'];
    readonly status: BoundaryStatus;
    readonly startedAt: string;
    readonly completedAt: string;
    readonly durationMs: number;
    readonly resultSummary?: Record<string, unknown>;
    readonly comparisonSummary?: Record<string, unknown>;
    readonly semanticProjection?: Readonly<Record<string, unknown>>;
    readonly warnings: GovernedExecutionResponse['warnings'];
    readonly errors: GovernedExecutionResponse['errors'];
  }): GovernedExecutionResponse {
    return {
      requestId: params.requestId,
      correlationId: params.correlationId,
      mode: params.mode,
      status: params.status,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      durationMs: params.durationMs,
      ...(params.resultSummary
        ? { resultSummary: params.resultSummary }
        : {}),
      ...(params.comparisonSummary
        ? { comparisonSummary: params.comparisonSummary }
        : {}),
      ...(params.semanticProjection !== undefined
        ? { semanticProjection: params.semanticProjection }
        : {}),
      warnings: params.warnings,
      errors: params.errors,
    };
  }
}

export default GovernedExecutionBoundary;
