import type {
  AuthorityApplicationServiceDependenciesV1,
  AuthorityAuthorizationDecisionV1,
  AuthorityAuthorizationResultV1,
  AuthorityMutationRepositoryPort,
  AuthorityObligationVerificationResultV1,
  AuthorityPrincipalResolutionResultV1,
  AuthorityTenantScopeResolutionResultV1,
} from "@aura/intelligence-os/server";

import {
  authorizationDecision,
  resolvedPrincipal,
  resolvedScope,
  verificationResult,
} from "../../../../src/modules/intelligence/serverAuthorityApplicationService/tests/fixtures";
import {
  END_TO_END_CONTEXT_FINGERPRINT,
  END_TO_END_OCCURRED_AT,
} from "./authorityEndToEndFixtures";

export type EndToEndAuthorizationMode =
  | "ALLOW"
  | "DENY"
  | "STALE"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type EndToEndObligationMode =
  | "VERIFIED"
  | "REJECTED"
  | "STALE"
  | "INCOMPLETE"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export interface AuthorityEndToEndDependencyState {
  principalResult: AuthorityPrincipalResolutionResultV1;
  scopeResult: AuthorityTenantScopeResolutionResultV1;
  authorizationMode: EndToEndAuthorizationMode;
  obligationMode: EndToEndObligationMode;
  obligationTypes: readonly AuthorityAuthorizationDecisionV1["obligations"][number]["obligationType"][];
  obligationResultOverride?: AuthorityObligationVerificationResultV1;
  principalCalls: number;
  scopeCalls: number;
  authorizationCalls: number;
  authorizationRequest?: Parameters<
    AuthorityApplicationServiceDependenciesV1["authorizationEvaluator"]["evaluate"]
  >[0];
  obligationCalls: number;
  fingerprintCalls: number;
  repositoryCalls: number;
  applicationClockCalls: number;
  repositoryCommand?: Parameters<AuthorityMutationRepositoryPort["execute"]>[0];
  repositoryContext?: Parameters<AuthorityMutationRepositoryPort["execute"]>[1];
  decisionPrincipalIdOverride?: string;
  decisionOperationResourceIdOverride?: string;
  decisionResourceOverride?: AuthorityAuthorizationDecisionV1["resourceBinding"];
  abortBeforeRepository?: AbortController;
}

export function createAuthorityEndToEndDependencyState():
  AuthorityEndToEndDependencyState {
  return {
    principalResult: {
      schemaVersion: "1",
      status: "RESOLVED",
      principal: resolvedPrincipal(),
    },
    scopeResult: {
      schemaVersion: "1",
      status: "RESOLVED",
      scope: resolvedScope(),
    },
    authorizationMode: "ALLOW",
    obligationMode: "VERIFIED",
    obligationTypes: ["REQUIRE_IDEMPOTENCY_KEY"],
    principalCalls: 0,
    scopeCalls: 0,
    authorizationCalls: 0,
    obligationCalls: 0,
    fingerprintCalls: 0,
    repositoryCalls: 0,
    applicationClockCalls: 0,
  };
}

function authorizationFailure(
  mode: Exclude<EndToEndAuthorizationMode, "ALLOW" | "DENY">,
): AuthorityAuthorizationResultV1 {
  const mapping = {
    STALE: ["POLICY_STALE", "RETRY_AFTER_POLICY_REFRESH"],
    CONFLICT: ["BINDING_CONFLICT", "RETRY_AFTER_OPERATOR_REVIEW"],
    INTERNAL_ERROR: ["INTERNAL_AUTHORIZATION_FAILURE", "SAFE_TO_RETRY"],
  } as const;
  const [reasonCode, retryDisposition] = mapping[mode];
  return Object.freeze({
    schemaVersion: "1",
    status: mode,
    reasonCode,
    retryDisposition,
    evaluatorVersion: "authorization-evaluator-d9-v1",
    evaluatedAt: END_TO_END_OCCURRED_AT,
  });
}

function obligationFailure(
  mode: Exclude<EndToEndObligationMode, "VERIFIED">,
): AuthorityObligationVerificationResultV1 {
  const safeCodes = {
    REJECTED: "OBLIGATIONS_REJECTED",
    STALE: "OBLIGATIONS_STALE",
    INCOMPLETE: "OBLIGATIONS_INCOMPLETE",
    CONFLICT: "OBLIGATIONS_CONFLICT",
    INTERNAL_ERROR: "OBLIGATIONS_INTERNAL_ERROR",
  } as const;
  return Object.freeze({
    schemaVersion: "1",
    status: mode,
    safeCode: safeCodes[mode],
    retryDisposition: "DO_NOT_RETRY",
    maskNotFound: false,
  });
}

