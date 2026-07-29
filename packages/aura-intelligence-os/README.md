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
source. The package is not imported by production Functions code and is never
published.

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
`PipelineBootstrapper` entirely in memory. Its consumer is located under
`functions/tests`; production `functions/src` remains free of OS imports and
execution.

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
