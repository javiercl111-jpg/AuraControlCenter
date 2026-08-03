# Discovery Intake Idempotency Retention V1

Status: architectural-review candidate. This document and its manifest do not
apply Firebase configuration and do not authorize a deployment.

## Contract and collections

`DiscoveryIntakeIdempotencyRecordV1` is the only accepted record contract for
`discovery_intake_idempotency`. Its states are `PROCESSING`, `COMPLETED`, and
`FAILED_FINAL`. Every state has a Firestore `Timestamp` in `expiresAt`; state
invariants, request binding, attempt fencing, and expiration are checked on
every transactional read. Unknown, legacy, or malformed records fail closed.

`discovery_intake_idempotency_namespaces_v1` bounds simultaneously active
PROCESSING keys per derived identity. Both document ids are SHA-256 HMAC
values. Neither collection stores raw idempotency keys, email, IP, advisor id,
tenant id, or plaintext capability tokens. The completed result stores only a
link id and a non-secret generation id; the server re-derives the capability
with its secret and verifies the persisted link token hash.

## Policy V1

| Control | Value |
| --- | ---: |
| Lease | 60 seconds |
| PROCESSING retention | 24 hours |
| COMPLETED retention | 7 days |
| FAILED_FINAL retention | 24 hours |
| Maximum attempts | 3 |
| Maximum lease recoveries | 2 |
| Active records per derived namespace | 3 |
| Maximum cleanup batch | 100 |

The values live in `DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1`; handler and
adapter code contain no lifecycle duration or attempt literals. Lease recovery
preserves the original PROCESSING `expiresAt`, so retries cannot extend a key
indefinitely. When a limit is exceeded, the same transaction persists a
bounded FAILED_FINAL record and removes it from active cardinality.

## Three distinct expiration controls

1. **Code-enforced semantic expiration** is authoritative. Reads classify a
   record as ACTIVE, EXPIRED, or CORRUPTED. An expired COMPLETED record is never
   returned as cached success, even if Firestore still contains it.
2. **Firestore TTL** is eventual physical deletion only. The versioned target
   is `manifests/DISCOVERY_INTAKE_IDEMPOTENCY_TTL_V1.json`. Merely writing a
   timestamp does not enable TTL.
3. **Cleanup fallback** is an internal, non-deployed component. It selects only
   `expiresAt <= now`, caps each batch, revalidates inside a transaction,
   preserves active records, supports dry-run, updates namespace membership,
   and reports `scanned`, `deleted`, `wouldDelete`, `skipped`, `errors`, oldest
   expiration and maximum lag. Re-running the same batch is idempotent.

P9 must inspect the remote Firestore field policy and record evidence that TTL
for collection group `discovery_intake_idempotency` targets `expiresAt` before
any production authorization. This slice neither runs that command nor changes
remote Firebase state.

## Boundaries

The cleanup class is not referenced by `functions/src/index.ts`; there is no
scheduled function, cron, deployment export, or production invocation. P2
public rate-limit policies are not connected to any handler. Existing legacy
historical link-count queries remain outside this slice and require their
separate handler-integration phase.
