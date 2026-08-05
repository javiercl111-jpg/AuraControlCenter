# Preview Secret Resource Binding Evidence Index V1

Change ID: `AI-02H1E.5.R3D-PREVIEW-SECRET-BINDING-20260805-01`

All file paths are repository-relative. No secret value is included.

| Claim | Evidence | Result |
|---|---|---|
| Direct idempotency SecretParam | `functions/src/discovery/createDiscoveryLead.ts` | exact Preview resource |
| Direct Gemini SecretParam | `functions/src/intelligence/evaluateConversation.ts` | exact Preview resource |
| Direct HMAC SecretParam | `functions/src/discovery/completeDiscoverySession.ts` | exact Preview resource |
| Resource/param/consumer/identity contract | `functions/src/discovery/runtimeContracts/discoveryRuntimeSecretManifestV1.ts` | PASS |
| Exact allowlist, identities, bindings, codebase and target | `functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts` | PASS |
| No post-discovery binder | `functions/src/previewDiscoveryIndex.ts` | PASS |
| Codebase deploy command | `functions/package.json` | `functions:preview-discovery` |
| Codebase definition | `firebase.json` | `preview-discovery` |
| Fail-closed metadata and source guard | `scripts/preview-discovery-deployment-guard.cjs` | PASS |
| Required negative controls | `functions/tests/previewDeploymentUnit/previewDeploymentUnit.test.ts` | 22/22 PASS |
| Runtime contract alignment | `functions/tests/runtimeContracts/previewRuntimeContracts.test.ts` | 18/18 PASS |
| Trust contract alignment | `functions/tests/previewTrustCompletion/previewTrustCompletionContracts.test.ts` | 20/20 PASS |

## Local command evidence

| Command | Result |
|---|---|
| `npm run test:intelligence-os:distribution` | 7/7 PASS |
| `npm run test:preview-deployment-unit` | 22/22 PASS |
| `npm run test:preview-runtime-contracts` | 18/18 PASS |
| `npm run test:preview-trust-completion` | 20/20 PASS |
| `npm run test:preview-rules-emulator` | 14/14 PASS |
| `npm run test:preview-rules-guard` | 15/15 PASS |
| `npm run build --prefix functions` | PASS |
| Functions TypeScript `--noEmit` | PASS |
| `npm run guard:preview-deployment-unit` | PASS |
| `npm run dry-run:preview-discovery-deploy` | PASS; `deploymentExecuted=false` |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## Sanitized endpoint metadata

The compiled `__endpoint.secretEnvironmentVariables` data was inspected locally through the guard. It contained exactly the three Preview Secret Manager IDs, each on its authorized handler, and empty arrays on both session handlers. No logical uppercase alias appeared.

## Read-only cloud commands

Metadata-only commands described each secret, listed enabled versions, read resource IAM policies, read project IAM, listed Functions and Cloud Run services, and listed enabled APIs. No `versions access` or equivalent value-reading command was executed.

Read-back: three containers; one enabled version each; one exact resource-level accessor each; zero project-level accessors; zero Functions; zero Cloud Run services; Firebase Extensions API enabled.

## Attempt history

- Attempt 1: individual function filters, aborted on codebase targeting before resource creation.
- Attempt 2: codebase filter, aborted during secret analysis on logical `DISCOVERY_HMAC_SECRET` before Function creation.
- This slice: no deploy attempted.

Secret values, Staging and Production remained untouched.

