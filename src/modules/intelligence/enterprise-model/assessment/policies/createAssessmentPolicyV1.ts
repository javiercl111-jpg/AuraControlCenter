import { DefaultAssessmentPolicy } from './AssessmentPolicy';
import type { AssessmentPolicy } from '../domain/types';

/**
 * AEA-05-R1C.2 - Orchestrator Policy Factory
 *
 * Factory that returns the canonical AssessmentPolicy.
 * The underlying DefaultAssessmentPolicy is stateless structurally but has properties that could be
 * mutated if not careful. By returning a new instance on every call, we prevent shared mutable state.
 */
export function createAssessmentPolicyV1(): AssessmentPolicy {
  return new DefaultAssessmentPolicy();
}
