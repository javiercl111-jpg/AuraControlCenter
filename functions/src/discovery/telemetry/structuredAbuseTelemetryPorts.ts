import type {
  StructuredAbuseMetricAggregateV1,
  StructuredAbuseTelemetryEventV1,
} from "./structuredAbuseTelemetryTypes";

export interface StructuredAbuseTelemetryRepository {
  record(event: StructuredAbuseTelemetryEventV1): Promise<Readonly<{
    decision: "CREATED" | "REPLAY";
  }>>;
}

export interface StructuredAbuseMetricsReader {
  readDailyAggregate(input: Readonly<{
    date: string;
    scope: string;
  }>): Promise<StructuredAbuseMetricAggregateV1 | null>;
}
