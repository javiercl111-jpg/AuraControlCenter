# Authority Dark Handler Composition

This server-only composition certifies that the Authority Application Service can sit behind a closed invocation boundary without creating a real handler. It has no transport, route, Firebase authentication runtime, productive principal or tenant resolver, productive authorization evaluator, or environment-driven activation.

`DISABLED` returns an immutable `INERT` description with no operational method and rejects ambiguous dependencies. `TEST_ONLY` requires an authentic in-memory capability, an already composed `AuthorityApplicationServiceV1`, an injected clock, and closed external metadata. Its only operational surface is `invokeTestOnly(request, context, capability)`.

The capability is issued only by the internal test module, registered by identity in a `WeakSet`, and bound to the composition instance. Its serialized or cloned shape cannot be used to invoke the service. The invocation accepts only an explicitly `TEST_ONLY` execution context, validates request, cancellation and deadline before delegating, and preserves the exact request, context, command, and service result instances.

This directory is deliberately absent from `functions/src/index.ts`. It does not initialize Firebase Admin, connect to Firestore, register a Functions export, read environment state, accept traffic, or authorize production. Tests are the only consumers of the capability issuer.

Verdict: **READY FOR END-TO-END EMULATOR CERTIFICATION**.

Production remains unauthorized. This verdict is not production readiness.
