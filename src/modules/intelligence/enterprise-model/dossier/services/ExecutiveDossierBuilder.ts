import type { 
  ExecutiveDossier, 
  DossierExecutionContext,
  DossierPolicy,
  DiagnosticNarrativeProvider
} from '../domain/types';
import { DiagnosticContextBuilder } from './DiagnosticContextBuilder';
import { MaturityEvaluator } from './MaturityEvaluator';
import { StrengthAnalyzer } from './StrengthAnalyzer';
import { WeaknessAnalyzer } from './WeaknessAnalyzer';
import { PriorityRanker } from './PriorityRanker';

export class ExecutiveDossierBuilder {
  private executionContext: DossierExecutionContext;
  private policy: DossierPolicy;
  private narrativeProvider: DiagnosticNarrativeProvider;
  private contextBuilder: DiagnosticContextBuilder;
  private maturityEvaluator: MaturityEvaluator;
  private strengthAnalyzer: StrengthAnalyzer;
  private weaknessAnalyzer: WeaknessAnalyzer;
  private priorityRanker: PriorityRanker;

  constructor(
    executionContext: DossierExecutionContext,
    policy: DossierPolicy,
    narrativeProvider: DiagnosticNarrativeProvider
  ) {
    this.executionContext = executionContext;
    this.policy = policy;
    this.narrativeProvider = narrativeProvider;
    this.contextBuilder = new DiagnosticContextBuilder();
    this.maturityEvaluator = new MaturityEvaluator(this.policy);
    this.strengthAnalyzer = new StrengthAnalyzer(this.executionContext, this.maturityEvaluator);
    this.weaknessAnalyzer = new WeaknessAnalyzer(this.executionContext, this.maturityEvaluator);
    this.priorityRanker = new PriorityRanker(this.executionContext);
  }

  public build(report: unknown): ExecutiveDossier {
    const context = this.contextBuilder.build(report);

    const dimensionAssessments = this.maturityEvaluator.evaluate(context);
    const overallScore = dimensionAssessments.reduce((acc, a) => acc + a.score, 0) / (dimensionAssessments.length || 1);
    const overallMaturity = this.policy.evaluateScore(overallScore);

    const strengths = this.strengthAnalyzer.analyze(context);
    const weaknesses = this.weaknessAnalyzer.analyze(context);

    const businessDiagnosis = {
      overallMaturity,
      dimensionAssessments,
      strengths,
      weaknesses
    };

    const { priorities, candidates } = this.priorityRanker.rank(strengths, weaknesses);

    const narrativeContext = {
      diagnosis: businessDiagnosis,
      priorities,
      status: context.status
    };

    const executiveSummary = this.narrativeProvider.generateExecutiveSummary(narrativeContext);
    const narrative = this.narrativeProvider.generateNarrative(narrativeContext);

    const dossierId = this.executionContext.generateId('DOSSIER', context.report.reportId);

    return {
      dossierId,
      reportRef: context.report.reportId,
      timestamp: this.executionContext.timestamp,
      diagnosticStatus: context.status,
      blocks: context.blocks,
      executiveSummary,
      businessDiagnosis,
      priorities,
      recommendationCandidates: candidates,
      narrative,
      diagnosticAudit: context.audit
    };
  }
}

export default ExecutiveDossierBuilder;
