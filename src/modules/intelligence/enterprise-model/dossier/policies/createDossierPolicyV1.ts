import { DefaultDossierPolicy } from '../utils/DefaultDossierPolicy';
import type { DossierPolicy } from '../domain/types';

/**
 * AEA-05-R1C.2 - Orchestrator Policy Factory
 *
 * Factory that returns the canonical DossierPolicy.
 * The underlying DefaultDossierPolicy is stateless/immutable, but we return a new instance
 * to avoid any accidental shared state issues if internal implementations change in the future.
 */
export function createDossierPolicyV1(): DossierPolicy {
  return new DefaultDossierPolicy();
}
