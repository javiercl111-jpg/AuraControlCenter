# Preview Secret Activation Evidence Index V1

## Evidence set

| File | Purpose |
| --- | --- |
| `PREVIEW_SECRET_ACTIVATION_V1.md` | Authoritative activation state, incidents, controls, rollback, and verdict |
| `PREVIEW_SECRET_ACTIVATION_MATRIX_V1.json` | Sanitized machine-readable versions, accessors, incidents, keys, and scope matrix |
| `PREVIEW_SECRET_ACTIVATION_EVIDENCE_INDEX_V1.md` | Evidence inventory, source boundaries, hygiene, and limitations |
| `PREVIEW_SECRET_ACTIVATION_CHANGE_RECORD_V1.md` | Authorized scope, resulting state, stop conditions, and rollback record |

Evidence destination: `docs/security/discovery/production-remediation/security-baseline/execution/preview-runtime/secret-activation/`

## Evidence basis

This documentation closure uses operator-verified authoritative metadata for target `aura-intel-preview`. It records container names, version numbers and states, exact accessor identity names, aggregate key counts, infrastructure counts, environment controls, and incident dispositions.

No secret value was requested or read during this closure. The evidence does not contain secret material, authentication material, personal email addresses, personal data, or local absolute paths.

## Certified controls

- one enabled version for each consumed Preview secret;
- all superseded versions disabled and never consumed;
- IP salt preserved with zero versions and zero accessors;
- exact resource-level accessor separation;
- zero project-level Secret Manager accessor bindings;
- zero user-managed keys across 11 service accounts;
- zero Functions, Cloud Run services, Storage buckets, and Cloud Tasks resources;
- no Function deployment;
- no App Check or Vercel mutation;
- Staging unchanged;
- Production unchanged under `REMEDIATION_HOLD`.

## Limitations

- this evidence set does not contain or validate secret values;
- version creation timestamps were not supplied and are not asserted;
- this documentation closure did not perform a new external read or write;
- readiness is limited to the next separately governed App Check slice;
- Production remains unauthorized.

Verdict: **PREVIEW SECRET ACTIVATION COMPLETE — READY FOR APP CHECK**.

Boundary: **PRODUCTION NOT AUTHORIZED**.
