# Structured Abuse Telemetry V1

**Slice:** AI-02H1E.4.6  
**Contract:** `STRUCTURED_ABUSE_TELEMETRY_V1`  
**Status:** implemented for architectural review  
**Production:** not authorized

## Purpose and boundaries

This slice provides reusable, provider-neutral telemetry for public Discovery abuse detection, failure diagnosis, latency, and logical cost measurement. It does not change IAM, App Check, Firestore Rules, Authority, remote configuration, or `functions/src/index.ts`.

Telemetry is operational evidence, not business authority. It cannot grant access, alter a rate-limit decision, complete a capability, or replace an authoritative record.

## Event contract

Every `StructuredAbuseTelemetryEventV1` contains:

- deterministic `eventId`;
- derived `correlationId` and `requestId`;
- millisecond `timestamp`;
- versioned `eventType`;
- `severity`, `source`, `outcome`, and normalized `reasonCode`;
- bounded `durationMs`;
- `environment` and `component`;
- optional HMAC/SHA-256-derived subject;
- closed numeric measurements;
- a 30-day logical `expiresAt` value for future TTL configuration.

There is no arbitrary metadata map. The serializer reconstructs the allowed document and discards additional runtime properties.

## Event inventory

| Domain | Events |
|---|---|
| Intake and payload | `intake.accepted`, `intake.rejected`, `payload.invalid` |
| Rate limiting | `rateLimit.allowed`, `rateLimit.denied` |
| Idempotency | `idempotency.replay`, `idempotency.expired` |
| Capabilities | `capability.accepted`, `capability.rejected` |
| Completion | `completion.started`, `completion.completed`, `completion.replayed` |
| Reports | `report.generated`, `report.denied` |
| Notifications | `notification.emitted`, `notification.skipped` |
| Downloads | `download.authorized`, `download.denied` |

The current instrumentation covers public intake, conversation AI budget reservations, capability exchange/resolution/authorization, completion, PDF generation, document download, and completion notification delivery.

## Deterministic identity and correlation

Event IDs are SHA-256 derivations of the contract version, event type, component, source, correlation ID, request ID, outcome, and reason code. Timestamp is excluded, so a retry of the same logical event converges on one document.

Correlation and request source values are never stored. They are transformed into prefixed SHA-256 identifiers. Sensitive subjects use HMAC-SHA-256 with a server secret; already-derived identifiers use an additional SHA-256 layer. Plaintext capability tokens never enter a telemetry command.

## Redaction policy

The contract and runtime validator prohibit fields representing:

- email, telephone, company/contact/prospect names;
- tokens or plaintext capabilities;
- signed/download URLs;
- raw payloads;
- Gemini prompts or responses.

Malformed subject hashes, forbidden keys, arbitrary metrics, unsafe reason codes, negative/fractional counters, excessive durations, and invalid identifiers fail before persistence. Handler fallback logs include only a stable reason code and component.

## Metrics

Closed counters support:

- `requests`, `rejections`, `retries`, and `replays`;
- `aiAttempts`, `aiInputBytes`, and `aiOutputTokens`;
- `pdfs` and `pdfBytes`;
- `downloads` and `notifications`.

Each aggregate also carries event/rejection/replay/retry counts plus latency count, total, and maximum. Cardinality is represented by 64 deterministic boolean buckets, providing a bounded abuse signal without storing subject values or creating unbounded per-subject metric documents. Domain millisecond timestamps are converted to Firestore timestamps by the adapter, including the future TTL field.

## Firestore adapter

| Collection | Purpose |
|---|---|
| `discovery_abuse_telemetry_v1` | Immutable, deterministic event envelopes |
| `discovery_abuse_metrics_v1` | Daily aggregates for dashboards and alerts |

`FirestoreStructuredAbuseTelemetryRepository` implements provider-neutral repository and metrics-reader ports. One Firestore transaction:

1. reads the deterministic event;
2. returns `REPLAY` if it already exists;
3. reads daily global, event-type, and component aggregates;
4. creates the event;
5. updates all three aggregates.

Consequently, transaction retries and caller retries do not double-count metrics. Corrupt aggregate counters fail closed rather than being reset.

## Dashboard and alert readiness

Consumers can query daily scopes without coupling to a monitoring vendor:

- `global`;
- `event:<eventType>`;
- `component:<component>`.

Future dashboards can calculate rejection rate, replay rate, AI attempts per accepted intake, PDF bytes per completion, download amplification, notification delivery rate, latency, and cardinality saturation. Future alert adapters should consume the metrics-reader port rather than Firestore document shapes directly.

## Runtime failure policy

Telemetry persistence is isolated from the business outcome through `recordDiscoveryTelemetrySafe`. A telemetry outage produces only `DISCOVERY_TELEMETRY_WRITE_FAILED` with a normalized component and does not turn a previously authorized side effect into an ambiguous caller failure. Contract/adapter tests remain fail-closed when invoked directly.

This tradeoff prevents duplicate leads, completions, PDFs, or notifications caused solely by observability failure. Alerting on telemetry write failures remains a pending operational configuration.

## Certification

P6 uses Firestore Emulator port 8095 and project `demo-aura-discovery-abuse-telemetry`. The runner removes application credentials and rejects non-demo project configuration.

The 25-case suite verifies all 18 event types, deterministic IDs, correlation, HMAC consistency, closed serialization, forbidden fields, Firestore redaction, normalized reason codes, suppression of arbitrary exception messages, metric validation, all requested counters, latency, bounded cardinality, dashboard scopes, concurrency, replay deduplication, corrupt aggregates, retention, provider-neutral ports, and sanitized notification logs.

Inherited gates remain mandatory:

- P5 payload/cost bounds;
- P4 capability exactly-once;
- P3 idempotency retention;
- P2 atomic rate limiting;
- D.9 Authority end-to-end.

## Pending decisions and residual risks

- Firestore TTL must be enabled for `expiresAt` in an authorized configuration slice; this implementation only writes the contract value.
- Retention duration and access governance require Privacy/Security approval.
- Alert thresholds, paging destinations, and dashboard provider remain intentionally unconfigured.
- The 64-bucket cardinality signal is bounded and privacy-preserving, but approximate.
- Best-effort runtime recording can create visibility gaps during a Firestore outage; the sanitized write-failure log is the fallback signal.
- No production telemetry data was read or written during certification.

## Explicit non-authorization

This slice does not authorize deployment or production use. Architectural, Privacy, Security, and operational review are required before configuration or rollout.
