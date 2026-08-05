# Preview App Check Change Record V1

## Change

- Program: `AI-02H1E.5.0`
- Slice: `AI-02H1E.5.R2C-P5B`
- Change ID: `AI-02H1E.5.R2C-P5B-PREVIEW-APP-CHECK-20260805-01`
- Target: Preview project `aura-intel-preview`
- Branch: `ops/intelligence-preview-appcheck`
- Evidence destination: `docs/security/discovery/production-remediation/security-baseline/execution/preview-runtime/app-check/`

## Authorized scope

- inventory Firebase Apps and App Check metadata;
- enable only APIs strictly required by Preview App Check;
- use the existing Preview Web App;
- create a Preview-only reCAPTCHA Enterprise site key if exact domains and read-back are available;
- register the provider while keeping enforcement OFF;
- retain zero debug tokens;
- verify the client contract;
- create documentation evidence.

Rules, Secrets, Vercel, Storage, Tasks, Functions, Cloud Run, Staging, and Production were excluded from mutation scope.

## Actual external write

Enabled `recaptchaenterprise.googleapis.com` only in `aura-intel-preview`. The service read-back returned `ENABLED`.

No other external write occurred.

## Resulting state

- existing Web App: exact, active, and unchanged;
- Firebase and Firebase App Check APIs: enabled and unchanged;
- reCAPTCHA Enterprise API: enabled by this change;
- reCAPTCHA Enterprise site keys: 0;
- App Check provider: not created by this change; remote state not readable through WIF;
- enforcement: unchanged, inherited OFF, and not independently API-verified;
- debug tokens: 0;
- client contract: 20/20 PASS;
- deployed runtime site key: pending;
- Functions, Cloud Run, Storage, and Tasks: 0;
- Staging: unchanged;
- Production: unchanged under `REMEDIATION_HOLD`.

## Stop conditions reached

- App Check provider and service metadata return `403` through the restricted WIF identity;
- an authenticated Firebase Console session was not available to the execution;
- no site key exists;
- the final Vercel Preview domain is not yet isolated;
- creating a key without provider registration and metadata read-back would leave a partial configuration.

No Function deployment is permitted while these conditions remain.

## Manual completion requirements

An authorized Preview operator must:

1. confirm the final Preview-only deployment domain;
2. create one score-based reCAPTCHA Enterprise site key restricted to that domain and explicitly approved local development, if any;
3. register the key with `Aura Intelligence Preview Web`;
4. keep all App Check enforcement OFF;
5. verify provider and site-key metadata without recording the key value;
6. verify debug-token count remains zero;
7. record the completion under this Change ID before Vercel isolation proceeds.

Do not include a Production domain.

## Rollback

### API activation

If the activation is abandoned, first verify that the project still has zero reCAPTCHA Enterprise keys and no provider dependency, then disable only `recaptchaenterprise.googleapis.com`. Preserve audit evidence.

### Future site key or provider

If a future key is created with an invalid domain, remove only that Preview key. If a future provider association is invalid, remove only that association and leave enforcement OFF. Do not add debug tokens as a fallback.

## Prohibited rollback actions

Do not alter Rules, Secrets, WIF, runtime identities, Vercel, Storage, Tasks, Staging, or Production. Do not deploy Functions or Cloud Run.

## Verdict

**CONDITIONAL — RECAPTCHA ENTERPRISE REQUIRES MANUAL APPROVAL**

**PRODUCTION NOT AUTHORIZED**
