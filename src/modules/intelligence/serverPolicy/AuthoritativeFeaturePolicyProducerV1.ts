import type {
  AuthoritativeFeaturePolicyPort,
  EffectiveBoundaryPolicy,
} from '../os/boundary/ports';
import {
  AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
  type AuthoritativeBoundaryPolicyDecisionV1,
  type AuthoritativeBoundaryPolicyQueryV1,
} from '../os/boundary/types';
import {
  validateAuthoritativeBoundaryPolicyDecisionV1,
  validateAuthoritativeBoundaryPolicyQueryV1,
} from '../os/boundary/validators';
import { evaluateAuthoritativeFeaturePolicyV1 } from './evaluateAuthoritativeFeaturePolicyV1';
import type { AuthoritativeFeaturePolicySourcePortV1 } from './ports';

export class AuthoritativeFeaturePolicyProducerV1
  implements AuthoritativeFeaturePolicyPort
{
  private readonly source: AuthoritativeFeaturePolicySourcePortV1;

  constructor(source: AuthoritativeFeaturePolicySourcePortV1) {
    this.source = source;
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
    const validatedQuery = validateAuthoritativeBoundaryPolicyQueryV1(query);

    const snapshot = await this.source.loadPolicySnapshot(
      validatedQuery.tenantId
    );

    if (!snapshot) {
      return validateAuthoritativeBoundaryPolicyDecisionV1({
        schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
        authorizationPolicyVersion: 'unknown',
        evaluatedTenantId: validatedQuery.tenantId,
        evaluatedConsumerId: validatedQuery.consumerId,
        evaluatedSource: validatedQuery.source,
        evaluatedActor: validatedQuery.actor,
        requestedMode: validatedQuery.requestedMode,
        decision: 'DENIED',
        reasonCode: 'POLICY_NOT_FOUND',
      });
    }

    return evaluateAuthoritativeFeaturePolicyV1(snapshot, validatedQuery);
  }
}
