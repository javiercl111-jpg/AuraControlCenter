# Authority persistence contracts

`serverAuthorityPersistence` defines the closed, versioned, server-only
contracts for a future tenant-authority persistence adapter. It contains no
repository implementation, Firebase Admin SDK, Firestore dependency, security
rules, Functions handler, resolver, migration runtime, I/O, or network access.

The canonical document locations described by these contracts are:

- `platform_tenants/{tenantId}`;
- `tenant_memberships/{membershipKey}`;
- `tenant_aliases/{aliasKey}`.

Tenant IDs are canonical document IDs. Membership keys are reversible,
length-framed tuples of principal type, principal ID, and tenant ID. Alias keys
are reversible, length-framed values over alias type and an encoded normalized
alias. Neither helper uses randomness or hashing.

Every write command carries an explicit create-only or version precondition,
an idempotency key, a canonical actor, and caller-supplied timestamps. Closed
transition matrices prevent silent status jumps and make deleted records
terminal. Audit and outbox contracts accept only a small non-sensitive payload
summary.

Migration metadata is explicitly marked `authorityUse: PROHIBITED`. It may
describe classification and rollout state but cannot create tenant or
membership authority.

## Repository invocation boundary

`AuthorityMutationRepositoryPort` exposes only `execute(command, context)`.
The command is the closed administrative union; the separate
`AuthorityRepositoryInvocationContextV1` is the authority. Its principal,
actor, authorization decision, authorized operation types, request identity,
correlation identity, source, consumer, and authorization version must agree
exactly. A denied or expired decision, an unlisted operation, or a command
actor mismatch fails closed. `AbortSignal`, when present, is preserved by
identity and is never cloned or frozen.

`AuthorityClockPort` exposes only `nowIso()`. A future runtime must resolve one
validated timestamp before starting a transaction and reuse it for every
transaction retry.

## Determinism and replay

Command and repository-result fingerprints use a versioned, explicitly framed
canonical serialization followed by SHA-256. SHA-256 is only a stable
fingerprint mechanism; it grants no authority. Validated arrays are
canonicalized before hashing. Audit, outbox, idempotency-document, and
operation-binding IDs are also versioned deterministic hashes with distinct
namespaces.

A completed or rejected idempotency record contains the exact validated
repository result and its fingerprint. An operation binding independently
binds `operationId`, `idempotencyKey`, operation type, and request fingerprint.
Single-transaction repositories may persist only terminal `COMPLETED` or
`REJECTED` idempotency states. `IN_PROGRESS` is not a valid persistence state
for that execution model.

Repository results expose only closed retry dispositions:
`DO_NOT_RETRY`, `RETRY_AFTER_READ`, or
`SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY`. They never expose Firebase error
codes.

## Authority versions and events

New authority starts at version `1`. Every `APPLIED` administrative mutation
increments `authorityVersion` by exactly one. Replay, `NO_OP`, rejection,
conflict, not-found, and internal-error outcomes do not increment it. Version
jumps fail closed.

Specific lifecycle events are the canonical transition mapping. The retained
`TENANT_STATUS_CHANGED` event is a compatibility event and is not emitted by
the specific transition mapper. `MEMBERSHIP_ACTIVATED` represents activation
without a prior authoritative membership status; `MEMBERSHIP_REACTIVATED`
represents the explicit `SUSPENDED -> ACTIVE` transition.

## Delivery, activation, and legacy input

`AuthorityOutboxEventV1` remains immutable event data.
`AuthorityOutboxDeliveryRecordV1` separately models `PENDING`, `LEASED`,
`DELIVERED`, and `FAILED_TERMINAL` delivery state with closed lease and
timestamp invariants.

Tenant activation requires an exact active USER membership for the same
tenant, containing `TENANT_ADMIN`, plus expected tenant and membership
versions. Global roles cannot satisfy this prerequisite.

Legacy canonicalization accepts only the seven allowlisted variants.
`CONFLICTING_STATUS_FIELDS` always requires review and cannot be passed to a
canonicalization command. Unknown variants fail closed. A normalized target,
source version and fingerprint, deterministic alias reservations, migration
metadata, and conflict disposition are mandatory. No decoder, database read,
repository implementation, migration runtime, or delivery worker exists in
this module.
