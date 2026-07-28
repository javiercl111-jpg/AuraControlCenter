import type { EnterpriseKnowledgeGraph } from '../../graph/domain/types';
import type {
  CoverageDomain,
  CoverageGap,
  CoverageScenarioInput,
  CoverageScenarioScope,
  DecisionReadinessAssessment,
  OverallCoverageReport,
} from '../domain/types';
import { assertCoverageScenarioScopeValid } from '../domain/validation';
import { CoverageCalculator } from './CoverageCalculator';

export class CoverageDecisionEngine {
  public static evaluateDecisionReadiness(
    graphOrReport: EnterpriseKnowledgeGraph | OverallCoverageReport,
    scenario: CoverageScenarioInput
  ): DecisionReadinessAssessment {
    const targetScenario =
      typeof scenario === 'string' ? scenario : scenario.scenarioId;
    const requiredDomains =
      typeof scenario === 'string'
        ? this.resolveRequiredDomainsFromScenarioString(scenario)
        : this.validateExplicitCoverageDomains(scenario);
    const report =
      'totalNodes' in graphOrReport
        ? graphOrReport
        : CoverageCalculator.calculateOverallReport(
            graphOrReport,
            undefined,
            typeof scenario === 'string' ? undefined : requiredDomains
          );
    const blockingGaps: CoverageGap[] = [];

    requiredDomains.forEach((domain) => {
      const metrics = report.domainBreakdown[domain];
      if (!metrics || metrics.completenessScore < 50) {
        blockingGaps.push({
          id: `blocking-${targetScenario}-${domain}`,
          domain,
          gapType: metrics ? 'low_confidence' : 'missing_node_type',
          severity: 'critical',
          description: `Required domain ${domain} has insufficient coverage score for scenario '${targetScenario}'`,
          recommendedAction: `Conduct targeted discovery in ${domain}`,
        });
      } else {
        const domainCriticals = metrics.gaps.filter(
          (g) => g.severity === 'critical' || g.severity === 'high'
        );
        blockingGaps.push(...domainCriticals);
      }
    });

    const score =
      typeof scenario === 'string'
        ? report.overallScore
        : this.calculateExplicitScopeScore(report, requiredDomains);
    const isReady = blockingGaps.length === 0 && score >= 55;

    const recommendedQuestions = this.generateRecommendedQuestions(
      targetScenario,
      blockingGaps
    );

    return {
      isReady,
      score,
      targetScenario,
      blockingGaps,
      recommendedQuestions,
    };
  }

  private static resolveRequiredDomainsFromScenarioString(
    scenario: string
  ): CoverageDomain[] {
    const s = scenario.toLowerCase();
    if (s.includes('payroll') || s.includes('nomina')) {
      return ['payroll', 'organization', 'compliance'];
    }
    if (s.includes('comp') || s.includes('restructure') || s.includes('salary')) {
      return ['compensation', 'organization', 'payroll', 'benefits'];
    }
    if (s.includes('org') || s.includes('structure') || s.includes('headcount')) {
      return ['organization', 'workforce_analytics', 'talent_performance'];
    }
    if (s.includes('compliance') || s.includes('audit')) {
      return ['compliance', 'payroll', 'time_attendance'];
    }
    return ['organization', 'payroll'];
  }

  private static validateExplicitCoverageDomains(
    scope: CoverageScenarioScope
  ): CoverageDomain[] {
    assertCoverageScenarioScopeValid(scope);
    return [...scope.includedDomains];
  }

  private static calculateExplicitScopeScore(
    report: OverallCoverageReport,
    requiredDomains: readonly CoverageDomain[]
  ): number {
    const totalScore = requiredDomains.reduce(
      (sum, domain) =>
        sum + (report.domainBreakdown[domain]?.completenessScore ?? 0),
      0
    );
    return Math.round(totalScore / requiredDomains.length);
  }

  private static generateRecommendedQuestions(
    scenario: string,
    blockingGaps: CoverageGap[]
  ): string[] {
    if (blockingGaps.length === 0) {
      return [
        `Knowledge coverage is sufficient for ${scenario}. No critical questions outstanding.`,
      ];
    }

    return blockingGaps.map((gap) => {
      switch (gap.domain) {
        case 'payroll':
          return '¿Cuáles son las reglas de cálculo de nómina y complementos aplicables?';
        case 'organization':
          return '¿Cuál es la estructura jerárquica y centros de costo oficiales?';
        case 'compensation':
          return '¿Cuáles son los tabuladores de compensación y esquema de bonos?';
        case 'benefits':
          return '¿Qué prestaciones superiores a la ley están activas actualmente?';
        case 'compliance':
          return '¿Qué regulaciones fiscales y laborales locales requieren validación explícita?';
        case 'time_attendance':
          return '¿Cómo se registran e integran las incidencias de tiempo y asistencia?';
        default:
          return `¿Puedes proporcionar evidencia detallada sobre el dominio de ${gap.domain}?`;
      }
    });
  }
}

export default CoverageDecisionEngine;
