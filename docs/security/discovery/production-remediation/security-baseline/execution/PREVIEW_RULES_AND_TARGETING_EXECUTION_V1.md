# Preview Rules and Targeting Execution V1

## Decision

**CONDITIONAL — PREVIEW MIGRATION GAPS REMAIN**

The first fail-closed Firestore Rules baseline is deployed and verified only in Preview. The deployment is safe for the current empty, non-serving Preview environment. Direct client writers identified in the migration matrix must move behind audited backend paths before Preview traffic is enabled or a Staging review is authorized.

This record does not authorize Production.

## Change control

| Field | Value |
| --- | --- |
| Slice | AI-02H1E.5.R2B |
| Change ID | `AI-02H1E.5.R2B-PREVIEW-RULES-20260804-01` |
| Branch | `security/intelligence-preview-rules-targeting` |
| HEAD | `c0d491d12f4acdc732378c5a7b56538e6ee417ca` |
| origin/main at gate | `c0d491d12f4acdc732378c5a7b56538e6ee417ca` |
| Actor role | `RELEASE_IMPLEMENTER` |
| Approver role | `SECURITY_OWNER` |
| Approval marker | `SECURITY_OWNER_APPROVED` |
| Production hold | `REMEDIATION_HOLD` |
| Rules SHA-256 | `c933a1b80b8cc562aaf25021e6459b679c4eea368a172f285f16070352736145` |
| Implementation artifact SHA-256 | `183b495df7d7301a13c1f960d77f0af83948d3770d69f8aa8cc2de47bfa6c6b4` |

The implementation artifact hash covers the aliases, Rules, package scripts, targeting guard, guard tests, and Rules Emulator harness. Evidence documents are intentionally excluded to keep the executable artifact hash stable.

## Gate

- Exact branch verified.
- HEAD equaled `origin/main`.
- Worktree was clean before R2B changes.
- Node `v20.20.2` and npm `10.8.2` were verified with the required runtime.
- R2A was present in `origin/main`.
- No new contradiction affecting Authority, IAM, tenant trust, or privileges was found.

## Aliases and targeting

The repository now defines explicit aliases:

| Alias | Project ID | R2B disposition |
| --- | --- | --- |
| `preview` | `aura-intel-preview` | sole authorized deploy target |
| `staging` | `aura-intel-staging` | configured, not touched |
| `production` | `aura-control-center-debb3` | configured, `REMEDIATION_HOLD` |

No `default` alias exists. The guard requires the exact branch, project, environment, Change ID, approval marker, actor role, confirmation, Production hold, runtime versions, alias map, and an allowlisted unstaged worktree. It fails closed for staged or unrelated changes.

The positive dry-run and deploy-mode authorization both emitted `AUTHORIZED_FOR_PREVIEW_RULES_ONLY`. The 15-test guard suite passed and includes explicit rejection of default, Staging, Production, an empty target, project mismatch, invalid branch, missing Change ID, missing approval marker, altered Production hold, missing actor confirmation, staged changes, unrelated changes, and a default alias mapping.

## Firestore Rules baseline

The deployed candidate enforces these boundaries:

- canonical active administrator authority comes only from a UID-addressed, backend-owned `platform_global_admins` document;
- email-addressed documents and custom claims do not grant authority;
- no client writes to `platform_global_admins` or `platform_tenants`;
- no direct client access to rate-limit, idempotency, capability, completion, budget, telemetry, containment, or Authority persistence collections;
- no client mutation of server-owned Discovery records;
- cross-tenant access is denied in the absence of a versioned canonical membership contract;
- an authenticated subject may read only its own backend-owned inbox;
- canonical active administrators retain read-only access to the explicitly enumerated administrative views needed for migration assessment;
- no public Firestore read path is defined; public advisor resolution must use its callable backend path;
- all unknown collections are denied by default.

## Migration safety finding

Preview had no Functions, Storage bucket, Cloud Tasks, or serving traffic at execution time. Deploying the fail-closed Rules baseline therefore did not interrupt a running Preview workload. It intentionally makes legacy direct writers unusable if a client is later pointed at Preview.

The blocking gaps for traffic enablement are:

- direct tenant, client, subscription, license, provisioning, quote, commission, organization, and market dataset mutations;
- the direct `discovery_sessions` status writer;
- direct advisor creation and the legacy public Firestore advisor lookup;
- the legacy email-keyed global administrator read fallback;
- absence of deployed backend mutation paths in Preview.

