# Authority Authorization Decision Contracts

This module defines the closed, server-only contracts for representing an
authorization decision that has already been evaluated. It contains no policy
engine, RBAC implementation, claims evaluator, repository, adapter, policy
reader, Firebase/Firestore access, Functions code, handler, middleware,
environment access, clock, randomness, or production composition.

## Separation of responsibilities

- Principal resolution establishes who the actor is; it grants no permission.
- Tenant/scope resolution establishes where the actor intends to act; it
  grants no permission.
- Membership is evidence of a relationship, not authorization.
- A role is neither identity, permission, nor decision.
- Assurance and App Check are evidence. Neither grants permission.
- Platform scope does not imply total access.
- `superadmin` is not a decision and creates no bypass.
- Authorization binds one principal, one resolved scope, one operation, one
  permission, one resource, and one versioned policy evaluation.

`DENY` is a valid evaluated decision. `REJECTED`, `STALE`, `CONFLICT`, and
`INTERNAL_ERROR` are evaluation/contract outcomes and must not be confused
with `DENY`. Obligations on an `ALLOW` must be satisfied before execution.
Obligations on a `DENY` may describe safe remediation but never transform it
into `ALLOW`.

## Closed permission and obligation vocabularies

Permissions map one-to-one to the eight certified Authority operation types.
Wildcards, `admin`, `all`, arbitrary caller permissions, role names, and
default allow are unrepresentable.

Obligations are closed payloads for freshness, App Check, MFA, idempotency,
expected versions, audit reason, change ticket, support session, migration
manifest, not-found masking, and test-only execution. Bypass, rule skipping,
audit skipping, cross-tenant access, caller tenant trust, and admin override
are unrepresentable.

## Anti-enumeration

Internal decisions can distinguish permission, resource/scope, membership,
policy, and binding failures. A future external error boundary must collapse
tenant-not-found, membership-not-found, resource-outside-scope, cross-tenant,
and permission-denied details into a uniform response where disclosure could
enumerate another tenant or identity.

## Persistence compatibility

`AuthorityRepositoryAuthorizationDecisionV1` is intentionally not modified.
It is a minimal persistence projection and cannot replace this richer
contract. AI-02H1E.3D.5 should project only:

- `ALLOW`/`DENY` into the repository decision vocabulary;
- exact permission and operation;
- principal ID;
- scope type and canonical tenant ID when applicable;
- policy version and decision fingerprint;
- evaluated/valid-until timestamps;
- obligation-satisfaction fingerprint.

Full policy evidence, matched rules, principal/scope bindings, obligations,
roles, claims, documents, and source material must not reach persistence.

No handler or production consumer is authorized. The next slice is Invocation
Identity, Idempotency and Context Closure.
