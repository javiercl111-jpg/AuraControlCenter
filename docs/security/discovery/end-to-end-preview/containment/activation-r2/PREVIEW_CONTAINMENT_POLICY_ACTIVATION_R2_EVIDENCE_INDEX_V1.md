# Preview Containment Policy Activation R2 Evidence Index V1

Change ID: `AI-02H2.2E-R1B-R2-PREVIEW-CONTAINMENT-ACTIVATION-20260806-01`

Evidence is limited to aggregate counts, boolean checks, safe enums, and truncated SHA-256 locators. No email, credential, token, key, full identity ID, full fingerprint, signed URL, or local absolute path is retained.

| Evidence | Result |
|---|---:|
| Git/worktree/branch/HEAD gate | PASS |
| Node and Firebase/GCP target gate | PASS |
| Functions / Cloud Run pre-check | 5/5 ACTIVE / 5/5 READY |
| Containment baseline | 0 policies / 0 pointers / 0 audits |
| Functional baseline | ZERO |
| Authority inspection | 1 actor / 1 approver / 1 separated pair |
| Authority verifier | ALLOW |
| Actor / approver capability | `containment.policy.activate` / `containment.policy.approve` |
| Dry-run / post-dry-run | DRY_RUN_VALIDATED / 0-0-0 |
| Apply / post-apply | APPLIED / 1-1-1 |
| Fingerprint locator | `sha256:5cd582fa9c62…` |
| Exact retry / post-retry | REPLAY / 1-1-1 |
| Pointer, policy, audit metadata | PASS |
| Runtime containment provider | POLICY FOUND / ACTIVE |
| `CONTAINMENT_POLICY_NOT_FOUND` | false |
| Rollback readiness | ROLLBACK_READY |
| Production / Staging / wildcard scope | 0 / 0 / 0 |
| Functional resources after activation | ZERO |
| Cloud Tasks / functional Storage objects | 0 / 0 |
| Failed revisions | 0 |
| Vercel `aura-control-center-preview` | READY / Preview |
| Containment emulator | 52/52 PASS |
| Base containment / control plane block | 36/36 / 16/16 PASS |
| Authority composition | 25/25 PASS |
| Authority / containment guard tests | 18/18 / 14/14 PASS |
| Both source guards | PASS |
| TypeScript noEmit / Functions build / root build | PASS / PASS / PASS |
| JSON parse / exact file count / diff check | PASS / 4 / PASS |

## Repository locators

- `functions/src/discovery/containment/controlPlane/PreviewContainmentActivationControlPlaneV1.ts`
- `functions/src/infrastructure/firestore/discoveryContainment/FirestorePreviewContainmentActivationStoreV1.ts`
- `functions/src/infrastructure/firestore/discoveryContainment/FirestorePreviewContainmentActivationAuthorityVerifierV1.ts`
- `functions/src/composition/previewContainmentActivation/PreviewContainmentActivationCompositionV1.ts`
- `functions/src/infrastructure/firestore/discoveryContainment/FirestoreDiscoveryContainmentRepository.ts`
- `scripts/preview-containment-activation-guard.cjs`
- `scripts/preview-containment-authority-composition-guard.cjs`

## Boundary

This evidence certifies controlled activation and resolver read-back only. It does not certify a Discovery Happy Path, browser flow, token exchange, session resolution, AI output, completion, report, notification, deployment, or rollback execution.
