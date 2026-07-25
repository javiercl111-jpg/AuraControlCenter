import type { ExecutiveInsight, TraceableTakeaway } from '../domain/types';
import type { ExecutiveSummary, DiagnosticNarrative } from '../../dossier/domain/types';

export class ExecutiveInsightBuilder {
  public build(
    summary: ExecutiveSummary,
    narrative: DiagnosticNarrative
  ): ExecutiveInsight {
    // Convert string key insights to TraceableTakeaway.
    // In a full implementation with AI or richer input, we would extract specific source references here.
    const keyTakeaways: TraceableTakeaway[] = summary.keyInsights.map(insight => {
      return {
        text: insight,
        sourceRefs: [] // Needs to be populated by advanced extraction or linking logic if available
      };
    });

    return {
      summary: { ...summary },
      narrative: { ...narrative },
      keyTakeaways
    };
  }
}
