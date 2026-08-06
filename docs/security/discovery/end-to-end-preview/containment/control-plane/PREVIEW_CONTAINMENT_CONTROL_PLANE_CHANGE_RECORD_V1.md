# Preview Containment Control Plane Change Record V1

Change ID: `AI-02H2.2E-R1A-PREVIEW-CONTAINMENT-CONTROL-PLANE-20260806-01`

## Purpose

Introduce and certify the internal, fail-closed mechanism required for a later controlled Preview containment policy activation. This change does not perform the activation.

## Code changes

- Added versioned request, proposal, audit, authority, clock and persistence contracts.
- Added strict target and schema validation with no unsafe defaults.
- Added canonical semantic fingerprinting with domain-separated SHA-256.
- Added server-side policy materialization that rejects client timestamps.
- Added authority-gated orchestration.
- Added Firestore transaction support for CAS, immutable versions, orphan detection, atomic pointer/audit creation, deterministic retry and no-write dry-run.
- Exposed the existing policy document serializer/deserializer for one shared persistence boundary; existing repository behavior is unchanged.
- Added a fail-closed target/source guard and its negative test matrix.
- Extended the existing containment emulator suite without replacing its 36 historical tests.
- Registered local test and guard commands.

## Documentation changes

Created exactly four certification artifacts in the control-plane evidence directory:

1. certification narrative;
2. machine-readable matrix;
3. evidence index;
4. this change record.

## Validation summary

- Existing containment coverage: 36/36 PASS.
- New emulator coverage: 16/16 PASS.
- Combined containment coverage: 52/52 PASS.
- Guard coverage: 14/14 PASS.
- TypeScript `noEmit`: PASS.
- Functions build: PASS.
- Root build: PASS.
- Git whitespace validation: PASS.

## Operational impact

There is no newly exported Function, callable or HTTP endpoint. There is no automatic activation command and no deployment change. A later explicitly authorized slice must provide the trusted authority composition and invoke dry-run before any apply operation.

## Explicit non-actions

- No Firestore policy, pointer or audit write.
- No Firebase, GCP, IAM or Secret Manager mutation.
- No browser or Happy Path execution.
- No Production or Staging action.
- No deployment, commit, push or pull request.

## Suggested commit

`feat(security): certify preview containment activation control plane`
