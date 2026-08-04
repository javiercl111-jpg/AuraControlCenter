# Preview Runtime Trust Evidence Index V1

## Record

- Slice: `AI-02H1E.5.R2C-P2`
- Change ID: `AI-02H1E.5.R2C-P2-PREVIEW-TRUST-BINDING-20260804-01`
- Target: Preview / `aura-intel-preview`
- Final read-back: `2026-08-04T23:31:23Z`
- Verdict: **BLOCKED — RUNTIME TRUST BINDING INCOMPLETE**

Raw policies, credentials, tokens, secret material, personal account identifiers, project numbers, full app identifiers, notification-channel identifiers, billing account identifiers, and local paths are excluded.

## Evidence catalog

| Evidence ID | Sanitized source | Result | Assessment |
| --- | --- | --- | --- |
| EV-GATE | Git revision/status, runtime binaries, aliases, inherited evidence | exact branch; clean gate; HEAD equals `origin/main`; R2C-P present; Node/npm exact; Preview alias exact; Production hold present | PASS |
| EV-INVENTORY-API | Service Usage enabled list | 49 enabled pre-state; 50 final; STS added; Tasks remains disabled | PASS |
| EV-INVENTORY-IAM | project and per-service-account policies | generic runtime roles removed; four runtimes each have Firestore data user + log writer; deployer has no roles | PASS / PARTIAL TRUST |
| EV-IDENTITIES | service-account create/list | four separate runtime identities; two shortened IDs preserve logical names | PASS |
| EV-KEYS | user-managed key list for every Preview service account | total 0 | PASS |
| EV-HANDLERS | local source audit of five handlers, repositories, telemetry, containment, cost budgets and completion path | handler-to-identity/collection/secret/control map produced; four blocking contracts recorded | BLOCKED FOR DEPLOY |
| EV-SECRET-METADATA | Secret Manager metadata, versions and per-secret policies | three exact accessor bindings; IP salt unbound; all four version counts 0 | BLOCKED |
| EV-SECRET-UPLOAD | execution security review | generation/upload rejected before execution; no secret value or version created | NO CHANGE / BLOCKED |
| EV-WIF-DESIGN | proposed pool/provider/claims/condition/audience/lifetime | exact Preview design recorded | DESIGN COMPLETE |
| EV-WIF-EXECUTION | execution security review plus WIF read-back | provider creation rejected before execution; 0 pools/providers/bindings | BLOCKED |
| EV-APP-CHECK | Firebase app list, debug-token list, mutation record | one Web app; zero debug tokens; no provider/enforcement mutation; provider API read-back unavailable | CONDITIONAL / BLOCKED FOR DEPLOY |
| EV-METRICS | Logging metrics list | four named log-based metrics | PASS |
| EV-ALERTS | Monitoring policy name list | 0 policies | PENDING |
| EV-BUDGETS | Billing Budgets API | 403; USD 5 and USD 10 signals not verified or changed | PENDING |
| EV-WORKLOADS | Functions, Cloud Run, bucket and Tasks read-back | 0 / 0 / 0 / 0 | PASS |
| EV-STAGING | project/account/bucket read-back and mutation target log | ACTIVE; one automatic account; no bucket; never targeted by writes | PASS / UNCHANGED |
| EV-PRODUCTION | project read-back and mutation target log | ACTIVE; never targeted by writes; `REMEDIATION_HOLD` | PASS / UNCHANGED |
| EV-SANITIZATION | repository evidence scan | secrets, emails, project numbers, app IDs, billing/channel IDs and local paths excluded | PENDING FINAL GIT VALIDATION |

## Mutation receipts

Successful external mutations were limited to Preview:

1. enabled `sts.googleapis.com`;
2. created four runtime service accounts;
3. added eight project IAM bindings: Firestore data user and log writer for each runtime;
4. removed log writer and metric writer from `preview-functions-runtime`;
5. added three secret-level accessor bindings to exact consumers;
6. created four log-based metrics.

No deployer role, service-account `actAs`, federation principal, WIF pool/provider, secret version, App Check provider/enforcement, debug token, alert policy, budget, Function, Cloud Run service, bucket, Task, Rule, Staging resource, or Production resource was created or changed.

## Handler audit evidence

| Handler | Primary source | Repository/control evidence |
| --- | --- | --- |
| `createDiscoveryLead` | `functions/src/discovery/createDiscoveryLead.ts` | idempotency repository, links/advisors, containment, structured telemetry, App Check and secret declaration |
| `exchangeDiscoveryToken` | `functions/src/discovery/exchangeDiscoveryToken.ts` | capability exchange repository, containment, telemetry and manual App Check |
| `resolveDiscoverySession` | `functions/src/discovery/resolveDiscoverySession.ts` | capability/session resolution, link binding, containment, telemetry and manual App Check |
| `evaluateConversation` | `functions/src/intelligence/evaluateConversation.ts` | Gemini secret, capability authorization, conversation budget, containment, telemetry and declarative App Check |
| `completeDiscoverySession` | `functions/src/discovery/completeDiscoverySession.ts` | HMAC secret, exactly-once completion repository, structured result, report-generation call and manual App Check |
| shared capabilities | `functions/src/infrastructure/firestore/discoveryCapabilities/FirestoreDiscoveryCapabilityRepository.ts` | capability, completion, outbox, session, lead and event transaction scope |

The source audit was read-only. No production code or Rule was edited.

## Evidence limitations

- WIF conditions were not remotely created or tested; approval of the exact persistent federation boundary is still required.
- No secret positive test is possible with zero versions.
- Provider read-back was unavailable and no site key/domain input was supplied.
- No Function exists, so runtime IAM and log metrics have no effective positive invocation test.
- Firestore IAM has project data scope; collection isolation relies on application composition and requires negative deployment tests.
- Budget state cannot be certified with the current 403.
- No approved alert threshold or notification channel exists.
- Nominal approver receipts are pending.

## Related evidence documents

| File | Purpose |
| --- | --- |
| `PREVIEW_RUNTIME_TRUST_BINDING_V1.md` | narrative execution, handler map, decisions, blockers and next slice |
| `PREVIEW_RUNTIME_TRUST_MATRIX_V1.json` | machine-readable trust, IAM, secrets, WIF, observability and scope matrix |
| `PREVIEW_RUNTIME_TRUST_CHANGE_RECORD_V1.md` | change receipt, before/after, deviations, rollback and stop conditions |

Stop before any Function or traffic operation.
