# Non-Production Base Provisioning Evidence Index v1

**Slice:** AI-02H1E.5.R1C-B1

**Capture window:** `2026-08-04T19:55:33.7430079Z`–`2026-08-04T19:56:16.0054339Z`

**Sanitization:** project numbers omitted; organization and billing IDs partially masked; no tokens, principals, emails, UIDs, payloads, object names or local absolute paths retained

**Supplemental closure evidence:** operator-provided read-only `firebase projects:list --json` result; only the two required project IDs and their membership result are retained

## Evidence register

| Evidence ID | Environment | Read-only source | Sanitized result | Authority | Status |
|---|---|---|---|---|---|
| EV-GATE | Local | Git, Node and npm version/read-only commands | Branch `ops/intelligence-nonprod-provisioning-preflight`; HEAD `19a3a45…`; clean initial worktree; Node/npm exact | Local authoritative | PASS |
| EV-PREVIEW-PROJECT | Preview | `gcloud projects describe aura-intel-preview` | ACTIVE, expected display, organization `876******321`, labels, create timestamp; project number redacted | Cloud Resource Manager authoritative | PASS |
| EV-PREVIEW-BILLING | Preview | `gcloud billing projects describe aura-intel-preview` | billing enabled; `01E**************793` | Cloud Billing authoritative | PASS |
| EV-PREVIEW-FIREBASE | Preview | Operator-provided `firebase projects:list --json` result | Exact project ID `aura-intel-preview` confirmed; no full dump retained | Firebase CLI read-only membership evidence | PASS / `CREATED_AND_VERIFIED` |
| EV-PREVIEW-FIRESTORE | Preview | `gcloud firestore databases describe --database=(default) --project=aura-intel-preview` | `nam5`, native, Standard, delete protection enabled, PITR disabled, timestamps | Firestore authoritative | PASS |
| EV-PREVIEW-APIS | Preview | `gcloud services list --enabled --project=aura-intel-preview` | 37 sorted service names | Service Usage authoritative | PASS |
| EV-PREVIEW-RESOURCES | Preview | Storage/IAM/Functions/Run/Tasks list commands | 0 buckets; one automatic Firebase SA; 0 dedicated SAs; Functions/Run/Tasks APIs disabled | Respective service metadata | PASS/NOT_CONFIGURED |
| EV-PREVIEW-DEFERRED | Preview | Scope/change record | Rules/indexes/TTL/Auth/App Check/secrets/WIF not part of verified base wave | Scope evidence, not remote absence proof | DEFERRED |
| EV-STAGING-PROJECT | Staging | `gcloud projects describe aura-intel-staging` | ACTIVE, expected display, organization `876******321`, labels, create timestamp; project number redacted | Cloud Resource Manager authoritative | PASS |
| EV-STAGING-BILLING | Staging | `gcloud billing projects describe aura-intel-staging` | billing enabled; `01E**************793` | Cloud Billing authoritative | PASS |
| EV-STAGING-FIREBASE | Staging | Operator-provided `firebase projects:list --json` result | Exact project ID `aura-intel-staging` confirmed; no full dump retained | Firebase CLI read-only membership evidence | PASS / `CREATED_AND_VERIFIED` |
| EV-STAGING-FIRESTORE | Staging | `gcloud firestore databases describe --database=(default) --project=aura-intel-staging` plus supplied Change ID | `nam5`, native, Standard, delete protection enabled, PITR disabled, timestamps; associated with `AI-02H1E.5.R1C-B-STAGING-FIRESTORE-20260804-01` | Firestore authoritative plus operator change association | PASS / `CREATED_AND_VERIFIED` |
| EV-STAGING-APIS | Staging | `gcloud services list --enabled --project=aura-intel-staging` | Same 37 sorted service names | Service Usage authoritative | PASS |
| EV-STAGING-RESOURCES | Staging | Storage/IAM/Functions/Run/Tasks list commands | 0 buckets; one automatic Firebase SA; 0 dedicated SAs; Functions/Run/Tasks APIs disabled | Respective service metadata | PASS/NOT_CONFIGURED |
| EV-STAGING-DEFERRED | Staging | Scope/change record | Rules/indexes/TTL/Auth/App Check/secrets/WIF not part of verified base wave | Scope evidence, not remote absence proof | DEFERRED |
| EV-CHANGE-RECORDS | Both | User-supplied Change IDs | Two project records plus the Preview and Staging Firestore records; all four are associated | Handoff evidence | PASS |
| EV-PRODUCTION-SCOPE | Production | User-confirmed state + command target audit | No read-back command targeted Production; state confirmed unchanged/hold | Scope evidence; no new remote read | UNCHANGED |

## Command outcomes

| Command family | Preview | Staging | Mutation |
|---|---|---|---|
| Project describe | PASS | PASS | None |
| Billing project describe | PASS | PASS | None |
| Firebase CLI project inventory | PASS; exact project ID confirmed by operator-provided output | PASS; exact project ID confirmed by operator-provided output | None; full dump not retained |
| Firebase Management project GET | Earlier supplemental attempt: PERMISSION_DENIED | Earlier supplemental attempt: PERMISSION_DENIED | None; superseded for membership certification by CLI evidence |
| Firestore database describe | PASS | PASS | None |
| Enabled services list | PASS | PASS | None |
| Bucket list | PASS, count 0 | PASS, count 0 | None |
| Service-account list | PASS, count 1 automatic | PASS, count 1 automatic | None |
| Functions list | SERVICE_DISABLED | SERVICE_DISABLED | None; API not enabled |
| Cloud Run list | SERVICE_DISABLED | SERVICE_DISABLED | None; API not enabled |
| Cloud Tasks list | SERVICE_DISABLED | SERVICE_DISABLED | None; API not enabled |

## Sanitization checks

- Billing Account: only masked reference.
- Organization: only masked reference.
- Project numbers: `REDACTED`.
- Service accounts: logical ID only; no email or project number.
- Firebase API responses: no raw error, token or resources emitted.
- Firestore: database metadata only; no documents or counts queried.
- Storage: bucket count/list only; zero objects queried.
- No production invocation, application traffic or write command.

## Non-blocking observations

1. The automatic `firebase-adminsdk-fbsvc` service account in each project remains pending IAM review.
2. The 37 enabled APIs remain pending classification in the security baseline.
3. PITR remains disabled on both databases pending an approved recovery policy before data-bearing work.
4. Nominal implementer/approver receipts and restricted raw evidence hashes remain pending governance.

These observations do not block verification of the base provisioning scope and do not authorize a compensating write, permission change or additional provisioning.
