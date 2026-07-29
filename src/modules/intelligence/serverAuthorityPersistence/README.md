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
