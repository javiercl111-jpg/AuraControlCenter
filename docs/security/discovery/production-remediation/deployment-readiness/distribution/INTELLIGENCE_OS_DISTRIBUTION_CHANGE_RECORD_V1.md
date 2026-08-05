# Aura Intelligence OS Distribution Change Record V1

Date: 2026-08-05
Change ID: `AI-02H1E.5.R3C1-INTELLIGENCE-OS-DISTRIBUTION-20260805-01`

## Problem

The canonical package build and staging implementation already existed and CI invoked it explicitly. Direct `npm run build --prefix functions` executed a verifier-only `prebuild`, so a clean checkout failed when `functions/.generated/aura-intelligence-os` did not yet exist.

## Minimal correction

### `functions/package.json`

- added `prepare:intelligence-os-distribution` using the canonical root staging command;
- changed `prebuild` to prepare first and verify second;
- retained the existing build, package dependency, entrypoint, deploy guard and deploy allowlist.

### `packages/aura-intelligence-os/tests/distribution.test.ts`

- updated the lifecycle contract to require preparation before verification;
- added an exact assertion for the preparation command;
- retained all tamper, boundary, import and deterministic-rebuild tests.

### `packages/aura-intelligence-os/README.md`

- documented the self-contained three-command clean-checkout flow;
- documented automatic staging and verification in Functions `prebuild`;
- retained the explicit staging command for CI and distribution-only use.

## Explicitly unchanged

- `firebase.json` and Firebase resources;
- Vercel and GCP configuration;
- Functions handlers and runtime behavior;
- Preview export allowlist;
- Firestore Rules;
- package locks and dependency versions;
- generated artifacts in Git;
- Staging and Production.

## Operational record

- Firebase deploy: not executed.
- Cloud resources modified: none.
- Commit: none.
- Push: none.
- Pull request: none.

The reproduction worktree was disposable. Generated build outputs were used only for local validation and were never added to the principal worktree diff or Git index.

## Handoff

The distribution prerequisite is reproducible from a clean checkout. Preview deployment may be resumed only under a separately authorized slice. Production remains on `REMEDIATION_HOLD` and is not authorized.

