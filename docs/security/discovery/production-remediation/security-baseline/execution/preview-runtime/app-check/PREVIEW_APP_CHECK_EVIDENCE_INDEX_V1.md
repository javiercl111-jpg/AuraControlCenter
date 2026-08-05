# Preview App Check Evidence Index V1

## Evidence set

| File | Purpose |
| --- | --- |
| `PREVIEW_APP_CHECK_ACTIVATION_V1.md` | Gate, inventory, API activation, client verification, limitations, and verdict |
| `PREVIEW_APP_CHECK_MATRIX_V1.json` | Sanitized machine-readable app, API, provider, debug, client, and scope state |
| `PREVIEW_APP_CHECK_EVIDENCE_INDEX_V1.md` | Evidence sources, hygiene, and certification boundary |
| `PREVIEW_APP_CHECK_CHANGE_RECORD_V1.md` | Authorized scope, actual write, stop conditions, manual completion, and rollback |

Evidence destination: `docs/security/discovery/production-remediation/security-baseline/execution/preview-runtime/app-check/`

## Evidence sources

- Git branch, SHA, worktree, and toolchain gate;
- explicit Preview project read-back;
- enabled-service inventory before and after the change;
- Firebase Web App list;
- Firebase App Check debug-token list;
- Firebase Hosting site inventory;
- reCAPTCHA Enterprise key inventory after API activation;
- App Check provider and service read-back attempts;
- local client contract and 20/20 contract-test result;
- inherited certified resource baseline for Functions, Cloud Run, Storage, Tasks, Staging, and Production.

## Sanitization

This evidence contains metadata only. It excludes Web App credentials, complete App IDs, site-key values, authentication material, debug-token values, personal email addresses, personal data, local absolute paths, and browser-session data.

## External change evidence

One external write occurred: `recaptchaenterprise.googleapis.com` was enabled only in `aura-intel-preview`. Read-back returned the service as enabled.

No Web App, site key, App Check provider, debug token, enforcement setting, code, Rules, secret, Vercel variable, Storage bucket, Task, Function, or Cloud Run service was created or modified.

## Certification boundary

Verified:

- exact active Preview Web App;
- required APIs enabled after the change;
- zero reCAPTCHA Enterprise keys;
- zero App Check debug tokens;
- Preview-only client contract passes 20/20 tests;
- no Function deployment;
- Staging and Production unchanged.

Not certified:

- site key and allowed-domain metadata;
- provider association;
- independent enforcement OFF read-back;
- deployed Preview runtime variable;
- final Vercel Preview domain.

Verdict: **CONDITIONAL — RECAPTCHA ENTERPRISE REQUIRES MANUAL APPROVAL**.

Boundary: **PRODUCTION NOT AUTHORIZED**.
