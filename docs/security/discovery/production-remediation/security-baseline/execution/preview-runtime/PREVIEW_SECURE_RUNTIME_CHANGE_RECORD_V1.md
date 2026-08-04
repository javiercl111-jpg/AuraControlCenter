# Preview Secure Runtime Change Record V1

## Record

| Field | Value |
| --- | --- |
| Slice / change reference | `AI-02H1E.5.R2C-P` |
| Distinct operator Change ID | not supplied |
| Date | `2026-08-04` |
| Target | Preview / `aura-intel-preview` |
| Branch | `ops/intelligence-preview-secure-runtime-provisioning` |
| Gate HEAD | `64e2408567473c9ef12ac945cde21cc0f608c9b7` |
| Gate `origin/main` | `64e2408567473c9ef12ac945cde21cc0f608c9b7` |
| Final read-back | `2026-08-04T23:04:23Z` |
| Production | excluded; `REMEDIATION_HOLD` |
| Verdict | **CONDITIONAL — RUNTIME SECRETS OR APP CHECK PENDING** |

The operator request supplies the scope reference but not a separate execution receipt identifier or nominal implementer/approver receipts. Those governance fields are not inferred.

## Authorized request versus executed change

| Requested area | Executed state | Receipt |
| --- | --- | --- |
| Approved APIs | six valid allowlisted APIs explicitly enabled; logging/monitoring retained; IAM Credentials observed enabled; STS deferred | VERIFIED with deviation |
| Dedicated identities | four requested accounts created | VERIFIED |
| Minimal IAM | four log/metric writer bindings; no deploy, secret, token, Firestore, invoker, or broad role | VERIFIED |
| WIF / impersonation | none; trust inputs not supplied | DEFERRED |
| Secret resources | four metadata-only resources, automatic replication, zero versions | VERIFIED / VALUES PENDING |
| Firebase Web app | one Preview Web app registered | VERIFIED |
| App Check | API enabled; zero debug tokens; provider and enforcement not configured | CONDITIONAL |
| Runtime limits | exact minimums documented; no workload exists to apply them | DESIGN ONLY |
| Observability | APIs present and writer roles applied; no alerts/budget/routing | CONDITIONAL |
| Storage | no bucket; decision A, `DEFERRED` | VERIFIED |

## Mutation receipt

### APIs

Explicit successful enablement:

1. `cloudfunctions.googleapis.com`
2. `run.googleapis.com`
3. `cloudbuild.googleapis.com`
4. `artifactregistry.googleapis.com`
5. `secretmanager.googleapis.com`
6. `firebaseappcheck.googleapis.com`

`logging.googleapis.com` and `monitoring.googleapis.com` were already enabled. `iamcredentials.googleapis.com` was disabled before the wave and enabled in final read-back, without being named in the successful six-service command; audit attribution was unavailable. `sts.googleapis.com` remains disabled.

An earlier seven-service attempt failed atomically because `errorreporting.googleapis.com` is not an available service name. Read-back verified that the failed command produced no API change. No replacement service was enabled.

### Service accounts and IAM

Created:

- `preview-functions-runtime`
- `preview-deployer`
- `preview-secret-accessor`
- `preview-telemetry-writer`

All four have zero user-managed keys. Applied bindings:

- `preview-functions-runtime`: `roles/logging.logWriter`, `roles/monitoring.metricWriter`;
- `preview-telemetry-writer`: `roles/logging.logWriter`, `roles/monitoring.metricWriter`.

The deployer and secret-accessor accounts have no roles. No workload uses any new identity. The first IAM attempt returned an error and read-back confirmed no change; the explicit non-conditional form then applied the four listed bindings.

### Secret Manager

Created four resources with automatic replication and metadata labels:

- `discovery-idempotency-secret-preview`
- `discovery-ip-hash-salt-preview`
- `discovery-hmac-secret-preview`
- `discovery-gemini-api-key-preview`

No version, value, accessor binding, rotation operation, or output containing secret material exists.

### Firebase and App Check

Registered one Web app named `Aura Intelligence Preview Web`. The app ID is excluded from evidence and represented only by a SHA-256 fingerprint. App Check debug-token count is zero. No provider, debug exception, or enforcement was configured.

## Architectural deviations

1. R2A defines per-path `ai-prev-fn-*` identities, while this slice requested a generic runtime account. The generic account is parked with observability roles only.
2. R2A explicitly prohibits a generic secret-accessor identity. The requested account exists but has no roles or secret bindings.
3. The requested `errorreporting.googleapis.com` identifier is invalid; no substitute was authorized.
4. IAM Credentials became enabled as an observed dependency, but no WIF or impersonation binding was created and audit attribution was unavailable.
5. The four requested secret names differ from the R2A name catalog; consumer mapping/rename requires approval.
6. A distinct operational Change ID, exact WIF subject/conditions, secret consumers/values, App Check key/domains, budget threshold, alert route, owner, and approver receipts were not supplied.

These deviations are handled by withholding deploy, data, token, secret, Firestore, and traffic privileges. They must not be closed by broad IAM.

## Environment receipts

| Environment | Receipt |
| --- | --- |
| Preview | APIs/identities/IAM/empty secrets/Web app changed as listed; zero workloads and buckets |
| Staging | never targeted by a mutation; ACTIVE; base Firestore and resource counts unchanged |
| Production | never targeted by a mutation; ACTIVE; `REMEDIATION_HOLD` |

## Rollback

| Field | State |
| --- | --- |
| Triggered | no |
| Status | `NOT_EXECUTED_NO_FAILURE` |
| Workload/traffic containment required | no; both remain absent |
| Destructive rollback authorized by this record | no |

If later approved, rollback order is exact IAM binding removal, then unused app/secret/account removal, then API dependency analysis before any disablement. The current record must not be used to infer deletion authority.

## Stop and handoff

Stop before Functions, Cloud Run, traffic, STS/WIF, secret versions, secret access, App Check provider/enforcement, Storage, Tasks, Staging, or Production. The next review must resolve the R2A identity contradiction and the pending security/governance inputs.

No commit, push, pull request, or deploy was performed.
