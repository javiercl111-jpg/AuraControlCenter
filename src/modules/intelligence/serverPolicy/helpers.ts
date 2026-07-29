import {
  AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
} from '../os/boundary/types';
import {
  validateAuthoritativeBoundaryPolicyQueryV1,
} from '../os/boundary/validators';
import {
  AuthoritativePolicySnapshotContractError,
} from './errors';
import type {
  AuthoritativePolicyLookupInputV1,
} from './types';

function frameLookupField(name: string, value: string): string {
  return `${name.length}:${name}${value.length}:${value}`;
}

export function createAuthoritativePolicyLookupKeyV1(
  input: AuthoritativePolicyLookupInputV1
): string {
  try {
    const query = validateAuthoritativeBoundaryPolicyQueryV1({
      schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
      tenantId: input.tenantId,
      consumerId: input.consumerId,
      source: input.source,
      requestedMode: input.requestedMode,
      actor: {
        actorType: input.actorType,
        actorId: input.actorId,
      },
    });
    if (query.requestedMode !== 'SHADOW_ONLY') {
      throw new AuthoritativePolicySnapshotContractError(
        'MODE_NOT_ALLOWED'
      );
    }
    return [
      frameLookupField('tenantId', query.tenantId),
      frameLookupField('actorType', query.actor.actorType),
      frameLookupField('actorId', query.actor.actorId),
      frameLookupField('consumerId', query.consumerId),
      frameLookupField('source', query.source),
      frameLookupField('requestedMode', query.requestedMode),
    ].join('');
  } catch (error) {
    if (error instanceof AuthoritativePolicySnapshotContractError) {
      throw error;
    }
    throw new AuthoritativePolicySnapshotContractError(
      'INVALID_BINDING'
    );
  }
}
