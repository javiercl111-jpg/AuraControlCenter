# Non-Production Base Provisioning Change Record v1

**Slice:** AI-02H1E.5.R1C-B1 evidence consolidation

**Record state:** `EXECUTED_EXTERNALLY_BASE_SCOPE_VERIFIED`

**Documentation timestamp:** `2026-08-04T19:56:16.0054339Z`

R1C-B1 did not execute the recorded changes. It consolidates supplied Change IDs with independent sanitized read-back.

## 1. Change records

| Change ID | Authorized/claimed scope | Read-back match | Status |
|---|---|---|---|
| `AI-02H1E.5.R1C-B-NONPROD-PROVISIONING-20260804-01` | Create/configure Preview base project | ACTIVE project created `2026-08-04T19:22:51.349Z`; parent, labels and billing match | `VERIFIED_METADATA` |
| `AI-02H1E.5.R1C-B-NONPROD-PROVISIONING-20260804-02` | Create/configure Staging base project | ACTIVE project created `2026-08-04T19:35:58.750Z`; parent, labels and billing match | `VERIFIED_METADATA` |
| `AI-02H1E.5.R1C-B-PREVIEW-FIRESTORE-20260804-01` | Create Preview Firestore `(default)` | Database created `2026-08-04T19:47:51.388611Z`; exact location/type/edition/protection match | `VERIFIED_METADATA` |
| `AI-02H1E.5.R1C-B-STAGING-FIRESTORE-20260804-01` | Create Staging Firestore `(default)` | Database created `2026-08-04T19:51:08.828981Z`; exact location/type/edition/protection match | `VERIFIED_METADATA` |

## 2. Actors and approvals

| Field | Evidence |
|---|---|
| Implementer role | `NOT_INCLUDED_IN_HANDOFF` |
| Approver role | `NOT_INCLUDED_IN_HANDOFF` |
| Billing approver reference | `NOT_INCLUDED_IN_HANDOFF`; effective linkage verified |
| Privacy/Security location approval | `NOT_INCLUDED_IN_HANDOFF`; actual location verified |
| Raw execution log hash | `NOT_INCLUDED_IN_HANDOFF` |
| Rollback owner | `NOT_INCLUDED_IN_HANDOFF` |

No personal identity is inferred. Nominal implementer/approver receipts and restricted change-management hashes remain pending governance as a non-blocking observation for the verified base scope.

## 3. Resources verified as created

Per environment:

- one ACTIVE project under organization `876******321`;
- billing enabled on `01E**************793`;
- labels for environment, Firebase, managed-by and product;
- Firebase membership confirmed for each exact project ID by operator-provided sanitized `firebase projects:list --json` output; no full dump retained;
- Firestore `(default)` in `nam5`, `FIRESTORE_NATIVE`, `STANDARD`;
- delete protection enabled and PITR disabled;
- one platform-created `firebase-adminsdk-fbsvc` service account;
- 37 enabled services.

Project numbers are omitted. No Firebase project dump, principal, email, token or sensitive field is retained.

## 4. Resources verified not configured

| Resource | Preview | Staging |
|---|---|---|
| Buckets | Count 0 | Count 0 |
| Dedicated/additional service accounts | Count 0 | Count 0 |
| Functions | API disabled | API disabled |
| Cloud Run services | API disabled | API disabled |
| Cloud Tasks queues | API disabled | API disabled |

Rules, indexes, TTL, Auth configuration/users, App Check, WIF and secrets were outside the direct read-back and remain `DEFERRED`; their absence is not inferred solely from enabled APIs.

## 5. Billing and cost state

Both projects are linked to the same approved masked Billing Account reference. No budget, alert, spend, payment or banking metadata was queried. R1C-B1 did not link/unlink billing.

## 6. Production exclusion

`aura-control-center-debb3` was absent from every command target in this evidence run. The confirmed state is unchanged and `REMEDIATION_HOLD`. No Production metadata was re-read because the authorized read-back list was limited to Preview and Staging.

## 7. Rollback status

| Field | Result |
|---|---|
| Base-wave rollback reported | None |
| R1C-B1 rollback required | No; evidence run was read-only |
| Project abandon/delete | Not invoked |
| Billing unlink | Not invoked |
| Firestore delete | Not invoked; delete protection enabled |
| Production rollback | Not applicable |

Status: `NOT_REQUIRED_NO_WRITES_IN_EVIDENCE_SLICE`. Any original base-wave rollback receipts remain pending governance even though no rollback was triggered.

## 8. Deviations

| ID | Deviation | Severity | Closure |
|---|---|---|---|
| CR-DEV-03 | Nominal implementer/approver receipts and restricted raw-log hashes absent | Non-blocking governance observation | Attach restricted receipts and sanitized hashes when available |
| CR-DEV-04 | Automatic Firebase SA exists | Expected platform side effect requiring review | Include its effective permissions in security baseline |
| CR-DEV-05 | 37 services enabled | Configuration review | Classify Firebase defaults and deny additional enablement |
| CR-DEV-06 | PITR disabled | Recovery risk before data | Approve/implement recovery in later authorized wave |

## 9. Next change boundary

This record authorizes no external operation. The next permitted activity is Security Baseline Design. The non-blocking observations remain inputs to governance and baseline design. Any API enablement, IAM/WIF, Rules, Storage, Functions, queues, secret or deployment change requires a new Change ID and human approval.
