# Preview Secure Runtime Evidence Index V1

## Control record

- Slice / change reference: `AI-02H1E.5.R2C-P`
- Target: Preview / `aura-intel-preview`
- Final read-back: `2026-08-04T23:04:23Z`
- Verdict: **CONDITIONAL — RUNTIME SECRETS OR APP CHECK PENDING**
- Raw cloud responses, credentials, account identities, project numbers, app identifiers, secret values, and tokens are not stored in this evidence set.

## Evidence set

| Evidence ID | Source / sanitized command family | Sanitized result | Assessment |
| --- | --- | --- | --- |
| EV-GATE-GIT | branch, revisions, status, last commit | exact branch; gate HEAD equals `origin/main`; clean pre-change worktree | PASS |
| EV-GATE-RUNTIME | required Node and npm binaries | Node `v20.20.2`; npm `10.8.2` | PASS |
| EV-GATE-TARGET | Firebase aliases, project metadata, billing read-back, R2B hold record | exact Preview target; billing enabled; Production hold present | PASS |
| EV-API-PRE | Service Usage enabled-list before writes | logging/monitoring enabled; six valid runtime APIs, IAM Credentials, and STS disabled | PASS |
| EV-API-INVALID | attempted Service Usage batch containing `errorreporting.googleapis.com` | invalid service name; batch rejected atomically; follow-up read-back showed no enablement from the failed batch | PASS / NO CHANGE |
| EV-API-POST | Service Usage enabled-list after writes | six valid runtime APIs enabled; IAM Credentials observed enabled; STS disabled; 49 enabled APIs total | CONDITIONAL |
| EV-IDENTITIES | service-account list | four requested dedicated account IDs present | PASS |
| EV-KEYS | user-managed key list for each dedicated account | 0 for all four | PASS |
| EV-IAM | project IAM policy filtered to the four dedicated accounts | runtime and telemetry each have log/metric writer; deployer and accessor have no roles | PASS / PARKED |
| EV-SECRETS | Secret Manager describe and versions list | four expected containers; automatic replication; zero versions | PASS / VALUES PENDING |
| EV-FIREBASE-APP | Firebase Web app list | one app named `Aura Intelligence Preview Web`; identifier retained only as SHA-256 fingerprint | PASS |
| EV-APP-CHECK | API state plus debug-token list | API enabled; 0 debug tokens; provider and enforcement not configured | CONDITIONAL |
| EV-WIF | WIF pool list plus IAM read-back | 0 pools/providers and no impersonation binding | DEFERRED |
| EV-WORKLOADS | Functions v2 and Cloud Run service lists | 0 Functions; 0 Cloud Run services | PASS |
| EV-STORAGE | bucket list | 0 buckets; formal decision `DEFERRED` | PASS |
| EV-TASKS | Service Usage state | Cloud Tasks API disabled; 0 queues/resources created by this wave | PASS |
| EV-STAGING | project, Firestore, service-account and workload read-back | ACTIVE; base Firestore unchanged; one automatic account; no Functions/Run/buckets; no mutation target | PASS / UNCHANGED |
| EV-PRODUCTION | project metadata plus repository hold record | ACTIVE; no mutation target; `REMEDIATION_HOLD` | PASS / UNCHANGED |
| EV-SANITIZATION | repository evidence scan | no raw secret, token, email, project number, app identifier, or local absolute path intended | PENDING FINAL REPOSITORY VALIDATION |

## Command catalog

Only the following command families were executed against cloud state:

- read-only `gcloud projects describe`, `gcloud billing projects describe`, and Service Usage lists;
- `gcloud services enable` for the six valid allowlisted APIs;
- `gcloud iam service-accounts create/list` and user-managed-key lists;
- `gcloud projects add-iam-policy-binding/get-iam-policy` for four observability bindings;
- `gcloud secrets create/describe` and versions lists, with no version-add command;
- `firebase apps:create/list` for the one Preview Web app;
- read-only App Check debug-token list;
- read-only WIF, Functions, Cloud Run, bucket, Firestore, and environment queries.

No general Firebase deploy, Functions deploy, Cloud Run deploy, Storage creation, Cloud Tasks creation, Rules write, WIF creation, key creation, secret-version upload, App Check provider/enforcement write, Staging write, or Production write was executed.

## Evidence limitations

- Service Usage audit attribution was unavailable, so the transition of `iamcredentials.googleapis.com` is recorded as an observed IAM dependency rather than attributed to a specific sub-operation.
- The app ID is intentionally represented only by `sha256:dbdeed4c9993004032dfa45b44e37ae53e70be1416dc19edf826b968a386d321`.
- No provider read-back exists because no App Check provider was configured.
- No effective runtime permission test exists because no workload was deployed.
- No WIF exchange or negative claim test exists because the required trust inputs were not supplied.
- No secret access test exists because every secret has zero versions and no consumer binding.
- Nominal implementer/approver receipts and a distinct operational Change ID remain governance gaps.

## Related documents

| Document | Purpose |
| --- | --- |
| `PREVIEW_SECURE_RUNTIME_PROVISIONING_V1.md` | narrative execution, decisions, deviations, limits, and next wave |
| `PREVIEW_SECURE_RUNTIME_MATRIX_V1.json` | machine-readable resource matrix and final scope |
| `PREVIEW_SECURE_RUNTIME_CHANGE_RECORD_V1.md` | change receipt, mutations, rollback state, and approvals gap |

This evidence set authorizes no workload deployment or traffic enablement. Storage remains deferred; Staging and Production remain outside the write scope.
