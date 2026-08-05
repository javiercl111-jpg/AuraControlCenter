# Preview Trust Completion Change Record V1

## Change

- Change ID: `AI-02H1E.5.R2C-P4-PREVIEW-TRUST-COMPLETION-20260804-01`
- Target: Preview project `aura-intel-preview`
- Actor role: authenticated Preview project operator
- Approver role: pending governance receipt
- Evidence destination: `docs/security/discovery/production-remediation/security-baseline/execution/preview-runtime/trust-completion/`

## Authorized resources

- the three demonstrated secret consumers;
- exact resource-level secret accessor policies;
- Preview-only WIF design and, with an approved ref, federation resources;
- Preview Web App reCAPTCHA Enterprise App Check with enforcement off;
- Preview client App Check integration;
- minimum observability with approved governance inputs.

## Actual changes

External changes: none. Existing secret IAM already matched the required identities; the IP salt already had no accessor. Secret-version creation was rejected before execution. WIF and App Check writes were not attempted because required branch/provider inputs and permissions were incomplete.

Local changes implement and test the fail-closed Preview App Check client contract and add this sanitized evidence set.

## Stop conditions reached

- secret version creation not authorized by the environment security control;
- Gemini value absent from a secure operator channel;
- deployment branch/ref not approved;
- App Check provider/enforcement read-back denied;
- alert thresholds, notification channel, and owner absent;
- budget read-back unavailable.

These conditions stop all Function deployment.

## Rollback

### Secrets

No version was created and no binding changed. For a future compromised version: disable the version, retain the resource and audit history, and remove only the exact accessor added by this Change ID.

### WIF

No pool, provider, or binding was created. For a future rollback: remove deployer impersonation, disable the provider, disable the pool, and retain evidence.

### App Check

No external provider or enforcement change was made. Keep enforcement off; remove an invalid future provider and delete any future debug token.

### IAM

No IAM write occurred. Future rollback must remove only bindings introduced under this Change ID.

### Client

Revert `.env.example`, `src/config/previewAppCheckContractV1.ts`, the App Check section of `src/config/firebase.ts`, and the safe boolean reference in `src/pages/DiscoverPage.tsx` if the contract fails architectural review.

## Prohibited rollback actions

Do not relax Rules, copy secrets across environments, create permanent keys, enable deferred document features, or alter Staging or Production.
