# Preview Runtime Contract Evidence Index V1

## Scope

This index covers local code, contract, composition, test, and documentation evidence for `AI-02H1E.5.R2C-P3`. It records no external state mutation and contains no secret values, personal data, project numbers, tokens, console URLs, or local absolute paths.

## Primary evidence

| Evidence | Purpose |
| --- | --- |
| `PREVIEW_RUNTIME_CONTRACT_REMEDIATION_V1.md` | Gate, audit, remediation, validation, risks, and verdict |
| `PREVIEW_RUNTIME_SECRET_MAPPING_V1.json` | Canonical handler, runtime identity, secret resource, and environment-variable mapping |
| `PREVIEW_RUNTIME_COMPOSITION_MATRIX_V1.json` | Exact handler exports and Preview MVP feature gates |
| `runtimeEnvironmentV1.ts` | Closed environment/project matching contract |
| `previewDiscoveryRuntimeContractV1.ts` | Closed Preview feature-gate contract |
| `discoveryCompletionOptionalEffectsV1.ts` | Optional document/notification port gates |
| `discoveryRuntimeSecretManifestV1.ts` | Executable canonical secret manifest and deferred IP salt |
| `resolveDiscoveryPrincipalV1.ts` | Discovery-specific canonical UID authority resolver |
| `runtimeCompositions/*.ts` | Four explicit runtime identity boundaries |
| `previewRuntimeContracts.test.ts` | Executable environment, feature, composition, secret, authority, PII, and retained replay assertions |

Source paths in this index are repository-relative. The executable sources reside below `functions/src/discovery`; the dedicated tests reside below `functions/tests/runtimeContracts`.

## Commands and results

| Command | Result |
| --- | --- |
| `npm run test:preview-runtime-contracts` | 18/18 PASS |
| `npm run test:preview-rules-emulator` | 14/14 PASS |
| `npm run test:preview-rules-guard` | 15/15 PASS |
| `npm run test:public-intake-abuse-matrix` | 33/33 PASS |
| `npm run test:firestore-rate-limit-emulator` | 17/17 PASS |
| `npm run test:firestore-idempotency-emulator` | 24/24 PASS |
| `npm run test:firestore-capability-emulator` | 29/29 PASS |
| `npm run test:discovery-payload-bounds-emulator` | 34/34 PASS |
| `npm run test:discovery-abuse-telemetry-emulator` | 25/25 PASS |
| `npm run test:discovery-containment-emulator` | 36/36 PASS |
| `npm run test:firestore-authority-end-to-end-emulator` | 40/40 PASS |
| `npm run test:authority-dark-handler-composition` | 81/81 PASS |
| `npm run build:functions` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |

All Node/npm commands used the certified Node `v20.20.2` and npm `10.8.2` installation verified at the gate.

## Negative evidence and scope controls

- No Firebase deploy or backend deployment command was executed.
- No IAM policy, WIF provider, secret version, App Check provider, Storage bucket, Cloud Task, Staging resource, or Production resource was read or changed by this slice.
- `functions/src/index.ts`, Firebase Rules, workflows, and deployment target configuration remain unchanged.
- The build-only `functions/lib` changes were removed after successful compilation.

## Review boundary

Verdict: **PREVIEW RUNTIME CONTRACTS REMEDIATED — READY FOR TRUST COMPLETION**.

The evidence stops before trust completion, secret loading, App Check configuration, deployment, or traffic enablement.
