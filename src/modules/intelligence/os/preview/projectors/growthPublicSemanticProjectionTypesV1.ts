import type { GrowthPublicOperationV1 } from '../publicPreviewTypesV1';

export interface GrowthPublicSemanticProjectionV1 {
  readonly schemaVersion: '1.0';
  readonly capability: 'GROWTH_INTELLIGENCE_V1';
  readonly operation: GrowthPublicOperationV1;
  readonly status: 'SUCCESS' | 'PARTIAL_SUCCESS';
  readonly missingFields: readonly string[];
  readonly output: Readonly<Record<string, unknown>>;
}
