# Preview First End-to-End Happy Path Evidence Index V1

Change ID: `AI-02H2.2E-PREVIEW-FIRST-END-TO-END-HAPPY-PATH-20260806-FINAL-01`

All evidence is sanitized. No secret values, capability tokens, credentials, full generated resource IDs, payloads, documents, real PII or local absolute paths are recorded.

| Evidence | Source | Observation | Result |
|---|---|---|---|
| EV-01 | Git read-back | Required branch; HEAD equals `origin/main` at short SHA `2defd876d2b6`; initial status clean | PASS |
| EV-02 | Firebase Functions read-back | Five allowlisted gen2 Functions report ACTIVE | PASS |
| EV-03 | Cloud Run read-back | Five expected services report Ready=True; failed revisions count 0 | PASS |
| EV-04 | Vercel read-back | Isolated project `aura-control-center-preview` reports READY | PASS |
| EV-05 | Firebase App Check CLI | Debug token count 0 | PASS |
| EV-06 | Fresh browser preflight | `/discover` rendered; console errors 0; warnings 0; reCAPTCHA Enterprise resources loaded | PASS |
| EV-07 | Browser resource inventory | Production host requests 0; direct `a.run.app` requests 0 | PASS |
| EV-08 | Firestore aggregation baseline | Business collections 0; telemetry 2; no documents or PII read | PASS |
| EV-09 | Storage metadata aggregation | Functional buckets/objects 0/0; 8 existing objects classified as build artifacts | PASS |
| EV-10 | Cloud Tasks CLI | Cloud Tasks API disabled; no queue inventory surface enabled | PASS |
| EV-11 | Structured telemetry at 2026-08-06T22:14:34Z | `containment.policy_missing`, DENIED, `CONTAINMENT_POLICY_NOT_FOUND`, followed by `intake.rejected`/`UNAVAILABLE` | BLOCKER |
| EV-12 | Structured telemetry at 2026-08-06T22:15:54Z | Second rejected UI request produced the same two-event pattern; no business write | CONTROL GAP |
| EV-13 | Containment aggregation | Active pointers 0; policies 0; audit records 0 | BLOCKER |
| EV-14 | Secondary browser console | App Check reCAPTCHA Enterprise exchange HTTP 403; `initial-throttle` for 24 hours | BLOCKER |
| EV-15 | Secondary browser network aggregation | Only Preview, Google reCAPTCHA and Firebase App Check hosts observed; Production 0; direct Run 0 | PASS |
| EV-16 | Firestore post-readback | All business collections remain 0; telemetry 6, delta +4 | PASS WITH CONTROL DELTA |
| EV-17 | Source correlation | Containment evaluator denies when active policy is absent and normalizes caller response to unavailable | CONFIRMED |
| EV-18 | Source correlation | Handler response constructs a Production-host `discoveryUrl`; client helper ignores it and builds a relative route | BLOCKER LATENT |
| EV-19 | Final health read-back | Functions 5/5 ACTIVE; Run 5/5 READY; failed revisions 0; Vercel READY | PASS |
| EV-20 | Operational audit | No exchange, resolve, evaluate, completion, PDF, Storage, Tasks, notifications, deploy, commit, push or PR | PASS |

## Evidence interpretation

The first functional boundary did not pass. App Check was sufficient in the integrated browser to reach `createDiscoveryLead`, but containment denied the operation before business writes. The fallback browser did not reach the Function because its App Check exchange was rejected. These are separate observations and must not be conflated.

The telemetry delta is the only external data delta produced by this slice. It contains four sanitized control events representing two rejected intake requests. No correlation ID, request ID or subject identifier is reproduced here.
