# Preview Authority Firestore adapter

Server-only Admin SDK transaction adapter for the closed Preview authority
application service. It maps UID-addressed principals, tenants, memberships,
and sanitized audit records to their certified collections. Every document is
decoded through the V1 closed-schema validators. No snapshot escapes.

This adapter is not a transport and is not exported by the Discovery deployment
unit. Production and Staging are outside its authorized environment.
