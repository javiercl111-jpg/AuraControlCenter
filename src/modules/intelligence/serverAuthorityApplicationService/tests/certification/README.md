# Authority Boundary Unit Certification

## Scope

This test-only suite certifies the closed Authority boundary formed by Principal
Resolution, Tenant/Scope Resolution, Authorization Decision, Invocation Context
Closure, Authority Application Service, and deterministic repository doubles.
It adds no runtime surface and authorizes no production traffic.

The suite is colocated under the Application Service tests because that service
owns the orchestration sequence and is the only application-layer consumer of
`AuthorityMutationRepositoryPort`. Existing D.6 deterministic doubles are
reused without exporting test helpers from the server package.

## Certified matrices

- five valid principal types and every closed principal failure result;
- six valid scope types, every closed scope failure, tenant executability, and
  special-scope isolation;
- all authorization decisions and evaluator failure results;
- all eleven obligation types plus missing, duplicate, undeclared, stale,
  unsatisfied, fingerprint, and summary contradictions;
- READY and safe non-ready invocation contexts, cross-binding contradictions,
  freshness, and idempotency closure;
- every repository result, timeout, unavailable/internal failures, and
  cancellation checkpoints;
- exact stage order, command identity, safe trace, anti-enumeration, and
  repository ownership.

## Product contradictions closed

1. Authorization principal binding is compared explicitly against the resolved
   principal across identity, type, status, authentication method, assurance,
   binding version, evidence fingerprint, resolution time, and validity.
2. A normal `TENANT` scope is executable only while scope, tenant, and membership
   are active and its principal/tenant bindings remain coherent. Special scopes
   retain their own certified rules.

The remaining provisional failures were harness classification errors: a
non-ready Invocation Context is a valid closed value but cannot be projected,
`NOT_AUTHORIZED` belongs to the context status rather than the context-result
failure union, and clock-triggered cancellation is attributed to the stage
being closed rather than the following checkpoint.

## Invariants

- Only coherent READY + ALLOW reaches the repository.
- No later stage runs after a failed boundary.
- Repository calls are zero for every pre-repository contradiction.
- The original command instance, operation ID, fingerprint, and idempotency
  bindings remain unchanged.
- Results and trace expose no raw input, identity document, policy source,
  infrastructure path, stack, or secret.
- All clocks, identifiers, hashes, and matrices are deterministic and injected.

## Exclusions and residual risk

The suite contains no resolver/evaluator implementation, Firebase, Firestore,
Functions, handler, transport, productive Composition Root, planner change,
adapter change, persistence-contract change, emulator, Rules, indexes, or
deployment. Concrete runtime composition and production authorization remain
outside D.7.

## Verdict

**CERTIFIED FOR DARK COMPOSITION**

This verdict does not authorize production use.
