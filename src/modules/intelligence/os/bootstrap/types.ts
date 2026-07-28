import type { PipelineStageId } from '../types';
import type { CoverageDomain } from '../../enterprise-model/coverage/domain/types';
import type { PipelineBootstrapError } from './errors';
import type {
  PipelineBootstrapTaxonomyCategory,
  PipelineBootstrapValueType,
} from './taxonomy';
import type {
  PipelineBootstrapActorType,
  PipelineBootstrapDirectness,
  PipelineBootstrapPolarity,
  PipelineBootstrapProvenance,
  PipelineBootstrapReliability,
  PipelineBootstrapSourceType,
} from './provenance';

export const PIPELINE_BOOTSTRAP_SCHEMA_VERSION = '1' as const;
export const PIPELINE_BOOTSTRAP_VERSION = '1' as const;
export const PIPELINE_BOOTSTRAP_SCENARIO_VERSION = '1' as const;
export const PIPELINE_BOOTSTRAP_VERSIONING_MODE = 'V1_ONLY' as const;

export const PIPELINE_BOOTSTRAP_SCENARIO_IDS = [
  'PAYROLL_AUDIT',
  'COMPENSATION_RESTRUCTURE',
  'ORGANIZATION_RESTRUCTURE',
  'COMPLIANCE_AUDIT',
] as const;

export type PipelineBootstrapScenarioId =
  (typeof PIPELINE_BOOTSTRAP_SCENARIO_IDS)[number];

export const PIPELINE_BOOTSTRAP_SCENARIO_SOURCES = [
  'USER_SELECTION',
  'ADMIN_SELECTION',
  'AUTHORIZED_SYSTEM_CONFIGURATION',
] as const;

export type PipelineBootstrapScenarioSource =
  (typeof PIPELINE_BOOTSTRAP_SCENARIO_SOURCES)[number];

export const PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS = {
  PAYROLL_AUDIT: 'ASSESS_PAYROLL_AUDIT_READINESS',
  COMPENSATION_RESTRUCTURE:
    'ASSESS_COMPENSATION_RESTRUCTURE_READINESS',
  ORGANIZATION_RESTRUCTURE:
    'ASSESS_ORGANIZATION_RESTRUCTURE_READINESS',
  COMPLIANCE_AUDIT: 'ASSESS_COMPLIANCE_AUDIT_READINESS',
} as const satisfies Readonly<
  Record<PipelineBootstrapScenarioId, string>
>;

export type PipelineBootstrapScenarioObjectiveKey =
  (typeof PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS)[PipelineBootstrapScenarioId];

export const PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES = [
  'EVIDENCE_EXTRACTION',
  'MENTAL_MODEL',
  'KNOWLEDGE_GRAPH',
  'KNOWLEDGE_COVERAGE',
  'ADAPTIVE_PLANNING',
  'EXECUTIVE_REASONING',
  'EXECUTIVE_DOSSIER',
  'TRANSFORMATION_ASSESSMENT',
] as const satisfies readonly PipelineStageId[];

export const PIPELINE_BOOTSTRAP_STAGE_DEPENDENCIES: Readonly<
  Record<PipelineStageId, readonly PipelineStageId[]>
> = Object.freeze({
  EVIDENCE_EXTRACTION: [],
  MENTAL_MODEL: ['EVIDENCE_EXTRACTION'],
  KNOWLEDGE_GRAPH: ['EVIDENCE_EXTRACTION', 'MENTAL_MODEL'],
  KNOWLEDGE_COVERAGE: [
    'EVIDENCE_EXTRACTION',
    'MENTAL_MODEL',
    'KNOWLEDGE_GRAPH',
  ],
  ADAPTIVE_PLANNING: ['KNOWLEDGE_COVERAGE'],
  EXECUTIVE_REASONING: ['KNOWLEDGE_COVERAGE'],
  EXECUTIVE_DOSSIER: ['EXECUTIVE_REASONING'],
  TRANSFORMATION_ASSESSMENT: [
    'EXECUTIVE_REASONING',
    'EXECUTIVE_DOSSIER',
  ],
});

const PIPELINE_BOOTSTRAP_REQUIRED_SCENARIO_STAGES = [
  'EVIDENCE_EXTRACTION',
  'MENTAL_MODEL',
  'KNOWLEDGE_GRAPH',
  'KNOWLEDGE_COVERAGE',
] as const satisfies readonly PipelineStageId[];

