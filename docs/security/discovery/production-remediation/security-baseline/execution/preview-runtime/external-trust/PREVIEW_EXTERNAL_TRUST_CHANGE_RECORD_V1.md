# Preview External Trust Change Record V1

## Change

- Change ID: `AI-02H1E.5.R2C-P5-PREVIEW-EXTERNAL-TRUST-20260805-01`
- Target: Preview project `aura-intel-preview`
- Actor role: authenticated Preview project operator
- Approver role: pending governance receipt
- Evidence destination: `docs/security/discovery/production-remediation/security-baseline/execution/preview-runtime/external-trust/`

## Authorized resources

- internal and Gemini secret versions and exact secret IAM;
- deferred IP salt IAM cleanup;
- Preview GitHub WIF pool/provider and deployer binding;
- Preview Web App reCAPTCHA Enterprise App Check with enforcement OFF;
- unequivocally targeted Vercel Preview variables;
- governed Preview alerts and budgets.

## Actual external writes

1. Created `preview-github-pool`.
2. Created `preview-github-provider` with repository, owner, main ref, Preview environment, push-event, and subject restrictions.
3. Added repository-attribute `roles/iam.workloadIdentityUser` to `preview-deployer`.

No other external write succeeded or was performed.

## Stop conditions

- the execution security control rejected generated internal secret upload before execution;
- Gemini was not available through a secure local channel;
- reCAPTCHA Enterprise API, provider permission, site key, and definitive domain were incomplete;
- Vercel targeting was not repository-linked and existing variables crossed Production/Preview scopes;
- alert notification channel and owner were unavailable;
- budget API or permission remained unavailable.

Function deployment remains stopped.

## Rollback

### WIF

1. Remove the repository principal-set `roles/iam.workloadIdentityUser` binding from `preview-deployer`.
2. Disable `preview-github-provider`.
3. Disable `preview-github-pool`.
4. Preserve IAM and provider audit evidence.

### Secrets

No version or IAM binding changed. For a future version created under this Change ID, disable that version and retain the container and audit history.

### App Check and Vercel

No write occurred. Keep enforcement OFF. If a future invalid provider/site key or Preview variable is introduced under this Change ID, remove only that resource or variable and do not alter Production scope.

### Alerts and budgets

No policy or budget was created. A future rollback must disable or remove only resources carrying this Change ID.

## Prohibited rollback actions

Do not relax Rules, copy secrets between environments, create permanent keys, deploy runtime services, create Storage or Tasks, or alter Staging or Production.
