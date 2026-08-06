# Production / Preview Firebase Bootstrap Isolation V1

Date: 2026-08-06
Change ID: `PROD-UI-01R1-PRODUCTION-PREVIEW-FIREBASE-BOOTSTRAP-ISOLATION-20260806-01`
Branch: `fix/production-preview-firebase-bootstrap-isolation`
Base: `origin/main`
Base SHA: `6c58f6c525887cc447693fbc8eaaf89eb5b424c6`
Production deployment executed: no
Preview deployment executed: no

## Verdict

**CONDITIONAL — BOOTSTRAP ISOLATED WITH REMAINING CONFIGURATION GAP**

The source and build boundaries are isolated. A controlled Production deployment is not ready until the existing Production Vercel project receives the explicit `VITE_AURA_RUNTIME_ENVIRONMENT=PRODUCTION` discriminator under a separately authorized change.

## Root cause

Commit `04a16e0ed5d71d945dc25a0266aa87b78c41ae17`, integrated through `03c750a693fda41d56890d1f42f4ebbe951bfa4e`, connected the Preview-only resolver and domain assertion directly to `src/config/firebase.ts` module evaluation.

Every SPA route statically reached that module. Production therefore evaluated the Preview contract before React, routing, Auth or Firebase initialization. Because Production did not define `VITE_AURA_RUNTIME_ENVIRONMENT`, the first failure was `PREVIEW_CLIENT_VARIABLE_MISSING` and the UI remained blank.

## New boundary

The client now resolves `VITE_AURA_RUNTIME_ENVIRONMENT` before selecting a Firebase contract:

- `PREVIEW` selects only `resolvePreviewClientConfigurationV1`, validates the exact Preview project/auth domain/client domain and preserves Preview App Check;
- `PRODUCTION` selects only `resolveProductionClientConfigurationV1`, validates the exact Production project/auth domain/client domain and leaves App Check disabled;
- a missing or unsupported environment fails closed before either contract is selected;
- project IDs, auth domains and client domains never fall back across environments;
- hostname is a secondary consistency check, not an environment discriminator.

## Production contract

Authorized non-secret identifiers:

- environment: `PRODUCTION`;
- Firebase project: `aura-control-center-debb3`;
- Firebase auth domain: `aura-control-center-debb3.firebaseapp.com`;
- client domain: `controlcenter.auranexus.io`;
- Functions region: `us-central1`;
- App Check: disabled by this bootstrap.

The contract also validates presence and format of the API key, sender ID and App ID without hardcoding or recording their values.

## Preview preservation

Preview continues to require its existing seven variables, exact project, exact auth domain and exact client domain. reCAPTCHA Enterprise App Check remains enabled only after the Preview branch passes, token auto-refresh remains enabled and debug remains off. No Preview variable name or Preview contract invariant changed.

## Configuration gap

Read-only Vercel metadata showed that the current Production project contains the Firebase client variables but does not contain `VITE_AURA_RUNTIME_ENVIRONMENT` for the Production target. This slice did not add or modify that variable.

The gap must not be closed with hostname inference or a silent default. A separate authorized configuration/deployment action must set the explicit Production discriminator before building the deployable Production artifact.

## Validation record

| Validation | Result |
|---|---|
| Gate: branch, base SHA and clean worktree | PASS |
| Node / npm | `20.20.2` / `10.8.2` |
| Package-lock dry run | PASS |
| Dual bootstrap and existing Preview tests | 47/47 PASS |
| Preview client enablement guard suite | 23/23 PASS |
| Preview client source guard | PASS |
| Preview trust completion | 20/20 PASS |
| TypeScript project build/noEmit | PASS |
| Production root build with synthetic metadata | PASS |
| Preview root build with synthetic metadata | PASS |
| Production active-value artifact isolation | PASS |
| Preview active-value and App Check artifact preservation | PASS |
| Generated build outputs tracked by Git | 0 |
| Functions build | Not required; client configuration is not shared with Functions |

Build warnings about existing bundle size and ineffective dynamic imports were unchanged and are outside this bootstrap correction.

## Boundaries

- No backend Discovery, Authority, Functions, Secret Manager or Firebase resource was modified.
- No Vercel variable was added, removed or changed.
- No Production or Preview deployment was executed.
- No commit, push or pull request was performed.

Suggested commit: `fix(firebase): isolate production and preview bootstrap`
