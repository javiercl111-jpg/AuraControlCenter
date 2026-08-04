import { Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import {
  STRUCTURED_ABUSE_METRIC_KEYS,
  STRUCTURED_ABUSE_TELEMETRY_VERSION,
  StructuredAbuseTelemetryError,
  deriveTelemetryIdentifierV1,
  serializeStructuredAbuseTelemetryEventV1,
  type StructuredAbuseMetricAggregateV1,
  type StructuredAbuseMetricKey,
  type StructuredAbuseMetricsReader,
  type StructuredAbuseTelemetryEventV1,
  type StructuredAbuseTelemetryRepository,
} from "../../../discovery/telemetry";
import {
  DISCOVERY_ABUSE_METRICS_COLLECTION,
  DISCOVERY_ABUSE_TELEMETRY_COLLECTION,
} from "./firestoreDiscoveryTelemetryCollections";

const CARDINALITY_BUCKETS = 64;

function utcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function metricDocumentId(date: string, scope: string): string {
  return deriveTelemetryIdentifierV1("metric", `${date}|${scope}`);
}

function emptyMeasurements(): Record<StructuredAbuseMetricKey, number> {
  return Object.fromEntries(
    STRUCTURED_ABUSE_METRIC_KEYS.map((key) => [key, 0]),
  ) as Record<StructuredAbuseMetricKey, number>;
}

function nonNegative(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new StructuredAbuseTelemetryError("TELEMETRY_INVALID");
  }
  return parsed;
}

function nextAggregate(
  current: Record<string, unknown> | undefined,
  event: StructuredAbuseTelemetryEventV1,
  scope: string,
): StructuredAbuseMetricAggregateV1 {
  const measurements = emptyMeasurements();
  const currentMeasurements = (current?.measurements ?? {}) as Record<string, unknown>;
  for (const key of STRUCTURED_ABUSE_METRIC_KEYS) {
    measurements[key] = nonNegative(currentMeasurements[key]) +
      nonNegative(event.measurements[key]);
  }
  const buckets = Array.isArray(current?.cardinalityBuckets)
    ? [...current.cardinalityBuckets] as boolean[]
    : Array.from({ length: CARDINALITY_BUCKETS }, () => false);
  if (buckets.length !== CARDINALITY_BUCKETS ||
      buckets.some((value) => typeof value !== "boolean")) {
    throw new StructuredAbuseTelemetryError("TELEMETRY_INVALID");
  }
  if (event.subject) {
    const bucket = Number.parseInt(event.subject.hash.slice(0, 8), 16) % CARDINALITY_BUCKETS;
    buckets[bucket] = true;
  }
  return Object.freeze({
    version: STRUCTURED_ABUSE_TELEMETRY_VERSION,
    date: utcDate(event.timestamp), scope,
    eventCount: nonNegative(current?.eventCount) + 1,
    rejectionCount: nonNegative(current?.rejectionCount) +
      (["REJECTED", "DENIED"].includes(event.outcome) ? 1 : 0),
    replayCount: nonNegative(current?.replayCount) +
      (event.outcome === "REPLAYED" ? 1 : 0),
    retryCount: nonNegative(current?.retryCount) +
      nonNegative(event.measurements.retries),
    durationCount: nonNegative(current?.durationCount) + 1,
    durationTotalMs: nonNegative(current?.durationTotalMs) + event.durationMs,
    durationMaxMs: Math.max(nonNegative(current?.durationMaxMs), event.durationMs),
    measurements, cardinalityBuckets: buckets,
    createdAt: current ? nonNegative(current.createdAt) : event.timestamp,
    updatedAt: event.timestamp,
  });
}

export class FirestoreStructuredAbuseTelemetryRepository
implements StructuredAbuseTelemetryRepository, StructuredAbuseMetricsReader {
  constructor(private readonly db: Firestore) {}

  async record(event: StructuredAbuseTelemetryEventV1): Promise<Readonly<{
    decision: "CREATED" | "REPLAY";
  }>> {
    const eventRef = this.db.collection(DISCOVERY_ABUSE_TELEMETRY_COLLECTION)
      .doc(event.eventId);
    const date = utcDate(event.timestamp);
    const scopes = ["global", `event:${event.eventType}`, `component:${event.component}`];
    const metricRefs = scopes.map((scope) => this.db
      .collection(DISCOVERY_ABUSE_METRICS_COLLECTION)
      .doc(metricDocumentId(date, scope)));
    return this.db.runTransaction(async (transaction: Transaction) => {
      const eventSnapshot = await transaction.get(eventRef);
      if (eventSnapshot.exists) {
        const stored = eventSnapshot.data();
        if (stored?.eventId !== event.eventId || stored?.eventType !== event.eventType ||
            stored?.requestId !== event.requestId) {
          throw new StructuredAbuseTelemetryError("TELEMETRY_INVALID");
        }
        return Object.freeze({ decision: "REPLAY" as const });
      }
      const metricSnapshots = await Promise.all(
        metricRefs.map((ref) => transaction.get(ref)),
      );
      transaction.create(eventRef, {
        ...serializeStructuredAbuseTelemetryEventV1(event),
        timestamp: Timestamp.fromMillis(event.timestamp),
        expiresAt: Timestamp.fromMillis(event.expiresAt),
      });
      metricRefs.forEach((ref, index) => transaction.set(
        ref,
        nextAggregate(metricSnapshots[index].data(), event, scopes[index]),
      ));
      return Object.freeze({ decision: "CREATED" as const });
    }, { maxAttempts: 10 });
  }

  async readDailyAggregate(input: Readonly<{
    date: string;
    scope: string;
  }>): Promise<StructuredAbuseMetricAggregateV1 | null> {
    const snapshot = await this.db.collection(DISCOVERY_ABUSE_METRICS_COLLECTION)
      .doc(metricDocumentId(input.date, input.scope)).get();
    return snapshot.exists
      ? snapshot.data() as StructuredAbuseMetricAggregateV1
      : null;
  }
}
