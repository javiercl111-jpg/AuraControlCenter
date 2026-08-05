# Preview Discovery Deployment Unit Remediation V1

Date: 2026-08-05
Change ID: `AI-02H1E.5.R3B-PREVIEW-DEPLOYMENT-UNIT-20260805-01`
Branch: `fix/intelligence-preview-deployment-unit`
Target: `aura-intel-preview`
Production: `REMEDIATION_HOLD` / not authorized

## Verdict

**PREVIEW DISCOVERY DEPLOYMENT UNIT READY — DEPLOYMENT STILL NOT EXECUTED**

The repository now exposes a project-explicit, allowlisted and fail-closed Functions deployment unit for exactly five Discovery handlers. No Firebase deployment, cloud mutation, Vercel change, Rules change, commit, push or pull request was performed.

## Certified deployment unit

| Export | Region | Runtime identity | Secret Manager binding | App Check |
|---|---|---|---|---|
| `createDiscoveryLead` | `us-central1` | `preview-public-intake-runtime` | `IDEMPOTENCY_SECRET` → `discovery-idempotency-secret-preview` | enforced |
| `exchangeDiscoveryToken` | `us-central1` | `preview-discovery-session-rt` | none | enforced |
| `resolveDiscoverySession` | `us-central1` | `preview-discovery-session-rt` | none | enforced |
| `evaluateConversation` | `us-central1` | `preview-conversation-runtime` | `GEMINI_API_KEY` → `discovery-gemini-api-key-preview` | enforced |
| `completeDiscoverySession` | `us-central1` | `preview-discovery-complete-rt` | `DISCOVERY_HMAC_SECRET` → `discovery-hmac-secret-preview` | enforced |

Secret values were neither read nor recorded. The Preview entrypoint enriches the generated Firebase endpoint manifest with an explicit environment-key-to-resource mapping and refuses a declaration mismatch.

## Fail-closed controls

- `functions/src/previewDiscoveryIndex.ts` is the only package entrypoint and exports the exact five-handler allowlist.
- `preview-discovery` is the only Functions codebase configured on this branch.
- Every handler fixes `us-central1`, its certified service account and `enforceAppCheck: true`.
- Every invocation requires `AURA_RUNTIME_ENVIRONMENT=PREVIEW` and the effective Google Cloud project to equal `aura-intel-preview`.
- `functions/.env.aura-intel-preview` contains only the non-sensitive Preview environment discriminator.
- The former tracked Production `.env` was removed and all environment files are ignored except the exact non-sensitive Preview file and examples.
- The future deploy command fixes `--project aura-intel-preview`, the exact five-function `--only` list and `--non-interactive`.
- The deployment guard rejects wrong project/environment, export drift, identity drift, secret-resource drift, missing App Check, forbidden modules and command drift.

## Isolation decisions

`functions/src/index.ts` remains unchanged but is no longer the package entrypoint for this branch. Its additional exports, report generation, Storage/Tasks/notification surfaces and the Production task identity are outside the loaded Preview module graph and outside the deploy allowlist. Unused task-queue dispatch support was removed from the shared completion helper.

The direct client writer in `src/modules/discovery/services/discoverySessionService.ts` was not removed because `src/pages/CrmPage.tsx` is an active caller. It is outside the Functions codebase and therefore outside this deployment unit. Its eventual removal or migration remains a separate client-remediation item and is not authorization to deploy the frontend.

## Validation record

| Validation | Result |
|---|---|
| Deployment unit tests, including all required negative cases | 15/15 pass |
| Runtime contracts | 18/18 pass |
| Preview trust completion | 20/20 pass |
| Preview Rules emulator | 14/14 pass |
| Preview Rules guard | 15/15 pass |
| P8 public intake matrix | 33/33 pass |
| P2 atomic rate limits | 17/17 pass |
| P3 idempotency retention | 24/24 pass |
| P4 capabilities/exactly-once | 29/29 pass |
| P5 payload/cost bounds | 34/34 pass |
| P6 abuse telemetry | 25/25 pass |
| P7 containment/emergency quotas | 36/36 pass |
| D.9 authority end-to-end | 40/40 pass |
| D.8 dark-handler composition | 81/81 pass |
| Functions build | pass |
| Root build | pass |
| TypeScript noEmit | pass |
| Preview deployment guard/dry-run | pass; `deploymentExecuted=false` |

The root build emitted only non-blocking bundle-size and ineffective-dynamic-import warnings. Vitest emitted existing future config-loader compatibility warnings; neither warning changes the deployment-unit contract.

## Residual limits

- This slice certifies repository code and generated endpoint metadata locally; it does not certify a deployed Cloud Functions revision or runtime read-back.
- The client Firestore writer remains reachable by its existing CRM caller and must be handled in a separately authorized client slice.
- Production remains on `REMEDIATION_HOLD`; this verdict does not authorize Production, Staging, Vercel, Rules, Storage or Tasks changes.

## Next slice

A separately authorized Preview deployment can use the recorded project-explicit command, followed by function inventory, endpoint metadata, runtime identity, secret binding, App Check and smoke-test read-back. This slice does not grant that authorization.

Suggested commit: `fix(security): isolate preview discovery deployment unit`
