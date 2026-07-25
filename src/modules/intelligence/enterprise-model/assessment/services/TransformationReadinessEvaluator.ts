import type { 
  TransformationReadiness,
  MaturityProfile,
  TransformationConstraint,
  TransformationDependency,
  AssessmentPolicy
} from '../domain/types';
import type { EnterpriseRisk } from '../../reasoning/domain/types';

export class TransformationReadinessEvaluator {
  private policy: AssessmentPolicy;

  constructor(policy: AssessmentPolicy) {
    this.policy = policy;
  }

  public evaluate(
    profile: MaturityProfile,
    risks: EnterpriseRisk[],
    constraints: TransformationConstraint[],
    dependencies: TransformationDependency[]
  ): TransformationReadiness {
    return this.policy.evaluateReadiness(profile, risks, constraints, dependencies);
  }
}
