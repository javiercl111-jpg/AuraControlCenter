# Preview Runtime Trust Change Record V1

## Change record

| Field | Value |
| --- | --- |
| Slice | `AI-02H1E.5.R2C-P2` |
| Change ID | `AI-02H1E.5.R2C-P2-PREVIEW-TRUST-BINDING-20260804-01` |
| Date | `2026-08-04` |
| Target | Preview / `aura-intel-preview` |
| Branch | `security/intelligence-preview-runtime-trust-binding` |
| Gate HEAD / `origin/main` | `5c6e14d7a1587922861f66a15306668f9c99fe31` |
| Actor role | `RUNTIME_PROVISIONING_IMPLEMENTER` |
| Required approver roles | `SECURITY_OWNER`, `DEPLOYMENT_APPROVER` |
| Nominal receipts | pending |
| Evidence destination | `docs/security/discovery/production-remediation/security-baseline/execution/preview-runtime/trust-binding/` |
| Verdict | **BLOCKED — RUNTIME TRUST BINDING INCOMPLETE** |

## Authorized resources

- Preview runtime service accounts and minimum IAM;
- exact secret consumer bindings and securely supplied versions;
- Preview-only GitHub WIF;
- Preview App Check provider without enforcement;
- minimum metrics, alerts and USD 5/USD 10 budget signals;
- evidence and read-back.

Functions, Cloud Run, Firestore Rules, Storage, Cloud Tasks, Staging, Production, permanent keys, code changes, commits, pushes and pull requests were excluded.

## Before / after

| Control | Before | After |
| --- | --- | --- |
| STS | disabled | enabled; no provider/trust path |
| Dedicated runtime identities | none of the four P2 boundaries | four accounts present |
| Generic functions runtime | log writer + metric writer | zero project roles; parked |
| Runtime project IAM | not present | each runtime has data user + log writer |
| Deployer | present, no roles | unchanged; no roles |
| Secret resource bindings | none | three exact consumers; IP salt unbound |
| Secret versions | 0 each | 0 each |
| WIF | 0 pools/providers | unchanged; execution rejected before creation |
| App Check | one app, zero debug, no provider/enforcement | no mutation |
| User log metrics | 0 | 4 |
| Alert policies | 0 | 0 |
| Budgets | not readable | 403, no mutation |
| User-managed service-account keys | 0 | 0 |
| Workloads/buckets/tasks | 0 / 0 / 0 | 0 / 0 / 0 |

## IAM receipt

Added at project level to each of the four runtime boundaries:

- `roles/datastore.user`;
- `roles/logging.logWriter`.

Removed from `preview-functions-runtime`:

- `roles/logging.logWriter`;
- `roles/monitoring.metricWriter`.

Added at exact secret-resource level:

- idempotency secret → public intake runtime;
- HMAC secret → completion runtime;
- Gemini secret → conversation runtime.

No project-wide secret accessor, Owner, Editor, key admin, token creator, broad service-account user, deploy role, Storage role, Task role, or cross-environment binding was added. The session runtime consumes no secret. IP salt has no consumer in the audited flow.

## Identity naming deviation

`preview-discovery-session-runtime` and `preview-discovery-completion-runtime` exceed the service-account ID limit. They were materialized as `preview-discovery-session-rt` and `preview-discovery-complete-rt`, with the full logical names retained as display metadata. The four-way trust split was preserved.

## WIF receipt

The planned provider binds only repository `javiercl111-jpg/AuraControlCenter`, the current exact branch, GitHub environment `preview`, the exact environment subject, canonical provider audience, and `preview-deployer`, with a 900-second workflow token target. The persistent provider mutation was rejected by the execution security reviewer pending explicit approval of those exact conditions. No WIF resource or IAM binding exists.

## Secret receipt

The environment rejected generation/upload of the three internal values before execution because operator-supplied material through a secure channel is required. Gemini was not supplied. All four version counts remain zero. No value, temporary file, persistent environment variable, token, or key file was created.

## App Check receipt

No site key or domain list was supplied. No provider, enforcement, debug token or client configuration was changed. Debug-token count remains zero. Provider API read-back was unavailable; no mutation command was issued.

## Observability receipt

Created:

- `preview_discovery_runtime_errors`;
- `preview_secret_access_denials`;
- `preview_iam_policy_changes`;
- `preview_appcheck_rejections`.

The first combined metric attempt failed and removed partial retry state; the four simplified metrics were then created and verified. No threshold or notification channel was invented. Alert-policy count remains zero. Budget read returned 403, so USD 5 and USD 10 budget controls were not changed.

## Stop conditions reached

- exact WIF boundary lacks additional persistent-federation approval;
- all secrets have zero versions;
- App Check site key/domains/client are absent;
- alerts and budget receipts are absent;
- Preview telemetry is misclassified as `PRODUCTION` in production Node mode;
- completion invokes an out-of-scope PDF/Storage service;
- secret parameter-to-resource mapping is not defined for deploy;
- Firestore collection isolation cannot be enforced by the granted project role alone.

No Function deployment may proceed while any stop condition remains.

## Environment and scope receipt

| Environment | Result |
| --- | --- |
| Preview | only the API, identity, IAM, secret-binding and metric changes listed here |
| Staging | no mutation target; ACTIVE; unchanged read-back |
| Production | no mutation target; ACTIVE; `REMEDIATION_HOLD` |

Zero Functions, Cloud Run services, buckets, Tasks, Rule changes, permanent keys, code changes, commits, pushes or pull requests.

## Rollback

`NOT_EXECUTED_FOR_SUCCESSFUL_CHANGES`. The failed metric attempt cleaned its own partial state. Secret upload and WIF were rejected before execution.

If a later failure or architecture rejection requires rollback, a separate approval must remove exact secret bindings, the eight runtime project bindings, four metrics and four unused accounts, then evaluate STS disablement. Secret containers and fail-closed Rules remain. Staging and Production must never enter the rollback target list.

## Required handoff

Obtain exact WIF approval, GitHub Environment protection evidence, secure secret input, App Check provider/client metadata, budget access, alert thresholds/channels, and a separately authorized remediation for the three runtime code/config blockers. Then repeat positive/negative read-back before a deployment slice.

No commit, push, pull request, or Function deploy was performed.
