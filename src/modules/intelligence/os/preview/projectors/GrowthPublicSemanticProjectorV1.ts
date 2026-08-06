import type { BoundarySemanticProjectionContextV1, BoundarySemanticProjectionPortV1 } from '../../boundary/ports';
import type { GrowthPublicSemanticProjectionV1 } from './growthPublicSemanticProjectionTypesV1';
import type { PipelineResult } from '../../types';

function isPipelineResult(data: unknown): data is PipelineResult {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const pr = data as Record<string, unknown>;
  return (
    typeof pr.executionId === 'string' &&
    typeof pr.sessionId === 'string' &&
    typeof pr.status === 'string' &&
    typeof pr.contractVersion === 'string' &&
    typeof pr.stageResults === 'object' &&
    pr.stageResults !== null
  );
}

export class GrowthPublicSemanticProjectorV1 implements BoundarySemanticProjectionPortV1 {
  public project(
    rawData: unknown,
    context: BoundarySemanticProjectionContextV1
  ): Readonly<Record<string, unknown>> | undefined {
    if (context.capability !== 'GROWTH_INTELLIGENCE_V1') {
      return undefined;
    }
    if (!context.operation) {
      return undefined;
    }
    if (!isPipelineResult(rawData)) {
      return undefined;
    }

    const { stageResults } = rawData;

    switch (context.operation) {
      case 'ANALYZE_CAMPAIGN':
        return this.projectAnalyzeCampaign(stageResults);
      case 'PRIORITIZE_OPPORTUNITIES':
        return this.projectPrioritizeOpportunities(stageResults);
      case 'RECOMMEND_ACTIONS':
        return this.projectRecommendActions(stageResults);
      case 'ASSESS_GROWTH_CAPABILITY':
        return this.projectAssessGrowthCapability(stageResults);
      default:
        return undefined;
    }
  }

  private projectAnalyzeCampaign(stageResults: PipelineResult['stageResults']): Readonly<Record<string, unknown>> | undefined {
    const assessmentStage = stageResults['TRANSFORMATION_ASSESSMENT'];
    if (!assessmentStage || typeof assessmentStage.output !== 'object' || assessmentStage.output === null) {
      return undefined;
    }

    const output = assessmentStage.output as Record<string, unknown>;

    // Check if finding and risks are present.
    if (!Array.isArray(output.findings) || !Array.isArray(output.risks)) {
      return undefined;
    }

    const safeFindings = output.findings.map((f: unknown) => {
      const rec = f as Record<string, unknown>;
      return {
        id: typeof rec.id === 'string' ? rec.id : undefined,
        description: typeof rec.description === 'string' ? rec.description : undefined,
      };
    }).filter(f => f.id);

    const safeRisks = output.risks.map((r: unknown) => {
      const rec = r as Record<string, unknown>;
      return {
        id: typeof rec.id === 'string' ? rec.id : undefined,
        description: typeof rec.description === 'string' ? rec.description : undefined,
      };
    }).filter(r => r.id);

    const safeRecommendations = Array.isArray(output.recommendationCandidates)
      ? output.recommendationCandidates.map((r: unknown) => {
          const rec = r as Record<string, unknown>;
          return {
            id: typeof rec.id === 'string' ? rec.id : undefined,
            proposedAction: typeof rec.proposedAction === 'string' ? rec.proposedAction : undefined,
          };
        }).filter(r => r.id)
      : [];

    const missingFields = ['knowledgeGaps'];
    const status = missingFields.length === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';

    const result: GrowthPublicSemanticProjectionV1 = {
      schemaVersion: '1.0',
      capability: 'GROWTH_INTELLIGENCE_V1',
      operation: 'ANALYZE_CAMPAIGN',
      status,
      missingFields: Object.freeze(missingFields),
      output: Object.freeze({
        findings: safeFindings,
        risks: safeRisks,
        recommendations: safeRecommendations,
      }),
    };
    return Object.freeze(result as unknown as Readonly<Record<string, unknown>>);
  }

  private projectPrioritizeOpportunities(stageResults: PipelineResult['stageResults']): Readonly<Record<string, unknown>> | undefined {
    // Attempt from Assessment opportunities or Dossier priorities
    let safeOpportunities: Array<unknown> = [];

    const dossierStage = stageResults['EXECUTIVE_DOSSIER'];
    if (dossierStage && typeof dossierStage.output === 'object' && dossierStage.output !== null) {
      const output = dossierStage.output as Record<string, unknown>;
      if (Array.isArray(output.priorities)) {
        safeOpportunities = output.priorities.map((p: unknown) => {
          const rec = p as Record<string, unknown>;
          return {
            opportunityId: typeof rec.id === 'string' ? rec.id : undefined,
            position: typeof rec.rank === 'number' ? rec.rank : undefined,
            evidenceIds: Array.isArray(rec.addressedWeaknesses) ? rec.addressedWeaknesses.filter((e: unknown) => typeof e === 'string') : [],
          };
        }).filter(p => p.opportunityId);
      }
    }

    if (safeOpportunities.length === 0) {
      const assessmentStage = stageResults['TRANSFORMATION_ASSESSMENT'];
      if (assessmentStage && typeof assessmentStage.output === 'object' && assessmentStage.output !== null) {
        const output = assessmentStage.output as Record<string, unknown>;
        if (Array.isArray(output.opportunities)) {
          safeOpportunities = output.opportunities.map((o: unknown) => {
            const rec = o as Record<string, unknown>;
            return {
              opportunityId: typeof rec.id === 'string' ? rec.id : undefined,
              evidenceIds: Array.isArray(rec.supportingFindings) ? rec.supportingFindings.filter((e: unknown) => typeof e === 'string') : [],
            };
          }).filter(o => o.opportunityId);
        }
      }
    }

    if (safeOpportunities.length === 0) {
      return undefined;
    }

    const missingFields = ['score', 'rationale', 'confidence'];
    const status = missingFields.length === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';

    const result: GrowthPublicSemanticProjectionV1 = {
      schemaVersion: '1.0',
      capability: 'GROWTH_INTELLIGENCE_V1',
      operation: 'PRIORITIZE_OPPORTUNITIES',
      status,
      missingFields: Object.freeze(missingFields),
      output: Object.freeze({
        opportunities: safeOpportunities,
      }),
    };
    return Object.freeze(result as unknown as Readonly<Record<string, unknown>>);
  }

