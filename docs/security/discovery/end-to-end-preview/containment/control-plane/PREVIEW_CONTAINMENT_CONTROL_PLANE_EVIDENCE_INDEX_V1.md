# Preview Containment Control Plane Evidence Index V1

Change ID: `AI-02H2.2E-R1A-PREVIEW-CONTAINMENT-CONTROL-PLANE-20260806-01`

## Evidence map

| Evidence | Repository source | Result |
|---|---|---|
| Request, proposal, audit and port contracts | `functions/src/discovery/containment/controlPlane/previewContainmentActivationTypesV1.ts` | PASS |
| Strict request, target, tenant and proposal validation | `functions/src/discovery/containment/controlPlane/previewContainmentActivationValidationV1.ts` | PASS |
| Canonical deterministic fingerprint and audit ID | `functions/src/discovery/containment/controlPlane/previewContainmentFingerprintV1.ts` | PASS |
| Authority gate and server materialization orchestration | `functions/src/discovery/containment/controlPlane/PreviewContainmentActivationControlPlaneV1.ts` | PASS |
| Firestore CAS, dry-run, replay and atomic audit adapter | `functions/src/infrastructure/firestore/discoveryContainment/FirestorePreviewContainmentActivationStoreV1.ts` | PASS |
| Reused policy serialization boundary | `functions/src/infrastructure/firestore/discoveryContainment/FirestoreDiscoveryContainmentRepository.ts` | PASS |
| Fail-closed source and target guard | `scripts/preview-containment-activation-guard.cjs` | PASS |
| Guard negative matrix | `scripts/tests/preview-containment-activation-guard.test.cjs` | 14/14 PASS |
| Historical and new emulator matrix | `functions/tests/emulator/containment/firestoreContainmentEmulator.test.ts` | 52/52 PASS |
| Package command registration | `package.json` | PASS |

## Validation commands

The following local, non-deployment validations completed successfully:

- Node runtime assertion;
- Functions TypeScript `noEmit`;
- isolated Firestore Emulator containment suite;
- control-plane guard tests;
- guard read-back against the actual source tree;
- Functions build;
- root build;
- Git whitespace validation.

The emulator used a demo project namespace and was configured to reject access to non-emulated services. No browser or cloud write path was invoked.

## Evidence handling

This index records only control results and repository-relative source locations. It contains no credentials, tokens, variable values, personal identifiers, absolute workstation paths or deployment identifiers.
