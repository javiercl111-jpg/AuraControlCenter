# Authority Principal Resolution Contracts

This module defines the closed, Firebase-free contracts used to represent a
principal after authentication metadata has been verified and canonical
identity binding has been resolved. It contains no resolver implementation,
I/O, environment access, clock, randomness, handler, middleware, tenant
resolution, membership resolution, authorization, or production composition.

The normalized claims snapshot contains only token timing, issuer/audience,
version, and irreversible subject/snapshot fingerprints. It never transports
the complete claims map, roles, permissions, raw tokens, email, or other PII.

## Identity boundaries

- A principal is the nature and canonical identity of an actor. It is not a
  role, permission, tenant, membership, employee record, or authorization
  decision.
- Email is never a canonical principal ID.
- Firebase UID and platform user ID are distinct, explicitly bound values.
- Employee ID is not a Firebase UID and is not part of this contract.
- A service account email is not sufficient by itself; IAM issuer, subject,
  audience, and a server-owned binding are required.
- `PLATFORM_ADMIN` is intentionally not a principal type. Platform authority is
  a later authorization attribute.
- Support operators remain their real operator identity. The contract marks
  impersonation as prohibited and carries no customer or tenant scope.
- Migration identity does not imply global authority. Migration scope and
  permission belong to later contracts.

## Assurance and App Check

Assurance is evidence, never permission. App Check proves an attested app
context, not user identity, tenant scope, role, or authorization.

`REQUIRED_AND_VALID` is required for resolved app callers.
`NOT_APPLICABLE_INTERNAL_CALLER` is used for verified internal identities.
`NOT_EVALUATED` is allowed only as pre-resolution evidence and is rejected by
resolved principal validation. There is no bypass or optional-success state.

## Existing contract relationship

`serverIdentity` remains the certified lower-level vocabulary for verified
subjects, canonical bindings, and trusted `USER | SERVICE | SYSTEM`
projections. This module does not replace or mutate it. It adds the boundary
contract required by AI-02H1E.3D.2: five principal natures, authentication
binding details, assurance, evidence, freshness, safe failure results, and the
resolver port.

The principal-resolution retry vocabulary is intentionally separate from
Authority persistence retry dispositions. Persistence answers whether a
mutation can be replayed; principal resolution answers whether identity should
be retried after reauthentication, refresh, or operator review.

## Resolver request and context

`AuthorityPrincipalResolutionRequestV1` accepts only normalized metadata from a
previous authentication boundary. Raw ID/access/refresh tokens, JWTs, private
keys, passwords, complete claims maps, caller-proposed principal IDs, roles,
tenant IDs, and authorization decisions are rejected by closed-record
validation.

`AuthorityAuthenticationClaimsSnapshotV1` is carried only as optional
resolution evidence. Its timestamps and version must agree with the enclosing
resolution evidence; it is not an authorization input.

`AuthorityPrincipalResolutionContextV1` carries request ID, correlation ID,
channel, resolver version, and injected resolution time. Cancellation remains
an execution concern outside this serializable contract and can be carried by
a future runtime execution envelope.

Only `AuthorityPrincipalResolverPort` is defined. A separate binding-reader
port is deferred until a runtime slice proves it necessary.

## Freshness

All timestamps are canonical ISO instants supplied as values. Validators use no
ambient clock. `validUntil` must be exactly `staleAfterSeconds` after
`resolvedAt`; binding and optional claims versions must remain consistent.
Historical/expired values remain representable because determining staleness
requires an injected comparison time. A resolver reports that outcome through
the `STALE` result variant.

## Future invocation-context projection

For AI-02H1E.3D.5, `ResolvedAuthorityPrincipalV1.principalId` and
`principalType` should project to the repository principal/actor only through a
certified mapping. The repository context should persist or bind:

- canonical principal ID and mapped actor type;
- canonical binding version;
- resolver version;
- evidence fingerprint;
- assurance level and freshness decision version.

Full authentication bindings, App Check details, UID/platform-user pair,
support session details, claims metadata, and raw evidence must not be copied
into repository audit events. Tenant, membership, roles, permissions,
operation allowlists, policy versions, and obligations belong to tenant and
authorization contracts, not this principal.

## Status

`ACTIVE`, `SUSPENDED`, `REVOKED`, and `DISABLED` are representable. This module
does not authorize them. A future invocation boundary must reject every status
other than `ACTIVE`.

No handler or production use is authorized. The next slice is Tenant & Scope
Resolution Contracts.
