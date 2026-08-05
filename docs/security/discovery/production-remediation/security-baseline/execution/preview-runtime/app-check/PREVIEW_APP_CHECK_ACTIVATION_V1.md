# Preview App Check Activation V1

## Execution record

- Program: `AI-02H1E.5.0`
- Slice: `AI-02H1E.5.R2C-P5B`
- Change ID: `AI-02H1E.5.R2C-P5B-PREVIEW-APP-CHECK-20260805-01`
- Recorded on: `2026-08-05`
- Target: `aura-intel-preview`
- Branch: `ops/intelligence-preview-appcheck`
- Certified base: `6bd724fa1a3bfc1ba075a9aa4228f94c4fc2d998`

## Gate

The gate passed with the exact branch, `HEAD == origin/main`, a clean worktree, Node `v20.20.2`, npm `10.8.2`, and the configured target `aura-intel-preview`.

## Read-only inventory before change

| Control | Classification | Observed state |
| --- | --- | --- |
| Firebase Web App | READY | One `ACTIVE` Web App named `Aura Intelligence Preview Web`; certified App ID suffix unchanged |
| Firebase App Check API | READY | Enabled |
| reCAPTCHA Enterprise API | MISSING | Disabled |
| reCAPTCHA Enterprise site keys | MISSING | Not listable until API activation |
| App Check provider | PARTIAL | Metadata read-back returned `403` through the restricted WIF identity |
| Enforcement | PARTIAL | Inherited OFF; API read-back returned `403` |
| Debug tokens | READY | 0, verified through Firebase CLI |
| Preview domain | PARTIAL | The project owns the exact Firebase Hosting site `aura-intel-preview`; no Vercel domain was selected or changed |

## API activation

Only `recaptchaenterprise.googleapis.com` was enabled in `aura-intel-preview`. Read-back confirmed the API enabled. No unrelated API was enabled.

After activation, the reCAPTCHA Enterprise key inventory returned zero keys.

## Web App and domain boundary

The existing Web App belongs to the exact Preview project and remains `ACTIVE`. No additional Web App was created.

The project-owned Preview Hosting domain is the only unequivocal non-local domain candidate found in scope. No Production domain was selected. `localhost` was not added because no site key was created. No Hosting deployment or Vercel change occurred.

## Provider, site key, and enforcement

The restricted WIF identity can read project and service state but receives `403` for App Check provider and service configuration. The authenticated browser console was unavailable to this execution. Creating a site key without the ability to register and read back the provider would leave a partial security configuration, so no key or provider was created.

Enforcement was not modified. Its inherited state remains OFF, but the App Check API did not permit independent enforcement read-back. No service exists on which to activate enforcement.

## Debug policy

Debug-token count is 0. No debug token was created, requested, emitted, or stored.

## Client verification

The repository client already matches the intended Preview contract:

- `previewAppCheckContractV1` requires environment `PREVIEW` and exact project `aura-intel-preview`;
- `firebase.ts` uses `ReCaptchaEnterpriseProvider` and enables automatic refresh;
- the site key is supplied only through the dedicated Preview runtime variable;
- `DiscoverPage` records only the boolean configured state and does not expose key material;
- debug mode is disabled by contract;
- `test:preview-trust-completion` passed 20/20 tests.

No code change was required. The runtime site-key value remains pending because no remote site key exists.

## Scope read-back

- Functions: 0; no deployment;
- Cloud Run services: 0;
- Storage buckets: 0;
- Cloud Tasks resources: 0;
- Rules: unchanged;
- Secrets: unchanged;
- Vercel: unchanged;
- Staging: unchanged;
- Production: unchanged under `REMEDIATION_HOLD`.

## Risks and limitations

- provider and enforcement read-back remain unavailable to WIF;
- no reCAPTCHA Enterprise site key exists;
- App Check provider registration is incomplete;
- the final Preview deployment domain must be confirmed before key creation;
- reCAPTCHA assessment cost governance remains outside this slice;
- Vercel runtime configuration is intentionally deferred.

## Verdict

**CONDITIONAL — RECAPTCHA ENTERPRISE REQUIRES MANUAL APPROVAL**

App Check is not yet activated. A manually authenticated Preview operator must create the Preview-only score-based site key, register it with the existing Web App, keep enforcement OFF, verify debug-token count 0, and provide metadata-only read-back.

**PRODUCTION NOT AUTHORIZED**

No Function deployment is authorized by this record.
