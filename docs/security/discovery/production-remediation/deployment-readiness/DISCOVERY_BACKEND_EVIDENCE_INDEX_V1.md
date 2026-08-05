# Discovery Backend Evidence Index V1

## Evidence set

| File | Purpose |
| --- | --- |
| `DISCOVERY_BACKEND_READINESS_V1.md` | Gate, handler assessment, blockers, passed controls, remediation, and verdict |
| `DISCOVERY_BACKEND_MATRIX_V1.json` | Machine-readable handler, deployment-unit, environment, residual, and test state |
| `DISCOVERY_BACKEND_EVIDENCE_INDEX_V1.md` | Audited sources, validation commands, evidence limits, and hygiene |
| `DISCOVERY_BACKEND_CHANGE_RECORD_V1.md` | Audit scope, findings, stop conditions, and required next change |

Evidence destination: `docs/security/discovery/production-remediation/deployment-readiness/`

## Audited sources

- `firebase.json` and `.firebaserc`;
- root and Functions package manifests;
- `functions/src/index.ts` and Admin SDK initialization;
- the five requested Discovery handlers;
- runtime environment and feature-gate contracts;
- secret manifest and runtime composition modules;
- Firestore capability, idempotency, containment, and telemetry adapters referenced by the handlers;
- Preview secret activation evidence for exact accessors;
- tracked environment-variable names and target classification without values;
- client Discovery Firestore writer references;
- residual Storage, Tasks, report, notification, Production, email-fallback, and `NODE_ENV` references.

## Executed validation

| Validation | Result |
| --- | --- |
| Runtime contract suite | 18/18 PASS |
| Preview trust-completion suite | 20/20 PASS |
| Functions TypeScript with `--noEmit` | PASS |
| Secret values read | 0 |
| Deployments performed | 0 |
| Infrastructure changes | 0 |

The test suites validate declared source contracts. This audit separately inspected the actual function options, package entrypoint, deployment command, environment bindings, and export inventory because those controls are not covered by the passing contract tests.

## Primary negative evidence

- zero requested handlers declare `serviceAccount`;
- four of five handlers do not invoke the environment/project contract;
- zero Functions environment files or deployable parameter bindings supply `AURA_RUNTIME_ENVIRONMENT`;
- the package entrypoint exposes 19 function names;
- runtime composition modules are not deployment entrypoints;
- the deploy script has no explicit Preview project or handler allowlist;
- one exported task handler contains a Production service-account binding;
- the HMAC manifest identity differs from the certified accessor identity;
- the tracked root environment targets Production;
- Storage, Tasks, report generation, notification, and client-writer code remains reachable outside the intended five-handler boundary.

## Evidence limits

- inherited cloud certifications were accepted and not queried;
- no generated Firebase deployment manifest was produced because build/deploy artifact generation was outside the no-modification scope;
- no secret value, environment value, credential, personal email address, or personal data is included;
- no runtime invocation or emulator test was used as proof of effective cloud identity;
- this record does not authorize a remediation implementation or deployment.

Verdict: **BLOCKED — DEPLOYMENT NOT SAFE**.

Boundary: **PRODUCTION NOT AUTHORIZED**.
