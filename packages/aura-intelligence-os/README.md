# Aura Intelligence OS — Server Build Boundary

`@aura/intelligence-os` is a private, server-only build boundary for Node 20.
It emits CommonJS and TypeScript declarations from the canonical source in
`src/modules/intelligence`.

The package intentionally exposes only `@aura/intelligence-os/server`. Browser,
React, Vite, Firebase, Discovery, UI, persistence, and network integrations are
outside this boundary.

`dist/` is generated and must not be committed or edited. This package is not
published and is not yet consumed or staged by Firebase Functions.
