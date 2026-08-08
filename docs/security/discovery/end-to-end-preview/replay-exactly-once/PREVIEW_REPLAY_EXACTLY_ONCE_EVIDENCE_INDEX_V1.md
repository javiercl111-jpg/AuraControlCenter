# Preview Replay and Exactly-Once Evidence Index V1

**Change ID:** `AI-02H2.2F-REPLAY-IDEMPOTENCY-EXACTLY-ONCE-20260807-01`  
**Handling:** sanitized metadata only; no personal data, credentials, request payloads, complete identifiers, or local absolute paths.

| Evidence | Source | Observation | Result |
|---|---|---|---|
| EV-01 | Local gate | Required branch/worktree, clean merged base, Node `v20.20.2` | PASS |
| EV-02 | Firebase/GCP target | Active project and Firebase alias both `aura-intel-preview` | PASS |
| EV-03 | Firestore count-only baseline | Leads/sessions/completions `2/2/2`; capabilities 6; outbox 2 | PASS |
| EV-04 | Containment and quota metadata | Containment `1/1/1`; current INTAKE count 1, remaining 0 | PASS |
| EV-05 | Sanitized fixture linkage | Latest lead/session/completion distinct from prior fixture and mutually linked | PASS |
| EV-06 | Session capability metadata | SESSION purpose, completed, unexpired, not revoked, linkage consistent | PASS |
| EV-07 | Intake idempotency metadata | COMPLETED, one attempt, zero lease recovery, no failure | PASS |
| EV-08 | Browser official recovery | Existing completed tab reclaimed; one reload; zero clicks | PASS |
| EV-09 | Cloud Run recovery request | `resolveDiscoverySession POST 200`, 1.547 s; App Check VALID | PASS |
| EV-10 | Recovery UI | Existing session reported already completed | PASS |
| EV-11 | Recovery state read-back | Session count remained 2; delta 0 | PASS |
| EV-12 | Controlled replay | Exactly one additional reload; zero clicks or public submits | PASS |
| EV-13 | Cloud Run replay request | `resolveDiscoverySession POST 200`, 0.579 s; App Check VALID | PASS |
| EV-14 | Request cardinality | Exactly two POSTs total: one recovery and one replay | PASS |
| EV-15 | Correlation | Same sanitized locator `sha256:54781c09d3fc` | PASS |
| EV-16 | Telemetry deduplication | One deterministic containment/capability event pair retained for repeated resolve contract | PASS |
| EV-17 | Functional post-state | Leads/sessions/completions remained `2/2/2`; delta `0/0/0` | PASS |
| EV-18 | Duplication safeguards | Capabilities, outbox, idempotency, namespaces and platform events unchanged | PASS |
| EV-19 | Side-effect read-back | Notifications 0; Tasks disabled/no queue; functional Storage 0/0 | PASS |
| EV-20 | Quota read-back | INTAKE, AI_EVALUATION and COMPLETION counters unchanged | PASS |
| EV-21 | Idempotency emulator | 24/24 tests | PASS |
| EV-22 | Capability/completion emulator | 29/29 tests, including identical/conflicting replay and 2/100 concurrent completions | PASS |
| EV-23 | Containment emulator | 52/52 tests | PASS |
| EV-24 | Authority adapter | 30/30 tests | PASS |
| EV-25 | Authority handler composition | 81/81 tests | PASS |
| EV-26 | Preview trust/completion contract | 20/20 tests | PASS |
| EV-27 | TypeScript | App, Node configuration and Functions `noEmit` | PASS |
| EV-28 | Root build | 2,134 transformed modules | PASS |
| EV-29 | Environment boundary | Live project/runtime remained Preview; Production/Staging not accessed | PASS |
| EV-30 | Remote completion replay | Not invoked; browser-held credential not extracted | CONDITIONAL GAP |

## Test coverage relevant to exactly-once

- Completed idempotency result reuse without a second effect.
- Concurrent completed replays converge on one result.
- Capability state remains stable during concurrent replay.
- Identical completion replay returns the equivalent result.
- Conflicting completion replay fails closed.
- Two and one hundred simultaneous completions converge.
- Transaction conflict retry and caller retry preserve deterministic IDs.
- One logical event, notification key, report capability, dossier, and completion.
- Existing/completed session authorization remains capability-bound.

## Sanitized locators

| Kind | Locator |
|---|---|
| Lead | `sha256:31d85eea1116` |
| Session | `sha256:f0279b13e363` |
| Completion | `sha256:8f60b7af067e` |
| Resolve correlation | `sha256:54781c09d3fc` |

These truncated hashes are evidence locators only and cannot authorize an operation.
