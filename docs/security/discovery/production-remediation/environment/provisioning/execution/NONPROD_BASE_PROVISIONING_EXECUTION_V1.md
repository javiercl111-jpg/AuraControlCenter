# Non-Production Base Provisioning Execution Evidence v1

**Programa:** AI-02H1E.5.0 — Production Readiness Remediation Program

**Slice:** AI-02H1E.5.R1C-B1 — Non-Production Base Provisioning Evidence

**Evidence cutoff:** `2026-08-04T19:56:16.0054339Z`

**Mode:** read-only metadata verification and local documentation

**Dictamen:** **NON-PRODUCTION BASE PROVISIONING VERIFIED — READY FOR SECURITY BASELINE DESIGN**

## 1. Scope

This evidence package records the externally completed base wave for Preview and Staging. R1C-B1 did not create, update or delete any cloud resource; enable an API; change billing/IAM; or deploy code.

The read-back covered project metadata, organization parent, labels, billing, Firebase membership, Firestore, enabled APIs, buckets, service accounts, Functions, Cloud Run and Cloud Tasks. Prompts were disabled. A disabled API remained disabled and was classified `NOT_CONFIGURED`.

## 2. Git/runtime gate

| Control | Actual | Result |
|---|---|---|
| Branch | `ops/intelligence-nonprod-provisioning-preflight` | PASS |
| HEAD | `19a3a45c6d5813c27f43ace99ee7dbe588705645` | Recorded |
| origin/main | `f3ed700de88192041c28f208064b3f446f656e51` | Branch is one preflight-document commit ahead |
| Worktree initial | Clean | PASS |
| Preserved R1C-A docs | Commit `19a3a45` contains exactly the four preflight documents | PASS |
| Node | `v20.20.2` | PASS |
| npm | `10.8.2` | PASS |

No previous documentation was reset, removed or rewritten.

## 3. Sanitized commands executed

Executed for both exact project IDs unless noted:

```text
gcloud projects describe <PROJECT_ID>
gcloud billing projects describe <PROJECT_ID>
firebase projects:list --json, filtered to exact project IDs
GET firebase.googleapis.com/v1beta1/projects/<PROJECT_ID>
gcloud firestore databases describe --database=(default) --project=<PROJECT_ID>
gcloud services list --enabled --project=<PROJECT_ID>
gcloud storage buckets list --project=<PROJECT_ID>
gcloud iam service-accounts list --project=<PROJECT_ID>
gcloud functions list --v2 --regions=us-central1 --project=<PROJECT_ID>
gcloud run services list --region=us-central1 --project=<PROJECT_ID>
gcloud tasks queues list --location=us-central1 --project=<PROJECT_ID>
```

For evidence closure, the operator supplied the read-only result of `firebase projects:list --json`. The sanitized result confirms the exact project IDs `aura-intel-preview` and `aura-intel-staging` as Firebase projects. No complete dump, principal, email, token, project number or other sensitive field was retained. The earlier supplemental Firebase Management GET returned `PERMISSION_DENIED` for both projects; that read-path limitation did not require a permission or API change and is superseded for membership certification by the operator-provided CLI evidence.

## 4. Preview read-back

| Resource | Actual | Status |
|---|---|---|
| Project | `aura-intel-preview`, display `Aura Intelligence Preview`, ACTIVE | `CREATED_AND_VERIFIED` |
| Created | `2026-08-04T19:22:51.349Z` | Evidence timestamp |
| Parent | organization `876******321` | `CREATED_AND_VERIFIED` |
| Labels | environment=preview, firebase=enabled, firebase-core=disabled, managed-by=readiness-program, product=aura-intelligence | `CREATED_AND_VERIFIED` |
| Billing | Enabled, account `01E**************793` | `CREATED_AND_VERIFIED` |
| Firebase | Operator-provided sanitized `firebase projects:list --json` output confirms project ID `aura-intel-preview`; no full dump retained | `CREATED_AND_VERIFIED` |
| Firestore | `(default)`, `nam5`, `FIRESTORE_NATIVE`, `STANDARD` | `CREATED_AND_VERIFIED` |
| Firestore created | `2026-08-04T19:47:51.388611Z` | Evidence timestamp |
| Delete protection | `DELETE_PROTECTION_ENABLED` | `CREATED_AND_VERIFIED` |
| PITR | `POINT_IN_TIME_RECOVERY_DISABLED` | `CREATED_AND_VERIFIED` |
| Enabled APIs | 37; exact inventory in matrix | `CREATED_AND_VERIFIED` |
| Buckets | 0 | `NOT_CONFIGURED` |
| Automatic Firebase SA | One: logical ID `firebase-adminsdk-fbsvc` | `CREATED_AND_VERIFIED` |
| Dedicated/additional SAs | 0 | `NOT_CONFIGURED` |
| Functions | API disabled; zero resources enumerated | `NOT_CONFIGURED` |
| Cloud Run | API disabled; zero resources enumerated | `NOT_CONFIGURED` |
| Cloud Tasks | API disabled; zero resources enumerated | `NOT_CONFIGURED` |

## 5. Staging read-back

