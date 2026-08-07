# Preview First End-to-End Happy Path R3

## Control record

- Change ID: `AI-02H2.2E-R3-PREVIEW-FIRST-END-TO-END-HAPPY-PATH-20260807-01`
- Test run: `AI02H2-2E-R3-PREVIEW-HAPPY-PATH-20260807-01`
- Date: 2026-08-07
- Scope: Preview only
- Result: `BLOCKED`
- Retry policy: no retry, replay, fuzzing, load, or stress activity was performed

## Gate

The required worktree and branch were used. The branch HEAD matched `origin/main` at short revision `01a5374`, the worktree was clean, and Node was `v20.20.2` before evidence creation. The active cloud project was `aura-intel-preview`. Five of five Cloud Functions were ACTIVE, five of five Cloud Run services were READY, failed Cloud Run revisions were zero, and the `aura-control-center-preview` deployment serving the Preview domain was READY.

The containment resolver found the active Preview policy. Aggregate control-plane state was 1 policy, 1 active pointer, and 1 activation audit. The client contract had App Check debug disabled. The browser loaded the Preview application plus Google Enterprise reCAPTCHA resources; no Production application host and no direct `a.run.app` client asset were observed.

## Baseline

Only aggregate counts were read. No PII-bearing documents, tokens, secrets, or complete resource identifiers were read into this evidence.

| Surface | Before |
|---|---:|
| Containment policies | 1 |
| Active containment pointers | 1 |
| Containment audits | 1 |
| Leads/links | 0 |
| Sessions | 0 |
| Session capabilities | 0 |
| Conversation budgets | 0 |
| Completions | 0 |
| Completion outbox | 0 |
| Intake idempotency records | 0 |
| Platform events | 0 |
| Notifications | 0 |
| Cloud Tasks queues/tasks | 0 |
| Functional Storage objects | 0 |

The pre-existing abuse-control aggregates were 6 telemetry records and 4 metric records.

## Controlled browser attempt

The public `/discover` UI rendered on the Preview domain. Required fields were valid and contained synthetic values. The company value was `Empresa Sintética Aura Preview`; all contact attributes used reserved synthetic test data and are intentionally omitted here.

Exactly one UI click on `Iniciar Diagnóstico` was executed after confirmation. The navigation stayed on `/discover`; the button returned to its enabled state. The rendered page showed no success or error state, browser warning/error logs were empty, and no Cloud Run request for `createDiscoveryLead` was observable in the attempt window. Aggregate readback showed no lead, idempotency record, session, or capability.

The Enterprise reCAPTCHA anchor was present. No CAPTCHA challenge was solved, no second click was made, and no alternate callable invocation was attempted. The precise client-side reason for the non-dispatch was not exposed by the rendered UI or captured logs.

## Flow result

| Operation | Result | Sanitized observation |
|---|---|---|
| `/discover` | PASS | Preview UI rendered; synthetic form valid |
| `createDiscoveryLead` | BLOCKED | 1 UI submit action; 0 observable callable requests; 0 leads |
| `exchangeDiscoveryToken` | NOT RUN | No lead artifact or one-time capability existed |
| `resolveDiscoverySession` | NOT RUN | No session capability existed |
| `evaluateConversation` | NOT RUN | Session was never established |
| `completeDiscoverySession` | NOT RUN | Conversation was never established |

The deployed response's historical `discoveryUrl` host could not be observed because the callable was not reached. Static client inspection confirmed that a successful response would be consumed through a repository-relative `/discover/{link}` navigation target and that the optional backend `discoveryUrl` field is not used by this client path. This is supporting isolation evidence only, not proof of a successful response.

## Post-readback and health

Post-attempt aggregate state matched the baseline for every Happy Path artifact: leads 0, sessions 0, capabilities 0, completions 0, outbox 0, idempotency 0, events 0, and notifications 0. Containment remained 1/1/1. Abuse-control aggregates remained 6/4.

Cloud Tasks could not contain functional work because its API was disabled for this project; it was not enabled. The project exposed only Cloud Functions source/upload buckets and no functional application Storage bucket. Five of five Functions remained ACTIVE, five of five Cloud Run services remained READY, failed revisions remained zero, and Vercel remained READY.

No Production or Staging action, code change, IAM change, secret change, Rules change, deployment, commit, push, or pull request was performed.

## Exactly-once observation

| Counter | Observed |
|---|---:|
| UI submit clicks | 1 |
| `createDiscoveryLead` requests | 0 |
| New leads | 0 |
| New sessions | 0 |
| New completions | 0 |

Exactly-once behavior is not certified by this run. The prescribed no-retry rule was honored.

## Verdict

BLOCKED —
PREVIEW END-TO-END HAPPY PATH FAILED

