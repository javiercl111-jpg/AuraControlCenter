# Production / Preview Firebase Bootstrap Isolation Evidence Index V1

Change ID: `PROD-UI-01R1-PRODUCTION-PREVIEW-FIREBASE-BOOTSTRAP-ISOLATION-20260806-01`

All evidence paths are repository-relative. No secret values, API keys, full App IDs, full sender IDs or local workstation paths are retained.

## Source evidence

| Claim | Evidence | Result |
|---|---|---|
| Explicit environment is resolved before contract selection | `src/config/clientFirebaseBootstrapV1.ts` | PASS |
| Production contract is independent and fail-closed | `src/config/productionClientConfigurationV1.ts` | PASS |
| Preview contract remains authoritative and unchanged | `src/config/previewClientConfigurationV1.ts` | PASS |
| Global Firebase module no longer calls Preview resolver directly | `src/config/firebase.ts` | PASS |
| Preview App Check is selected only by the Preview branch | `src/config/firebase.ts`, `src/config/previewAppCheckContractV1.ts` | PASS |
| Production App Check remains disabled | `src/config/productionClientConfigurationV1.ts`, `src/config/firebase.ts` | PASS |
| No hostname-only environment inference | `src/config/clientFirebaseBootstrapV1.ts` | PASS |
| Deployment discriminator documented without a default | `.env.example` | PASS |

## Test evidence

| Suite | Coverage | Result |
|---|---|---|
| `src/config/previewClientConfigurationV1.test.ts` | Existing Preview invariants | PASS |
| `src/config/productionClientConfigurationV1.test.ts` | Production variables, IDs, domain and malformed identifiers | PASS |
| `src/config/clientFirebaseBootstrapV1.test.ts` | Selection, unknown/missing environment and cross-environment denial | PASS |
| `src/config/firebaseProductionBootstrapV1.test.ts` | Real Firebase import and Market Intelligence module graph under Production | PASS |
| Combined bootstrap suite | 47 tests | 47/47 PASS |
| Preview client enablement guard | 23 tests | 23/23 PASS |
| Preview trust completion | 20 tests | 20/20 PASS |
| Preview source guard | Existing Preview source boundary | PASS |

## Build evidence

Both root builds used synthetic, non-secret client metadata and separate temporary output directories.

| Artifact claim | Production | Preview |
|---|---|---|
| Full root build | PASS | PASS |
| Active synthetic App ID belongs only to selected environment | PASS | PASS |
| Cross-environment synthetic App ID absent | PASS | PASS |
| Preview site-key metadata active | absent | present |
| Authorized environment project/domain contract | Production present | Preview present |
| App Check debug global assignment | not enabled | absent |
| Generated output tracked by Git | 0 | 0 |

The Firebase SDK contains its generic debug-capability string, but the application bundle contains no assignment to the App Check debug global. The source contract remains `debugEnabled: false`.

## Configuration evidence

Read-only Vercel metadata was used only to confirm variable names and non-secret project/domain identifiers. Production lacks `VITE_AURA_RUNTIME_ENVIRONMENT`; no Vercel setting was changed. This evidence set records the gap but does not authorize its remediation or a deployment.
