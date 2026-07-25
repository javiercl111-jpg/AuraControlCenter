import type { EnterpriseStrength, DossierExecutionContext } from '../domain/types';
import type { DiagnosticContext } from './DiagnosticContextBuilder';
import type { MaturityEvaluator } from './MaturityEvaluator';

export class StrengthAnalyzer {
  private contextProvider: DossierExecutionContext;
  private maturityEvaluator: MaturityEvaluator;

  constructor(
    contextProvider: DossierExecutionContext,
    maturityEvaluator: MaturityEvaluator
  ) {
    this.contextProvider = contextProvider;
    this.maturityEvaluator = maturityEvaluator;
  }

  public analyze(context: DiagnosticContext): EnterpriseStrength[] {
    const strengths: EnterpriseStrength[] = [];

    // Extract from findings
    for (const f of context.findings) {
      if (f.status === 'SUPPORTED_FINDING' && f.type === 'FINDING') {
        if (f.confidence.aggregate >= 0.7) {
          const dimension = this.maturityEvaluator.extractDimension(f);
          const impact = f.confidence.aggregate >= 0.9 ? 'CRITICAL' : 
                         f.confidence.aggregate >= 0.8 ? 'HIGH' : 'MODERATE';
                         
          strengths.push({
            id: this.contextProvider.generateId('STRENGTH_FINDING', f.findingId),
            dimension,
            description: f.statement,
            impact,
            supportingFindings: [f.findingId]
          });
        }
      }
    }

    // Extract from opportunities
    for (const opp of context.opportunities) {
      if (opp.status === 'SUPPORTED_FINDING') {
        const dimension = this.maturityEvaluator.extractDimension(opp);
        const impact = opp.confidence.aggregate >= 0.9 ? 'CRITICAL' : 
                       opp.confidence.aggregate >= 0.8 ? 'HIGH' : 'MODERATE';
                       
        strengths.push({
          id: this.contextProvider.generateId('STRENGTH_OPP', opp.findingId),
          dimension,
          description: opp.statement,
          impact,
          supportingFindings: [opp.findingId]
        });
      }
    }

    return strengths;
  }
}

export default StrengthAnalyzer;
