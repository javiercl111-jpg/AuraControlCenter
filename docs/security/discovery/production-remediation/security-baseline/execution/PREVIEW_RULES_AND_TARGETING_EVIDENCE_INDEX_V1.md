# Preview Rules and Targeting Evidence Index V1

## Control record

- Slice: `AI-02H1E.5.R2B`
- Change ID: `AI-02H1E.5.R2B-PREVIEW-RULES-20260804-01`
- Environment: Preview only
- Project ID: `aura-intel-preview`
- Verdict: **CONDITIONAL — PREVIEW MIGRATION GAPS REMAIN**

## Evidence set

| Evidence | Purpose |
| --- | --- |
| `PREVIEW_RULES_AND_TARGETING_EXECUTION_V1.md` | gate, implementation, test counts, deploy receipt, read-back, rollback, and scope closure |
| `PREVIEW_RULES_AND_TARGETING_MATRIX_V1.json` | machine-readable alias, collection migration, validation, rollback, and environment status |
| `PREVIEW_RULES_AND_TARGETING_EVIDENCE_INDEX_V1.md` | this evidence map |
| `PREVIEW_RULES_CHANGE_RECORD_V1.md` | authorization, artifact identity, deployment receipt, metadata, stop conditions, and rollback status |

## Executable evidence

| Repository artifact | Evidence supplied |
| --- | --- |
| `.firebaserc` | explicit Preview, Staging, and Production aliases; no default alias |
| `firestore.rules` | deployed fail-closed policy |
| `scripts/preview-rules-target-guard.cjs` | deterministic predeploy authorization and artifact hashing |
| `scripts/tests/preview-rules-target-guard.test.cjs` | positive contract, Git parser, and fail-closed negative cases |
| `functions/tests/emulator/runPreviewRulesEmulator.cjs` | pinned `firebase-tools` runner using a `demo-*` project |
| `functions/tests/emulator/rulesBaseline/firestorePreviewRulesBaseline.test.ts` | Rules boundary certification and Admin SDK positive path |
| `functions/tests/emulator/rulesBaseline/vitest.config.ts` | isolated single-file Rules suite configuration |

## Artifact identity

| Artifact | SHA-256 |
| --- | --- |
| Local and remote Firestore Rules source | `c933a1b80b8cc562aaf25021e6459b679c4eea368a172f285f16070352736145` |
| Executable R2B implementation set | `183b495df7d7301a13c1f960d77f0af83948d3770d69f8aa8cc2de47bfa6c6b4` |

## Deployment and read-back evidence

- Command scope: `firestore:rules` only.
- Target: `aura-intel-preview`.
- Release: `projects/aura-intel-preview/releases/cloud.firestore`.
- Ruleset: `projects/aura-intel-preview/rulesets/40dd0474-660b-43b6-b145-c85d765dec26`.
- Ruleset created: `2026-08-04T22:20:17.753289Z`.
- Release updated: `2026-08-04T22:20:18.102177Z`.
- Remote and local SHA-256 values matched exactly.
- Sanitization: no token, secret, account email, UID, project number, local absolute path, or full remote dump is retained.

## Test evidence

The predeploy and postdeploy results are recorded in the execution report and JSON matrix. Key security gates were:

- Preview Rules Emulator: 14/14 PASS before and after deploy;
- targeting guard: 15/15 PASS before and after deploy;
- P8 certification: PASS before and after deploy;
- P2: 17/17 PASS;
- P3: 24/24 PASS;
- P4: 29/29 PASS;
- Authority D.9: 40/40 PASS;
- Dark Handler D.8: 81/81 PASS;
- Functions and root builds: PASS before deploy.

## Limitations and follow-up

- No previous Preview ruleset exists, so historical rollback is unavailable.
- The matrix identifies direct client writers that block traffic enablement.
- Staging was not touched and is not authorized for review until migrations close.
- Production was not touched and remains on `REMEDIATION_HOLD`.
