import type {
  AuthoritativeFeaturePolicyPort,
  EffectiveBoundaryPolicy,
} from '../os/boundary/ports';
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
import {
  createAuthoritativePolicySnapshotV1,
} from './factories';
import {
  createAuthoritativePolicyLookupKeyV1,
} from './helpers';
import {
  AUTHORITATIVE_POLICY_ENTRY_VERSION,
  AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
  type AuthoritativePolicyEntryV1,
  type AuthoritativePolicySnapshotV1,
} from './types';

export class InMemoryAuthoritativeFeaturePolicyProducer
  implements AuthoritativeFeaturePolicyPort
{
  readonly #snapshot: AuthoritativePolicySnapshotV1;
  readonly #entryIndex: ReadonlyMap<
    string,
    AuthoritativePolicyEntryV1
  >;

  constructor(snapshot: unknown) {
    const certifiedSnapshot =
      createAuthoritativePolicySnapshotV1(snapshot);
    const entryIndex = new Map<
      string,
      AuthoritativePolicyEntryV1
    >();
    for (const entry of certifiedSnapshot.entries) {
      entryIndex.set(
        createAuthoritativePolicyLookupKeyV1(entry),
        entry
      );
    }
    this.#snapshot = certifiedSnapshot;
    this.#entryIndex = entryIndex;
    Object.freeze(this);
  }

  public getEffectivePolicy(
    tenantId: string,
    source: string
  ): Promise<EffectiveBoundaryPolicy | undefined> {
    void tenantId;
    void source;
    return Promise.resolve(undefined);
  }

  public async evaluateAuthoritativePolicy(
    query: AuthoritativeBoundaryPolicyQueryV1
  ): Promise<AuthoritativeBoundaryPolicyDecisionV1> {
    const validatedQuery =
      validateAuthoritativeBoundaryPolicyQueryV1(query);

    if (validatedQuery.requestedMode !== 'SHADOW_ONLY') {
      return this.createDeniedDecision(
        validatedQuery,
        'MODE_NOT_ALLOWED'
      );
    }
    if (
      !this.#snapshot.entries.some(
        (entry) => entry.tenantId === validatedQuery.tenantId
      )
    ) {
      return this.createDeniedDecision(
        validatedQuery,
        'TENANT_NOT_ALLOWED'
      );
    }
    if (
      !this.#snapshot.entries.some(
        (entry) =>
          entry.actorType === validatedQuery.actor.actorType &&
          entry.actorId === validatedQuery.actor.actorId
      )
    ) {
      return this.createDeniedDecision(
        validatedQuery,
        'ACTOR_NOT_ALLOWED'
      );
    }
    if (!this.isKnownConsumerId(validatedQuery.consumerId)) {
      return this.createDeniedDecision(
        validatedQuery,
        'CONSUMER_NOT_ALLOWED'
      );
    }
    if (!this.isKnownSource(validatedQuery.source)) {
      return this.createDeniedDecision(
        validatedQuery,
        'SOURCE_NOT_ALLOWED'
      );
    }

    const lookupKey = createAuthoritativePolicyLookupKeyV1({
      tenantId: validatedQuery.tenantId,
      actorType: validatedQuery.actor.actorType,
      actorId: validatedQuery.actor.actorId,
      consumerId: validatedQuery.consumerId,
      source: validatedQuery.source,
      requestedMode: validatedQuery.requestedMode,
    });
    const entry = this.#entryIndex.get(lookupKey);
    if (!entry) {
      return this.createDeniedDecision(
        validatedQuery,
        'POLICY_NOT_FOUND'
      );
    }
    if (!entry.enabled) {
      return this.createDeniedDecision(
        validatedQuery,
        'POLICY_DISABLED'
      );
    }
    if (
      entry.entryVersion !== AUTHORITATIVE_POLICY_ENTRY_VERSION ||
      entry.authorizationPolicyVersion !==
        this.#snapshot.authorizationPolicyVersion ||
      this.#snapshot.authorizationPolicyVersion !==
        AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION
    ) {
      return this.createDeniedDecision(
        validatedQuery,
        'POLICY_VERSION_UNSUPPORTED'
      );
    }
    if (
      entry.requestedMode !== validatedQuery.requestedMode ||
      entry.effectiveExecutionMode !==
        validatedQuery.requestedMode
    ) {
      return this.createDeniedDecision(
        validatedQuery,
        'MODE_NOT_ALLOWED'
      );
    }

    return validateAuthoritativeBoundaryPolicyDecisionV1({
      ...this.decisionContext(validatedQuery),
      decision: 'ALLOWED',
      reasonCode: 'POLICY_ALLOWED',
      effectiveExecutionMode: entry.effectiveExecutionMode,
      effectiveTimeoutMs: entry.effectiveTimeoutMs,
    });
  }

  private isKnownConsumerId(
    consumerId: string
  ): consumerId is AuthoritativePolicyEntryV1['consumerId'] {
    return this.#snapshot.entries.some(
      (entry) => entry.consumerId === consumerId
    );
  }

  private isKnownSource(
    source: string
  ): source is AuthoritativePolicyEntryV1['source'] {
    return this.#snapshot.entries.some(
      (entry) => entry.source === source
    );
  }

  private createDeniedDecision(
    query: AuthoritativeBoundaryPolicyQueryV1,
    reasonCode: AuthoritativeBoundaryPolicyDenialReasonCodeV1
  ): AuthoritativeBoundaryPolicyDecisionV1 {
    return validateAuthoritativeBoundaryPolicyDecisionV1({
      ...this.decisionContext(query),
      decision: 'DENIED',
      reasonCode,
    });
  }

  private decisionContext(
    query: AuthoritativeBoundaryPolicyQueryV1
  ): Readonly<{
    schemaVersion:
      typeof AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION;
    authorizationPolicyVersion: string;
    evaluatedTenantId: string;
    evaluatedConsumerId: string;
    evaluatedSource: string;
    evaluatedActor: AuthoritativeBoundaryPolicyQueryV1['actor'];
    requestedMode: AuthoritativeBoundaryPolicyQueryV1['requestedMode'];
  }> {
    return Object.freeze({
      schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
      authorizationPolicyVersion:
        this.#snapshot.authorizationPolicyVersion,
      evaluatedTenantId: query.tenantId,
      evaluatedConsumerId: query.consumerId,
      evaluatedSource: query.source,
      evaluatedActor: query.actor,
      requestedMode: query.requestedMode,
    });
  }
}