function decidedAuthorization(
  state: AuthorityEndToEndDependencyState,
  request: Parameters<
    AuthorityApplicationServiceDependenciesV1["authorizationEvaluator"]["evaluate"]
  >[0],
): AuthorityAuthorizationResultV1 {
  if (
    state.authorizationMode !== "ALLOW" &&
    state.authorizationMode !== "DENY"
  ) {
    return authorizationFailure(state.authorizationMode);
  }
  const base = authorizationDecision(
    state.authorizationMode,
    state.obligationTypes,
  );
  const principalBinding = Object.freeze({
    ...request.principalBinding,
    ...(state.decisionPrincipalIdOverride === undefined
      ? {}
      : { principalId: state.decisionPrincipalIdOverride }),
  });
  const resourceBinding =
    state.decisionResourceOverride ?? request.resourceBinding;
  const operationBinding = Object.freeze({
    ...request.operationBinding,
    ...(state.decisionOperationResourceIdOverride === undefined
      ? {}
      : { resourceId: state.decisionOperationResourceIdOverride }),
  });
  return Object.freeze({
    schemaVersion: "1",
    status: "DECIDED",
    decision: Object.freeze({
      ...base,
      permission: request.operationBinding.permission,
      principalBinding,
      scopeBinding: request.scopeBinding,
      operationBinding,
      resourceBinding,
      policyEvidence: Object.freeze({
        ...base.policyEvidence,
        evaluatorVersion: "authorization-evaluator-d9-v1",
        principalEvidenceFingerprint:
          principalBinding.principalEvidenceFingerprint,
        scopeEvidenceFingerprint:
          request.scopeBinding.scopeEvidenceFingerprint,
      }),
      obligations: base.obligations,
    }),
  });
}

export function createAuthorityEndToEndDependencies(
  state: AuthorityEndToEndDependencyState,
  repository: AuthorityMutationRepositoryPort,
): AuthorityApplicationServiceDependenciesV1 {
  return Object.freeze({
    principalResolver: Object.freeze({
      async resolve() {
        state.principalCalls += 1;
        return state.principalResult;
      },
    }),
    tenantScopeResolver: Object.freeze({
      async resolve() {
        state.scopeCalls += 1;
        return state.scopeResult;
      },
    }),
    authorizationEvaluator: Object.freeze({
      async evaluate(request) {
        state.authorizationCalls += 1;
        state.authorizationRequest = request;
        return decidedAuthorization(state, request);
      },
    }),
    obligationVerifier: Object.freeze({
      async verify() {
        state.obligationCalls += 1;
        if (state.obligationResultOverride !== undefined) {
          return state.obligationResultOverride;
        }
        return state.obligationMode === "VERIFIED"
          ? verificationResult(state.obligationTypes)
          : obligationFailure(state.obligationMode);
      },
    }),
    contextFingerprintProvider: Object.freeze({
      async fingerprint() {
        state.fingerprintCalls += 1;
        return END_TO_END_CONTEXT_FINGERPRINT;
      },
    }),
    repository: Object.freeze({
      async execute(command, context) {
        state.repositoryCalls += 1;
        state.repositoryCommand = command;
        state.repositoryContext = context;
        state.abortBeforeRepository?.abort();
        return repository.execute(command, context);
      },
    }),
    clock: Object.freeze({
      nowIso() {
        state.applicationClockCalls += 1;
        return END_TO_END_OCCURRED_AT;
      },
    }),
  });
}

export function principalFailure(
  status: "NOT_FOUND" | "STALE",
): AuthorityPrincipalResolutionResultV1 {
  return Object.freeze({
    schemaVersion: "1",
    status,
    reasonCode: status === "NOT_FOUND"
      ? "AUTHENTICATION_BINDING_NOT_FOUND"
      : "STALE_BINDING",
    retryDisposition: status === "NOT_FOUND"
      ? "DO_NOT_RETRY"
      : "RETRY_AFTER_REFRESH",
    resolverVersion: "principal-resolver-d9-v1",
    resolvedAt: END_TO_END_OCCURRED_AT,
  });
}

export function scopeFailure(
  status: "STALE" | "REVOKED",
): AuthorityTenantScopeResolutionResultV1 {
  return Object.freeze({
    schemaVersion: "1",
    status,
    reasonCode: status === "STALE"
      ? "TENANT_AUTHORITY_STALE"
      : "TENANT_REVOKED",
    retryDisposition: status === "STALE"
      ? "RETRY_AFTER_TENANT_REFRESH"
      : "DO_NOT_RETRY",
    resolverVersion: "scope-resolver-d9-v1",
    resolvedAt: END_TO_END_OCCURRED_AT,
  });
}
