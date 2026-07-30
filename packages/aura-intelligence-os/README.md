# Aura Intelligence OS — Server Build Boundary

`@aura/intelligence-os` is a private, server-only build boundary for Node 20.
It emits CommonJS and TypeScript declarations from the canonical source in
`src/modules/intelligence`.

The package intentionally exposes only `@aura/intelligence-os/server`. Browser,
React, Vite, Firebase, Discovery, UI, persistence, and network integrations are
outside this boundary.

`dist/` is generated and must not be committed or edited. The canonical
distribution command builds it and stages a reduced package under
`functions/.generated/aura-intelligence-os` before Functions installation or
build. Both generated directories remain outside Git.

The staged package contains only `dist/`, this README, and a reduced private
manifest with a deterministic content fingerprint. It has no build scripts,
development dependencies, source files, tests, `node_modules`, or lockfile.

From a clean checkout, the reproducible order is:

1. `npm ci`
2. `npm run stage:intelligence-os:functions`
3. `npm ci --prefix functions`
4. `npm run build --prefix functions`

Firebase predeploy runs the staging command before the verified Functions
build. The Firebase ignore contract retains its default exclusions without
excluding `.generated`, so the local package is inside the uploaded Functions
source. The closed Firestore authority persistence adapter under
`functions/src/infrastructure/firestore/authorityPersistence` is the only
production Functions code permitted to import
`@aura/intelligence-os/server`; it consumes the certified persistence port and
pure planner without exporting infrastructure back through this package. The
package is never published.

## Node 20 consumption validation

The dedicated
`.github/workflows/intelligence-os-node20.yml` workflow runs on pull requests
and pushes to `main` with `actions/setup-node` configured for Node 20. It fails
closed if `process.version` does not start with `v20.`.

From a clean checkout under Node 20, the workflow executes:

1. `npm ci`
2. `npm run stage:intelligence-os:functions`
3. `npm ci --prefix functions`
4. `npm run validate:intelligence-os:node20`

The validation requires the installed local package from Functions, checks the
closed export and dependency contract, and executes the production
`GovernedExecutionBoundary`, `BootstrapBoundaryAdapter`, and
`PipelineBootstrapper` entirely in memory. Boundary execution remains confined
to `functions/tests`; the production Firestore adapter consumes only the
server-side authority persistence contracts and planner and does not register
a handler or composition root.

## Trusted server composition contracts

`src/modules/intelligence/serverComposition` defines the server-only contracts
for a future trusted composition root. It contains:

- authenticated principal and resolved tenant-membership contracts;
- a test-only consumer/source registry that authorizes only `INTERNAL_TEST`
  with `SHADOW_ONLY`;
- server-generated or server-verified request identity;
- transport lifecycle and identity-preserving `AbortSignal` handling;
- allowlisted, non-authoritative transport context;
- closed sanitized responses;
- neutral resolver ports and the required composition dependency contract.

The module contains no Firebase adapter, resolver implementation, policy
producer, Boundary execution, Functions handler, productive consumer, I/O, or
network integration. Business payload is not part of server authority.

`transportDeadlineAt` is operational context only. The current certified
Boundary derives its authoritative deadline from policy and does not propagate
`min(transport deadline, policy deadline)` as the authoritative deadline.
Therefore this module deliberately performs no deadline adaptation. A future
composition may preserve transport cancellation, but changing authoritative
deadline semantics requires a separate certified Boundary contract change.

## Verified identity and tenant binding contracts

`src/modules/intelligence/serverIdentity` defines the closed, versioned
server-only contracts that a future authoritative principal and tenant resolver
must satisfy. It contains no resolver runtime, Firebase Admin, Auth, Firestore,
Functions handler, composition root, persistence, network, or productive
consumer.

The authority chain is explicit:

1. `VerifiedAuthenticationSubjectV1` records a verified `USER`, `SERVICE`, or
   `SYSTEM` provider subject, credential lifecycle, and revocation-check time.
2. A provider-specific verified binding maps that exact subject to one
   canonical principal. Firebase user identity is the exact Firebase UID; email
   is never an identity key. Service and system identities require explicit IAM
   bindings and the literal `system` is not a principal.
3. `CanonicalTenantAuthorityV1.tenantId` is the exact canonical tenant document
   ID. Slugs, organization references, and client references are derived lookup
   aliases only. `aura_root` is never a tenant.
4. `ServerOwnedTenantMembershipRecordV1` is the sole membership authority.
   Membership lookup uses the deterministic length-framed tuple
   `(principalType, principalId, tenantId)`. Only an exact `ACTIVE` record can
   be adapted into `TrustedTenantMembershipV1`; suspended, revoked, deleted,
   duplicate, mismatched, or globally scoped roles fail closed.
5. `TenantSelectorHintV1` is explicitly `NON_AUTHORITATIVE`. It can select a
   candidate for server verification but cannot grant a tenant or membership,
   and there is no implicit first-tenant strategy.
