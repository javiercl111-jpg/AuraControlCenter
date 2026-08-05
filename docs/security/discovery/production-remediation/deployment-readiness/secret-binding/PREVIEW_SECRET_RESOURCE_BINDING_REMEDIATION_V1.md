# Preview Firebase Secret Resource Binding Remediation V1

Date: 2026-08-05
Change ID: `AI-02H1E.5.R3D-PREVIEW-SECRET-BINDING-20260805-01`
Branch: `fix/intelligence-preview-secret-resource-binding`
Target: `aura-intel-preview`
Production: `REMEDIATION_HOLD` / not authorized

## Verdict

**PREVIEW SECRET RESOURCE BINDING REMEDIATED — READY TO RETRY CONTROLLED DEPLOYMENT**

This slice corrects Firebase Functions v2 secret discovery and the Preview codebase deployment target. It does not execute or authorize a deployment.

## Incident record

Two inherited deployment attempts were aborted before a Function was created:

1. The first used individual `functions:<handler>` filters and Firebase rejected them because the project uses a codebase.
2. The second used `functions:preview-discovery`, reached secret analysis and stopped because Firebase resolved the logical `DISCOVERY_HMAC_SECRET` parameter as a missing Secret Manager resource.

The attempts created zero Functions and zero Cloud Run services. The Firebase Extensions API was enabled as a side effect of the aborted analysis. Staging and Production were not targeted or changed.

## Root cause and remediation

Firebase CLI resolves the name passed to `defineSecret` as the Secret Manager resource name. The former entrypoint binder modified endpoint metadata after Firebase had already discovered the declared SecretParams, so it could not provide aliases.

The three handlers now declare the existing Preview resources directly:

| Handler | SecretParam name | Secret resource | Runtime identity |
|---|---|---|---|
| `createDiscoveryLead` | `discovery-idempotency-secret-preview` | `discovery-idempotency-secret-preview` | `preview-public-intake-runtime` |
| `evaluateConversation` | `discovery-gemini-api-key-preview` | `discovery-gemini-api-key-preview` | `preview-conversation-runtime` |
| `completeDiscoverySession` | `discovery-hmac-secret-preview` | `discovery-hmac-secret-preview` | `preview-discovery-complete-rt` |
| `exchangeDiscoveryToken` | none | none | `preview-discovery-session-rt` |
| `resolveDiscoverySession` | none | none | `preview-discovery-session-rt` |

Each consumer continues to use `SecretParam.value()`. No value was read, copied or logged. No secret, version or IAM binding was created or modified. `discovery-ip-hash-salt-preview` remains deferred with zero consumers.

The post-discovery binder was removed. The runtime manifest and deployment contract now distinguish `secretParamName` and `secretResource`; for this Firebase integration they are intentionally identical.

## Deployment target

The future command remains build-first and guard-first, then uses exactly:

`firebase deploy --project aura-intel-preview --only functions:preview-discovery --non-interactive`

The command was not executed. The guard rejects individual handler filters, wrong codebase/project/environment, handler drift, identity drift, SecretParam drift, logical uppercase aliases, session secrets, IP salt activation, Production references, Storage, Tasks, reports, PDF and notifications.

## Effective endpoint metadata

Local compiled endpoint metadata and the Preview guard produced exactly:

- `createDiscoveryLead` → `discovery-idempotency-secret-preview`;
- `evaluateConversation` → `discovery-gemini-api-key-preview`;
- `completeDiscoverySession` → `discovery-hmac-secret-preview`;
- both session handlers → no secrets.

The metadata contained five and only five exports, codebase `preview-discovery`, `us-central1`, exact runtime identities and `deploymentExecuted=false`.

## Read-only cloud confirmation

| Check | Result |
|---|---|
| Three certified secret containers exist | PASS |
| Enabled versions | exactly one per secret |
| Resource-level accessors | exactly one certified runtime identity per secret |
| Project-level Secret Manager accessors | 0 |
| Functions | 0 |
| Cloud Run services | 0 |
| `firebaseextensions.googleapis.com` | enabled |
| Secret values accessed | no |

Staging and Production remain intact because no command in this slice targeted either environment. Production remains unauthorized.

## Validation record

| Validation | Result |
|---|---|
| Aura Intelligence OS distribution | 7/7 PASS |
| Preview deployment unit | 22/22 PASS |
| Runtime contracts | 18/18 PASS |
| Preview trust completion | 20/20 PASS |
| Preview Rules emulator | 14/14 PASS |
| Targeting guard | 15/15 PASS |
| Functions build | PASS |
| TypeScript noEmit | PASS |
| Preview guard | PASS |
| Preview dry-run | PASS; no deployment |
| Root build | PASS |
| `git diff --check` | PASS |

Root build warnings about bundle size and ineffective dynamic imports are pre-existing and non-blocking for this server-side secret binding.

## Boundaries

- No Firebase deploy or cloud mutation was executed.
- No secret values, versions or IAM policies were changed.
- No Firebase, Vercel, Rules, Storage or Tasks configuration was modified.
- No commit, push or pull request was performed.
- A retry requires a separately authorized controlled deployment slice.

Suggested commit: `fix(functions): bind preview secrets by resource name`