| Resource | Actual | Status |
|---|---|---|
| Project | `aura-intel-staging`, display `Aura Intelligence Staging`, ACTIVE | `CREATED_AND_VERIFIED` |
| Created | `2026-08-04T19:35:58.750Z` | Evidence timestamp |
| Parent | organization `876******321` | `CREATED_AND_VERIFIED` |
| Labels | environment=staging, firebase=enabled, firebase-core=disabled, managed-by=readiness-program, product=aura-intelligence | `CREATED_AND_VERIFIED` |
| Billing | Enabled, account `01E**************793` | `CREATED_AND_VERIFIED` |
| Firebase | Operator-provided sanitized `firebase projects:list --json` output confirms project ID `aura-intel-staging`; no full dump retained | `CREATED_AND_VERIFIED` |
| Firestore | `(default)`, `nam5`, `FIRESTORE_NATIVE`, `STANDARD` | `CREATED_AND_VERIFIED` |
| Firestore created | `2026-08-04T19:51:08.828981Z` | Evidence timestamp |
| Delete protection | `DELETE_PROTECTION_ENABLED` | `CREATED_AND_VERIFIED` |
| PITR | `POINT_IN_TIME_RECOVERY_DISABLED` | `CREATED_AND_VERIFIED` |
| Enabled APIs | 37; same exact inventory as Preview | `CREATED_AND_VERIFIED` |
| Buckets | 0 | `NOT_CONFIGURED` |
| Automatic Firebase SA | One: logical ID `firebase-adminsdk-fbsvc` | `CREATED_AND_VERIFIED` |
| Dedicated/additional SAs | 0 | `NOT_CONFIGURED` |
| Functions | API disabled; zero resources enumerated | `NOT_CONFIGURED` |
| Cloud Run | API disabled; zero resources enumerated | `NOT_CONFIGURED` |
| Cloud Tasks | API disabled; zero resources enumerated | `NOT_CONFIGURED` |

## 6. Enabled API inventory

Both projects returned the same 37 services. The base includes Firebase/Firestore/Auth/Storage/Logging/Monitoring dependencies and several platform-default analytics/data services. It does not include Cloud Functions, Cloud Run, Cloud Tasks, Secret Manager, Artifact Registry, Cloud Build, IAM Credentials, STS, App Check or Billing Budgets APIs from later R1B waves.

The exact sorted list is preserved in `NONPROD_BASE_PROVISIONING_MATRIX_V1.json`. Enabled does not mean configured: there are no buckets, Functions, Cloud Run services or queues.

## 7. Resources created and not created

Created/verified per environment:

- ACTIVE project under the approved organization;
- approved billing linkage;
- project labels;
- Firestore `(default)` in `nam5`, Standard edition, delete protection enabled, PITR disabled;
- one Firebase automatic service account;
- 37 enabled platform/Firebase APIs.

Confirmed absent/deferred:

- report buckets and Storage objects;
- dedicated runtime/deployer/Tasks/signer/notifier/telemetry service accounts;
- Functions and Cloud Run services;
- Cloud Tasks queues;
- WIF, secret resources/versions and deployments;
- Rules/index/TTL execution, Auth users/configuration, App Check configuration and provider traffic.

The last group is `DEFERRED` unless a direct query was part of this read-back; absence is not inferred from API state alone.

## 8. Change records

| Scope | Change ID | Evidence state |
|---|---|---|
| Preview project | `AI-02H1E.5.R1C-B-NONPROD-PROVISIONING-20260804-01` | Supplied and consistent with project create time |
| Staging project | `AI-02H1E.5.R1C-B-NONPROD-PROVISIONING-20260804-02` | Supplied and consistent with project create time |
| Preview Firestore | `AI-02H1E.5.R1C-B-PREVIEW-FIRESTORE-20260804-01` | Supplied and consistent with database create time |
| Staging Firestore | `AI-02H1E.5.R1C-B-STAGING-FIRESTORE-20260804-01` | Supplied and associated with the verified database metadata |

Nominal implementer/approver receipts and restricted raw evidence hashes were not included in the handoff. This is a non-blocking governance observation for the verified base scope and is not treated as inferred approval.

## 9. Production and rollback

Production `aura-control-center-debb3` was outside every R1C-B1 read-back target. Per confirmed external state it remains unchanged and in `REMEDIATION_HOLD`; R1C-B1 performed no Production command.

Rollback status is `NOT_REQUIRED`: the evidence slice executed no writes and the supplied base wave reports no rollback. Delete protection is enabled on both databases. PITR remains disabled and must be decided before data-bearing certification work.

## 10. Deviations and risks

1. The automatic `firebase-adminsdk-fbsvc` account exists in each project; it is platform-created, not a dedicated R1B runtime identity, and its effective permissions remain pending IAM review.
2. Thirty-seven APIs are enabled, broader than the minimal base resources; security baseline design must classify Firebase defaults versus unnecessary services before later waves.
3. PITR is disabled on both databases; no real/sensitive data may be introduced until recovery policy is approved.
4. Nominal implementer/approver receipts and restricted raw evidence hashes were not provided to this documentation slice and remain pending governance review.

## 11. Next authorized wave

Only **Security Baseline Design** is authorized next. No additional provisioning is authorized by this package. Before any later security baseline execution:

- attach sanitized role approvals and raw-evidence hashes;
- review the automatic Firebase service account's effective IAM permissions;
- review the 37-service API baseline;
- decide the PITR policy before data-bearing work;
- keep Production excluded and all deferred resources unconfigured.
