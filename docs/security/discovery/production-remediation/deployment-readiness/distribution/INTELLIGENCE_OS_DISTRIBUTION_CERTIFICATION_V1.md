# Aura Intelligence OS Distribution Certification V1

Date: 2026-08-05
Change ID: `AI-02H1E.5.R3C1-INTELLIGENCE-OS-DISTRIBUTION-20260805-01`
Branch: `ops/intelligence-os-distribution-certification`
Base: `origin/main`
Certified SHA: `57154de233ad1f51acc925730eae872edf6b8a18`
Future functional target: `aura-intel-preview`
Production: `REMEDIATION_HOLD` / not authorized

## Verdict

**INTELLIGENCE OS DISTRIBUTION CERTIFIED — READY TO RESUME PREVIEW DEPLOYMENT**

This slice certifies the repository-local creation and verification of `functions/.generated/aura-intelligence-os`. It does not authorize or execute a Firebase deployment.

## Gate

- exact branch: PASS;
- HEAD equals `origin/main` and the expected SHA: PASS;
- initial principal worktree clean: PASS;
- Node `v20.20.2`: PASS;
- npm `10.8.2`: PASS.

The supplied temporary directory no longer contained a Git worktree marker and was left untouched. Reproduction used a new detached disposable worktree at the certified SHA.

## Authoritative workflow

From a clean checkout:

1. `npm ci`
2. `npm ci --prefix functions`
3. `npm run build --prefix functions`

The Functions `prebuild` lifecycle now performs:

1. `npm --prefix .. run stage:intelligence-os:functions`
2. `npm run verify:intelligence-os-distribution`
3. the existing TypeScript build and asset copy.

The canonical staging command builds `packages/aura-intelligence-os`, deletes and recreates only its authorized staging child, copies the allowlisted distribution, writes a reduced manifest, and validates its fingerprint. The verifier then rejects symlinks, unexpected files, forbidden file types or paths, manifest drift and fingerprint drift.

## Inventory and reproducibility

| Property | Certified result |
|---|---|
| Staged files | 204 |
| Compiled distribution files | 202 |
| Additional files | `README.md`, `package.json` |
| Allowed compiled types | `.js`, `.d.ts` |
| Manifest `distSha256` | `b1d625329c3847eeb4121a8bda84ba15172967b14604aff97a882cc5295c0275` |
| Aggregate inventory/content fingerprint | `7110ddb228b8c4c803b67ccafe6c14f32404f554561db36745511d369bfc4a6a` |
| Second reconstruction inventory | identical, 204/204 |
| Second reconstruction fingerprint | identical |

The distribution package exposes only `@aura/intelligence-os/server`. It contains no scripts, dependencies, development dependencies, lockfile, tests, source tree or `node_modules`.

## Local and CI convergence

CI already ran the canonical staging command before Functions installation. The root `build:functions` and Firebase predeploy also staged the package. Direct local `npm run build --prefix functions` differed: its `prebuild` verified an artifact it had not prepared.

The minimal correction makes the direct Functions build self-contained. Existing CI and predeploy flows remain valid; repeated staging replaces the same single ignored directory and produces the same content rather than creating duplicate artifacts.

## Security certification

The reconstructed artifact reported:

- zero `.env` files;
- zero credential or private-key patterns;
- zero absolute workstation-path patterns;
- zero Production project IDs;
- zero `NODE_ENV` targeting;
- zero Storage, Tasks, report or notification paths;
- zero forbidden runtime imports for those surfaces;
- zero generated files tracked by Git;
- no change to the five-handler deployment allowlist.

`functions/.generated/` remains ignored by `functions/.gitignore` and remains included in the Firebase upload source because Firebase's own ignore list does not exclude it. No generated artifact is added to the repository diff.

## Validation record

| Validation | Result |
|---|---|
| Clean `npm ci` | PASS |
| Clean `npm ci --prefix functions` | PASS |
| Distribution generated from absent outputs | PASS |
| Distribution verifier | PASS |
| Distribution contract/tamper/rebuild suite | 7/7 PASS |
| Functions build | PASS |
| Deployment unit | 15/15 PASS |
| Runtime contracts | 18/18 PASS |
| Preview trust completion | 20/20 PASS |
| TypeScript noEmit | PASS |
| Preview deployment guard | PASS |
| Preview dry-run | PASS; `deploymentExecuted=false` |
| Deterministic reconstruction | PASS |
| `git diff --check` | PASS |

`npm ci` reported dependency-audit findings already present in the locked dependency graphs. They were not modified in this distribution-only slice and do not affect artifact reproducibility; dependency remediation remains separate work.

## Boundaries

- No Firebase, GCP, Vercel, Staging or Production configuration was changed.
- No Discovery handler, export, allowlist, Rules, secret or runtime identity was modified.
- No deploy, commit, push or pull request was performed.
- Resuming Preview deployment requires a separately authorized deployment action.

Suggested commit: `build(functions): prepare intelligence os distribution in prebuild`

