import type { InternalPayloadValue } from '../boundary/ports';
import type { AuthoritativeBoundaryExecutionModeV1 } from '../boundary/types';
import type {
  BootstrapAcceptedState,
  BootstrapRejectedState,
} from '../bootstrap/types';

export const BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION = '1' as const;

export const BOOTSTRAP_BOUNDARY_BRIDGE_ACTOR_TYPES = Object.freeze([
  'HUMAN',
  'SERVICE',
  'SYSTEM',
] as const);

export type BootstrapBoundaryBridgeActorType =
  (typeof BOOTSTRAP_BOUNDARY_BRIDGE_ACTOR_TYPES)[number];

export type BootstrapBoundaryBridgeActorV1 = {
  readonly [ActorType in BootstrapBoundaryBridgeActorType]: {
    readonly actorType: ActorType;
    readonly actorId: string;
  };
}[BootstrapBoundaryBridgeActorType];

export interface BootstrapBoundaryBridgeAuthorityV1 {
  readonly schemaVersion:
    typeof BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION;
  readonly tenantId: string;
  readonly actor: BootstrapBoundaryBridgeActorV1;
  readonly consumerId: string;
  readonly source: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly executionMode: AuthoritativeBoundaryExecutionModeV1;
  readonly authorizationPolicyVersion: string;
  readonly initiatedAt: string;
  readonly authoritativeDeadlineAt: string;
}

export interface BootstrapBoundaryBridgeEnvelopeV1 {
  readonly schemaVersion:
    typeof BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION;
  readonly authority: BootstrapBoundaryBridgeAuthorityV1;
  readonly businessPayload: InternalPayloadValue;
  readonly cancellationSignal?: AbortSignal;
}

export interface BootstrapBoundaryBridgePublicErrorV1 {
  readonly code: 'BOOTSTRAP_REJECTED';
  readonly message: 'Bootstrap request was rejected';
  readonly retryable: false;
}

export interface BootstrapBoundaryBridgeAcceptedResultV1 {
  readonly schemaVersion:
    typeof BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION;
  readonly bridgeStatus: 'ACCEPTED';
  readonly authority: BootstrapBoundaryBridgeAuthorityV1;
  readonly bootstrapState: BootstrapAcceptedState;
}

export interface BootstrapBoundaryBridgeRejectedResultV1 {
  readonly schemaVersion:
    typeof BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION;
  readonly bridgeStatus: 'REJECTED';
  readonly authority: BootstrapBoundaryBridgeAuthorityV1;
  readonly bootstrapState: BootstrapRejectedState;
  readonly publicError: BootstrapBoundaryBridgePublicErrorV1;
}

export type BootstrapBoundaryBridgeResultV1 =
  | BootstrapBoundaryBridgeAcceptedResultV1
  | BootstrapBoundaryBridgeRejectedResultV1;
