# Preview Secret Activation V1

## Execution record

- Slice: `AI-02H1E.5.R2C-P5A`
- Change ID: `AI-02H1E.5.R2C-P5A-PREVIEW-SECRETS-20260805-01`
- Recorded on: `2026-08-05`
- Target: `aura-intel-preview`
- Branch: `ops/intelligence-preview-secret-activation`
- Evidence basis: operator-verified authoritative metadata
- Scope: Preview secret activation certification only

This record certifies metadata and control state only. No secret value was read, reproduced, persisted, or added to this evidence set.

## Activation result

| Secret container | Versions | Active version | Exclusive accessor | Status |
| --- | --- | --- | --- | --- |
| `discovery-idempotency-secret-preview` | 3 total: v3 `ENABLED`; v2 and v1 `DISABLED` | v3 | `preview-public-intake-runtime` | ACTIVE |
| `discovery-hmac-secret-preview` | 2 total: v2 `ENABLED`; v1 `DISABLED` | v2 | `preview-discovery-complete-rt` | ACTIVE |
| `discovery-gemini-api-key-preview` | 2 total: v2 `ENABLED`; v1 `DISABLED` | v2 | `preview-conversation-runtime` | ACTIVE |
| `discovery-ip-hash-salt-preview` | 0 | none | none | DEFERRED |

The three active versions were loaded from temporary UTF-8 files without BOM or trailing newline. The temporary material is not part of this repository or evidence set.

## Incident and rotation record

1. Idempotency v1 is `DISABLED`. Its entropy generation was invalid, and the version was never consumed.
2. Idempotency v2 is `DISABLED`. It was rotated preventively because a PowerShell pipeline might have introduced a trailing newline, and the version was never consumed.
3. HMAC v1 is `DISABLED`. It was rotated preventively because a pipeline might have introduced a trailing newline, and the version was never consumed.
4. Gemini v1 is `DISABLED`. It was rotated preventively because a pipeline might have introduced a trailing newline, and the version was never consumed.

Disabled versions remain preserved for audit history. They are not the active versions and must not be re-enabled.

## IAM and key controls

- each active secret has exactly one resource-level accessor, listed in the activation table;
- the IP salt has zero accessors and zero versions;
- project-level Secret Manager accessor bindings: 0;
- user-managed service-account keys: 0 across 11 service accounts;
- no IAM expansion is recorded by this documentation closure.

## Infrastructure and environment controls

- Functions: 0; no Function deployment performed;
- Cloud Run services: 0;
- Storage buckets: 0;
- Cloud Tasks resources: 0;
- App Check: unchanged and not touched;
- Vercel: unchanged and not touched;
- Staging: unchanged;
- Production: unchanged and remains under `REMEDIATION_HOLD`;
- no additional external change was performed by this documentation closure.

## Rollback

If an active version is later found invalid, disable only that exact version, retain the secret container and audit history, and activate a newly generated environment-exclusive replacement through the approved secure local procedure. Do not re-enable the incident versions, copy values between environments, broaden IAM, or alter Staging or Production.

## Verdict

**PREVIEW SECRET ACTIVATION COMPLETE — READY FOR APP CHECK**

**PRODUCTION NOT AUTHORIZED**

This verdict authorizes only progression to a separately governed App Check slice. It does not authorize a Function deployment or any Production action.
