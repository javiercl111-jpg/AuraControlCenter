# Preview Rules Change Record V1

## Authorization

| Field | Value |
| --- | --- |
| Change ID | `AI-02H1E.5.R2B-PREVIEW-RULES-20260804-01` |
| Change type | Firestore Rules only |
| Environment | Preview |
| Project ID | `aura-intel-preview` |
| Branch | `security/intelligence-preview-rules-targeting` |
| Base | `c0d491d12f4acdc732378c5a7b56538e6ee417ca` |
| Actor role | `RELEASE_IMPLEMENTER` |
| Approver role | `SECURITY_OWNER` |
| Approval marker | `SECURITY_OWNER_APPROVED` |
| Production state | `REMEDIATION_HOLD` |

No individual name is asserted by this record.

## Artifact

| Field | Value |
| --- | --- |
| Rules SHA-256 | `c933a1b80b8cc562aaf25021e6459b679c4eea368a172f285f16070352736145` |
| Remote source SHA-256 | `c933a1b80b8cc562aaf25021e6459b679c4eea368a172f285f16070352736145` |
| Artifact SHA-256 | `183b495df7d7301a13c1f960d77f0af83948d3770d69f8aa8cc2de47bfa6c6b4` |
| Hash comparison | exact match |

## Predeploy controls

- Guard dry-run: `AUTHORIZED_FOR_PREVIEW_RULES_ONLY`.
- Guard deploy mode: `AUTHORIZED_FOR_PREVIEW_RULES_ONLY`.
- Guard suite: 15/15 PASS.
- Rules Emulator: 14/14 PASS.
- P8 and inherited security regressions: PASS.
- Functions build: PASS.
- Root build: PASS.
- Migration decision: safe for the current empty Preview baseline; legacy direct writers block traffic enablement but must not cause Rules relaxation.

## Execution receipt

```text
firebase deploy --only firestore:rules --project aura-intel-preview --non-interactive
```

Result:

- exact target was `aura-intel-preview`;
- deploy component was Firestore only;
- the already-enabled Firestore API was confirmed;
- `firestore.rules` compiled successfully;
- Rules were uploaded and released to `cloud.firestore`;
- deploy completed successfully;
- no index or other Firebase component was included.

## Ruleset metadata

| Field | Value |
| --- | --- |
| Release | `projects/aura-intel-preview/releases/cloud.firestore` |
| Ruleset | `projects/aura-intel-preview/rulesets/40dd0474-660b-43b6-b145-c85d765dec26` |
| Ruleset creation time | `2026-08-04T22:20:17.753289Z` |
| Release creation time | `2026-08-04T22:20:18.102177Z` |
| Release update time | `2026-08-04T22:20:18.102177Z` |
| Previous ruleset | none |

## Postdeploy controls

- Rules Emulator: 14/14 PASS.
- Admin SDK positive path: PASS.
- Guard positive and negative cases: 15/15 PASS.
- P8 matrix: 33/33 PASS.
- P2: 17/17 PASS.
- P3: 24/24 PASS.
- P4: 29/29 PASS.
- P5: 34/34 PASS.
- P6: 25/25 PASS.
- P7: 36/36 PASS.
- Authority D.9: 40/40 PASS.
- Dark Handler D.8: 81/81 PASS.
- No real Preview traffic was generated.

## Rollback record

Rollback status: `NOT_EXECUTED_NO_FAILURE`.

Preview contained no earlier ruleset. A historical rollback target therefore cannot be named or certified as fail-closed. If a stop condition is met, no permissive Rules may be introduced. The safe action is to stop and, only under a fresh authorization, redeploy the current verified fail-closed artifact by hash.

## Stop conditions

Stop immediately if any of these conditions occurs:

- the target differs from `aura-intel-preview`;
- Staging or Production appears in a deploy command;
- the Change ID, branch, approval marker, actor confirmation, or Production hold differs;
- the worktree contains staged or non-allowlisted changes;
- the Rules or artifact hash differs from this record;
- compilation, Emulator, negative, Admin SDK, P8, D.9, or D.8 verification fails;
- deploy output includes indexes, Functions, Hosting, Storage, Tasks, or any component other than Firestore Rules;
- read-back ruleset source does not match the local Rules hash;
- a migration gap is used to justify permissive Rules.

## Scope receipt

| Resource or environment | Result |
| --- | --- |
| Preview Firestore Rules | changed and verified |
| Preview indexes | unchanged |
| Preview TTL | unchanged |
| Preview Functions | unchanged; none deployed |
| Preview Storage | unchanged; none created |
| Preview Tasks | unchanged; none created |
| Preview IAM, service accounts, WIF, secrets, App Check | unchanged |
| Staging | unchanged; not targeted |
| Production | unchanged; not targeted; `REMEDIATION_HOLD` |

## Final disposition

**CONDITIONAL — PREVIEW MIGRATION GAPS REMAIN**

No commit, push, pull request, Staging action, Production action, or deployment outside Preview Firestore Rules is part of this record.
