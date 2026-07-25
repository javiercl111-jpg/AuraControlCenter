import type { EnterpriseWeakness, DossierExecutionContext } from '../domain/types';
import type { DiagnosticContext } from './DiagnosticContextBuilder';
import type { MaturityEvaluator } from './MaturityEvaluator';
import type { EnterpriseRisk } from '../../reasoning/domain/types';

export class WeaknessAnalyzer {
  private contextProvider: DossierExecutionContext;
  private maturityEvaluator: MaturityEvaluator;

  constructor(
    contextProvider: DossierExecutionContext,
    maturityEvaluator: MaturityEvaluator
  ) {
    this.contextProvider = contextProvider;
    this.maturityEvaluator = maturityEvaluator;
  }

  public analyze(context: DiagnosticContext): EnterpriseWeakness[] {
    const weaknesses: EnterpriseWeakness[] = [];
    const processedRisks = new Set<string>();

    for (const rootCause of context.rootCauses) {
      if (rootCause.status !== 'SUPPORTED_FINDING' && rootCause.status !== 'PARTIALLY_SUPPORTED') {
        continue;
      }

      const relatedRisks = context.risks.filter(r => rootCause.relatedFindings.includes(r.findingId));
      
      const dimension = this.maturityEvaluator.extractDimension(rootCause);
      
      let severity: 'MODERATE' | 'HIGH' | 'CRITICAL' = 'MODERATE';
      if (relatedRisks.some(r => r.severity === 'CRITICAL')) severity = 'CRITICAL';
      else if (relatedRisks.some(r => r.severity === 'HIGH')) severity = 'HIGH';
      else if (rootCause.confidence.aggregate >= 0.9) severity = 'CRITICAL';
      else if (rootCause.confidence.aggregate >= 0.8) severity = 'HIGH';

      relatedRisks.forEach(r => processedRisks.add(r.findingId));

      weaknesses.push({
        id: this.contextProvider.generateId('WEAKNESS_RC', rootCause.findingId),
        dimension,
        description: rootCause.statement,
        severity,
        relatedRisks: relatedRisks.map(r => r.findingId),
        rootCauses: [rootCause.findingId]
      });
    }

    const remainingRisks = context.risks.filter(r => 
      !processedRisks.has(r.findingId) && 
      (r.status === 'SUPPORTED_FINDING' || r.status === 'PARTIALLY_SUPPORTED') &&
      (r.severity === 'CRITICAL' || r.severity === 'HIGH')
    );

    const risksByDimension = new Map<string, EnterpriseRisk[]>();
    for (const r of remainingRisks) {
      const dim = this.maturityEvaluator.extractDimension(r);
      if (!risksByDimension.has(dim)) risksByDimension.set(dim, []);
      risksByDimension.get(dim)!.push(r);
    }

    for (const [dimension, risks] of risksByDimension.entries()) {
      if (risks.length === 0) continue;

      const severity = risks.some(r => r.severity === 'CRITICAL') ? 'CRITICAL' : 'HIGH';
      const description = `Aggregated risks in ${dimension}: ${risks.map(r => r.statement).join('; ')}`;
      
      weaknesses.push({
        id: this.contextProvider.generateId('WEAKNESS_AGG', dimension),
        dimension,
        description,
        severity,
        relatedRisks: risks.map(r => r.findingId),
        rootCauses: []
      });
    }

    for (const w of weaknesses) {
      if (w.relatedRisks.length === 0 && w.rootCauses.length === 0) {
        throw new Error(`Weakness ${w.id} generated without any backing risk or root cause.`);
      }
    }

    return weaknesses;
  }
}

export default WeaknessAnalyzer;
