export interface GrowthIntelligenceContextRequestV1 {

  readonly workspaceId: string;

  readonly subject: string;

  readonly offerSummary: string | null;

  readonly audienceSummary: string | null;

  readonly growthObjective: string | null;

}