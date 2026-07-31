# Authority Invocation Context Closure

This server-only module closes the contract between resolved principal,
resolved scope, authorization decision, operational metadata, idempotency,
obligation satisfaction, and the existing Authority repository invocation
context. It contains pure contracts, validation, factories, and one pure
projector. It contains no resolver, policy evaluator, application service,
repository implementation, adapter, handler, production composition, clock,
randomness, environment read, Firebase, Firestore, Functions, or React code.

## Rich context and minimal persistence projection

`AuthorityInvocationContextV1` retains only bounded projections. Full
principals, token claims, memberships, policy evidence, commands, manifests,
documents, and repository objects are deliberately excluded. Operational IDs
and idempotency keys bind an invocation; they never grant authority.

The repository contract remains unchanged. Only a `READY` context with an
`ALLOW` decision, an active principal, a compatible scope, current freshness,
consistent principal/scope/operation/resource/idempotency bindings, and one
satisfied or not-applicable evidence record per declared obligation can be
projected.

The projector maps fields as follows:

- the principal projection becomes the existing trusted principal and actor;
- the single operation becomes `authorizedOperationTypes`;
- the policy version becomes the repository authorization version;
- `ALLOW` becomes the repository's `ALLOWED`;
- evaluated and aggregate-valid-until timestamps become decision bounds;
- request, correlation, consumer, source, and creation time become the
  repository invocation metadata.

Policy evidence, matched rules, scope details, obligation evidence,
idempotency material, command fingerprints, and context fingerprints are not
copied to persistence.

## Closed bindings and freshness

Principal identity must agree across principal, authorization, and
idempotency projections. Scope and tenant identity must agree across scope,
authorization, resource, and idempotency projections. Platform scope carries
no synthetic tenant. Bootstrap is limited to tenant creation, legacy scope to
legacy canonicalization, migration resources to declared target tenants, and
support freshness to the support-session limit.

Aggregate `validUntil` is the exact minimum of principal, scope,
authorization, and applicable obligation limits. Validation uses only
provided canonical timestamps and never reads ambient time or extends a
source window. Context fingerprints are supplied by the future orchestration
owner and validated as certified SHA-256 references; this module does not
invent canonicalization or cryptography.

The next slice is the Authority Application Service. Until then there is no
runtime or production consumer.
