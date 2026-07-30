# Firestore authority persistence adapter

`FirestoreAuthorityMutationRepository` is a server-only implementation of
`AuthorityMutationRepositoryPort`. It receives an initialized Firestore
instance and an `AuthorityClockPort`; it does not initialize Firebase, read
environment variables, or register a Function.

The adapter validates the command and authoritative invocation context, takes
one clock value before opening one transaction, and reuses that value across
all Firestore callback retries. Each callback reads a closed, operation-specific
document set, assembles a validated partial repository snapshot and legacy read
registry, invokes the pure OS planner, revalidates write-bearing expected reads,
and applies only the writes present in the certified mutation plan.

The transaction runner seam exposes only exact document reads plus `create` and
`update`. Production uses the Firestore Admin runner; unit tests use a small
atomic harness and require no emulator.

Legacy source lookup is closed to `PLATFORM_TENANTS`, which maps only to
`platform_tenants`. All other collection names are infrastructure constants.
No caller-provided collection or path is accepted.

Cancellation is checked before the clock, before the transaction, at each
callback start, after reads, and immediately before writes. A transaction that
has already been submitted to Firestore cannot always be actively cancelled;
the adapter guarantees that a cancellation observed before write scheduling
adds no writes to that callback.
