# Preview Discovery Deployment Unit Evidence Index V1

Change ID: `AI-02H1E.5.R3B-PREVIEW-DEPLOYMENT-UNIT-20260805-01`

All paths are repository-relative. Evidence contains identifiers and metadata only; it contains no secret values.

| Evidence | Repository artifact | Result |
|---|---|---|
| Exclusive five-export entrypoint and explicit secret-resource mapping | `functions/src/previewDiscoveryIndex.ts` | PASS |
| Exact project, environment, region, identities, allowlist and binding contract | `functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts` | PASS |
| Exact codebase | `firebase.json` | `preview-discovery` |
| Exact package entrypoint and future deploy command | `functions/package.json` | PASS |
| Non-sensitive Preview runtime environment | `functions/.env.aura-intel-preview` | `PREVIEW` only |
| Runtime assertion and handler options | five handler source files | PASS |
| Correct completion identity | `functions/src/discovery/runtimeContracts/discoveryRuntimeSecretManifestV1.ts` | PASS |
| No task-queue dispatch in loaded completion support | `functions/src/discovery/discoveryCapabilityHandlerSupport.ts` | PASS |
| Deployment guard | `scripts/preview-discovery-deployment-guard.cjs` | PASS; deployment false |
| Required negative/positive tests | `functions/tests/previewDeploymentUnit/previewDeploymentUnit.test.ts` | 15/15 |
| Runtime contracts | `functions/tests/runtimeContracts/previewRuntimeContracts.test.ts` | 18/18 |
| Preview trust completion | `functions/tests/previewTrustCompletion/previewTrustCompletionContracts.test.ts` | 20/20 |
| P8 evidence follows centralized App Check contract | `functions/tests/publicIntakeAbuseCertification/publicIntakeAbuseCertificationMatrix.ts` | 33/33 |

## Executed local commands

| Command | Result |
|---|---|
| `npm run test:preview-deployment-unit` | 15/15 pass |
| `npm run test:preview-runtime-contracts` | 18/18 pass |
| `npm run test:preview-trust-completion` | 20/20 pass |
| `npm run test:preview-rules-emulator` | 14/14 pass |
| `npm run test:preview-rules-guard` | 15/15 pass |
| `npm run test:public-intake-abuse-matrix` | P8 33/33 pass |
| `npm run test:public-intake-abuse-certification` | P2–P7, D.8 and D.9 passed; initial aggregate exit reflected the subsequently corrected P8 evidence path |
| `npm run test:firestore-authority-end-to-end-emulator` | D.9 40/40 pass |
| `npm run test:authority-dark-handler-composition` | D.8 81/81 pass |
| `npm run build --prefix functions` | pass |
| `npm run build` | pass |
| TypeScript `--noEmit` for Functions and root | pass |
| `npm run dry-run:preview-discovery-deploy` | guard pass; no deploy |

The certification aggregate initially reported one P8 evidence-location failure after App Check configuration was centralized. The evidence matrix was updated to require the handler reference plus `enforceAppCheck: true` in the central contract, and P8 then passed 33/33. This was an evidence-path repair, not a relaxation of the control.

No cloud console, Firebase deployment, Vercel operation or external-resource mutation is part of this evidence set.

