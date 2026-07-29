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
