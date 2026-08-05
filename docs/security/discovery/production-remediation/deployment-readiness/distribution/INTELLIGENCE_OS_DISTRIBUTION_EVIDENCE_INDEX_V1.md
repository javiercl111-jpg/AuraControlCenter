# Aura Intelligence OS Distribution Evidence Index V1

Change ID: `AI-02H1E.5.R3C1-INTELLIGENCE-OS-DISTRIBUTION-20260805-01`

All evidence paths are repository-relative. Generated content was inspected in a disposable detached worktree and was not added to Git.

| Claim | Evidence | Result |
|---|---|---|
| Canonical build and staging command | `package.json` | `stage:intelligence-os:functions` |
| Functions self-prepares before verification | `functions/package.json` | PASS |
| Staging boundary, allowlist and source fingerprint | `packages/aura-intelligence-os/scripts/stage-for-functions.cjs` | PASS |
| Staged manifest, inventory and fingerprint verification | `functions/scripts/verifyIntelligenceOsDistribution.cjs` | PASS |
| Tampering and deterministic reconstruction tests | `packages/aura-intelligence-os/tests/distribution.test.ts` | 7/7 PASS |
| Clean-checkout operating instructions | `packages/aura-intelligence-os/README.md` | updated |
| Generated directory ignored | `functions/.gitignore` | `.generated/` |
| Local file dependency and lock contract | `functions/package.json`, `functions/package-lock.json` | PASS |
| Explicit CI staging | `.github/workflows/intelligence-os-node20.yml` | present |
| Authority emulator CI staging | `.github/workflows/firestore-authority-emulator.yml` | present |
| Preview allowlist unchanged | `scripts/preview-discovery-deployment-guard.cjs` | guard PASS |

## Reproduction evidence

| Action | Result |
|---|---|
| Initial direct Functions build before remediation | FAIL as expected: generated directory missing |
| `npm ci` from detached clean checkout | PASS |
| `npm ci --prefix functions` before staging | PASS |
| Delete authorized `dist` and staged outputs | confirmed absent before build |
| Corrected `npm run build --prefix functions` | PASS; generated, verified and compiled |
| Second delete and reconstruction | PASS |
| Inventory comparison | 204/204 identical |
| Aggregate fingerprint comparison | identical: `7110ddb228b8c4c803b67ccafe6c14f32404f554561db36745511d369bfc4a6a` |
| Manifest distribution fingerprint | `b1d625329c3847eeb4121a8bda84ba15172967b14604aff97a882cc5295c0275` |

## Executed validations

| Command | Result |
|---|---|
| `npm run verify:intelligence-os-distribution --prefix functions` | PASS |
| `npm run test:intelligence-os:distribution` | 7/7 PASS |
| `npm run build --prefix functions` | PASS |
| `npm run test:preview-deployment-unit` | 15/15 PASS |
| `npm run test:preview-runtime-contracts` | 18/18 PASS |
| `npm run test:preview-trust-completion` | 20/20 PASS |
| Functions TypeScript `--noEmit` | PASS |
| `npm run guard:preview-deployment-unit` | PASS |
| `npm run dry-run:preview-discovery-deploy` | PASS; no deploy |
| `git diff --check` | PASS |

## Security scan evidence

The staged inventory contained 202 `.js`/`.d.ts` files plus its reduced manifest and README. Scans returned zero `.env` files, credential patterns, workstation paths, Production project IDs, `NODE_ENV` targeting, forbidden surface paths and forbidden Storage/Tasks/report/notification runtime imports. `git ls-files` returned zero generated distribution files.

No secret values, cloud credentials or deployment output are retained in this evidence set.

