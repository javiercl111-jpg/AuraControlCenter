# Discovery Backend Change Record V1

## Change

- Program: `AI-02H1E.5.0`
- Slice: `AI-02H1E.5.R3A`
- Change ID: `AI-02H1E.5.R3A-DISCOVERY-BACKEND-READINESS-20260805-01`
- Target assessed: Preview project `aura-intel-preview`
- Branch: `ops/intelligence-preview-backend-readiness`
- Change type: local read-only readiness audit and documentation
- Evidence destination: `docs/security/discovery/production-remediation/deployment-readiness/`

## Authorized scope

- inspect Functions configuration and source;
- trace the five specified Discovery handlers;
- verify declared identity, secret, Firestore, App Check, environment, target, logging, and telemetry controls;
- search for Production and optional-service residue;
- execute local tests and typecheck without output artifacts;
- create four documentation files.

No code, Firebase, Vercel, Staging, Production, infrastructure, resource creation, or deployment change was authorized or performed.

## Findings recorded

1. All five requested handlers use Firestore and have App Check and structured telemetry controls.
2. Secret declarations exist for intake, conversation, and completion; session handlers are intentionally secretless.
3. None of the five function definitions binds a certified runtime identity.
4. The completion runtime identity in the source manifest conflicts with the certified HMAC accessor identity.
5. Only completion applies the fail-closed environment/project contract.
6. `AURA_RUNTIME_ENVIRONMENT` has no Functions deployment binding in the repository.
7. The generic deploy script does not pin the Preview project or a handler allowlist.
8. The actual package entrypoint exports 19 function names, including Storage, Tasks, document, notification, advisor, prospect, and import surfaces outside the intended MVP.
9. An exported notification task contains a Production service-account binding.
10. The tracked root environment targets Production and is not a safe Preview default.
11. A client Firestore writer remains present for Discovery session status.
12. Runtime and trust suites pass, but they do not assert effective function options or deploy-manifest isolation.

## Stop conditions

Deployment remains stopped while any of the following is true:

- a requested handler lacks its exact certified service account;
- the HMAC identity name conflict is unresolved;
- a requested handler lacks exact Preview environment/project validation;
- `AURA_RUNTIME_ENVIRONMENT=PREVIEW` is not supplied through an approved Functions mechanism;
- the deployment command can target an implicit alias or all Functions;
- the deployment unit includes a Production service account or an out-of-scope surface;
- generated deployment metadata has not been reviewed for exact handler, secret, identity, region, runtime, and App Check settings.

## Required next change

A separate code-remediation slice must implement an isolated Preview Functions deployment unit and prove its generated manifest. It must bind the five exact runtime identities, align the HMAC accessor name, apply the environment guard uniformly, pin `aura-intel-preview`, and exclude reports, Storage, Tasks, notifications, import, advisor, and prospect exports.

The remediation must add negative tests that fail when a Production project, Production service account, default alias, out-of-scope export, missing service account, or missing environment binding enters the Preview deployment unit.

## Rollback

No runtime or infrastructure rollback is required because this audit performed no external or code mutation. If the documentation is rejected, remove only these four uncommitted evidence files.

## Verdict

**BLOCKED — DEPLOYMENT NOT SAFE**

**PRODUCTION NOT AUTHORIZED**

No Functions deployment is authorized.
