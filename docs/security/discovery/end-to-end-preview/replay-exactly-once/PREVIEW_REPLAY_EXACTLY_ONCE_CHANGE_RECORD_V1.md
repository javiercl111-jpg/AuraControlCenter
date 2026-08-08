# Preview Replay and Exactly-Once Change Record V1

**Change ID:** `AI-02H2.2F-REPLAY-IDEMPOTENCY-EXACTLY-ONCE-20260807-01`  
**Classification:** Preview certification evidence only  
**Verdict:** B — Conditional

## Authorized execution

- Selected the latest completed Happy Path fixture through sanitized metadata.
- Reclaimed its existing browser tab without opening another Discovery.
- Performed one official completed-session recovery with no click.
- Performed one and only one replay of the same recovery contract with no click.
- Read sanitized Preview counts, capability/idempotency state, quota, telemetry, Tasks, and Storage metadata.
- Executed isolated idempotency, capability/completion, containment, Authority, and Preview completion contract tests.
- Executed TypeScript `noEmit` and the root build.

## Remote effects

The two live business calls were read-only `resolveDiscoverySession` operations: one recovery and one replay. Both returned `200` with valid App Check and the same completed-session result.

No functional persistence delta occurred:

- leads `2→2`;
- sessions `2→2`;
- completions `2→2`;
- capabilities `6→6`;
- completion outbox `2→2`;
- intake idempotency records `2→2`;
- namespaces `2→2`;
- platform events `6→6`;
- notifications `0→0`.

Quota counters were unchanged. Cloud Tasks remained disabled. No functional Storage bucket or object was created.

## Local validation

The six suites passed 236/236 tests. TypeScript `noEmit` passed for all three configured targets. The root build passed with 2,134 modules. Temporary dependency links, emulator logs, staged package output, and build output were removed after validation.

## Conditional limitation

No second remote completion was invoked. The browser-held session credential was not inspected or exported, and no unsupported harness was created. Remote evidence therefore proves safe repeated resolution and zero functional duplication; isolated Firestore evidence proves completion replay and concurrent exactly-once convergence.

## Repository change

Only these four evidence files are added:

1. `PREVIEW_REPLAY_EXACTLY_ONCE_CERTIFICATION_V1.md`
2. `PREVIEW_REPLAY_EXACTLY_ONCE_MATRIX_V1.json`
3. `PREVIEW_REPLAY_EXACTLY_ONCE_EVIDENCE_INDEX_V1.md`
4. `PREVIEW_REPLAY_EXACTLY_ONCE_CHANGE_RECORD_V1.md`

No code, test, configuration, Containment, Authority, IAM, Rules, or deployment file was changed. No commit, push, or pull request was created. Production and Staging were not accessed.
