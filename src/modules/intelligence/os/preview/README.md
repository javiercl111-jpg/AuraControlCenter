# AG-07 Controlled Preview Integration V1

## Architectural Overview

This module (`src/modules/intelligence/os/preview`) provides the **Public Preview Facade V1**, a strictly controlled, fail-closed interface designed to expose Aura Intelligence capabilities to external consumers (like Aura Growth) in `EVALUATION`/`SHADOW` mode exclusively.

This implementation acts as an anti-corruption layer on top of `GovernedExecutionBoundary`. It prevents arbitrary injection of authoritative context and completely blocks escalations to `PRODUCTIVE` execution from non-core domains.

## Design Constraints & Invariants

1. **Identity & Authority**: The facade strictly requires a pre-resolved, trusted `BoundaryInvocationContextV1`. It NEVER infers or trusts `tenantId` or `actorId` fields injected in the payload. Instead, it explicitly cross-validates them against the trusted context.
2. **Execution Mode**: The facade statically and forcefully maps the boundary's requested mode to `EVALUATION`. Any request explicitly asking for `PRODUCTIVE` is rejected before any internal OS logic is hit.
3. **Fail-Closed Capabilities**: Capabilities are whitelisted in `PublicPreviewCapabilityV1`. Unknown strings are rejected with a safe error.
4. **Error Sanitization**: `GovernedExecutionResponse` objects are intercepted, and public `PublicPreviewResponseV1` shapes are yielded. Internal trace stacks and stages are safely obfuscated.

## Integration Path

For Aura Growth to integrate, a transport layer (e.g. Cloud Run / Firebase Callable) must be created in `functions/src` that:
1. Receives the HTTP payload.
2. Validates App Check and Firebase Auth claims.
3. Resolves the `BoundaryInvocationContextV1` using trusted resolvers.
4. Calls `AuraIntelligencePublicPreviewFacadeV1.execute(request, context)`.

> Note: The facade itself currently DOES NOT expose any HTTP endpoint, secrets, or external infrastructure. It is purely an OS-level abstraction.
