# Authority Tenant & Scope Resolution Contracts

This module defines the closed contracts used to represent a tenant or
non-tenant scope after server-side resolution. It contains no resolver
implementation, Firestore/Firebase access, Functions code, handlers,
middleware, policy decision, authorization, repository, adapter, environment
access, clock, randomness, or production composition.

## Boundary rules

- A selector is a request, never resolved authority. A caller-provided
  `tenantId` must still be resolved server-side.
- A legacy `companyId` is not automatically a canonical tenant ID.
- Email, email domain, display name, UI state, client cache, and the first
  membership are never tenant resolution sources.
- Principal and tenant are separate. The request carries only a minimal,
  versioned principal reference, not the complete resolved principal.
- Membership binding is evidence of a relationship, not permission or
  authorization. It carries no roles or permissions; an optional role-set
  version is only a reference.
- Platform scope has no synthetic tenant ID and does not imply total access.
  `PLATFORM_ADMIN` is authorization vocabulary and is not a scope.
- Bootstrap requires no prior membership by definition, but grants no
  permission.
- Migration uses an explicit, finite, sorted tenant set. Wildcards and global
  scope are prohibited.
- Support keeps the operator identity separate from the target tenant.
  Full impersonation is not representable.

## Reused contracts

Canonical tenant and membership vocabulary remains owned by `serverIdentity`
and Authority persistence. This module reuses their tenant status, alias type,
and legacy source descriptor types through type-only dependencies. Validation
mirrors their closed literals without importing persistence runtime.

Principal IDs and principal types are validated through
`serverPrincipalResolution`. The complete principal, authentication binding,
claims snapshot, and assurance evidence are not copied.

Tenant-scope retry dispositions are intentionally separate from persistence
retry dispositions. Persistence retry describes transaction/idempotency
replay; scope retry describes refreshing tenant, membership, selector, or
operator-reviewed evidence.

## Status and freshness

`ACTIVE`, `SUSPENDED`, `REVOKED`, and `DISABLED` are representable for normal
scopes. `PENDING_BOOTSTRAP` belongs only to bootstrap and
`LEGACY_PENDING_CANONICALIZATION` only to legacy canonicalization. The future
invocation boundary must reject non-active normal tenant scopes unless a
separately authorized special flow applies.

Timestamps and comparison time are injected values. Validators use no ambient
clock. `validUntil` must exactly equal `resolvedAt + staleAfterSeconds`.

## Error exposure

Internal reason codes distinguish resolution conditions, including ambiguous
aliases, but must not be exposed directly when they could enumerate tenants or
memberships. A future error boundary must collapse those details into uniform
external responses.

## Future invocation-context projection

AI-02H1E.3D.5 should project only:

- canonical tenant ID, or an explicit platform/special scope reference;
- scope type;
- tenant authority version;
- membership binding version when applicable;
- tenant evidence fingerprint;
- canonical principal ID and principal binding version.

It must not copy full records, alias candidates, membership records, roles,
authorization, support notes, complete migration manifests, or legacy source
documents.

No handler or production consumer is authorized. The next slice is
Authorization Decision Contracts.
