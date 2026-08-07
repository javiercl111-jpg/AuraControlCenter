import {
  AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
  type AuthoritativeBoundaryPolicyDecisionV1,
  type AuthoritativeBoundaryPolicyDenialReasonCodeV1,
  type AuthoritativeBoundaryPolicyQueryV1,
} from '../os/boundary/types';
import {
  validateAuthoritativeBoundaryPolicyDecisionV1,
  validateAuthoritativeBoundaryPolicyQueryV1,
} from '../os/boundary/validators';
import { createAuthoritativePolicyLookupKeyV1 } from './helpers';
import {
  AUTHORITATIVE_POLICY_ENTRY_VERSION,
  AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
  type AuthoritativePolicySnapshotV1,
} from './types';
import type { TrustedConsumerId, TrustedSourceId } from '../serverComposition/types';

export function evaluateAuthoritativeFeaturePolicyV1(
  snapshot: AuthoritativePolicySnapshotV1,
  query: AuthoritativeBoundaryPolicyQueryV1
): AuthoritativeBoundaryPolicyDecisionV1 {
  const validatedQuery = validateAuthoritativeBoundaryPolicyQueryV1(query);

  const decisionContext = Object.freeze({
    schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    authorizationPolicyVersion: snapshot.authorizationPolicyVersion,
    evaluatedTenantId: validatedQuery.tenantId,
    evaluatedConsumerId: validatedQuery.consumerId,
    evaluatedSource: validatedQuery.source,
    evaluatedActor: validatedQuery.actor,
    requestedMode: validatedQuery.requestedMode,
  });

  const createDeniedDecision = (
    reasonCode: AuthoritativeBoundaryPolicyDenialReasonCodeV1
  ): AuthoritativeBoundaryPolicyDecisionV1 => {
    return validateAuthoritativeBoundaryPolicyDecisionV1({
      ...decisionContext,
      decision: 'DENIED',
      reasonCode,
    });
  };

  // Only SHADOW_ONLY and EVALUATION are supported feature policy modes.
  // PRODUCTIVE is intentionally denied.
  if (
    validatedQuery.requestedMode !== 'SHADOW_ONLY' &&
    validatedQuery.requestedMode !== 'EVALUATION'
  ) {
    return createDeniedDecision('MODE_NOT_ALLOWED');
  }

  if (
    !snapshot.entries.some(
      (entry) => entry.tenantId === validatedQuery.tenantId
    )
  ) {
    return createDeniedDecision('TENANT_NOT_ALLOWED');
  }

  if (
    !snapshot.entries.some(
      (entry) =>
        entry.actorType === validatedQuery.actor.actorType &&
        entry.actorId === validatedQuery.actor.actorId
    )
  ) {
    return createDeniedDecision('ACTOR_NOT_ALLOWED');
  }

  const isKnownConsumerId = snapshot.entries.some(
    (entry) => entry.consumerId === validatedQuery.consumerId
  );
  if (!isKnownConsumerId) {
    return createDeniedDecision('CONSUMER_NOT_ALLOWED');
  }

  const isKnownSource = snapshot.entries.some(
    (entry) => entry.source === validatedQuery.source
  );
  if (!isKnownSource) {
    return createDeniedDecision('SOURCE_NOT_ALLOWED');
  }

  const lookupKey = createAuthoritativePolicyLookupKeyV1({
    tenantId: validatedQuery.tenantId,
    actorType: validatedQuery.actor.actorType,
    actorId: validatedQuery.actor.actorId,
    consumerId: validatedQuery.consumerId as TrustedConsumerId,
    source: validatedQuery.source as TrustedSourceId,
    requestedMode: validatedQuery.requestedMode,
  });

  const entry = snapshot.entries.find(
    (e) => createAuthoritativePolicyLookupKeyV1(e) === lookupKey
  );

  if (!entry) {
    return createDeniedDecision('POLICY_NOT_FOUND');
  }
  if (!entry.enabled) {
    return createDeniedDecision('POLICY_DISABLED');
  }
  if (
    entry.entryVersion !== AUTHORITATIVE_POLICY_ENTRY_VERSION ||
    entry.authorizationPolicyVersion !== snapshot.authorizationPolicyVersion ||
    snapshot.authorizationPolicyVersion !==
      AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION
  ) {
    return createDeniedDecision('POLICY_VERSION_UNSUPPORTED');
  }
  if (
    entry.requestedMode !== validatedQuery.requestedMode ||
    entry.effectiveExecutionMode !== validatedQuery.requestedMode
  ) {
    return createDeniedDecision('MODE_NOT_ALLOWED');
  }

  return validateAuthoritativeBoundaryPolicyDecisionV1({
    ...decisionContext,
    decision: 'ALLOWED',
    reasonCode: 'POLICY_ALLOWED',
    effectiveExecutionMode: entry.effectiveExecutionMode,
    effectiveTimeoutMs: entry.effectiveTimeoutMs,
  });
}
