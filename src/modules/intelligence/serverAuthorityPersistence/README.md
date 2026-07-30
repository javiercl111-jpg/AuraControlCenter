# Authority persistence contracts

`serverAuthorityPersistence` defines the closed, versioned, server-only
contracts and the infrastructure-neutral authority mutation core. It contains
no Firebase Admin SDK, Firestore dependency or adapter, security rules,
Functions handler, resolver, migration executor, I/O, or network access.

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

`AuthorityClockPort` exposes only `nowIso()`. The in-memory repository resolves
one validated timestamp per execution and reuses it for the result, records,
audit, outbox, and initial delivery state.

## Pure mutation runtime

`AuthorityRepositorySnapshotV1` is a closed, immutable, canonically sorted
representation of tenants, memberships, aliases, classified legacy sources,
idempotency records, operation bindings, audit, outbox, and delivery state.
Every entry carries its neutral document ID. Construction validates each
record, the ID-to-record binding, duplicates, and outbox-to-delivery
references. It exposes no mutable maps or infrastructure snapshots.

`planAuthorityMutationV1(command, context, snapshot, occurredAt)` is pure. It
validates authority before inspecting resources, checks cancellation and both
idempotency bindings, evaluates preconditions and transitions, and returns a
frozen `AuthorityMutationPlanV1`. Plans contain only closed reads, writes,
events, versions, and the safe repository result. They contain no callbacks,
infrastructure references, arbitrary paths, clocks, or I/O.

`InMemoryAuthorityMutationRepository` injects only an initial snapshot and an
`AuthorityClockPort`. It owns a private validated snapshot, executes the pure
planner, checks cancellation again before apply, validates the complete next
snapshot, and then swaps state once. Failed validation leaves the prior
snapshot unchanged. Its test snapshot method returns a fresh validated frozen
clone. The class is reusable and has no singleton or global state.

All eight closed operations are supported: tenant creation/status changes,
membership creation/role/status changes, alias reservation/tombstoning, and
validated legacy canonicalization. Canonicalization reads a neutral classified
legacy-source record and verifies the exact physical locator, source version,
and fingerprint. The target is create-only. It does not execute an external
migration.

## Legacy tenant source closure

`AuthorityLegacyTenantSourceCollectionV1` is a versioned closed vocabulary.
Its only value is `PLATFORM_TENANTS`, mapped internally and immutably to the
fixed collection path `platform_tenants`. Callers provide no collection path.
`AuthorityLegacyTenantSourceDescriptorV1` accepts one simple document ID and
always carries `authorityUse: PROHIBITED`. It cannot contain a project,
database, absolute path, subcollection, or infrastructure reference.

`createAuthorityLegacyTenantPhysicalLocatorV1` produces a neutral locator with
the fixed collection path, exact document ID, and a versioned SHA-256
`locatorKey` over canonical framing of collection, document ID, and locator
version. The locator is descriptive only and grants no tenant authority.

`AuthorityLegacyTenantRawRecordV1` is the closed union of fields observed in
the audited `platform_tenants` writers. Unknown fields, accessors, class
instances, nested unknown objects, auth data, roles, claims, and arbitrary
metadata fail closed. Legacy timestamps accept only canonical UTC ISO strings
or the neutral `{ seconds, nanoseconds }` shape. Normalization emits UTC ISO
with nine fractional digits and uses no ambient clock.

`decodeAuthorityLegacyTenantSourceRecordV1` is a pure decoder. It receives the
descriptor, unknown raw value, and explicit `decodedAt`; validates and clones
the raw record; normalizes timestamps and status; classifies the variant;
derives alias candidates; computes the source fingerprint and source version;
then freezes the complete record. `decodedAt` is excluded from the source
fingerprint. A valid legacy `recordVersion` becomes
`EXPLICIT_NUMERIC_VERSION`; otherwise the distinguishable
`CONTENT_FINGERPRINT_ONLY` provenance is used. No update time is simulated.

Variant priority is explicit:

1. `CONFLICTING_STATUS_FIELDS`;
2. `AUTO_ID_WITH_TENANT_ID_SLUG`;
3. `AUTO_ID_WITH_TENANT_SLUG`;
4. `DOCUMENT_ID_EQUALS_TENANT_ID`;
5. `MISSING_SLUG`;
6. `STATUS_FIELD_ONLY`;
7. `TENANT_STATUS_FIELD_ONLY`.

The closed status mapping is:

- `PENDING`, `READY`, and `PENDING_ACTIVATION` to `PENDING`;
- `ACTIVE` to `ACTIVE`;
- `GRACE_PERIOD` and `SUSPENDED` to `SUSPENDED`;
- `CANCELLED` and `DEACTIVATED` to `DEACTIVATED`;
- `DELETED` to `DELETED`.

The explicitly listed lowercase equivalents are also accepted. Unknown status
tokens are classified `REJECTED` and never become `ACTIVE`. Conflicting status
fields are `REQUIRES_REVIEW`. Company names never become alias or tenant
identity. Only tenant slug, legacy tenant ID, client reference, and
organization reference candidates can be selected.

Canonicalization input embeds the validated decoded record. Selected aliases
must be exact `RESERVE` candidates from that record. Migration metadata binds
the locator key, source version, fingerprint, and classified variant.
`sourceReference` is not accepted. A target document ID equal to the decoded
slug is rejected. `REQUIRES_REVIEW` and `REJECTED` records can be represented
for review but cannot become an administrative command.

`AuthorityRepositoryReadRegistryEntryV1` is a separate immutable, server-only
read-coverage contract. `PRESENT` binds collection, document ID, locator,
version, and fingerprint; `ABSENT` carries no record identity. It is not part
of `AuthorityRepositorySnapshotV1`. The planner reports a missing registry
entry as `LEGACY_SOURCE_NOT_READ` and only reports
`LEGACY_SOURCE_NOT_FOUND` for an explicit `ABSENT` entry.

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

The in-memory runtime persists terminal replay state only for `APPLIED`,
`NO_OP`, and authorized deterministic `REJECTED` results. That is the exact
closed vocabulary supported by `AuthorityIdempotencyRecordV1`: `COMPLETED`
accepts only `APPLIED`/`NO_OP`, and `REJECTED` accepts only `REJECTED`.
`CONFLICT` and `NOT_FOUND` remain safe non-persistent results and must be
retried, when appropriate, after a new read. Contract, context, authorization,
and cancellation failures are never persisted. Replays return the exact
stored result and create no record, version, audit, or outbox change.

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
canonicalization command. Unknown variants fail closed. A decoded source
record, normalized target, selected source-backed aliases, migration metadata,
and conflict disposition are mandatory. No database read, infrastructure
adapter, migration executor, or delivery worker exists in this module.
