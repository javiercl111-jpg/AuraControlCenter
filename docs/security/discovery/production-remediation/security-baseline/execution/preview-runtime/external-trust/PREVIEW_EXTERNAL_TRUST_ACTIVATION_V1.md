# Preview External Trust Activation V1

## Execution record

- Slice: `AI-02H1E.5.R2C-P5`
- Change ID: `AI-02H1E.5.R2C-P5-PREVIEW-EXTERNAL-TRUST-20260805-01`
- Recorded at: `2026-08-04T19:49:08-06:00`
- Target: `aura-intel-preview`
- Branch: `ops/intelligence-preview-external-trust-activation`
- Certified base: `5c8ae75dc67a80af877dd35f3ef97bac503e322a`
- Actor role: authenticated Preview project operator
- Approver role: pending governance receipt

## Gate

The gate passed with the exact branch, `HEAD == origin/main`, a clean worktree, Node `v20.20.2`, npm `10.8.2`, PR #87 and PR #88 present, and Preview Trust Completion 20/20 PASS.

## Secret activation

The two internal secret containers and their exact resource-level accessors were verified. The execution security control rejected generation/upload before either write ran. Both internal containers therefore remain at zero versions.

Gemini material was unavailable through a local secure operator channel and was not requested through chat. It remains at zero versions. The IP salt container remains preserved, deferred, at zero versions, with no accessor or consumer.

No project-level, cross-runtime, default-compute, generic, or deployer secret access exists. No secret value was read, printed, persisted, or documented.

## WIF activation

The following external resources were created and verified:

- pool `preview-github-pool`, state `ACTIVE`;
- OIDC provider `preview-github-provider`, state `ACTIVE`;
- GitHub issuer `https://token.actions.githubusercontent.com`;
- exact repository and owner claims;
- exact `refs/heads/main` ref;
- exact GitHub environment `preview`;
- `push` event only;
- exact environment-bound subject;
- `roles/iam.workloadIdentityUser` on `preview-deployer` through the repository attribute principal set.

The provider condition denies forks, pull requests, feature branches, tags, other repositories, other environments, and ambiguous subjects. No runtime identity received impersonation. The canonical provider audience is used; the future workflow must request a 900-second access-token lifetime.

`preview-deployer` has no project-level runtime role and no secret access. Runtime identities retain only their inherited Firestore and logging roles. No permanent key was created.

## App Check and reCAPTCHA Enterprise

The exact Preview Web App and zero debug tokens were verified. The reCAPTCHA Enterprise API is not enabled. App Check provider and service-enforcement read-back returned `403`.

No definitive Preview domain, usable site-key metadata, or sufficient provider permission was available. The provider was not partially configured, no API was enabled, no debug token was created, and enforcement was not changed. Its inherited state remains OFF but could not be independently API-certified.

## Vercel Preview targeting

Seven Aura-named projects were visible. The exact-name candidate `aura-control-center` is not locally linked to this repository and its project inventory exposes no repository link. Six observed Firebase/App Check variables are shared between `production` and `preview`; the App Check variable also uses the legacy name rather than the current client contract.

This is not an unequivocal Preview-only target. No Vercel variable was added, replaced, removed, or pulled locally. In particular, no Production-scoped variable was changed.

## Observability and budgets

Four Preview log-based metrics remain present. Alert-policy count is zero. Notification-channel read-back and owner approval are pending, so none of the approved thresholds was materialized as an incomplete alert.

Budget read-back remains blocked by API or permission. Neither the USD 5 nor USD 10 budget was created, and IAM was not broadened.

## Final read-back

- internal secret versions: 0;
- Gemini versions: 0;
- IP salt versions/accessors: 0/0;
- WIF pool/provider: ACTIVE/ACTIVE;
- deployer WIF binding: verified;
- user-managed keys: 0 across 11 service accounts;
- Functions: 0;
- Cloud Run services: 0;
- Storage buckets: 0;
- Cloud Tasks API: disabled;
- Function and Cloud Run deploys: 0.

Staging and Production were not queried or changed by this slice. Production remains under remediation hold.

## Verdict

**BLOCKED — PREVIEW EXTERNAL TRUST INCOMPLETE**

WIF is activated and certifiable, but external trust cannot authorize a Function deployment while all consumed secrets lack versions, App Check remains unconfigured/unverified, Vercel Preview targeting is ambiguous, and alert/budget governance is incomplete.
