# Production Configuration Verification v1

**Program:** AI-02H1E.4.0 — Aura Intelligence Production Hardening Program

**Slice:** AI-02H1E.4.9 — Production Configuration Verification

**Repository:** AuraControlCenter

**Branch:** `audit/intelligence-public-intake-production-configuration`

**Certified base / HEAD / origin/main:** `a1b5a338251a636b143a013c96e186fd8b96441b`

**Audit date:** 2026-08-04

**Mode:** Read-only remote verification plus local evidence generation

## Executive result

**NOT READY — CRITICAL PRODUCTION CONFIGURATION GAPS**

The local Git/runtime gate passed. The production-candidate environment does not satisfy the P1–P8 operational contracts. The decisive findings are:

1. The latest Vercel Production frontend is READY at the certified HEAD, but every scoped backend Function was last updated on 2026-07-23/24, before P1–P8 merged on 2026-08-03/04. The certified hardening is not deployed in the backend.
2. Firestore has no TTL field configuration, including the required `discovery_intake_idempotency.expiresAt`; 49 idempotency documents already exist.
3. The public Firebase Web App has one App Check debug token. App Check provider/enforcement metadata could not be read because the API returned HTTP 403.
4. No active PRODUCTION containment policy, policy version, rollback pointer, or containment audit exists.
5. Cloud Monitoring has zero custom log metrics, zero alert policies, and zero dashboards. P0 alerting is absent.
6. Runtime limits are amplifying rather than containing: scoped Functions use concurrency 80/maxInstances 20, and the notification queue allows 500 dispatches/s with 1,000 concurrent dispatches.
7. The repository Rules grant any authenticated client write access to `platform_global_admins` and `platform_tenants`. Deployed Rules could not be retrieved, so current production authority safety is not established and the repository Rules must not be deployed.
8. Eight scoped Functions use the default compute service account, which has project `Editor` and access to all three scoped secrets.

This audit made zero external configuration changes and generated no production traffic.

## Gate

| Item | Required | Actual | Result |
|---|---|---|---|
| Branch | `audit/intelligence-public-intake-production-configuration` | Exact match | PASS |
| HEAD = origin/main | `a1b5a338...` | Exact match | PASS |
| Initial worktree | Clean | Clean | PASS |
| Node | `v20.20.2` | `v20.20.2` | PASS |
| npm | `10.8.2` | `10.8.2` | PASS |
| Firebase CLI | Available | `15.25.1` | PASS |
| gcloud CLI | Available | `578.0.0` | PASS |
| Vercel CLI | Available | `58.4.4` | PASS |

## Environments and project selection

| Environment | projectId | Firebase alias | Vercel | Functions | Storage | Runtime identity | Status | Risk |
|---|---|---|---|---|---|---|---|---|
| Production candidate | `aura-control-center-debb3` | `default` | `production` | `us-central1` | `aura-control-center-debb3.firebasestorage.app` | Default compute for 8/9 scoped functions | MISCONFIGURED | Implicit default selection and stale backend |
| Preview | Not declared | None | READY branch previews | Not declared | Not declared | Not declared | CONFIGURED BUT NOT VERIFIED | Preview may share production backend/data configuration |
| Staging | Not found | None | Not evidenced | Not found | Not found | Not found | MISSING | No governed promotion environment |

Firebase CLI selected `aura-control-center-debb3`, while the active gcloud configuration selected `aura-hcm`. Every GCP audit command therefore used an explicit production-candidate project. `functions/package.json` still exposes an unscoped `firebase deploy --only functions` script, and no repository deploy workflow supplies a reviewed project/promotion authority.

No real environment separation is evidenced. This is a P0 release blocker.

## App Check

Two active Web Apps exist: Aura Nexus Public and Aura Control Center. The public app has one registered debug token; the control-center app has none. The audit did not request token identifiers or values.

The App Check configuration API returned HTTP 403 for provider and enforcement metadata. Repository source requires App Check on the eight public callables through `enforceAppCheck: true` or an explicit `request.app` check; the notification task is an internal OIDC surface. Because the deployed backend predates the certified source, source inspection does not prove effective production enforcement.

