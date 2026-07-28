import type { EnterpriseMentalModel } from '../../enterprise-model/domain/types';
import type { EnterpriseKnowledgeGraph } from '../../enterprise-model/graph/domain/types';
import type { TurnExtractionResult } from '../../enterprise-model/extraction/domain/types';
import type { OverallCoverageReport, DecisionReadinessAssessment, DomainCoverageMetrics } from '../../enterprise-model/coverage/domain/types';
import type { AdaptiveQuestionPlanResult } from '../../enterprise-model/planning/domain/types';
import type { ExecutiveReasoningReport } from '../../enterprise-model/reasoning/domain/types';
import type { ExecutiveDossier } from '../../enterprise-model/dossier/domain/types';
import type { EnterpriseTransformationAssessment, TransformationReadiness, ConfidenceMatrix, AssessmentAudit, AssessmentMetadata, EvidenceMap, ExecutiveInsight } from '../../enterprise-model/assessment/domain/types';
import type { PipelineExecutionScenario } from '../types';

export const createMinimalExecutionScenario = (
  scenarioId = 'PAYROLL_AUDIT'
): PipelineExecutionScenario => ({
  scenarioId,
  scenarioVersion: '1',
  objectiveKey: `OBJECTIVE_${scenarioId}`,
  requestedStages: ['KNOWLEDGE_COVERAGE'],
  allowedStages: [
    'EVIDENCE_EXTRACTION',
    'MENTAL_MODEL',
    'KNOWLEDGE_GRAPH',
    'KNOWLEDGE_COVERAGE',
    'ADAPTIVE_PLANNING',
    'EXECUTIVE_REASONING',
    'EXECUTIVE_DOSSIER',
    'TRANSFORMATION_ASSESSMENT'
  ],
  requiredStages: ['KNOWLEDGE_COVERAGE'],
  stageDependencies: {
    EVIDENCE_EXTRACTION: [],
    MENTAL_MODEL: ['EVIDENCE_EXTRACTION'],
    KNOWLEDGE_GRAPH: ['EVIDENCE_EXTRACTION', 'MENTAL_MODEL'],
    KNOWLEDGE_COVERAGE: [
      'EVIDENCE_EXTRACTION',
      'MENTAL_MODEL',
      'KNOWLEDGE_GRAPH'
    ],
    ADAPTIVE_PLANNING: ['KNOWLEDGE_COVERAGE'],
    EXECUTIVE_REASONING: ['KNOWLEDGE_COVERAGE'],
    EXECUTIVE_DOSSIER: ['EXECUTIVE_REASONING'],
    TRANSFORMATION_ASSESSMENT: [
      'EXECUTIVE_REASONING',
      'EXECUTIVE_DOSSIER'
    ]
  },
  includedDomains: ['payroll', 'organization', 'compliance'],
  excludedDomains: [
    'compensation',
    'benefits',
    'talent_performance',
    'time_attendance',
    'workforce_analytics'
  ]
});

export const createMinimalMentalModel = (): EnterpriseMentalModel => ({
  identity: {
    organizationName: null, industry: null, subindustry: null, size: null,
    employeeRange: null, locations: null, operatingRegions: null, businessModel: null
  },
  strategicContext: {
    transformationObjectives: [], growthObjectives: [], executivePriorities: [],
    constraints: [], urgency: null, timeHorizon: null
  },
  evidences: {},
  domains: {},
  processes: {},
  painPoints: {},
  risks: {},
  capabilities: {},
  objectives: {},
  constraints: {},
  hypotheses: {},
  knowledgeGaps: {},
  productApplicability: {}
});

export const createMinimalKnowledgeGraph = (): EnterpriseKnowledgeGraph => ({
  nodes: {},
  relationships: {},
  metadata: {
    lastUpdatedAt: 0,
    totalNodes: 0,
    totalRelationships: 0,
    version: '1'
  }
} as EnterpriseKnowledgeGraph);

export const createMinimalExtractionResult = (): TurnExtractionResult => ({
  evidence: [],
  knowledgeGaps: [],
  corrections: [],
  contradictions: [],
  nodeProposals: [],
  relationshipProposals: []
});

const minimalMetrics: DomainCoverageMetrics = {
  domain: 'organization',
  nodeCount: 0, relationshipCount: 0, confirmedEntitiesRatio: 0, evidenceDensity: 0, avgConfidence: 0, completenessScore: 0, gaps: []
};

