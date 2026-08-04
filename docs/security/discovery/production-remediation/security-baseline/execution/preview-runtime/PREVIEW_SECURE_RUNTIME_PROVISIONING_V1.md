# Preview Secure Runtime Provisioning V1

## Decision

**CONDITIONAL — RUNTIME SECRETS OR APP CHECK PENDING**

The minimum non-serving Preview control plane is present and verified. No backend workload was deployed and no traffic was enabled. WIF, secret values, App Check provider configuration, runtime-specific access, alert policies, and the R2A identity-boundary reconciliation remain open; therefore this record does not authorize a Discovery backend migration or any Production action.

## Change control

| Field | Value |
| --- | --- |
| Slice / change reference | `AI-02H1E.5.R2C-P` |
| Distinct operator Change ID | not supplied; the slice reference is the only authorization identifier recorded |
| Branch | `ops/intelligence-preview-secure-runtime-provisioning` |
| Gate HEAD | `64e2408567473c9ef12ac945cde21cc0f608c9b7` |
| Gate `origin/main` | `64e2408567473c9ef12ac945cde21cc0f608c9b7` |
| Target | Preview / `aura-intel-preview` only |
| Node | `v20.20.2` |
| npm | `10.8.2` |
| Final read-back | `2026-08-04T23:04:23Z` |
| Production control state | `REMEDIATION_HOLD` |

The gate confirmed the exact branch, clean worktree, `HEAD == origin/main`, required runtime versions, the explicit Preview alias, enabled billing, and the repository Production hold before any external write.

## Pre-state

- Preview was ACTIVE with billing enabled and Firebase membership.
- Firestore `(default)` already existed in `nam5`; this wave did not modify it or its Rules.
- Logging and Monitoring APIs were already enabled.
- The six valid runtime APIs enabled by this wave were disabled at pre-state.
- `iamcredentials.googleapis.com` and `sts.googleapis.com` were disabled at pre-state.
- Preview had no Firebase Web app, WIF pool, Secret Manager resources, Functions, Cloud Run services, Storage buckets, or Cloud Tasks.
- One automatic Firebase service account existed; no dedicated Preview runtime account existed.

## API disposition

The first attempted batch included the requested name `errorreporting.googleapis.com`. Service Usage rejected that name as unavailable and the batch failed atomically; read-back confirmed that attempt enabled none of its services.

The following six valid, allowlisted APIs were then enabled explicitly:

- `cloudfunctions.googleapis.com`
- `run.googleapis.com`
- `cloudbuild.googleapis.com`
- `artifactregistry.googleapis.com`
- `secretmanager.googleapis.com`
- `firebaseappcheck.googleapis.com`

`logging.googleapis.com` and `monitoring.googleapis.com` remained enabled from pre-state. `iamcredentials.googleapis.com` is enabled in final read-back although it was not named in the successful six-service command; it is recorded as an observed IAM dependency rather than silently claimed as an explicit WIF enablement. Audit attribution was unavailable. `sts.googleapis.com` remains disabled because no approved GitHub repository, ref/environment condition, audience, or WIF principal was supplied.

`errorreporting.googleapis.com` is not a valid available service name. No substitute was enabled. In particular, `clouderrorreporting.googleapis.com` remains disabled pending a separate approval or catalog correction.

Final read-back reported 49 enabled APIs in Preview. Pub/Sub and the Storage control-plane APIs are enabled in the project, but this wave created no Pub/Sub resource and no Storage bucket. Cloud Tasks and Eventarc remain disabled.

## Identities and IAM

Four requested service accounts were created with zero user-managed keys:

| Service account ID | Project bindings | Workload assignment | Disposition |
| --- | --- | --- | --- |
| `preview-functions-runtime` | `roles/logging.logWriter`, `roles/monitoring.metricWriter` | none | parked; observability only |
| `preview-deployer` | none | none | parked pending WIF and exact `actAs` targets |
| `preview-secret-accessor` | none | none | parked; no secret access granted |
| `preview-telemetry-writer` | `roles/logging.logWriter`, `roles/monitoring.metricWriter` | none | parked; observability only |

No `Owner`, `Editor`, project-wide secret accessor, token creator, or permanent key was added. Default compute was not selected as a runtime identity. The first IAM command failed because a non-conditional binding was not explicit; read-back proved zero change. Re-execution with `condition=None` applied only the four bindings shown above.

### R2A identity contradiction

The R2A baseline defines per-trust-boundary identities named `ai-prev-fn-*` and explicitly rejects a generic secret-accessor identity. The current slice requested the four broader names above. Creation of an unbound account does not resolve that architectural conflict. `preview-secret-accessor` therefore has no permissions, and `preview-functions-runtime` has no Firestore, secret, invoker, or deploy capability. Before workload deployment, architecture review must either map these accounts to an approved single boundary or replace them with the R2A per-path identities. This is a traffic and migration blocker, not a reason to grant broad roles.

The automatic `firebase-adminsdk-fbsvc` identity remains pending effective-permission review and was not reused.

## Secrets

The following Secret Manager containers were created with automatic replication and metadata labels only:

