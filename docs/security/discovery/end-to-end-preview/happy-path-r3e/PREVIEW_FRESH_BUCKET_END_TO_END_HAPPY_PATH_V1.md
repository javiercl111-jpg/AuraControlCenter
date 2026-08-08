# Preview Fresh-Bucket End-to-End Happy Path V1

**Change ID:** `AI-02H2.2E-R3E-FRESH-BUCKET-END-TO-END-HAPPY-PATH-20260807-01`  
**Test run:** `AI-02H2.2E-R3E-FRESH-BUCKET-HAPPY-PATH-20260807-01`  
**Environment:** Preview only  
**Verdict:** **B — CONDITIONAL — HAPPY PATH COMPLETED WITH NON-BLOCKING CONTROL GAP**

## Outcome

The fresh synthetic hotel fixture reached the terminal **Expediente Completado** screen. The observed state delta was exactly one new lead, one new session, and one new completion. The prior fixture remained distinct and unchanged. The browser issued one business `POST` to create the lead, and there was no retry, second submit, reload, replay, or second Discovery.

Certification is conditional because the normal uninterrupted frontend path did not call `resolveDiscoverySession`. The exchanged session remained in the running client context; the current frontend invokes resolve only while resuming a path that has a session token and no access fragment. Exercising that branch would have required a reload or equivalent resumption, which this slice explicitly prohibited. The resolve service was healthy but its runtime success was therefore not certified by this run.

## Scope and boundaries

- GCP/Firebase project: `aura-intel-preview`.
- Vercel project: `aura-control-center-preview`.
- Browser origin: `https://preview-controlcenter.auranexus.io`.
- Production and Staging were neither queried nor modified.
- No code, configuration, Containment, Authority, IAM, Secrets, Rules, or deployment was changed.
- The fixture used synthetic hotel operations data only.

## Preconditions

The required worktree, branch, clean base, Node `v20.20.2`, Firebase/GCP Preview target, and `HEAD = origin/main` gates passed before browser activity. The current INTAKE bucket began at `2026-08-08T00:00:00Z`, was not materialized, and therefore had effective count `0`, remaining `1`, and effective limit `1`. Public intake was enabled, the containment policy was active, the active pointer was valid, and containment cardinality was `1/1/1`.

Infrastructure preflight passed with Functions `5/5 ACTIVE`, Cloud Run `5/5 READY`, zero failed selected revisions, the Preview deployment ready, and App Check debug disabled.

## Single-submit trace

The single authorized click occurred at `2026-08-08T00:20:59.332Z`. The browser observer emitted eight submit-diagnostic records, corresponding to:

1. `CLICK`
2. `NATIVE_SUBMIT`
3. `REACT_HANDLER`
4. `VALIDATION_ACCEPTED`
5. `APP_CHECK_READY`
6. `CLIENT_PRECONDITION_ACCEPTED`
7. `SERVICE_DISPATCH_STARTED`
8. `NETWORK_DISPATCH`

The observer payloads were collapsed to `Object` by the browser log adapter, so their field-level values were not re-read after the click. The event count, source ordering, one `POST`, App Check verification, containment telemetry, intake acceptance, UI transition, and state delta jointly support the sequence. No second observation attempt was made.

## Operation results

| Operation | Business request | Duration | App Check | Containment/session outcome | Result |
|---|---:|---:|---|---|---|
| `createDiscoveryLead` | `POST 200` | 2.651 s | VALID | containment allowed twice; quota allowed; intake accepted | SUCCESS |
| `exchangeDiscoveryToken` | `POST 200` | 1.826 s | VALID | containment allowed; exchange capability accepted | SUCCESS |
| `resolveDiscoverySession` | none | n/a | n/a | service healthy; resumption branch not entered | NOT INVOKED |
| `evaluateConversation` | `POST 200` | 2.430 s | VALID | session capability accepted; containment and conversation budget allowed | SUCCESS |
| `completeDiscoverySession` | `POST 200` | 3.294 s | VALID | session capability accepted; completion and token-issuance containment allowed | SUCCESS |

The corresponding CORS preflights returned `204` and are not counted as business requests. Public callable authentication was absent as designed; App Check was valid for every observed business request.

## Functional state comparison

| Resource | Baseline | Post-state | Delta |
|---|---:|---:|---:|
| Discovery leads | 1 | 2 | +1 |
| Discovery sessions | 1 | 2 | +1 |
| Discovery capabilities | 3 | 6 | +3 |
| Conversation budgets | 1 | 2 | +1 |
| Discovery completions | 1 | 2 | +1 |
| Completion outbox | 1 | 2 | +1 |
| Platform events | 3 | 6 | +3 |
| Completed intake-idempotency records | 1 | 2 | +1 |
| Intake-idempotency namespaces | 1 | 2 | +1 |
| Notifications | 0 | 0 | 0 |
| Task queues observed | 0 | 0 | 0 |
| Functional Storage buckets/objects | 0/0 | 0/0 | 0/0 |

Both idempotency records were `COMPLETED`, each with one attempt, zero lease recoveries, and no failure code. This run created the newer record once. No replay was executed.

## Containment and quota post-state

- Containment policy / active pointer / activation audit: `1 / 1 / 1`.
- Current INTAKE bucket: count `1`, effective limit `1`, remaining `0`.
- Current AI_EVALUATION bucket: count `1`, effective limit `16`, remaining `15`.
- Current COMPLETION bucket: count `1`, effective limit `1`, remaining `0`.
- Every current-run structured containment event was `ALLOWED` in `PREVIEW`.

## Non-reuse and linkage

Sanitized SHA-256 locators demonstrate distinct resources:

| Resource | Previous locator | New locator | Distinct |
|---|---|---|---|
| Lead | `1a82ce34512d` | `31d85eea1116` | yes |
| Session | `dd71dfded1b6` | `f0279b13e363` | yes |
| Completion | `c158612acbdb` | `8f60b7af067e` | yes |

The new completion references the new lead and the new session. No complete identifier is recorded.

## Correlation observation

Sanitized telemetry correlation locators were present for create, exchange, evaluation, and completion. Locator `54781c09d3fc` linked exchange and completion telemetry. Other events used component-local locators, so this run did not prove a single invariant end-to-end correlation value across all five named operations. This is an observability limitation, not a functional failure.

## Exactly-once observation

- UI submit clicks: `1`.
- `createDiscoveryLead` business requests: `1`.
- New leads: `1`.
- New sessions: `1`.
- New completions: `1`.
- Replay attempts: `0`.

This is a happy-path observation only. Replay, idempotency conflict, and formal exactly-once certification remain a separate authorized slice.

## Final health

Final read-back showed Functions `5/5 ACTIVE`, Cloud Run `5/5 READY`, five selected ready revisions, zero failed selected revisions, and the latest observed Preview-project deployment `READY`. Cloud Tasks API remained disabled; no queue was observed. Storage remained limited to two managed function buckets with zero functional buckets or objects. Notifications remained zero. Production and Staging were not accessed.

## Conditional gap and next certification boundary

`GAP-R3E-01`: certify `resolveDiscoverySession` through a separately authorized, controlled resumption slice. That slice must define whether a reload/resumption is permitted and must not create another Discovery unless explicitly authorized. No such action was taken here.
