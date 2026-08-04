# Production Configuration Evidence Index v1

**Slice:** AI-02H1E.4.9

**Collection window:** 2026-08-04, America/Mexico_City

**Target project:** `aura-control-center-debb3`

**Handling:** metadata only; personal identities redacted; no secret values, access tokens, object names, payloads, or production log entries retained.

All Google Cloud queries after project discovery used an explicit `--project=aura-control-center-debb3` or a fully qualified project URI. Access tokens used for REST metadata calls existed only in process memory and were cleared before command completion.

| Evidence | Timestamp | Environment | Command / source | Redacted output summary | Result | Limitation |
|---|---|---|---|---|---|---|
| EV-01 | 2026-08-04T10:08:00-06:00 | Local repository | `Get-Content .firebaserc,firebase.json,vercel.json`; `git ls-files .env*`; `rg` over workflows/config | One Firebase `default` alias; no staging/preview alias; no `.vercel/project.json`; tracked `.env` names only; no deploy workflow | VERIFIED | Environment values and secret-like values were not read or retained |
| EV-02 | 2026-08-04T10:09:00-06:00 | Firebase/GCP account context | `firebase use`; `firebase projects:list`; `gcloud config get-value project` | Firebase selects `aura-control-center-debb3`; five accessible Firebase projects; active gcloud project is `aura-hcm` | VERIFIED | Identity/account value redacted; project inventory does not establish environment ownership |
| EV-03 | 2026-08-04T10:12:00-06:00 | Firebase Production candidate | Firebase Management/App Check metadata GETs | Two active Web Apps; public app has one debug token; control-center app has zero | VERIFIED | Debug token identifiers and values were not requested or emitted |
| EV-04 | 2026-08-04T10:13:00-06:00 | Firebase Production candidate | App Check service/provider REST GETs for Functions, Run, Firestore, Storage, Identity Toolkit, reCAPTCHA Enterprise/v3 | Every configuration query returned HTTP 403 | UNKNOWN DUE TO ACCESS LIMITATION | Provider, enforcement, metrics, and replay protection remain unknown |
| EV-05 | 2026-08-04T10:10:00-06:00 | Firestore `(default)` | `gcloud firestore databases describe`; `gcloud firestore fields ttls list` | Native Firestore in `nam5`; delete protection OFF; PITR OFF; one-hour version retention; TTL count zero | VERIFIED | TTL lag cannot exist as a metric until TTL is configured |
| EV-06 | 2026-08-04T10:11:00-06:00 | Firestore `(default)` | `gcloud firestore indexes composite list` | Composite index count zero | VERIFIED | Query execution plans were not invoked in production |
| EV-07 | 2026-08-04T10:28:00-06:00 | Local repository | `rg`/`Get-Content` on `firestore.rules` and `storage.rules` | Local Rules allow authenticated writes to `platform_global_admins` and `platform_tenants`; unmatched idempotency/containment collections are denied by default | VERIFIED | This is repository state, not proof of the deployed ruleset |
| EV-08 | 2026-08-04T10:19:00-06:00 | Firebase Rules | `GET firebaserules.googleapis.com/v1/projects/.../releases` with in-memory token | HTTP 403 | UNKNOWN DUE TO ACCESS LIMITATION | No release name, ruleset source, or local/remote hash could be verified |
| EV-09 | 2026-08-04T10:26:00-06:00 | Cloud Functions Production candidate | `gcloud functions list --v2 --regions=us-central1 --project=... --format=json` with sanitized projection | Nine scoped Functions ACTIVE, Gen2/nodejs20/us-central1; eight use default compute; max 20/concurrency 80; update dates 2026-07-23/24; secret names/versions only | VERIFIED | Deployed source commit is not exposed by this metadata; update dates prove it predates P1-P8 merges |
| EV-10 | 2026-08-04T10:27:00-06:00 | Cloud Run backing services | `gcloud run services get-iam-policy` for nine services | Zero service-level IAM bindings; no explicit `allUsers` or `allAuthenticatedUsers` | VERIFIED | Organization/project inherited controls were assessed separately; callable protocol exposure is not equivalent to an IAM public binding |
| EV-11 | 2026-08-04T10:15:00-06:00 | GCP IAM | `gcloud projects get-iam-policy`; `gcloud iam service-accounts list` with personal identities redacted | One personal Owner; three default service accounts with Editor; default compute has Cloud Tasks enqueuer; dedicated notifier account exists | VERIFIED | Effective permissions were not expanded into every transitive API permission |
| EV-12 | 2026-08-04T10:24:00-06:00 | Service-account IAM | `gcloud iam service-accounts get-iam-policy`; `keys list` | Compute can mint its own tokens; one personal principal can act as notifier; user-managed key counts denied for all four accounts | PARTIAL | Persistent-key posture is unknown due access denial; no key IDs were requested |
| EV-13 | 2026-08-04T10:23:00-06:00 | Secret Manager | `gcloud secrets list`; `versions list`; `get-iam-policy` | Three secrets found; four enabled versions total; all accessible by default compute; no values read | VERIFIED | Secret owner/rotation tickets are not represented in service metadata |
| EV-14 | 2026-08-04T10:19:00-06:00 | Firestore containment | REST GET of `discovery_containment_active_v1/PRODUCTION` with in-memory token | HTTP 404 for active pointer | MISSING | No writes or fallback environment guesses were attempted |
| EV-15 | 2026-08-04T10:21:00-06:00 | Firestore technical collections | `documents:runAggregationQuery` count-only queries | Telemetry 0; metrics 0; containment active/policy/audit 0; idempotency 49; rate-limit root collections 0 | VERIFIED | Counts do not reveal document IDs or payloads; subcollection-specific state was not enumerated |
| EV-16 | 2026-08-04T10:17:00-06:00 | Cloud Tasks / notification source | `gcloud tasks queues list --location=us-central1`; local source inspection | One RUNNING queue; 500/s, 1,000 concurrent; three attempts and bounded backoff; fixed notifier identity/audience in source | VERIFIED | No task was listed or invoked; gateway-side authentication remains unverified |
| EV-17 | 2026-08-04T10:23:00-06:00 | Cloud Storage | `gcloud storage buckets list/describe/get-iam-policy`; sanitized bucket/default ACL projection | Three buckets; no public bindings/ACL principals; report bucket UBLA false, PAP inherited, no lifecycle/retention, seven-day soft delete | VERIFIED | Object names and per-object ACLs were not listed; prevention is not enforced at bucket metadata level |
| EV-18 | 2026-08-04T10:20:00-06:00 | Cloud Logging/Monitoring/Billing | `gcloud logging metrics/buckets list`; `monitoring policies/dashboards list`; `billing projects describe`; budget list | Metrics 0, alerts 0, dashboards 0; log retention 30/400 days; billing enabled; budget list denied | PARTIAL | Provider budgets and budget thresholds remain unknown |
| EV-19 | 2026-08-04T10:25:00-06:00 | Vercel | `vercel project ls --json`; `vercel list aura-control-center --format=json`; `--environment=production` | Seven projects; aura-control-center Node 24.x; Production READY at HEAD/main; READY Preview deployments for feature/test branches | VERIFIED | Deployment protection and environment variables by target were unavailable without a project link; no local link was created |
| EV-20 | 2026-08-04T10:26:00-06:00 | Vercel notification gateway / local env | `vercel list aura-maintenance-os --format=json`; tracked env-name inventory | Gateway has READY main Production deployments; local Firebase env variable names inventoried | PARTIAL | Vercel env values were not read; env names/targets and gateway auth configuration remain unknown |
| EV-21 | 2026-08-04T10:22:00-06:00 | Repository governance | `git log --first-parent`; runbook/headings search; contract/source inspection | P1-P8 merged 2026-08-03/04; only future containment runbook found; signed URL code policy is five minutes | VERIFIED | Repository intent is not evidence of production deployment |
| EV-22 | 2026-08-04T10:24:00-06:00 | API key metadata | `gcloud services api-keys list` with restrictions summarized and key material omitted | One Firebase browser key exists with configured restrictions metadata | CONFIGURED BUT NOT VERIFIED | Restriction contents and effective App Check provider association were not exposed |
| EV-23 | 2026-08-04T10:46:00-06:00 | Local regressions | `npm.cmd run test:public-intake-abuse-certification`; independent D.9/D.8 commands | First P8 wrapper attempt timed out at 244s and left one workspace Emulator process, which was identified and stopped; clean retry PASS: P8 33/33, P2 17/17, P3 24/24, P4 29/29, P5 34/34, P6 25/25, P7 36/36, D.9 40/40, D.8 81/81; independent D.9 40/40 and D.8 81/81 PASS | VERIFIED | Vite emitted non-failing future config-loader warnings |
| EV-24 | 2026-08-04T10:47:00-06:00 | Local builds | `npm.cmd run build --prefix functions`; `npm.cmd run build` | Functions build PASS; frontend TypeScript/Vite/PWA build PASS | VERIFIED | Frontend emitted non-failing dynamic-import and chunk-size warnings |
| EV-25 | 2026-08-04T10:50:00-06:00 | Local integrity | JSON parse/schema checks; forbidden-string scan; trailing-whitespace scan; `git diff --check`; `git status --short --untracked-files=all` | Matrix parses; statuses are allowlisted; no prohibited verdict phrase; no trailing whitespace; diff check PASS; only four evidence files remain untracked | VERIFIED | `git diff --check` does not include untracked files, so a separate trailing-whitespace scan covered the evidence directory |

## Gate evidence

| Check | Result |
|---|---|
| Branch | `audit/intelligence-public-intake-production-configuration` |
| HEAD | `a1b5a338251a636b143a013c96e186fd8b96441b` |
| origin/main | `a1b5a338251a636b143a013c96e186fd8b96441b` |
| Initial worktree | Clean |
| Node | `v20.20.2` via `C:\nvm4w\nodejs\node.exe --version` |
| npm | `10.8.2` via `C:\nvm4w\nodejs\npm.cmd --version` |
| Firebase CLI | `15.25.1` |
| gcloud CLI | `578.0.0` |
| Vercel CLI | `58.4.4` |

## Evidence exclusions

- No secret, API key, debug token, access token, refresh token, private key, signed URL, personal email, personal UID, production payload, log entry, or object name is present in this bundle.
- No production handler, task, Auth endpoint, or signed-URL generator was invoked.
- No external write command was executed.
- Local tests/builds generated only regenerable ignored artifacts; the P8 runner removed its Emulator log/generated directory.
