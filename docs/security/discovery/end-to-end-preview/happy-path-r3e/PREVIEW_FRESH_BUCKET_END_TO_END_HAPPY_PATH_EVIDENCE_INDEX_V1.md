# Preview Fresh-Bucket End-to-End Happy Path Evidence Index V1

**Change ID:** `AI-02H2.2E-R3E-FRESH-BUCKET-END-TO-END-HAPPY-PATH-20260807-01`  
**Evidence handling:** metadata-only and sanitized; no PII, tokens, secrets, complete identifiers, or local absolute paths.

| Evidence | Source | Observation | Result |
|---|---|---|---|
| EV-01 | Local gate | Required worktree and branch; clean `origin/main` base; Node `v20.20.2`; Preview project selected | PASS |
| EV-02 | Firestore count-only read | Baseline lead/session/completion `1/1/1`; prior resources preserved | PASS |
| EV-03 | Preview INTAKE metadata | Fresh bucket effective count `0`, remaining `1`, effective limit `1` before submit | PASS |
| EV-04 | Containment metadata | Active policy, valid pointer, cardinality `1/1/1`, public intake enabled | PASS |
| EV-05 | Infrastructure metadata | Functions `5/5 ACTIVE`; Cloud Run `5/5 READY`; zero failed selected revisions | PASS |
| EV-06 | Browser form state | Fresh entrypoint, valid form, enabled button, App Check present, observer ready | PASS |
| EV-07 | Browser observer | Eight diagnostic messages emitted for the single submit; adapter retained message label but collapsed structured fields to `Object` | PASS WITH OBSERVABILITY LIMITATION |
| EV-08 | Browser click counter | `Iniciar Diagnóstico` click count `1`; no retry, reload, or second Discovery | PASS |
| EV-09 | Cloud Run request log | One `createDiscoveryLead` `POST 200`, 2.651 s; App Check VALID | PASS |
| EV-10 | Structured telemetry | Create containment allowed, rate limit allowed, intake accepted | PASS |
| EV-11 | Cloud Run request log | One `exchangeDiscoveryToken` `POST 200`, 1.826 s; App Check VALID | PASS |
| EV-12 | Structured telemetry | Exchange containment allowed and capability accepted | PASS |
| EV-13 | Resolve service logs | No `resolveDiscoverySession` request for this run; service itself remained ACTIVE and READY | CONDITIONAL GAP |
| EV-14 | Frontend control-flow review | Uninterrupted exchange writes the session token into the running context and enters welcome; resolve is called only by the resumption path with no access fragment | EXPLAINS EV-13 |
| EV-15 | Controlled conversation | Synthetic hotel, manual processes, overtime errors, manual document search, executive recommendations; minimum two user answers plus one summary confirmation | PASS |
| EV-16 | Cloud Run request log | One `evaluateConversation` `POST 200`, 2.430 s; App Check VALID | PASS |
| EV-17 | Structured telemetry | Evaluation capability accepted; containment and conversation budget allowed | PASS |
| EV-18 | Cloud Run request log | One `completeDiscoverySession` `POST 200`, 3.294 s; App Check VALID | PASS |
| EV-19 | Structured telemetry | Completion capability accepted; completion started and completed; containment allowed | PASS |
| EV-20 | Browser terminal state | `Expediente Completado` and successful diagnostic message; final navigation button intentionally not pressed | PASS |
| EV-21 | Firestore count-only read | Leads `1→2`; sessions `1→2`; completions `1→2` | PASS |
| EV-22 | Firestore count-only read | Capabilities `3→6`; budgets `1→2`; outbox `1→2`; platform events `3→6` | PASS |
| EV-23 | Sanitized in-memory comparison | Previous/new lead, session, and completion all distinct; new completion linked to new lead and session | PASS |
| EV-24 | Idempotency metadata | New record COMPLETED, one attempt, zero lease recovery, no failure; no replay event | PASS |
| EV-25 | Current quota metadata | INTAKE `1/1`, remaining `0`; AI_EVALUATION `1/16`; COMPLETION `1/1` | PASS |
| EV-26 | Side-effect read-back | Notifications `0`; Cloud Tasks disabled/no queue; functional Storage `0/0` | PASS |
| EV-27 | Final health | Functions `5/5 ACTIVE`; Cloud Run `5/5 READY`; zero failed selected revisions; Preview deployment READY | PASS |
| EV-28 | Environment field and target audit | All structured run telemetry marked PREVIEW; Production and Staging not accessed | PASS |
| EV-29 | Correlation locator projection | Sanitized locators existed; exchange and completion shared one locator, while not all components shared one invariant locator | NON-BLOCKING OBSERVABILITY GAP |

## Sanitized resource locators

| Resource | Previous | New |
|---|---|---|
| Lead | `sha256:1a82ce34512d` | `sha256:31d85eea1116` |
| Session | `sha256:dd71dfded1b6` | `sha256:f0279b13e363` |
| Completion | `sha256:c158612acbdb` | `sha256:8f60b7af067e` |

The locators are truncated hashes generated only for evidence correlation. They cannot be used as capabilities or session locators.
