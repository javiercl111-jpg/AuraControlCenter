import type { PipelineClock } from '../../os/ports';

/**
 * AEA-05-R1C.1 - Infrastructure Adapter
 *
 * Provides a production runtime infrastructure adapter for the Aura Intelligence Orchestrator.
 * This adapter encapsulates controlled non-determinism for time generation.
 * It is completely independent of Aura components (Boundary, Growth, Preview, Auth, Tenants).
 */
export class SystemPipelineClockV1 implements PipelineClock {
  public now(): number {
    return Date.now();
  }

  public toISOString(): string {
    return new Date().toISOString();
  }
}
