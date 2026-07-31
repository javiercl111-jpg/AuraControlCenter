# Authority Application Service

This server-only module owns the closed Authority orchestration boundary. It
coordinates principal resolution, tenant/scope resolution, authorization,
obligation verification, invocation-context construction and fingerprinting,
persistence projection, repository execution, and safe result mapping.

`AuthorityApplicationServiceV1` is the only application-layer owner of
`AuthorityMutationRepositoryPort`. The repository receives the same validated
command instance that entered the service. It does not authenticate, authorize,
rebuild commands, or reinterpret policy.

The flow is fail-closed and stops at the first non-executable stage:

1. validate request and execution context;
2. resolve an active, fresh principal;
3. resolve a compatible, fresh tenant scope;
4. obtain a current `ALLOW` decision;
5. verify every declared obligation;
6. construct the rich invocation context;
7. obtain its canonical SHA-256 fingerprint from the injected port;
8. project the certified context to persistence;
9. execute the repository once;
10. map the repository result to the closed internal result vocabulary.

Every timestamp comes from the injected execution context or clock. Cancellation
is checked around dependency boundaries and is never serialized into the
invocation context. The stage trace contains only closed stage names, safe codes,
retry dispositions, and timestamps.

This slice intentionally contains no authentication runtime, principal or scope
resolver runtime, authorization evaluator runtime, Firebase, Firestore,
Functions, handlers, transport, productive Composition Root, or production
traffic. Concrete dependencies remain future composition work.

The next slice is **Boundary Unit Certification**.
