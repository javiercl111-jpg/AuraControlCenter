import * as crypto from 'crypto';
import type { PipelineIdGenerator } from '../../os/ports';

/**
 * AEA-05-R1C.1 - Infrastructure Adapter
 *
 * Provides a production runtime infrastructure adapter for the Aura Intelligence Orchestrator.
 * This adapter encapsulates controlled non-determinism for ID generation using standard crypto.randomUUID().
 * It is completely independent of Aura components (Boundary, Growth, Preview, Auth, Tenants).
 */
export class CryptoPipelineIdGeneratorV1 implements PipelineIdGenerator {
  public generateExecutionId(): string {
    return crypto.randomUUID();
  }
}