export const createMinimalCoverageReport = (): OverallCoverageReport => ({
  timestamp: '2026-01-01',
  totalNodes: 0,
  totalRelationships: 0,
  overallScore: 85,
  confidenceLevel: 'LOW',
  criticalGaps: [],
  readinessForDecision: false,
  domainBreakdown: {
    organization: { ...minimalMetrics, domain: 'organization' },
    payroll: { ...minimalMetrics, domain: 'payroll' },
    compensation: { ...minimalMetrics, domain: 'compensation' },
    benefits: { ...minimalMetrics, domain: 'benefits' },
    compliance: { ...minimalMetrics, domain: 'compliance' },
    talent_performance: { ...minimalMetrics, domain: 'talent_performance' },
    time_attendance: { ...minimalMetrics, domain: 'time_attendance' },
    workforce_analytics: { ...minimalMetrics, domain: 'workforce_analytics' }
  }
});

export const createMinimalReadinessAssessment = (): DecisionReadinessAssessment => ({
  isReady: true,
  score: 85,
  targetScenario: 'Test',
  blockingGaps: [],
  recommendedQuestions: []
});

export const createMinimalPlanResult = (): AdaptiveQuestionPlanResult => ({
  planId: 'plan-1',
  objectives: [],
  strategies: [],
  intents: [],
  candidates: [],
  selectedPlan: { planId: 'plan-1', items: [], timestamp: '2026-01-01', totalQuestions: 0, evaluatedCandidateCount: 0, traceabilityMatrix: [] },
  evaluationSummary: { totalCandidates: 0, selectedCandidates: 0, rejectedDuplicateCandidates: 0, rejectedClosedCandidates: 0, rejectedUntraceableCandidates: 0 },
  traceabilityMatrix: []
});

export const createMinimalReasoningReport = (): ExecutiveReasoningReport => ({
  reportId: 'rep-1',
  timestamp: '2026-01-01',
  overallStatus: 'SUPPORTED_FINDING',
  rootCauses: [],
  findings: [],
  risks: [],
  opportunities: [],
  rejectedClaims: [],
  readinessGaps: []
});

export const createMinimalDossier = (): ExecutiveDossier => ({
  dossierId: 'dos-1',
  reportRef: 'rep-1',
  timestamp: '2026-01-01',
  diagnosticStatus: 'VALID',
  blocks: [],
  executiveSummary: { headline: 'T', keyInsights: [], criticalRisksSummary: '' },
  businessDiagnosis: { overallMaturity: 'INITIAL', dimensionAssessments: [], strengths: [], weaknesses: [] },
  priorities: [],
  recommendationCandidates: [],
  narrative: { executiveSummary: '', currentState: '', burningIssues: '', opportunitiesForGrowth: '' },
  diagnosticAudit: { rejectedClaims: [] }
});

export const createMinimalAssessment = (): EnterpriseTransformationAssessment => ({
  assessmentId: 'asm-1',
  dossierRef: 'dos-1',
  reasoningReportRef: 'rep-1',
  executionId: 'exec-1',
  status: 'COMPLETE',
  maturityProfile: { overallMaturity: 'INITIAL', dimensions: [] },
  findings: [], risks: [], opportunities: [], rootCauses: [],
  transformationPriorities: [], recommendationCandidates: [],
  transformationReadiness: { status: 'READY', score: 90, criticalGaps: [], constraints: [], dependencies: [] } as TransformationReadiness,
  confidenceMatrix: { overallConfidence: 1, support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, dimensionConfidence: { LEADERSHIP: 1, STRATEGY: 1, EXECUTION: 1, TECHNOLOGY: 1, CULTURE: 1, OPERATIONS: 1 } } as ConfidenceMatrix,
  evidenceMap: { mapId: 'map-1', links: [] } as EvidenceMap,
  executiveInsight: { summary: { headline: '', keyInsights: [], criticalRisksSummary: '' }, narrative: { executiveSummary: '', currentState: '', burningIssues: '', opportunitiesForGrowth: '' }, keyTakeaways: [] } as ExecutiveInsight,
  audit: { rejectedClaims: [], diagnosticAudit: { rejectedClaims: [] }, limitations: [], invalidReferences: [], unresolvedContradictions: [], insufficientEvidenceRefs: [] } as AssessmentAudit,
  metadata: { version: '1', schema: '1', generator: 'test', policyVersion: '1', timestamp: '1' } as AssessmentMetadata
});


