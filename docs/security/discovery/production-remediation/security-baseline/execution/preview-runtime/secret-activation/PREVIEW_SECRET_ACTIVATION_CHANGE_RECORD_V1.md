# Preview Secret Activation Change Record V1

## Change

- Slice: `AI-02H1E.5.R2C-P5A`
- Change ID: `AI-02H1E.5.R2C-P5A-PREVIEW-SECRETS-20260805-01`
- Target: Preview project `aura-intel-preview`
- Branch: `ops/intelligence-preview-secret-activation`
- Evidence basis: operator-verified authoritative metadata
- Evidence destination: `docs/security/discovery/production-remediation/security-baseline/execution/preview-runtime/secret-activation/`

## Authorized secret scope

- `discovery-idempotency-secret-preview`;
- `discovery-hmac-secret-preview`;
- `discovery-gemini-api-key-preview`;
- preserved deferred container `discovery-ip-hash-salt-preview`.

No Staging or Production secret is in scope.

## Resulting authoritative state

1. Idempotency v3 is the sole enabled version and `preview-public-intake-runtime` is the sole accessor.
2. HMAC v2 is the sole enabled version and `preview-discovery-complete-rt` is the sole accessor.
3. Gemini v2 is the sole enabled version and `preview-conversation-runtime` is the sole accessor.
4. The IP salt remains deferred with zero versions and zero accessors.
5. Project-level Secret Manager accessor bindings remain at zero.
6. User-managed keys remain at zero across 11 service accounts.

The active versions were loaded from temporary UTF-8 files without BOM or trailing newline. This record contains no value or recoverable secret material.

## Incident disposition

| Resource | Version | State | Disposition | Consumption |
| --- | --- | --- | --- | --- |
| Idempotency | v1 | `DISABLED` | Invalid entropy generation | Never consumed |
| Idempotency | v2 | `DISABLED` | Preventive rotation for possible pipeline newline | Never consumed |
| HMAC | v1 | `DISABLED` | Preventive rotation for possible pipeline newline | Never consumed |
| Gemini | v1 | `DISABLED` | Preventive rotation for possible pipeline newline | Never consumed |

All disabled versions are retained for audit history and must remain disabled.

## Documentation closure actions

Only the four evidence files in this directory were created. This closure performed no external read or write and made no code, Rules, Function, Cloud Run, Storage, Tasks, IAM, App Check, Vercel, Staging, or Production change.

## Stop conditions

Stop and do not deploy a Function if any of the following is observed:

- an active version is not `ENABLED`;
- more than one enabled version exists for a consumed secret;
- an accessor differs from the exact runtime identity recorded here;
- project-level secret access is introduced;
- the IP salt gains a version or accessor before separate authorization;
- any user-managed key appears;
- Staging or Production scope becomes involved.

## Rollback

1. Disable only the invalid active version.
2. Preserve the container, disabled version, and audit history.
3. Generate an environment-exclusive replacement and load it through the approved secure local procedure.
4. Verify metadata and exact resource-level access without reading the value.
5. Do not re-enable an incident version, copy values between environments, broaden IAM, or touch Staging or Production.

## Final boundary

**PREVIEW SECRET ACTIVATION COMPLETE — READY FOR APP CHECK**

**PRODUCTION NOT AUTHORIZED**

No Function deployment is authorized by this record.