export interface PipelineBootstrapScenarioRegistryEntry {
  readonly scenarioId: PipelineBootstrapScenarioId;
  readonly version: typeof PIPELINE_BOOTSTRAP_SCENARIO_VERSION;
  readonly description: string;
  readonly objectiveKey: PipelineBootstrapScenarioObjectiveKey;
  readonly allowedStages: readonly PipelineStageId[];
  readonly requiredStages: readonly PipelineStageId[];
  readonly stageDependencies: Readonly<
    Record<PipelineStageId, readonly PipelineStageId[]>
  >;
  readonly includedDomains: readonly CoverageDomain[];
  readonly excludedDomains: readonly CoverageDomain[];
}

export const PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY: Readonly<
  Record<
    PipelineBootstrapScenarioId,
    PipelineBootstrapScenarioRegistryEntry
  >
> = Object.freeze({
  PAYROLL_AUDIT: Object.freeze({
    scenarioId: 'PAYROLL_AUDIT',
    version: PIPELINE_BOOTSTRAP_SCENARIO_VERSION,
    description:
      'Assess evidence readiness for payroll controls and compliance.',
    objectiveKey:
      PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS.PAYROLL_AUDIT,
    allowedStages: PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES,
    requiredStages: PIPELINE_BOOTSTRAP_REQUIRED_SCENARIO_STAGES,
    stageDependencies: PIPELINE_BOOTSTRAP_STAGE_DEPENDENCIES,
    includedDomains: [
      'payroll',
      'organization',
      'compliance',
    ] as const,
    excludedDomains: [
      'compensation',
      'benefits',
      'talent_performance',
      'time_attendance',
      'workforce_analytics',
    ] as const,
  }),
  COMPENSATION_RESTRUCTURE: Object.freeze({
    scenarioId: 'COMPENSATION_RESTRUCTURE',
    version: PIPELINE_BOOTSTRAP_SCENARIO_VERSION,
    description:
      'Assess evidence readiness for compensation restructuring.',
    objectiveKey:
      PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS
        .COMPENSATION_RESTRUCTURE,
    allowedStages: PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES,
    requiredStages: PIPELINE_BOOTSTRAP_REQUIRED_SCENARIO_STAGES,
    stageDependencies: PIPELINE_BOOTSTRAP_STAGE_DEPENDENCIES,
    includedDomains: [
      'compensation',
      'organization',
      'payroll',
      'benefits',
    ] as const,
    excludedDomains: [
      'compliance',
      'talent_performance',
      'time_attendance',
      'workforce_analytics',
    ] as const,
  }),
  ORGANIZATION_RESTRUCTURE: Object.freeze({
    scenarioId: 'ORGANIZATION_RESTRUCTURE',
    version: PIPELINE_BOOTSTRAP_SCENARIO_VERSION,
    description:
      'Assess evidence readiness for organization restructuring.',
    objectiveKey:
      PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS
        .ORGANIZATION_RESTRUCTURE,
    allowedStages: PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES,
    requiredStages: PIPELINE_BOOTSTRAP_REQUIRED_SCENARIO_STAGES,
    stageDependencies: PIPELINE_BOOTSTRAP_STAGE_DEPENDENCIES,
    includedDomains: [
      'organization',
      'workforce_analytics',
      'talent_performance',
    ] as const,
    excludedDomains: [
      'payroll',
      'compensation',
      'benefits',
      'compliance',
      'time_attendance',
    ] as const,
  }),
  COMPLIANCE_AUDIT: Object.freeze({
    scenarioId: 'COMPLIANCE_AUDIT',
    version: PIPELINE_BOOTSTRAP_SCENARIO_VERSION,
    description:
      'Assess evidence readiness for compliance audit controls.',
    objectiveKey:
      PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS.COMPLIANCE_AUDIT,
    allowedStages: PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES,
    requiredStages: PIPELINE_BOOTSTRAP_REQUIRED_SCENARIO_STAGES,
    stageDependencies: PIPELINE_BOOTSTRAP_STAGE_DEPENDENCIES,
    includedDomains: [
      'compliance',
      'payroll',
      'time_attendance',
    ] as const,
    excludedDomains: [
      'organization',
      'compensation',
      'benefits',
      'talent_performance',
      'workforce_analytics',
    ] as const,
  }),
});

interface PipelineBootstrapTargetScenarioBase {
  readonly scenarioVersion: typeof PIPELINE_BOOTSTRAP_SCENARIO_VERSION;
  readonly requestedStages?: readonly PipelineStageId[];
  readonly source: PipelineBootstrapScenarioSource;
  readonly explicitSelection: boolean;
}

