# Discovery Backend Readiness V1

## Execution record

- Program: `AI-02H1E.5.0`
- Slice: `AI-02H1E.5.R3A`
- Change ID: `AI-02H1E.5.R3A-DISCOVERY-BACKEND-READINESS-20260805-01`
- Recorded on: `2026-08-05`
- Target: `aura-intel-preview`
- Branch: `ops/intelligence-preview-backend-readiness`
- Certified base: `55be95c658536db48196f728d435670e4ee0c5f9`
- Scope: local deployment-readiness audit only

## Gate

The gate passed with the exact branch, `HEAD == origin/main`, a clean worktree, Node `v20.20.2`, and npm `10.8.2`.

The inherited Preview infrastructure certifications were accepted as inputs and were not changed or independently revalidated by this local audit. Production remains under `REMEDIATION_HOLD`.

## Intended Preview handlers

| Handler | Firestore | App Check | Secret contract | Environment/project guard | Structured telemetry | Deployment identity | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `createDiscoveryLead` | Admin SDK | declarative plus explicit check | `IDEMPOTENCY_SECRET` | missing | present | missing from function options | BLOCKED |
| `exchangeDiscoveryToken` | Admin SDK | explicit check | secretless | missing | present | missing from function options | BLOCKED |
| `resolveDiscoverySession` | Admin SDK | explicit check | secretless | missing | present | missing from function options | BLOCKED |
| `evaluateConversation` | Admin SDK | declarative | `GEMINI_API_KEY` | missing | present | missing from function options | BLOCKED |
| `completeDiscoverySession` | Admin SDK | explicit check | `DISCOVERY_HMAC_SECRET` | fail-closed Preview contract present | present | missing and manifest identity mismatched | BLOCKED |

All five handlers initialize Firestore through the shared Admin SDK initialization in `functions/src/index.ts`. App Check is enforced either declaratively or by rejecting an absent verified App Check context. Payload, capability, containment, and telemetry controls are present.

These application controls do not compensate for missing deployment isolation.

## Deployment blockers

### 1. Runtime identities are not wired

None of the five handler definitions declares a `serviceAccount` option. The runtime composition files only reexport handlers; `firebase.json` does not configure separate codebases or entrypoints for those compositions.

A deployment would therefore use the platform-selected default runtime identity instead of the certified least-privilege identities.

### 2. HMAC identity contract conflicts with certified IAM

The source manifest maps `completeDiscoverySession` to `preview-discovery-completion-runtime`. The certified secret activation evidence grants the HMAC secret only to `preview-discovery-complete-rt`.

Even after adding a function identity option, the conflicting name must be resolved before deployment.

### 3. Environment and project targeting are incomplete

Only `completeDiscoverySession` calls `resolveDiscoveryRuntimeContractV1()` and validates the exact environment/project pair. The other four handlers accept the project selected by deployment and Admin SDK initialization without applying the runtime contract.

No `functions/.env*`, deployable parameter binding, or other repository configuration supplies `AURA_RUNTIME_ENVIRONMENT=PREVIEW`.

The deploy script is generic: `firebase deploy --only functions`. It does not specify `--project aura-intel-preview` or an allowlist of the five handlers. `.firebaserc` has explicit Preview, Staging, and Production aliases but no safe default alias.

### 4. The Functions entrypoint is not isolated

`functions/src/index.ts` exposes 19 function names, not only the five Preview MVP handlers. The same entrypoint includes or exports:

- report generation and document download;
- Storage access and signed URLs;
- a Cloud Tasks notification handler;
- advisor and prospect mutations;
- a market-import trigger;
- a notification task configured with a Production service-account address.

The Preview runtime composition modules are not the package entrypoint. A generic Functions deployment would discover out-of-scope surfaces and cannot be certified as a five-handler deployment.

### 5. Production and client-writer residue remains

The tracked root `.env` targets the Production Firebase project and does not include the Preview App Check environment or site-key variables. It is a frontend configuration and is not loaded as the Functions runtime environment, but it is not a safe repository default.

A client Firestore writer for Discovery session status remains reachable from the CRM page. No authority fallback by email was found, and `NODE_ENV` is not used for runtime environment resolution.

## Controls that passed

- `firebase.json` declares `nodejs20`;
- `functions/package.json` declares Node 20;
- Admin SDK initializes once in the package entrypoint;
- all five handlers use Firestore;
- App Check checks exist on all five handlers;
- the three secret environment names match the secret containers' intended purposes;
- exchange and session resolution are secretless;
- Preview feature gates disable PDF, Storage, signed URLs, notifications, and Cloud Tasks inside the completion contract;
- email-based authority fallback was not found;
- Gemini configuration is server-secret-only in the audited handler;
- runtime-contract tests passed 18/18;
- Preview trust-completion tests passed 20/20;
- Functions TypeScript passed with `--noEmit`.

Passing tests show that the declared contracts are internally consistent. They do not verify effective `serviceAccount` options, deploy target pinning, or entrypoint isolation.

## Required remediation

1. Bind each handler to its exact certified runtime identity in its actual function options.
2. Resolve the HMAC identity name conflict against the certified accessor.
3. Apply the fail-closed Preview environment/project guard to all five handlers.
4. Supply `AURA_RUNTIME_ENVIRONMENT=PREVIEW` through an approved Functions configuration mechanism.
5. Create an isolated deploy entrypoint or Firebase codebase containing only the five authorized handlers.
6. Remove Production-only, Storage, Tasks, reports, and notification exports from the Preview deployment unit.
7. Replace the generic deploy command with an explicit Preview project and handler/codebase allowlist plus a pre-deploy assertion.
8. Remove or quarantine unsafe Production defaults and the residual client writer under separate change control.
9. Add tests that inspect the actual exported function options and deploy manifest, not only source manifests.

## Verdict

**BLOCKED — DEPLOYMENT NOT SAFE**

The backend source compiles and its application-level contracts pass, but the current deployment unit cannot guarantee Preview-only targeting, certified runtime identities, secret access, or five-handler isolation.

**PRODUCTION NOT AUTHORIZED**

No deployment is authorized by this record.
