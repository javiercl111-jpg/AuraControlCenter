import type { StructuredAbuseTelemetryRepository } from
  "./structuredAbuseTelemetryPorts";
import {
  STRUCTURED_ABUSE_TELEMETRY_VERSION,
  type StructuredAbuseTelemetryCommandV1,
  type StructuredAbuseTelemetryEventV1,
} from "./structuredAbuseTelemetryTypes";
import {
  deriveTelemetryIdentifierV1,
  validateStructuredAbuseTelemetryEventV1,
} from "./structuredAbuseTelemetryValidation";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export class StructuredAbuseTelemetryRecorder {
  constructor(
    private readonly repository: StructuredAbuseTelemetryRepository,
    private readonly clock: () => number = Date.now,
  ) {}

  async record(command: StructuredAbuseTelemetryCommandV1): Promise<Readonly<{
    event: StructuredAbuseTelemetryEventV1;
    decision: "CREATED" | "REPLAY";
  }>> {
    const timestamp = command.timestamp ?? this.clock();
    const correlationId = deriveTelemetryIdentifierV1("corr", command.correlationKey);
    const requestId = deriveTelemetryIdentifierV1("req", command.requestKey);
    const eventId = deriveTelemetryIdentifierV1("evt", [
      STRUCTURED_ABUSE_TELEMETRY_VERSION, command.eventType, command.source,
      command.component, correlationId, requestId, command.outcome,
      command.reasonCode,
    ].join("|"));
    const event = validateStructuredAbuseTelemetryEventV1({
      version: STRUCTURED_ABUSE_TELEMETRY_VERSION,
      eventId, correlationId, requestId, timestamp,
      eventType: command.eventType,
      severity: command.severity ?? (command.outcome === "REJECTED" || command.outcome === "DENIED" ? "WARN" : "INFO"),
      source: command.source, outcome: command.outcome,
      reasonCode: command.reasonCode, durationMs: command.durationMs,
      environment: command.environment, component: command.component,
      ...(command.subject ? { subject: command.subject } : {}),
      measurements: Object.freeze({ ...(command.measurements ?? {}) }),
      expiresAt: timestamp + RETENTION_MS,
    });
    const result = await this.repository.record(event);
    return Object.freeze({ event, decision: result.decision });
  }
}