These gaps do not justify relaxing Rules. See `PREVIEW_RULES_AND_TARGETING_MATRIX_V1.json` for collection-level disposition.

## Local validation

### Predeploy

| Validation | Result |
| --- | --- |
| Preview Rules Emulator | 14/14 PASS |
| Targeting guard | 15/15 PASS |
| P8 matrix | 33/33 PASS |
| P2 rate limits | 17/17 PASS |
| P3 idempotency | 24/24 PASS |
| P4 capabilities | 29/29 PASS |
| P5 payload bounds | 34/34 PASS |
| P6 telemetry | 25/25 PASS |
| P7 containment | 36/36 PASS |
| Authority D.9 | 40/40 PASS |
| Dark Handler D.8 | 81/81 PASS |
| Functions build | PASS |
| Root build | PASS |
| `git diff --check` | PASS |

The required Functions build regenerated derived `functions/lib` outputs. Because the gate proved those paths clean before validation, the generated outputs were restored to `HEAD` and untracked build outputs were removed. No Functions source or compiled artifact remains modified by R2B.

### Postdeploy

| Validation | Result |
| --- | --- |
| Preview Rules Emulator | 14/14 PASS |
| Targeting guard and negative cases | 15/15 PASS |
| Admin SDK positive path | PASS within Rules Emulator suite |
| P8 matrix | 33/33 PASS |
| P2 rate limits | 17/17 PASS |
| P3 idempotency | 24/24 PASS |
| P4 capabilities | 29/29 PASS |
| P5 payload bounds | 34/34 PASS |
| P6 telemetry | 25/25 PASS |
| P7 containment | 36/36 PASS |
| Authority D.9 | 40/40 PASS |
| Dark Handler D.8 | 81/81 PASS |

All emulator projects used `demo-*` identifiers. No postdeploy test generated real Preview traffic.

## Deployment receipt

Authorized command:

```text
firebase deploy --only firestore:rules --project aura-intel-preview --non-interactive
```

Sanitized CLI result:

- target: `aura-intel-preview`;
- component: `firestore:rules` only;
- `firestore.googleapis.com` was already enabled;
- `firestore.rules` compiled successfully;
- `firestore.rules` was uploaded and released to `cloud.firestore`;
- deploy completed successfully;
- no indexes, Functions, Hosting, Storage, Tasks, TTL, IAM, WIF, secrets, service accounts, or App Check were deployed or changed.

## Read-back

The Firebase CLI does not expose a Firestore Rules get command. A first read-only API attempt with the available general Cloud credential returned HTTP 403 and made no change. Read-back then used the authenticated Firebase CLI session in memory and emitted only sanitized metadata:

| Field | Value |
| --- | --- |
| Target | `aura-intel-preview` |
| Release | `projects/aura-intel-preview/releases/cloud.firestore` |
| Current ruleset | `projects/aura-intel-preview/rulesets/40dd0474-660b-43b6-b145-c85d765dec26` |
| Ruleset created | `2026-08-04T22:20:17.753289Z` |
| Release updated | `2026-08-04T22:20:18.102177Z` |
| Remote source SHA-256 | `c933a1b80b8cc562aaf25021e6459b679c4eea368a172f285f16070352736145` |
| Local source SHA-256 | `c933a1b80b8cc562aaf25021e6459b679c4eea368a172f285f16070352736145` |
| Hash comparison | exact match |

No token, account identifier, email, or remote Rules content was printed or stored.

## Rollback

No previous ruleset exists in Preview. There is therefore no historical fail-closed ruleset eligible for rollback. No rollback was executed because deploy and postdeploy verification passed.

If a later validation fails, execution must stop. The only safe immediate action is to redeploy the exact current fail-closed artifact by its verified hash after a new guard authorization. Permissive Rules must never be introduced as rollback material.

## Environment and scope closure

- Preview: Firestore Rules changed exactly once and verified by remote hash.
- Staging: no command targeted it; unchanged.
- Production: no command targeted it; unchanged and remains on `REMEDIATION_HOLD`.
- No general Firebase deploy was executed.
- No commit, push, or pull request was created.

## Next authorized work

Create a dedicated Preview migration slice to replace the direct writers listed in the matrix with audited backend paths, remove the email-keyed administrator fallback, deploy the necessary backend only under separate authorization, and certify functional Preview flows. Staging review remains blocked until those gaps close.