6. `IdentityClaimsProjectionV1` is explicitly `DERIVED`, expirable, and marked
   `authorityUse: PROHIBITED`. It cannot create membership authority.
7. Boundary actors are derived only from a validated
   `TrustedServerPrincipalV1`; request payload identity is not an input to that
   derivation.

The module also defines Firebase-neutral resolver inputs and closed
`RESOLVED`, `REJECTED`, and `AMBIGUOUS` result contracts. Rejection results
carry only allowlisted internal reason codes, versions, and timestamps; they do
not echo provider subjects, tenant candidates, emails, tokens, or record
existence.

All factories validate unknown fields, canonical identifiers, explicit
versions, timestamp ordering, provider/type compatibility, role scope, and
cross-contract identity equality before returning frozen copies. They use no
ambient clock or randomness.

## Authoritative policy snapshot contracts

`src/modules/intelligence/serverPolicy` defines the immutable, versioned policy
snapshot consumed by a future server-only authoritative policy producer. The
initial table contains one explicit test-only binding for the certified trusted
consumer and source, and permits only `SHADOW_ONLY` with an explicit timeout.

Snapshot validation reuses the trusted consumer/source registries, requires
exact tenant and Boundary actor identifiers, rejects duplicate policy IDs and
lookup keys, canonicalizes entry order, and freezes the resulting data. Lookup
keys use explicit length framing so separator characters cannot create
ambiguous collisions.

Transport is intentionally absent because
`AuthoritativeBoundaryPolicyQueryV1` does not carry it. Trusted server
composition remains responsible for transport admission before policy
evaluation.

`InMemoryAuthoritativeFeaturePolicyProducer` is the first server-only runtime
consumer of this snapshot. Construction revalidates and clones the complete
snapshot, builds a private exact-key index once, and retains no caller-owned
mutable reference. Authoritative evaluation validates every query and decision,
permits only an exact enabled `SHADOW_ONLY` match, and returns deterministic
specific denial reason codes for every other path. The inherited legacy
`getEffectivePolicy()` method always returns `undefined` and cannot grant
authority.

The producer is side-effect-free and has no Boundary execution integration,
composition root, productive policy, Firebase, environment authority, audit,
I/O, or network dependency.

## In-memory Boundary integration validation

`src/modules/intelligence/serverIntegrationValidation/tests` contains the
test-only AI-02H1D.4 harness. It composes the trusted request contracts and
registries, the immutable in-memory policy producer, the governed Boundary,
the bootstrap adapter, and the production bootstrapper entirely in memory.
The final value is passed through the closed trusted response sanitizer.

The fixture uses explicit timestamps, request identities, bootstrap clock, and
`AbortSignal`; it never obtains authority from ambient time, randomness,
environment variables, transport metadata, or business payload. Its positive
path is limited to the existing contract-test consumer/source and
`SHADOW_ONLY`. Negative paths cover missing and disabled policy, authority and
mode mismatches, deadline, cancellation, missing context, and response
sanitization.

Run it with:

`npm run test:intelligence-os:integration`

The aggregate `validate:intelligence-os:node20` command also runs this suite,
so the dedicated Node 20 workflow certifies the same integration from a clean
checkout.

This harness is not exported from `@aura/intelligence-os/server`, is excluded
from the package build, and creates no productive composition root, Functions
handler, Firebase adapter, resolver, network or persistence integration, or
productive consumer.

## Authority persistence contracts

`src/modules/intelligence/serverAuthorityPersistence` defines the server-only,
fail-closed persistence contracts for canonical tenant documents, deterministic
tenant-membership documents, derived tenant aliases, administrative commands,
explicit write preconditions, idempotency, repository-safe results, and neutral
audit/outbox events.

The module is contract-only. It has no Firebase Admin or Firestore dependency,
repository implementation, security rule, Functions handler, migration
runtime, resolver, I/O, network access, ambient clock, randomness, or
environment authority. Document factories receive explicit document IDs and
reject mismatches. Write commands require either `MUST_NOT_EXIST` or an exact
record/authority version; blind writes cannot be represented.

Tenant and membership state transitions use closed matrices, with `DELETED`
terminal. Membership roles reuse the certified trusted tenant-role vocabulary
and remain principal-type compatible. Alias keys use reversible safe encoding,
and collision validation cannot turn an alias into authority.

Migration metadata is temporary and explicitly carries
`authorityUse: PROHIBITED`. Audit and outbox payload summaries are closed and
exclude email, tokens, claims, headers, complete records, and arbitrary
metadata.

Legacy tenant canonicalization is closed over the single allowlisted physical
source `PLATFORM_TENANTS -> platform_tenants`. The exported neutral descriptor,
deterministic locator, raw-record validator, timestamp/status normalizers, pure
decoder, source fingerprint/version factories, and read-registry contracts use
no Firebase types or I/O. Canonicalization embeds the decoded source record;
free `sourceReference` paths are rejected, and `MUST_MATCH_SOURCE` binds the
collection, document ID, locator key, source version, and fingerprint.
Review-required or rejected variants cannot produce an applicable command.
