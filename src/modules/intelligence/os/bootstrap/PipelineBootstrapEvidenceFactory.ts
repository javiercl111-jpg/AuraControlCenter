import type { EnterpriseEvidence } from '../../enterprise-model/domain/evidence';
import { generateDeterministicEvidenceId } from '../../enterprise-model/extraction/domain/utils';
import type {
  PipelineBootstrapDirectness,
  PipelineBootstrapReliability,
} from './provenance';
import type { PipelineBootstrapFact } from './types';
import { throwPipelineBootstrapCoreError } from './PipelineBootstrapCoreErrors';

export const PIPELINE_BOOTSTRAP_EVIDENCE_MAPPING_VERSION =
  'bootstrap-evidence-v1' as const;

export const PIPELINE_BOOTSTRAP_RELIABILITY_SCORES: Readonly<
  Record<PipelineBootstrapReliability, number>
> = Object.freeze({
  CONFIRMED: 1,
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.3,
  UNKNOWN: 0,
});

export const PIPELINE_BOOTSTRAP_DIRECTNESS_SCORES: Readonly<
  Record<PipelineBootstrapDirectness, number>
> = Object.freeze({
  DIRECT: 1,
  DERIVED: 0.75,
  INFERRED: 0.5,
});

export interface PipelineBootstrapEvidenceContext {
  readonly bootstrapId: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

/**
 * Canonical bootstrap evidence identity is the versioned JSON tuple emitted
 * below plus the existing generator inputs. The tuple includes tenant,
 * correlation, bootstrap batch, fact identity, normalized value, epistemic
 * qualifiers, provenance identity, timestamps, and schema version.
 *
 * EnterpriseEvidence has no tenant field, so tenant remains in this canonical
 * identity and in the source-fact envelope. correlationId is the legitimate
 * bootstrap session identity; bootstrapId is the legitimate batch/turn
 * identity. No conversational text or additional provenance is invented.
 */
function containsUnknownBusinessValue(
  value: PipelineBootstrapFact['value']
): boolean {
  return (
    value === 'UNKNOWN' ||
    (Array.isArray(value) && value.some((item) => item === 'UNKNOWN'))
  );
}

function createCanonicalStatement(
  fact: PipelineBootstrapFact,
  context: PipelineBootstrapEvidenceContext
): string {
  return JSON.stringify([
    PIPELINE_BOOTSTRAP_EVIDENCE_MAPPING_VERSION,
    context.tenantId,
    context.correlationId,
    context.bootstrapId,
    fact.factId,
    fact.category,
    fact.valueType,
    fact.value,
    fact.polarity,
    fact.reliability,
    fact.directness,
    fact.provenance.sourceType,
    fact.provenance.sourceId,
    fact.provenance.collectionMethod,
    fact.provenance.actorType,
    fact.provenance.inferenceRuleId ?? null,
    fact.observedAt,
    fact.provenance.capturedAt,
    fact.schemaVersion,
  ]);
}

function assertContextMatchesFact(
  fact: PipelineBootstrapFact,
  context: PipelineBootstrapEvidenceContext
): void {
  if (
    fact.provenance.tenantId !== context.tenantId ||
    fact.provenance.correlationId !== context.correlationId ||
    context.bootstrapId.length === 0 ||
    context.tenantId.length === 0 ||
    context.correlationId.length === 0
  ) {
    throwPipelineBootstrapCoreError(
      'BOOTSTRAP_FACT_MAPPING_FAILED'
    );
  }
}

export class PipelineBootstrapEvidenceFactory {
  public create(
    fact: PipelineBootstrapFact,
    context: PipelineBootstrapEvidenceContext
  ): EnterpriseEvidence {
    assertContextMatchesFact(fact, context);

    if (
      fact.polarity === 'UNCERTAIN' ||
      containsUnknownBusinessValue(fact.value)
    ) {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_FACT_MAPPING_FAILED'
      );
    }

    const normalizedStatement = createCanonicalStatement(
      fact,
      context
    );
    const evidenceId = generateDeterministicEvidenceId(
      context.correlationId,
      context.bootstrapId,
      normalizedStatement,
      fact.category
    );
    if (evidenceId.length === 0) {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_FACT_MAPPING_FAILED'
      );
    }

    const entityRefs: string[] = [];
    const metadata: Record<string, unknown> = {};
    Object.freeze(entityRefs);
    Object.freeze(metadata);

    return Object.freeze({
      evidenceId,
      sessionId: context.correlationId,
      turnId: context.bootstrapId,
      source: fact.provenance.sourceId,
      sourceType: fact.provenance.sourceType,
      originalText: null,
      normalizedStatement,
      category: fact.category,
      entityRefs,
      capturedAt: fact.provenance.capturedAt,
      reliability:
        PIPELINE_BOOTSTRAP_RELIABILITY_SCORES[fact.reliability],
      directness:
        PIPELINE_BOOTSTRAP_DIRECTNESS_SCORES[fact.directness],
      polarity:
        fact.polarity === 'AFFIRMED' ? 'POSITIVE' : 'NEGATIVE',
      extractorVersion:
        PIPELINE_BOOTSTRAP_EVIDENCE_MAPPING_VERSION,
      metadata,
    });
  }
}
