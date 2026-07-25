import type { EnterpriseKnowledgeGraph } from '../../graph/domain/types';
import type {
  CoverageDomain,
  CoverageGap,
  DecisionReadinessAssessment,
  OverallCoverageReport,
} from '../domain/types';
import { CoverageCalculator } from './CoverageCalculator';

export class CoverageDecisionEngine {
  public static evaluateDecisionReadiness(
    graphOrReport: EnterpriseKnowledgeGraph | OverallCoverageReport,
    targetScenario: string
  ): DecisionReadinessAssessment {
    const report =
      'totalNodes' in graphOrReport
        ? graphOrReport
        : CoverageCalculator.calculateOverallReport(graphOrReport);

    const requiredDomains = this.getRequiredDomainsForScenario(targetScenario);
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

    const isReady = blockingGaps.length === 0 && report.overallScore >= 55;

    const recommendedQuestions = this.generateRecommendedQuestions(
      targetScenario,
      blockingGaps
    );

    return {
      isReady,
      score: report.overallScore,
      targetScenario,
      blockingGaps,
      recommendedQuestions,
    };
  }

  private static getRequiredDomainsForScenario(scenario: string): CoverageDomain[] {
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
