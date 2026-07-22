import type { ExecutiveDiagnosis } from "./ExecutiveDiagnosis";
import type {
  DiscoveryMetadata,
  ExecutiveDiscoveryConsentAssertion,
  ExecutiveDiscoveryEvidence,
} from "./ExecutiveDiscoveryApiRequest";

export interface ExecutiveDiscoveryEvaluationInput {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly idempotencyKey: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly companyId: string;
  readonly sessionId: string;
  readonly discoveryDefinitionVersion: string;
  readonly locale: string;
  readonly evidence: readonly ExecutiveDiscoveryEvidence[];
  readonly consentAssertion: Readonly<ExecutiveDiscoveryConsentAssertion>;
  readonly metadata?: DiscoveryMetadata;
}

export interface ExecutiveDiscoveryAdapter {
  readonly evaluate: (
    input: ExecutiveDiscoveryEvaluationInput,
  ) => Promise<ExecutiveDiagnosis>;
}

