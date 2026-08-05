# Preview Trust Completion V1

## Execution record

- Slice: `AI-02H1E.5.R2C-P4`
- Change ID: `AI-02H1E.5.R2C-P4-PREVIEW-TRUST-COMPLETION-20260804-01`
- Target: `aura-intel-preview`
- Branch: `security/intelligence-preview-trust-completion`
- Base: `da58fc7912a2c62442e8fb7089e65a91ef24755e`
- Actor role: authenticated Preview project operator
- Approver role: pending governance receipt

## Gate

The gate passed: exact branch, clean initial worktree, `HEAD == origin/main`, Node `v20.20.2`, npm `10.8.2`, R2C-P3 present, Preview target exact, and Production hold inherited.

## Authoritative inventory

Preview contains eleven service accounts, including the four abbreviated runtime identities, `preview-deployer`, telemetry, inherited Firebase/default accounts, and two earlier generic identities. Project IAM has no project-level `roles/secretmanager.secretAccessor` binding. The four runtime identities have Firestore/logging permissions inherited from the prior slice; deployer has no runtime execution or secret accessor binding.

All eleven service accounts have zero user-managed keys. No JSON key was created.

## Secret boundary

The four containers exist. Resource-level access was already exact, so no IAM write was necessary:

| Secret | Versions | Exact accessor | Status |
| --- | ---: | --- | --- |
| `discovery-idempotency-secret-preview` | 0 | `preview-public-intake-runtime` | version pending |
| `discovery-hmac-secret-preview` | 0 | `preview-discovery-complete-rt` | version pending |
| `discovery-gemini-api-key-preview` | 0 | `preview-conversation-runtime` | operator value pending |
| `discovery-ip-hash-salt-preview` | 0 | none | deferred |

No cross-runtime, default-compute, generic accessor, deployer, or project-level secret access was found. The IP salt container was retained with no version and no accessor.

The environment security control rejected automated generation/upload of the two internal secret values before execution. No secret version was created. Gemini was not provided through a secure operator channel and was not requested in chat.

## WIF

No Workload Identity Pool, provider, or deployer impersonation binding exists. The approved design is recorded in the matrix with the exact repository, owner, GitHub issuer, Preview environment, push-only event, subject, and 900-second target token lifetime.

The definitive deployment branch/ref was not supplied. Therefore no pool/provider or binding was materialized, preventing an ambiguous or all-branches federation rule. The provider and impersonation binding remain fail-closed and pending.

## App Check

The exact Preview Web App was verified. Debug-token inventory is zero. Provider and service-enforcement API read-back returned `403`, so provider metadata and enforcement could not be independently certified. No permission was broadened and no provider was created.

The client integration is now explicit and local-only:

- `VITE_AURA_RUNTIME_ENVIRONMENT` is mandatory;
- Preview must match `aura-intel-preview` exactly;
- reCAPTCHA Enterprise site-key metadata is read only from `VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY`;
- missing environment, project mismatch, or missing Preview site key fails closed;
- Staging, Production, and local-demo environments do not consume Preview configuration;
- debug is disabled and no debug token variable is read;
- initialization errors are bounded and no site-key material is logged.

The code is not deployed and sends no new traffic.

## Observability and budgets

Four log-based metrics exist: App Check rejections, runtime errors, IAM policy changes, and secret access denials. There are no alert policies. No alert was invented because approved thresholds, notification channel, and owner were not supplied.

Budget read-back remains pending because the Budget API is disabled for the billing consumer and the operator lacks billing-account access. No API or permission was added. USD 5 and USD 10 budget evidence remains unknown.

## Resource read-back

- Functions: 0
- Cloud Run services in the approved region: 0
- Storage buckets: 0
- Cloud Tasks API: disabled
- Debug tokens: 0
- User-managed service-account keys: 0
- Function or Cloud Run deploys: 0

Staging and Production were neither queried nor changed by this slice. Their inherited states remain out of scope.

## Validation

| Validation | Result |
| --- | --- |
| P4 Preview trust client/contracts | 20/20 PASS |
| Runtime contracts | 18/18 PASS |
| Preview Rules Emulator | 14/14 PASS |
| Preview targeting guard | 15/15 PASS |
| P8 abuse matrix | 33/33 PASS |
| P2 rate limits | 17/17 PASS |
| P3 idempotency | 24/24 PASS |
| P4 capabilities | 29/29 PASS |
| P5 payload bounds | 34/34 PASS |
| P6 telemetry | 25/25 PASS |
| P7 containment | 36/36 PASS |
| Authority D.9 | 40/40 PASS |
| Dark Handler D.8 | 81/81 PASS |
| Functions build | PASS |
| Root build | PASS |
| `git diff --check` | PASS |

## Verdict

**BLOCKED — PREVIEW TRUST COMPLETION INCOMPLETE**

Function deployment must remain stopped until secret versions, an approved WIF branch/ref and binding, App Check provider/enforcement read-back, and budget/alert governance gaps are resolved.
