# Preview Authority Provisioning Capability

This server-only application module defines the closed Preview provisioning and
resolution capability for a synthetic Firebase UID, platform principal, tenant,
and membership. It has no Firebase, Firestore, React, HTTP, callable, ambient
environment, clock, randomness, credentials, or public transport dependency.

The only assignable Discovery authority capability set is empty. Public intake
is pre-principal, while exchange, session resolution, conversation, and
completion rely on server-issued Discovery capabilities. This module does not
invent an administrative permission for those surfaces.

Persistence, time, identifiers, fingerprints, and transactions are injected.
The service rejects non-Preview environments, ambiguous memberships, partial
state, unexpected fields, cross-tenant constraints, and idempotency conflicts.
It returns only sanitized locators and safe codes.

No cloud provisioning is performed by this module. Production remains
unauthorized.