| Surface | Repository control | Effective result |
|---|---|---|
| `createDiscoveryLead` | `enforceAppCheck: true` | UNKNOWN |
| `resolveAdvisorByCode` | `enforceAppCheck: true` | UNKNOWN |
| `exchangeDiscoveryToken` | Explicit App Check context required | UNKNOWN |
| `resolveDiscoverySession` | Explicit App Check context required | UNKNOWN |
| `evaluateConversation` | `enforceAppCheck: true` | UNKNOWN |
| `completeDiscoverySession` | Explicit App Check context required | UNKNOWN |
| `generateDiscoveryReport` | Explicit App Check context required | UNKNOWN |
| `requestExecutiveDocument` | Explicit App Check context required | UNKNOWN |
| `emitDiscoveryCompletedNotification` | Internal task/OIDC, not a public callable | PARTIAL |

Provider, Functions/Firestore/Storage enforcement, App Check failure metrics, Preview behavior, and replay/limited-use token posture remain unknown. The production debug token is independently a verified P0 blocker.

## Firestore

The `(default)` Native database is in multi-region `nam5`. Delete protection and point-in-time recovery are disabled; version retention is one hour.

### TTL and cardinality

Remote TTL field configuration count is zero. The required `discovery_intake_idempotency.expiresAt` TTL is therefore missing. Count-only aggregation found:

| Collection | Documents |
|---|---:|
| `discovery_intake_idempotency` | 49 |
| `discovery_abuse_telemetry_v1` | 0 |
| `discovery_abuse_metrics_v1` | 0 |
| `discovery_containment_active_v1` | 0 |
| `discovery_containment_policies_v1` | 0 |
| `discovery_containment_audit_v1` | 0 |
| `public_rate_limit_counters_v1` | 0 |
| `platform_rate_limits` | 0 |

No document IDs or payloads were retrieved. With no TTL and no cardinality metrics/alerts, retention growth is not operationally controlled.

### Indexes

Remote composite index count is zero and `firestore.indexes.json` is absent. Production query/index alignment, cleanup query bounds, and index drift are not certifiable.

### Rules

The Firebase Rules API returned HTTP 403, so the deployed Firestore and Storage releases cannot be hashed or compared.

Local `firestore.rules` is not safe to promote: it allows every authenticated client to read/write `platform_global_admins` and `platform_tenants`. It also allows market-authorized clients to write `market_discovery_links` and `discovery_sessions`, despite these being server-owned lifecycle records in the P1–P8 model. Unmatched rate-limit, idempotency, containment, capability, and telemetry collections are denied by default, but that does not offset the authority escalation paths.

The local Rules finding is P0. Production impact remains unknown rather than inferred because remote access was denied.

## Functions and runtime limits

All scoped functions are ACTIVE, Gen2, `nodejs20`, `us-central1`, 256 MiB, ingress `ALLOW_ALL`, and minInstances unset. No underlying Cloud Run service has an explicit public invoker binding.

| Function | Updated (UTC) | Runtime SA | Actual max/concurrency/timeout | Contract | Status |
|---|---|---|---|---|---|
| `createDiscoveryLead` | 2026-07-23 | default compute | 20 / 80 / 60s | 20 / 10 / 15s | MISCONFIGURED |
| `resolveAdvisorByCode` | 2026-07-23 | default compute | 20 / 80 / 60s | 20 / 10 / 15s | MISCONFIGURED |
| `exchangeDiscoveryToken` | 2026-07-23 | default compute | 20 / 80 / 60s | 20 / 10 / 15s | MISCONFIGURED |
| `resolveDiscoverySession` | 2026-07-23 | default compute | 20 / 80 / 60s | 20 / 10 / 15s | MISCONFIGURED |
| `evaluateConversation` | 2026-07-23 | default compute | 20 / 80 / 15s | 5 / 2 / 15s | MISCONFIGURED |
| `completeDiscoverySession` | 2026-07-24 | default compute | 20 / 80 / 60s | 10 / 2 / 30s | MISCONFIGURED |
| `generateDiscoveryReport` | 2026-07-23 | default compute | 20 / 80 / 60s | 3 / 1 / 120s | MISCONFIGURED |
| `requestExecutiveDocument` | 2026-07-23 | default compute | 20 / 80 / 60s | 10 / 10 / 20s | MISCONFIGURED |
| `emitDiscoveryCompletedNotification` | 2026-07-24 | notifier SA | 20 / 80 / 60s | 10 / 5 / 30s | MISCONFIGURED |

