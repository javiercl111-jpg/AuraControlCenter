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