export type PipelineBootstrapTargetScenario = {
  readonly [ScenarioId in PipelineBootstrapScenarioId]:
    PipelineBootstrapTargetScenarioBase & {
      readonly scenarioId: ScenarioId;
      readonly objectiveKey:
        (typeof PIPELINE_BOOTSTRAP_SCENARIO_OBJECTIVE_KEYS)[ScenarioId];
    };
}[PipelineBootstrapScenarioId];

interface PipelineBootstrapFactBase {
  readonly factId: string;
  readonly category: PipelineBootstrapTaxonomyCategory;
  readonly provenance: PipelineBootstrapProvenance;
  readonly reliability: PipelineBootstrapReliability;
  readonly directness: PipelineBootstrapDirectness;
  readonly polarity: PipelineBootstrapPolarity;
  readonly observedAt: number;
  readonly schemaVersion: typeof PIPELINE_BOOTSTRAP_SCHEMA_VERSION;
}

export type PipelineBootstrapFact = PipelineBootstrapFactBase &
  (
    | {
        readonly valueType: 'STRING';
        readonly value: string;
      }
    | {
        readonly valueType: 'BOOLEAN';
        readonly value: boolean;
      }
    | {
        readonly valueType: 'ENUM';
        readonly value: string;
      }
    | {
        readonly valueType: 'NUMBER';
        readonly value: number;
      }
    | {
        readonly valueType: 'STRING_LIST';
        readonly value: readonly string[];
      }
  );

export interface PipelineBootstrapRequester {
  readonly requesterId: string;
  readonly actorType: PipelineBootstrapActorType;
}

export interface PipelineBootstrapContext {
  readonly requestedAt: number;
  readonly requestedBy: PipelineBootstrapRequester;
  readonly locale?: string;
  readonly timezone?: string;
  readonly source: string;
}

export type PipelineBootstrapDuplicateFactPolicy = 'REJECT';

export interface PipelineBootstrapPolicy {
  readonly allowedTaxonomyVersion: '1';
  readonly allowedScenarioVersion: typeof PIPELINE_BOOTSTRAP_SCENARIO_VERSION;
  readonly allowUnknownReliability: boolean;
  readonly allowUncertainPolarity: boolean;
  readonly allowInferredDirectness: boolean;
  readonly allowedInferenceRuleIds: readonly string[];
  readonly maxFacts: number;
  readonly maxFactValueSize: number;
  readonly maxTotalPayloadSize: number;
  readonly duplicateFactPolicy: PipelineBootstrapDuplicateFactPolicy;
  readonly conflictPolicy: 'REJECT';
  readonly failClosed: boolean;
  readonly requireExplicitScenario: boolean;
}

export interface PipelineBootstrapInput {
  readonly bootstrapId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly targetScenario: PipelineBootstrapTargetScenario;
  readonly facts: readonly PipelineBootstrapFact[];
  readonly context: PipelineBootstrapContext;
  readonly policy: PipelineBootstrapPolicy;
  readonly schemaVersion: typeof PIPELINE_BOOTSTRAP_SCHEMA_VERSION;
}

export interface PipelineBootstrapProvenanceSummary {
  readonly factCount: number;
  readonly sourceTypes: readonly PipelineBootstrapSourceType[];
  readonly earliestObservedAt: number;
  readonly latestObservedAt: number;
}

export interface BootstrapAcceptedState {
  readonly status: 'ACCEPTED';
  readonly bootstrapId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly targetScenario: PipelineBootstrapTargetScenario;
  readonly normalizedFacts: readonly PipelineBootstrapFact[];
  readonly provenanceSummary: PipelineBootstrapProvenanceSummary;
  readonly bootstrapVersion: typeof PIPELINE_BOOTSTRAP_VERSION;
  readonly createdAt: number;
}

export interface BootstrapRejectedState {
  readonly status: 'REJECTED';
  readonly bootstrapId: string;
  readonly tenantId?: string;
  readonly correlationId?: string;
  readonly errors: readonly PipelineBootstrapError[];
  readonly bootstrapVersion: typeof PIPELINE_BOOTSTRAP_VERSION;
  readonly createdAt: number;
}

export type PipelineBootstrapState =
  | BootstrapAcceptedState
  | BootstrapRejectedState;

export type PipelineBootstrapFactValueType =
  PipelineBootstrapFact['valueType'] & PipelineBootstrapValueType;