- `discovery-idempotency-secret-preview`
- `discovery-ip-hash-salt-preview`
- `discovery-hmac-secret-preview`
- `discovery-gemini-api-key-preview`

Each resource has exactly zero versions. No value was provided, printed, logged, committed, or passed through a CLI argument. No account has been granted access to any secret. Runtime-to-secret bindings remain blocked until the identity split is reconciled and the operator supplies each value through an approved secure channel.

The names also differ from the R2A naming catalog. A deploy-time mapping or approved rename decision is required before a consumer is configured.

## Firebase Web app and App Check

The Firebase Web app `Aura Intelligence Preview Web` was registered in Preview. Its full app identifier is excluded; the evidence fingerprint is:

```text
sha256:dbdeed4c9993004032dfa45b44e37ae53e70be1416dc19edf826b968a386d321
```

Final read-back found one Preview Web app and zero App Check debug tokens. The App Check API is enabled, but the reCAPTCHA Enterprise provider, approved domains/site key, client artifact, and enforcement are `NOT_CONFIGURED`. Enforcement was intentionally not enabled before a certified client exists. No debug exception was requested or created.

## WIF and impersonation

No WIF pool, provider, federation binding, impersonation binding, or token-exchange configuration was created. `preview-deployer` has no roles and no `serviceAccountUser` binding. This is deliberate: the exact GitHub organization/repository, ref or environment, audience, attribute condition, deploy runtime targets, owner, and approver receipts were not provided. Permanent service-account keys are prohibited and remain at zero.

## Storage decision

**A. DEFERRED — certify structured results without documents first.**

No bucket was created. The project-level Storage APIs being enabled does not change this decision. Any Functions deployment process that would create or use a source bucket must be reviewed in the backend migration wave; it is not implicitly authorized by this record.

## Runtime limits for the later deployment wave

These are fail-closed deployment inputs, not deployed settings:

| Control | Minimum Preview limit |
| --- | --- |
| Region | `us-central1` only |
| Minimum instances | `0` |
| Maximum instances | `2` per backend surface |
| Concurrency | `5` maximum until load evidence supports a change |
| Timeout | `15s` intake; `30s` session; `60s` AI/completion maximum |
| Memory | `256MiB` intake/session; `512MiB` AI/completion maximum without a new review |
| Ingress/traffic | no public traffic or unauthenticated invocation enabled automatically |
| Identity | explicit per-path runtime service account; never default compute |
| Logs | structured, bounded, no tokens, secret values, IP addresses, email, free-text payloads, or other PII |
| Cost guard | alert thresholds and notification routing required before traffic; not configured because amount, channel, and accountable owner were not supplied |

Logging and Monitoring are enabled, and the two observability identities have only log/metric write roles. No alerting policy, dashboard, SLO, uptime check, or billing budget was created.

## Read-back result

| Resource | Final state |
| --- | --- |
| Dedicated service accounts | 4 present; zero user-managed keys |
| Project IAM | four observability bindings only |
| Secret resources | 4 present; zero versions |
| Firebase Web apps | 1 present |
| App Check debug tokens | 0 |
| App Check provider/enforcement | not configured / not configured |
| WIF pools | 0 |
| Functions | 0 |
| Cloud Run services | 0 |
| Storage buckets | 0 |
| Cloud Tasks | 0; API disabled |
| Staging | ACTIVE; one automatic service account; Firestore `nam5`; 0 Functions, Run services, and buckets; no write target |
| Production | ACTIVE; no write target; `REMEDIATION_HOLD` |

## Deviations and limitations

- The requested Error Reporting API name is invalid and no substitute was authorized.
- `iamcredentials.googleapis.com` changed from disabled pre-state to enabled final state as an observed IAM dependency; audit attribution could not be obtained.
- The requested account model conflicts with R2A's per-path identity model; broad runtime or secret permissions were withheld.
- WIF, `actAs`, secret access, and secret values are pending.
- App Check provider, site key/domain approval, client integration, negative tests, metrics, and enforcement are pending.
- Budget amount, notification channel, accountable owner, alert policies, and receipts are pending.
- A distinct operational Change ID and nominal implementer/approver receipts were not supplied.
- No runtime limits can be verified remotely until a separately authorized backend deployment exists.

## Rollback status

`NOT_EXECUTED_NO_FAILURE`. No workload or traffic required containment. If architectural review rejects this shape, a separately authorized rollback must remove exact IAM bindings first, then unused app/secret/account resources, and only then consider API disablement after dependency analysis. This evidence does not authorize destructive rollback.

## Next authorized wave

Architecture and Security must reconcile the identity/naming conflict; approve the GitHub WIF subject and conditions; provide a distinct Change ID and role-based receipts; approve per-secret consumers and secure value injection; provide the Preview reCAPTCHA Enterprise configuration and domains; define budget/alert routing; and approve an exact no-traffic backend deployment manifest with the limits above. Storage remains deferred.

No Functions were deployed. No source code, Firestore Rules, Staging resource, Production resource, Cloud Task, or Storage bucket was changed. No commit, push, pull request, or deploy was performed.