The merge timeline is later than every update time: P1–P7 merged on 2026-08-03 and P8 on 2026-08-04. Production backend provenance is therefore incompatible with the certified hardening baseline.

Remote environment-variable names contain legacy Discovery evaluation configuration; secret bindings are `IDEMPOTENCY_SECRET@1`, `IP_HASH_SALT@1`, and `GEMINI_API_KEY@2` only where declared. Values were not read.

## IAM and service accounts

- Eight scoped Functions use the default compute service account.
- Default compute, App Engine default, and Cloud Services service accounts hold project `Editor`.
- Default compute also holds Cloud Tasks enqueuer and can mint tokens for itself.
- One redacted personal principal holds permanent project `Owner`.
- One redacted personal principal has `serviceAccountUser` on the notifier account.
- The dedicated notifier account is used only by the notification Function in the scoped deployment metadata.
- User-managed service-account key counts could not be listed due access denial; persistent-key posture is a P0 unknown.

This is not a least-privilege production model and there is no evidenced operational break-glass workflow.

## Secret Manager and configuration

| Secret | Enabled versions | Deployed consumer | IAM accessor | Status |
|---|---|---|---|---|
| `GEMINI_API_KEY` | 1, 2 | `evaluateConversation` uses 2 | default compute | Present; access too broad; old enabled version needs owner decision |
| `IDEMPOTENCY_SECRET` | 1 | `createDiscoveryLead` | default compute | Present; access too broad |
| `IP_HASH_SALT` | 1 | `resolveAdvisorByCode` | default compute | Present; access too broad |

The tracked `.env` and `.env.example` expose Firebase configuration variable names. No values were included in evidence. One Firebase browser API key exists with restrictions metadata, but restriction contents/effective App Check association were not verified. No secret value was read.

## Kill switches and emergency quotas

`discovery_containment_active_v1/PRODUCTION` returns 404, and count-only queries found zero active pointers, policies, and audit records. None of the nine switches, blocked-subject lists, per-operation emergency quotas, environment/version/expiry, or rollback fields has effective production configuration.

The certified runtime fails closed when the policy is absent, but the deployed Functions predate P7. The actual live behavior must not be inferred without deployed source provenance or handler invocation; production handlers were not invoked.

## Cloud Tasks and notifications

Queue `emitDiscoveryCompletedNotification` is RUNNING in `us-central1` with:

- 500 dispatches per second;
- 1,000 concurrent dispatches;
- three attempts;
- 30–300 second backoff;
- two doublings.

Retry count/backoff align with the code contract, but rate/concurrency are far above a one-recipient completion flow and no backlog alert, DLQ/equivalent recovery evidence, or queue incident runbook exists.

Source uses a dedicated notifier service account and a fixed OIDC audience for `aura-maintenance-os`. The gateway has READY Production deployments from `main`. Gateway-side auth, audience allowlist, variables, provider quotas, and delivery observability were not verified. No task or gateway endpoint was invoked.

## Storage and signed URLs

No public IAM binding, public bucket ACL, or public default object ACL was found for the Firebase Storage bucket. This check did not list objects or object names.

The report bucket is `US-EAST1` regional storage with:

- Uniform Bucket-Level Access disabled;
- public access prevention inherited, not explicitly enforced at bucket metadata level;
- no lifecycle policy;
- no retention policy;
- seven-day soft delete;
- no bucket CORS configuration in returned metadata.

Repository code caps signed URLs at five minutes, within the proposed five-to-fifteen-minute range. Effective production TTL and signer permission are not verified because the deployed document Functions predate the certified code. No signed URL was generated.

## Logging, metrics, alerts, and budgets

| Control | Actual | Status |
|---|---|---|
| Default log retention | 30 days | VERIFIED |
| Required log retention | 400 days, locked | VERIFIED |
| User-defined log metrics | 0 | MISSING |
| Alert policies | 0 | MISSING — P0 |
| Dashboards | 0 | MISSING |
| Structured abuse telemetry documents | 0 | MISSING |
| Structured aggregate metric documents | 0 | MISSING |
| GCP billing link | Enabled | VERIFIED |
| GCP budget metadata | Access denied | UNKNOWN |
| Gemini/Vercel/notification budgets | No evidence | UNKNOWN |

There are no alerts for flooding, global quota, App Check failures, cost spikes, function errors/latency, Firestore conflicts, queue backlog, Storage growth, report failures, secret anomalies, or IAM changes.

