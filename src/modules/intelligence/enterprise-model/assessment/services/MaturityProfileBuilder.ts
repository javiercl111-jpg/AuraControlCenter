import type { 
  MaturityProfile, 
  AssessmentDimension, 
  AssessmentExecutionContext 
} from '../domain/types';
import type { 
  BusinessDiagnosis
} from '../../dossier/domain/types';

export class MaturityProfileBuilder {
  public build(
    diagnosis: BusinessDiagnosis,
    context: AssessmentExecutionContext
  ): MaturityProfile {
    if (!context) {
      throw new Error('AssessmentExecutionContext is required');
    }
    const dimensions: AssessmentDimension[] = diagnosis.dimensionAssessments.map(da => {
      const dimensionStrengths = diagnosis.strengths
        .filter(s => s.dimension === da.dimension)
        .map(s => s.id);
        
      const dimensionWeaknesses = diagnosis.weaknesses
        .filter(w => w.dimension === da.dimension)
        .map(w => w.id);

      return {
        dimension: da.dimension,
        maturity: da.level,
        score: da.score,
        strengths: dimensionStrengths,
        weaknesses: dimensionWeaknesses
      };
    });

    return {
      overallMaturity: diagnosis.overallMaturity,
      dimensions
    };
  }
}
