# Production / Preview Firebase Bootstrap Isolation Change Record V1

Date: 2026-08-06
Change ID: `PROD-UI-01R1-PRODUCTION-PREVIEW-FIREBASE-BOOTSTRAP-ISOLATION-20260806-01`

## Problem

`src/config/firebase.ts` evaluated the Preview client resolver and Preview domain assertion for every SPA build. Production therefore failed before React mounted with `PREVIEW_CLIENT_VARIABLE_MISSING`.

## Minimal correction

### Production contract

- Added an independent fail-closed contract for the authorized Production environment, Firebase project, auth domain and client domain.
- Added format validation for API key, sender ID and App ID without hardcoding values.
- Kept Functions pinned to `us-central1`.
- Kept Production App Check disabled.

### Environment selector

- Added an explicit two-value environment selector.
- Preview and Production resolve only their own contract.
- Missing and unknown environments fail before contract selection.
- Hostname validates the selected environment but never selects it.
- No cross-environment fallback exists.

### Firebase integration

- Replaced the unconditional Preview resolver call with the environment selector.
- Preserved the existing Firebase exports and single-app initialization.
- Preserved Preview reCAPTCHA Enterprise initialization and token auto-refresh.
- Prevented Preview App Check initialization in Production.

### Tests and template

- Added Production contract, selector and real module-graph tests.
- Added a dedicated package script for the isolation suite.
- Clarified the explicit environment discriminator and Preview-only site key in `.env.example`.
- Kept the existing Preview contract and Preview guard suites unchanged.

## Explicitly unchanged

- Discovery handlers and backend runtime;
- Functions exports, deployment unit and cloud resources;
- Authority and synthetic identity provisioning;
- Firebase resources and Rules;
- Secret Manager;
- Vercel variables;
- Preview variable names and contract invariants;
- Staging, Preview and Production deployments.

## Remaining configuration gap

The current Production Vercel target does not define `VITE_AURA_RUNTIME_ENVIRONMENT`. It must be configured explicitly as `PRODUCTION` in a separately authorized change before building or deploying Production. No silent default was introduced to bypass this requirement.

## Operational record

- Production deploy: not executed.
- Preview deploy: not executed.
- Firebase or Vercel changes: none.
- Functions build: not required because the changed client configuration is outside the Functions graph.
- Commit: none.
- Push: none.
- Pull request: none.
