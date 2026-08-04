# Environment Provisioning Evidence Plan v1

**Slice:** AI-02H1E.5.R1B

**Estado:** evidence design; no remote evidence captured by this slice

## 1. Evidence contract

Cada provisioning step produce un record con: command ID, environment, exact approved resource logical name, UTC timestamp, actor role, approver role, expected/actual normalized status, source API version, hash del raw restricted evidence, redaction result, rollback target y stop-condition result.

Raw evidence permanece en el sistema restringido aprobado. Git sólo recibe metadata sanitizada. Nunca se adjuntan secret values, tokens, key IDs, contact addresses, personal principals, UIDs, object names, Auth users ni business payloads.

## 2. Evidence matrix

| Evidence ID | Control | Capture | Sanitized repository evidence | Closure |
|---|---|---|---|---|
| EVD-PROJECT | Project metadata | lifecycle, projectId, display, parent type, labels | Approved ID/display, parent class hash, labels, state | Correct org/folder/environment and no unexpected inheritance |
| EVD-BILLING | Billing status | linked/unlinked and approved account reference | `LINKED_APPROVED` + restricted reference hash | FinOps/Product sign-off and isolated cost center |
| EVD-API | Enabled APIs | exact service names | Sorted allowlist + hash | Exact approved API set; no extras |
| EVD-FIREBASE | Firebase status | project Firebase enablement and Web Apps | enabled flag, app count/display names, app ID hashes | Project mapping exact |
| EVD-SA | Service accounts | IDs, display names, disabled state | Expected IDs and USER_MANAGED key count only | All expected; zero unexpected/default runtime use |
| EVD-IAM | IAM bindings | project/resource/SA/secret/bucket/queue policies | Principal role codes, scope, condition hash | Minimum scope; no Owner/Editor/cross-env |
| EVD-WIF | WIF | pool/provider, issuer, mapping, conditions, disabled flag | Names, issuer, condition hash, audience hash | Exact repository/ref/environment; no wildcard |
| EVD-FIRESTORE | Firestore | database, location, mode, protection, recovery | `(default)`, `nam5`, normalized flags | Approved location and policy |
| EVD-RULES | Rules baseline | ruleset/release normalized hash | Hash + release timestamp only | Safe baseline, readable before change |
| EVD-BUCKET | Bucket policy | location, PAP, UBLA, lifecycle, retention, CORS, IAM | Exact normalized metadata; object count only if approved | US, PAP enforced, UBLA enabled, no public principal |
| EVD-QUEUE | Queue state | state, rate, concurrency, retries/backoff | Exact queue config and endpoint/audience hashes | PAUSED, 1/s, 1 concurrent, 3 attempts |
| EVD-SECRET | Secret metadata | names, labels, replication, version state/date, IAM | No values; version count/state and consumer role | Seven exact secrets, isolated consumers |
| EVD-APPCHECK | App Check | app/provider/enforcement/debug-token count | App display, provider type, surface state, count only | Environment-correct; zero Staging/Production debug tokens at gate |
| EVD-VERCEL | Vercel | project, Git mapping, branch policy, Node, env-var names/targets, domains/protection | Names/targets only; values and contacts omitted | No cross-env variables; Node 20 contract |
| EVD-BUDGET | Budgets | display, project filter, thresholds, routing state | Amount category/hash, percentages, owner role | Environment-isolated and routing tested |
| EVD-DASHBOARD | Dashboards | names, widget metric refs | Name + config hash + metric IDs | Expected widgets and no sensitive labels |
| EVD-ALERT | Alerts | policy, threshold, severity, channel/runbook linkage | Name/config hash/routing receipt ID | Enabled, owner/runbook, synthetic receipt |
| EVD-ROLLBACK | Rollback tests | scenario, initial/final state, elapsed, evidence preserved | Result, state hashes, approvers | Every phase restores safe disabled state |
| EVD-ISOLATION | Cross-env validation | project/bucket/queue/secret/SA/app/domain references | Pairwise equality matrix | Zero shared resource/identity IDs |

## 3. Read-back sequence

1. Capture approved manifest hash before a write.
2. Capture pre-state with read-only command ID.
3. Execute one bounded write command ID.
4. Capture immediate read-back from the authoritative API.
5. Compare expected/actual and run negative/isolation checks.
6. On mismatch, execute the approved rollback and capture final state.
7. Redact and scan; store raw restricted evidence and repository summary separately.
8. Require responsible role and approver role sign-off.

An exit code zero is insufficient; closure requires effective read-back.

## 4. Rollback exercises

| Scenario | Exercise environment | Required proof |
|---|---|---|
| Project creation failure | Preview first | Project is empty, labeled abandoned, billing unlinked when approved |
| Billing rejection | Preview | No data/resources; unlink/abandon record |
| API wave partial failure | Preview | Dependency-aware stop; no disabled shared API |
| Firebase enablement failure | Preview | Partial state inventoried and project quarantined |
| IAM misbinding | Preview/Staging | Binding removed at exact scope; no broad fallback |
| WIF failure | Preview/Staging | Provider disabled; token exchange denied; audit retained |
| Bucket misconfiguration | Preview/Staging | PAP/UBLA corrected or empty bucket quarantined; no public access |
| Queue dispatch risk | Preview/Staging | Queue paused, zero producer binding, recovery ledger consistent |
| Secret access error | Preview/Staging | Binding/version disabled; no value in evidence |
| Vercel wrong linkage | Preview/Staging | Project unlinked/removed without Production domain/variables |
| Production targeting error | Staging simulation only | Guard fails before command; no Production write |

## 5. Redaction and quality gates

Automated scan must report zero:

- private keys, access/refresh tokens and API credential patterns;
- secret payloads or signed URLs;
- email addresses, personal principal names, UIDs and Auth records;
- Firestore payloads/object names/business data;
- unapproved organization, billing or provider identifiers;
- local absolute paths.

Counts, boolean state, approved resource names, normalized role codes and cryptographic hashes are allowed. A redaction failure invalidates the packet and stops delivery.

## 6. Evidence index schema

```json
{
  "evidenceId": "<EVD-ID>",
  "environment": "<preview|staging|production>",
  "commandId": "<CATALOG-ID>",
  "resourceLogicalName": "<APPROVED_NAME>",
  "expectedState": "<NORMALIZED_STATE>",
  "actualState": "<NORMALIZED_STATE>",
  "rawEvidenceHash": "<SHA256>",
  "redaction": "PASS",
  "responsibleRole": "<ROLE>",
  "approverRole": "<ROLE>",
  "rollbackEvidenceId": "<EVD-ID-OR-NOT_REQUIRED>"
}
```

## 7. Acceptance

Evidence is current only for the approved project, environment manifest version and change window. Drift, unavailable metadata, failed isolation, an unknown blocking state or stale evidence keeps the corresponding gate open.
