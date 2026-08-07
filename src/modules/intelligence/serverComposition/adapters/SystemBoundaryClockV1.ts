import type { BoundaryClockPort } from '../../os/boundary/ports';

/**
 * AEA-05-R1B.1 - System Boundary Clock Adapter
 *
 * Provides a production runtime infrastructure adapter for the GovernedExecutionBoundary.
 * This adapter encapsulates runtime non-determinism (Date generation).
 * Tests remain deterministic through port injection.
 */
export class SystemBoundaryClockV1 implements BoundaryClockPort {
  public now(): string {
    return new Date().toISOString();
  }
}
