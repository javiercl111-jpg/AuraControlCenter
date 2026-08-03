# Strict Payload and Cost Bounds V1

**Slice:** AI-02H1E.4.5  
**Contract version:** `DISCOVERY_COST_BOUND_POLICY_V1`  
**Status:** implemented for architectural review  
**Production:** not authorized

## Scope

This slice introduces versioned, fail-closed input schemas and deterministic cost ceilings for the public Discovery flow. It does not change IAM, App Check, Firestore Rules, remote Firebase configuration, the Authority Principal Resolver, or `functions/src/index.ts`. No deployment is authorized by this document.

## Public request contracts

| Surface | Schema | Max request bytes | Routing authority |
|---|---|---:|---|
| Lead intake | `PUBLIC_DISCOVERY_INTAKE_V1` | 4,096 | Server resolves advisor/organization context |
| Conversation evaluation | `DISCOVERY_CONVERSATION_EVALUATION_V1` | 48,000 | `SESSION` capability |
| Completion | `DISCOVERY_COMPLETION_PAYLOAD_V1` | 64,000 | `SESSION` capability; link/session derived server-side |
| Report request | `DISCOVERY_REPORT_REQUEST_V1` | 2,048 | `REPORT` capability or authenticated platform authority |
| Document download | `DISCOVERY_DOCUMENT_DOWNLOAD_V1` | 2,048 | `REPORT` capability or authenticated platform authority |

Token exchange and session resolution are also version-locked by `DISCOVERY_CAPABILITY_EXCHANGE_REQUEST_V1` and `DISCOVERY_SESSION_RESOLUTION_REQUEST_V1`.

Every schema uses an explicit allowlist. Unknown fields, caller-supplied server-owned fields, wrong primitive types, invalid Unicode/control characters, excessive UTF-8 bytes, excessive depth, excessive field counts, and excessive array cardinality fail before business logic. Normalized objects are newly constructed; raw caller objects are not persisted.

## Server-owned fields

At minimum, IDs and bindings for session, dossier, prospect, advisor, tenant and organization; lifecycle status; token hashes and capability state; timestamps; correlation and trust decisions; notifications; and events remain server-owned. Completion derives `linkId` and `sessionId` from the authorized `SESSION` capability. The public completion result is restricted to `dossierId`, `reportId`, `reportCapabilityToken`, and `trustDecision`.

## Deterministic structural bounds

- Maximum nesting depth: 6.
- Maximum total object fields: 256.
- Conversation history: 8 messages per evaluation and 40 messages at completion.
- Total normalized history budget: 32,000 UTF-8 bytes.
- Strings are NFC-normalized and trimmed before use.
- String ceilings use UTF-8 bytes, not JavaScript code units.
- Control characters are rejected.
- Partial dossiers and completion drafts are projected to their declared fields.

The frontend mirrors visible length limits, emits only V1 names, strips message metadata, and never calls public report generation directly after completion.

## AI cost bounds

The conversation adapter reserves capacity in a Firestore transaction before invoking Gemini:

- 16 conversation evaluations per `SESSION` capability.
- 2 provider attempts per evaluation.
- 32 reserved provider attempts per session.
- One in-flight evaluation lease per session for 15 seconds.
- 24,000 prompt bytes.
- 512 model output tokens.

The lease prevents concurrent duplicate provider work. A quota or active lease fails closed with `CONVERSATION_BUDGET_EXCEEDED`. Counters use the hashed capability as their subject and never store the plaintext token.

## Report, download, and notification bounds

- Report dataset: 128,000 UTF-8 bytes.
- Generated PDF: 5 MiB.
- Generation timeout: 20 seconds.
- Logical generation attempts: 2.
- Forced regenerations: 1.
- Document downloads: 3 per report/capability in a deterministic 15-minute window.
- Notification payload: 4,096 bytes.
- Notification fan-out: one recipient.
- Notification channels: `INBOX` and `PUSH` only.
- Notification attempts: 3.

Completion performs the initial report generation server-side and returns a `REPORT` capability. The browser uses that capability for status/download requests; a legacy `SESSION` token is rejected by the download schema.

## Firestore adapter and collections

`FirestoreDiscoveryCostBudgetRepository` is the Firestore adapter for atomic cost reservations. It uses `runTransaction` for every read/check/increment/persist decision.

| Collection | Purpose | Document key |
|---|---|---|
| `discovery_conversation_budgets_v1` | Turn, attempt, and in-flight lease accounting | SHA-256 of the session capability hash |
| `discovery_download_budgets_v1` | Fixed-window document download accounting | SHA-256 of budget subject and window start |

Both documents carry the policy version and timestamps. Corrupt counters fail closed with `COST_BOUND_CONFIGURATION_ERROR`.

## Normalized errors

The complete V1 set is:

`PAYLOAD_INVALID`, `PAYLOAD_TOO_LARGE`, `PAYLOAD_TOO_DEEP`, `TOO_MANY_FIELDS`, `TOO_MANY_ITEMS`, `STRING_TOO_LONG`, `UNKNOWN_FIELD`, `SERVER_OWNED_FIELD`, `CONVERSATION_BUDGET_EXCEEDED`, `REPORT_BUDGET_EXCEEDED`, `DOWNLOAD_LIMIT_EXCEEDED`, and `COST_BOUND_CONFIGURATION_ERROR`.

Handlers translate these to stable callable errors without returning raw input or internal exception details.

## Certification

The isolated demo project `demo-aura-discovery-payload-bounds` runs Firestore Emulator on port 8094. The runner removes application credentials and refuses non-demo projects. The P5 suite covers 34 cases, including all five payload contracts, Unicode/bytes/depth/fields/arrays, server-owned fields, normalized callable errors, exact quota, two concurrent conversation requests, 100 parallel download requests, window rollover, corrupt counters, AI/report/notification policy bounds, and frontend REPORT capability use.

Inherited certification must remain green:

- P4 Capability Emulator: 29/29.
- P3 Idempotency Emulator: 24/24.
- P2 Rate Limit Emulator: 17/17.
- D.9 Authority End-to-End Emulator: 40/40.

## Architectural invariants

1. Validation and cost reservation precede expensive work.
2. Caller payloads do not establish tenant, organization, advisor, prospect, session, dossier, report, trust, event, notification, or lifecycle authority.
3. Cost decisions that can race are Firestore transactions.
4. Plaintext capabilities are never persisted in budget documents.
5. Missing or corrupt cost configuration fails closed.
6. V1 behavior changes require a new schema or policy version and renewed emulator certification.

## Explicit non-authorization

This slice does not authorize production, deployment, App Check changes, IAM changes, Firestore Rules changes, remote Firebase configuration, or resumption of D.10S. Architectural and security review are required first.
