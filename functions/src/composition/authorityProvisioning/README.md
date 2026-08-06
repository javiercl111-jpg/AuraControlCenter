# Private Preview Authority provisioning composition

This internal server composition binds deterministic SHA-256 identifiers and
fingerprints, an injected clock, and the Firestore transaction adapter to the
V1 application service. It is absent from `previewDiscoveryIndex.ts`, has no
callable or HTTP transport, and cannot be invoked by a browser. A later
certified private procedure may consume it. This slice provisions nothing.
