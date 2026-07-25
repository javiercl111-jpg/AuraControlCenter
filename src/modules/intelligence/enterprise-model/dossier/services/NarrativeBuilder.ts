import type { 
  DiagnosticNarrativeProvider, 
  BusinessDiagnosis, 
  StrategicPriority, 
  DossierStatus,
  DiagnosticNarrative,
  ExecutiveSummary
} from '../domain/types';

export class NarrativeBuilder implements DiagnosticNarrativeProvider {
  public generateNarrative(context: {
    diagnosis: BusinessDiagnosis;
    priorities: StrategicPriority[];
    status: DossierStatus;
  }): DiagnosticNarrative {
    const { diagnosis, priorities, status } = context;

    if (status === 'INSUFFICIENT_EVIDENCE') {
      return {
        executiveSummary: 'The diagnostic could not be fully completed due to insufficient defendable evidence.',
        currentState: 'Unknown or partially assessed due to lack of evidence.',
        burningIssues: 'Requires further discovery to determine critical risks.',
        opportunitiesForGrowth: 'Cannot be determined with current evidence.'
      };
    }

    const currentState = `The organization is currently operating at a ${diagnosis.overallMaturity} maturity level across ${diagnosis.dimensionAssessments.length} key dimensions.`;
    
    const criticalPriorities = priorities.filter(p => p.urgency === 'IMMEDIATE');
    const burningIssues = criticalPriorities.length > 0 
      ? `Immediate attention is required for: ${criticalPriorities.map(p => p.title).join(', ')}.`
      : 'No critical burning issues identified at this time.';

    const uniqueStrengths = Array.from(new Set(diagnosis.strengths.map(s => s.dimension)));
    const opportunitiesForGrowth = uniqueStrengths.length > 0
      ? `The organization has strong foundations in ${uniqueStrengths.join(', ')} that can be leveraged for future growth.`
      : 'Opportunities for growth will require building foundational capabilities first.';

    return {
      executiveSummary: `${currentState} ${burningIssues}`,
      currentState,
      burningIssues,
      opportunitiesForGrowth
    };
  }

  public generateExecutiveSummary(context: {
    diagnosis: BusinessDiagnosis;
    priorities: StrategicPriority[];
    status: DossierStatus;
  }): ExecutiveSummary {
    const { diagnosis, priorities, status } = context;

    if (status === 'INSUFFICIENT_EVIDENCE') {
      return {
        headline: 'Diagnostic Incomplete: Insufficient Evidence',
        keyInsights: ['More data gathering is required to provide a defendable diagnosis.'],
        criticalRisksSummary: 'Unable to assess.'
      };
    }

    const headline = `Business Diagnostic: ${diagnosis.overallMaturity} Maturity Level`;
    const keyInsights = [
      `Identified ${diagnosis.strengths.length} key strengths and ${diagnosis.weaknesses.length} critical weaknesses.`,
      `Ranked ${priorities.length} strategic priorities.`
    ];

    const criticalWeaknesses = diagnosis.weaknesses.filter(w => w.severity === 'CRITICAL');
    const criticalRisksSummary = criticalWeaknesses.length > 0
      ? `Critical risks identified in ${Array.from(new Set(criticalWeaknesses.map(w => w.dimension))).join(', ')}.`
      : 'No critical structural risks identified.';

    return {
      headline,
      keyInsights,
      criticalRisksSummary
    };
  }
}

export default NarrativeBuilder;
