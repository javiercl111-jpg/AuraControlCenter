# Preview Secret Resource Binding Change Record V1

Date: 2026-08-05
Change ID: `AI-02H1E.5.R3D-PREVIEW-SECRET-BINDING-20260805-01`

## Purpose

Make Firebase Functions v2 discover and bind the existing Preview Secret Manager resources directly, and replace incompatible individual-function deployment filters with the certified codebase target.

## Repository changes

- Replaced three logical uppercase `defineSecret` names with exact Preview resource IDs.
- Preserved `SecretParam.value()` consumption.
- Replaced `runtimeEnvName` with exact `secretParamName` in the runtime manifest.
- Reworked the deployment contract to model `secretParamName` and `secretResource` explicitly.
- Added codebase and deploy-target fields to the fail-closed candidate contract.
- Removed the ineffective post-discovery endpoint binder from the Preview entrypoint.
- Changed the future deploy filter to `functions:preview-discovery` while retaining build, guard, exact project and non-interactive execution.
- Expanded the guard to validate direct SecretParams, target/order, codebase, identities and forbidden surfaces.
- Expanded deployment-unit coverage from 15 to 22 tests and aligned runtime/trust expectations.

## Explicitly unchanged

- secret values, versions and IAM;
- `discovery-ip-hash-salt-preview` deferred state;
- five-handler allowlist;
- runtime service accounts;
- Firebase and Firestore configuration;
- Rules, Vercel, Storage and Tasks;
- Staging and Production;
- package dependencies and locks.

## Cloud record

Read-only metadata confirmed the three existing secrets, one enabled version and one exact accessor per resource, zero project-level accessors, zero Functions, zero Cloud Run services and enabled Firebase Extensions API. No values were read.

The two inherited aborted attempts remain part of the incident record. This slice did not execute a third attempt.

## Operational record

- Firebase deploy: not executed.
- Cloud mutation: none.
- Commit: none.
- Push: none.
- Pull request: none.

## Handoff

The repository binding and codebase filter are ready for a separately authorized controlled Preview deployment retry. Production remains on `REMEDIATION_HOLD` and is not authorized.

