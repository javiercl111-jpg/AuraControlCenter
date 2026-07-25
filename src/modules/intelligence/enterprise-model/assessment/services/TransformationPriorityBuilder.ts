import type { 
  TransformationPriority, 
  TransformationDependency 
} from '../domain/types';
import type { StrategicPriority } from '../../dossier/domain/types';

export class TransformationPriorityBuilder {
  public build(
    priorities: StrategicPriority[],
    dependencies: TransformationDependency[]
  ): TransformationPriority[] {
    return priorities.map(p => {
      // Find dependencies where this priority is the source or target, 
      // depending on how we define readiness dependency.
      // Typically, readiness dependencies are those that this priority requires or is blocked by.
      const priorityDependencies = dependencies
        .filter(d => d.sourcePriorityId === p.id || d.targetPriorityId === p.id)
        .map(d => d.id);

      return {
        id: p.id,
        rank: p.rank,
        title: p.title,
        description: p.description,
        dimension: p.dimension,
        addressedWeaknesses: [...p.addressedWeaknesses],
        leveragedStrengths: [...p.leveragedStrengths],
        urgency: p.urgency,
        readinessDependencyIds: priorityDependencies
      };
    });
  }
}
