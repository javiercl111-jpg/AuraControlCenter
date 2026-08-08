# Preview Replay and Exactly-Once Certification V1

**Change ID:** `AI-02H2.2F-REPLAY-IDEMPOTENCY-EXACTLY-ONCE-20260807-01`  
**Environment:** Preview only  
**Verdict:** **B — CONDITIONAL — REPLAY COMPLETED WITH NON-BLOCKING CONTROL GAP**

## Outcome

The latest completed Happy Path fixture was recovered through the official `resolveDiscoverySession` path and then replayed exactly once through the same recovery path. Both business requests returned `POST 200`, both had valid App Check, both returned the same logical completed-session outcome, and no functional resource count changed.

The remote functional delta was exactly `0 / 0 / 0` for leads, sessions, and completions. Capabilities, completion outbox, intake idempotency, namespaces, platform events, notifications, quota counters, Tasks, and functional Storage also remained unchanged.

Certification is conditional because the live replay exercised completed-session resolution, not a second remote `completeDiscoverySession` call. A remote completion replay would require extracting the browser-held session credential or adding an unsupported invocation path. Neither was permitted. Completion replay, conflict handling, concurrent convergence, transaction retries, and deterministic effects were instead certified with the isolated Firestore capability suite.

## Scope and gates

- GCP/Firebase project: `aura-intel-preview`.
- Vercel project: `aura-control-center-preview`.
- Browser origin: `https://preview-controlcenter.auranexus.io`.
- Required branch and worktree gate passed.
- `HEAD = origin/main` at the merged PR #120 base.
- Worktree began clean.
- Node runtime: `v20.20.2`.
- Production and Staging were not accessed.

No new Discovery, public submit, lead, session, or completion was created. There were no browser clicks.

## Baseline

| Resource | Baseline |
|---|---:|
| Discovery leads | 2 |
| Discovery sessions | 2 |
| Discovery completions | 2 |
| Discovery capabilities | 6 |
| Completion outbox | 2 |
| Intake idempotency records | 2 |
| Intake idempotency namespaces | 2 |
| Platform events | 6 |
| Notifications | 0 |

Containment remained `1 / 1 / 1`. The current INTAKE bucket was already consumed at count `1`, effective limit `1`, remaining `0`.

## Selected fixture

The latest completed Happy Path fixture was selected exclusively through metadata ordering and in-memory linkage comparison.

| Resource | Sanitized locator |
|---|---|
| Lead | `sha256:31d85eea1116` |
| Session | `sha256:f0279b13e363` |
| Completion | `sha256:8f60b7af067e` |
| Runtime correlation | `sha256:54781c09d3fc` |

The lead was `completed`; its SESSION capability was linked correctly, unexpired, completed, and not revoked. The intake idempotency record was `COMPLETED` after one attempt, with zero lease recoveries and no failure code.

**Fixture replayable: YES.**

## Official recovery

The existing completed browser tab was reclaimed without opening another Discovery. One controlled reload executed the official resumption branch. The frontend displayed the expected message that the consultation session had already been completed.

| Field | Observation |
|---|---|
| Operation | `resolveDiscoverySession` |
| HTTP status | `200` |
| Duration | `1.547 s` |
| App Check | `VALID` |
| Authentication | public callable, `MISSING` as designed |
| Containment | `ALLOWED` |
| Capability outcome | `SESSION_RESOLVED` / accepted |
| Session delta | `0` |

The service returned the existing completed session contract and created no session.

## Controlled replay

Exactly one additional reload replayed the same resolution operation against the same completed fixture. No click or submit occurred.

| Field | Observation |
|---|---|
| Replay count | 1 |
| Operation | `resolveDiscoverySession` |
| HTTP status | `200` |
| Duration | `0.579 s` |
| App Check | `VALID` |
| Logical outcome | same completed-session response |
| Correlation locator | `sha256:54781c09d3fc` |

Cloud Run contained exactly two business POSTs for this slice: one recovery and one replay. Structured abuse telemetry retained one deterministic containment/capability pair for the repeated contract instead of creating duplicate event documents.

## Exactly-once read-back

| Resource | Before | After replay | Delta |
|---|---:|---:|---:|
| Discovery leads | 2 | 2 | 0 |
| Discovery sessions | 2 | 2 | 0 |
| Discovery completions | 2 | 2 | 0 |
| Discovery capabilities | 6 | 6 | 0 |
| Completion outbox | 2 | 2 | 0 |
| Intake idempotency records | 2 | 2 | 0 |
| Intake idempotency namespaces | 2 | 2 | 0 |
| Platform events | 6 | 6 | 0 |
| Notifications | 0 | 0 | 0 |

INTAKE remained count `1`, remaining `0`; AI_EVALUATION remained count `1`, remaining `15`; COMPLETION remained count `1`, remaining `0`. Cloud Tasks remained disabled with no queue observed. Storage remained limited to two managed function buckets and zero functional buckets or objects.

## Error recovery and formal exactly-once tests

All required isolated suites passed:

| Suite | Tests |
|---|---:|
| Firestore intake idempotency | 24/24 |
| Firestore capabilities, resolution, and completion | 29/29 |
| Discovery containment | 52/52 |
| Firestore Authority adapter | 30/30 |
| Authority handler composition | 81/81 |
| Preview trust and completion contract | 20/20 |
| **Total** | **236/236** |

The capability suite covered identical completion replay, conflicting replay, two simultaneous completions, one hundred simultaneous completions, stable event and notification identifiers, one REPORT capability, transaction conflict retries, caller timeout/retry, and corrupt or legacy capability failure. The idempotency suite covered cached reuse, request-hash conflict, lease recovery bounds, concurrent completed replays, capability stability, real transaction conflict retry, and cleanup idempotency. Containment covered completion-before-reservation denial and concurrent quota enforcement.

TypeScript `noEmit` passed for app, Node configuration, and Functions. The root build passed with 2,134 transformed modules. Warnings were limited to existing dynamic-import and large-chunk optimization notices.

## Tenant and correlation boundary

All live requests and telemetry remained within the `aura-intel-preview` project and PREVIEW runtime. Capability-to-link-to-session linkage was exact. The selected link has no record-level tenant or organization marker, so tenant correctness is established at the isolated project/runtime boundary rather than by a separately observable persisted tenant field. Authority and containment tests independently passed tenant-mismatch fail-closed cases.

## Conditional gap

`GAP-2F-01`: a live remote `completion.replayed` result was not generated. The completed-session credential remained inside the browser session and was not extracted. A future slice may close this gap only through a pre-authorized replay harness that can invoke `completeDiscoverySession` with the original normalized payload and credential without exposing either value or creating another fixture.

No second replay was attempted.
