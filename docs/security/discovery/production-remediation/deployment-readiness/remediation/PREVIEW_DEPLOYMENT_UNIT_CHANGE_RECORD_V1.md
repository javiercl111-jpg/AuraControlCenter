# Preview Discovery Deployment Unit Change Record V1

Date: 2026-08-05
Change ID: `AI-02H1E.5.R3B-PREVIEW-DEPLOYMENT-UNIT-20260805-01`

## Purpose

Replace the unsafe nineteen-export Functions deployment surface with a Preview-only deployment unit for the five Discovery MVP handlers, without deploying or modifying infrastructure.

## Repository changes

- Added a dedicated `previewDiscoveryIndex` entrypoint with exactly five exports.
- Added one centralized fail-closed deployment contract for project, environment, region, service accounts, App Check, handler allowlist and exact Secret Manager resource mappings.
- Bound each handler to its certified Preview runtime identity and `us-central1`.
- Added runtime assertions requiring both `AURA_RUNTIME_ENVIRONMENT=PREVIEW` and project `aura-intel-preview`.
- Corrected the completion runtime account ID to `preview-discovery-complete-rt`.
- Added explicit Firebase endpoint-manifest mappings from runtime environment keys to the three certified Preview secret resources.
- Changed the Functions package entrypoint to `lib/previewDiscoveryIndex.js` and codebase to `preview-discovery`.
- Added a dry-run guard and a future project-explicit, exact-allowlist, non-interactive deploy command. The deploy command was not executed.
- Removed unused task-queue/notification dispatch code from completion support so it cannot enter the loaded deployment graph.
- Removed the tracked Production `.env`; added only the non-sensitive `functions/.env.aura-intel-preview` discriminator and hardened ignore rules.
- Added 15 deployment-unit tests covering the exact candidate and every required negative case.
- Updated inherited runtime/trust expectations for the corrected completion identity.
- Updated P8 evidence lookup to follow the centralized App Check contract without changing enforcement.
- Preserved `functions/src/index.ts` unchanged; it is isolated from this branch's package entrypoint.

## Explicitly unchanged

- Firestore Rules
- Vercel configuration
- Staging and Production resources
- Secret values and secret versions
- Storage and Tasks resources
- Client writer with an active CRM caller

## Operational record

- Firebase deploy: not executed.
- Cloud resources created or modified: none.
- Functions deployed: none.
- Commit: none.
- Push: none.
- Pull request: none.

## Rollback boundary

The change is wholly repository-local and uncommitted. Rollback consists of discarding only the files listed by this change record; no cloud rollback exists or is required because no deployment or external mutation occurred.

## Handoff

The next authorized slice may perform a controlled Preview-only deployment and remote read-back. Production remains unauthorized and on `REMEDIATION_HOLD`.
