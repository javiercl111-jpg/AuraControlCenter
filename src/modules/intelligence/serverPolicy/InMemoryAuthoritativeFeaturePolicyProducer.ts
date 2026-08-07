import type {
  AuthoritativeFeaturePolicyPort,
  EffectiveBoundaryPolicy,
} from '../os/boundary/ports';
import type {
  AuthoritativeBoundaryPolicyDecisionV1,
  AuthoritativeBoundaryPolicyQueryV1,
} from '../os/boundary/types';
import { createAuthoritativePolicySnapshotV1 } from './factories';
import { evaluateAuthoritativeFeaturePolicyV1 } from './evaluateAuthoritativeFeaturePolicyV1';
import type { AuthoritativePolicySnapshotV1 } from './types';

export class InMemoryAuthoritativeFeaturePolicyProducer
  implements AuthoritativeFeaturePolicyPort
{
  readonly #snapshot: AuthoritativePolicySnapshotV1;

  constructor(snapshot: unknown) {
    this.#snapshot = createAuthoritativePolicySnapshotV1(snapshot);
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
    return evaluateAuthoritativeFeaturePolicyV1(this.#snapshot, query);
  }
}