## Vercel

Seven accessible projects were listed. `aura-control-center` reports Node `24.x`, while the audit baseline is Node 20.20.2. The latest Production deployment is READY from `main` at `a1b5a338...`. READY Preview deployments exist for the P8 test branch and P5–P7 feature branches; automatic branch deployment is therefore active.

No local `.vercel/project.json` exists. The audit did not create a link. Environment variable names/targets, deployment protection, Git authorization policy, and whether Preview receives production Firebase configuration remain unknown. The verified frontend/backend version split is a critical compatibility and controls drift.

## Runbooks, incident response, rollback, and break-glass

The only matching operational section is the future trusted-operator runbook in `KILL_SWITCHES_AND_EMERGENCY_QUOTAS_V1.md`, which explicitly states that no production control plane exists. Dedicated procedures were not found for:

- abuse/App Check incident;
- token compromise;
- quota exhaustion and cost spike;
- Firestore recovery/rollback;
- queue backlog;
- secret rotation;
- IAM revocation;
- break-glass;
- escalation/contact routing.

Runbooks and incident response are MISSING; containment rollback is MISSING in production; break-glass is MISSING.

## Drift summary

| Drift class | Critical finding |
|---|---|
| Code drift | Vercel frontend at HEAD; Functions deployed before P1–P8 |
| Config drift | TTL, containment, alerts, dashboards, and metrics absent; runtime/queue limits exceed contracts |
| IAM drift | Default compute + Editor + broad secret access; permanent personal privileged access |
| Environment drift | No staging; Preview backend isolation unknown; Firebase/gcloud default projects disagree |
| Documentation drift | Local rules conflict with authority trust model; no versioned index manifest; runbooks incomplete |
| Access unknown | App Check enforcement/provider, deployed Rules, service-account keys, budgets, Vercel env/protection |

The complete row-level matrix is in `PRODUCTION_CONFIGURATION_MATRIX_V1.json`; blocking remediation is in `PRODUCTION_CONFIGURATION_BLOCKERS_V1.md`; evidence commands and limitations are in `PRODUCTION_CONFIGURATION_EVIDENCE_INDEX_V1.md`.

## Verification still required after remediation

1. Read and hash deployed Rules before any Rules change.
2. Prove zero user-managed service-account keys.
3. Verify App Check provider/enforcement/debug-token state and metrics.
4. Establish separate Preview/Staging/Production resources and promotion authority.
5. Close IAM, TTL, containment, runtime/queue bounds, Storage, alerts, and runbooks through separately authorized changes.
6. Promote an approved backend release and prove commit provenance.
7. Repeat P9 remote read-back plus P8, Authority D.9, Dark Handler D.8, and both builds from a clean worktree.

## Local regressions and builds

| Command | Result |
|---|---|
| `npm.cmd run test:public-intake-abuse-certification` | PASS after one timeout-only retry; P8 33/33, P2 17/17, P3 24/24, P4 29/29, P5 34/34, P6 25/25, P7 36/36, D.9 40/40, D.8 81/81 |
| `npm.cmd run test:firestore-authority-end-to-end-emulator` | PASS 40/40 |
| `npm.cmd run test:authority-dark-handler-composition` | PASS 81/81 |
| `npm.cmd run build --prefix functions` | PASS |
| `npm.cmd run build` | PASS |

The first P8 invocation hit the command wrapper's 244-second timeout before producing buffered output. Its single workspace-owned Firestore Emulator process was identified, stopped, and all certification ports were verified free. The exact command then completed successfully in 185.6 seconds with the counts above. No assertion failed. Vite emitted non-failing future config-loader, dynamic-import, and chunk-size warnings.

## Final local integrity

- `PRODUCTION_CONFIGURATION_MATRIX_V1.json` parses successfully and every control uses the allowed status vocabulary.
- The evidence bundle contains no prohibited positive readiness verdict, secret value, personal identity, production payload, signed URL, or access token.
- A dedicated scan found no trailing whitespace in the four new files.
- `git diff --check` passed.
- Regenerable `functions/lib` outputs were restored/removed after build verification.
- Final worktree scope is exactly the four untracked documentation files under `docs/security/discovery/production-verification/`.

No commit, push, pull request, deployment, production invocation, or external configuration mutation was performed.