  private projectRecommendActions(stageResults: PipelineResult['stageResults']): Readonly<Record<string, unknown>> | undefined {
    let safeCandidates: Array<unknown> = [];

    const dossierStage = stageResults['EXECUTIVE_DOSSIER'];
    if (dossierStage && typeof dossierStage.output === 'object' && dossierStage.output !== null) {
      const output = dossierStage.output as Record<string, unknown>;
      if (Array.isArray(output.recommendationCandidates)) {
        safeCandidates = output.recommendationCandidates.map((c: unknown) => {
          const rec = c as Record<string, unknown>;
          return {
            actionId: typeof rec.id === 'string' ? rec.id : undefined,
            proposedAction: typeof rec.proposedAction === 'string' ? rec.proposedAction : undefined,
            effortEstimate: typeof rec.effortEstimate === 'string' ? rec.effortEstimate : undefined,
            evidenceIds: Array.isArray(rec.evidenceRefs) ? rec.evidenceRefs.filter((e: unknown) => typeof e === 'string') : [],
          };
        }).filter(c => c.actionId);
      }
    }

    if (safeCandidates.length === 0) {
      const assessmentStage = stageResults['TRANSFORMATION_ASSESSMENT'];
      if (assessmentStage && typeof assessmentStage.output === 'object' && assessmentStage.output !== null) {
        const output = assessmentStage.output as Record<string, unknown>;
        if (Array.isArray(output.recommendationCandidates)) {
          safeCandidates = output.recommendationCandidates.map((c: unknown) => {
            const rec = c as Record<string, unknown>;
            return {
              actionId: typeof rec.id === 'string' ? rec.id : undefined,
              proposedAction: typeof rec.proposedAction === 'string' ? rec.proposedAction : undefined,
              effortEstimate: typeof rec.effortEstimate === 'string' ? rec.effortEstimate : undefined,
              evidenceIds: Array.isArray(rec.evidenceRefs) ? rec.evidenceRefs.filter((e: unknown) => typeof e === 'string') : [],
            };
          }).filter(c => c.actionId);
        }
      }
    }

    if (safeCandidates.length === 0) {
      return undefined;
    }

    const missingFields = ['primaryRecommendation', 'alternatives'];
    const status = missingFields.length === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';

    const result: GrowthPublicSemanticProjectionV1 = {
      schemaVersion: '1.0',
      capability: 'GROWTH_INTELLIGENCE_V1',
      operation: 'RECOMMEND_ACTIONS',
      status,
      missingFields: Object.freeze(missingFields),
      output: Object.freeze({
        recommendations: safeCandidates,
      }),
    };
    return Object.freeze(result as unknown as Readonly<Record<string, unknown>>);
  }

  private projectAssessGrowthCapability(stageResults: PipelineResult['stageResults']): Readonly<Record<string, unknown>> | undefined {
    const assessmentStage = stageResults['TRANSFORMATION_ASSESSMENT'];
    if (!assessmentStage || typeof assessmentStage.output !== 'object' || assessmentStage.output === null) {
      return undefined;
    }

    const output = assessmentStage.output as Record<string, unknown>;
    const profile = output.maturityProfile as Record<string, unknown> | undefined;

    if (!profile || typeof profile !== 'object') {
      return undefined;
    }

    const safeDimensions = Array.isArray(profile.dimensions)
      ? profile.dimensions.map((d: unknown) => {
          const rec = d as Record<string, unknown>;
          return {
            dimension: typeof rec.dimension === 'string' ? rec.dimension : undefined,
            score: typeof rec.score === 'number' ? rec.score : undefined,
          };
        }).filter(d => d.dimension !== undefined && d.score !== undefined)
      : [];

    if (safeDimensions.length === 0) {
      return undefined;
    }

    const readiness = output.transformationReadiness as Record<string, unknown> | undefined;
    const safeDependencies = readiness && Array.isArray(readiness.dependencies)
      ? readiness.dependencies.map((d: unknown) => {
          const rec = d as Record<string, unknown>;
          return {
            id: typeof rec.id === 'string' ? rec.id : undefined,
            sourcePriorityId: typeof rec.sourcePriorityId === 'string' ? rec.sourcePriorityId : undefined,
          };
        }).filter(d => d.id)
      : [];

    const safeGaps = readiness && Array.isArray(readiness.criticalGaps)
      ? readiness.criticalGaps.filter((g: unknown) => typeof g === 'string')
      : [];

    const missingFields = ['roadmap'];
    const status = missingFields.length === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';

    const result: GrowthPublicSemanticProjectionV1 = {
      schemaVersion: '1.0',
      capability: 'GROWTH_INTELLIGENCE_V1',
      operation: 'ASSESS_GROWTH_CAPABILITY',
      status,
      missingFields: Object.freeze(missingFields),
      output: Object.freeze({
        maturityScore: typeof profile.overallMaturity === 'string' ? profile.overallMaturity : undefined,
        dimensions: safeDimensions,
        dependencies: safeDependencies,
        gaps: safeGaps,
      }),
    };
    return Object.freeze(result as unknown as Readonly<Record<string, unknown>>);
  }
}
