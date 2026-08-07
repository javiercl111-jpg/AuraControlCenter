# Preview Containment Policy Activation R2 V1

Change ID: `AI-02H2.2E-R1B-R2-PREVIEW-CONTAINMENT-ACTIVATION-20260806-01`

Execution date: `2026-08-07`

## Dictamen

**PREVIEW CONTAINMENT POLICY ACTIVATED AND CERTIFIED — READY TO RESUME FIRST END-TO-END HAPPY PATH**

Exactly one minimal containment policy is active in project `aura-intel-preview`, environment `PREVIEW`, region `us-central1`. Production and Staging were not targeted.

## Gate and baseline

- Required worktree and branch: PASS; `HEAD = origin/main`; initial worktree clean.
- Node `v20.20.2`; Firebase alias `preview`; GCP project `aura-intel-preview`.
- Functions 5/5 `ACTIVE`; Cloud Run 5/5 `READY`.
- Baseline: policies 0, pointers 0, audits 0.
- Functional baseline: leads, sessions, capabilities, conversation budgets, completions, notifications, Cloud Tasks, and Storage objects all 0.

Historical structured-abuse telemetry contained 6 aggregate events and 4 metric documents. These are not functional conversation or evaluation records and were unchanged by activation.

## Authority

The certified composition returned one eligible actor, one eligible approver, one separated pair, and verifier `ALLOW`. Actor and approver identity, principal, and membership locators were distinct and tenant-bound.

- actor capability: `containment.policy.activate`;
- approver capability: `containment.policy.approve`.

Email and payload fields were not used as authority.

## Minimal policy

| Control | Value |
|---|---|
| Version | `preview-containment-v1` |
| Status | `ACTIVE` |
| TTL | 86,400 seconds |
| Previous baseline | null |
| Fingerprint locator | `sha256:5cd582fa9c62…` |
| Enabled | public intake, token issuance, session resolution, conversation AI, session completion |
| Disabled | advisor-code resolution, reports, downloads, notifications |
| Block lists | empty |

The 24-hour containment quotas permit one intake, up to 16 AI evaluations (the contractual per-session maximum), and one completion. Report, download, and notification quotas remain disabled. Ordinary rate limits, App Check, capability authorization, idempotency, tenant binding, and dual-control authority remain in force.

## Execution and read-back

The certified control plane returned `DRY_RUN_VALIDATED`; the immediate read-back remained 0/0/0. One explicit `apply=true` transaction returned `APPLIED` and atomically created one policy, one versioned pointer, and one audit. Post-apply was 1/1/1.

An exact retry with the same request, idempotency key, proposed version, and fingerprint returned `REPLAY`; state remained 1/1/1.

The containment provider used by `createDiscoveryLead` found the active Preview policy. Pointer, policy, status, version, and fingerprint were consistent; `CONTAINMENT_POLICY_NOT_FOUND` was false. No Discovery handler was invoked.

Rollback was not executed. Readiness is `ROLLBACK_READY`: current version present, previous baseline null, CAS match, audit available, fingerprint available, and pointer schema version present.

## Final isolation and health

- Production scope 0; Staging scope 0; wildcards 0.
- Leads, sessions, capabilities, conversation records, completions, outbox, events, notifications, idempotency, Tasks, and functional Storage objects: 0.
- Functions 5/5 `ACTIVE`; Cloud Run 5/5 `READY`; failed revisions 0.
- Vercel project `aura-control-center-preview`: `READY` in Preview.
- IAM, Secrets, Rules, Production, and Staging: unchanged.

## Local validation

| Validation | Result |
|---|---:|
| Containment emulator | 52/52 PASS |
| Base containment / control plane | 36/36 / 16/16 PASS |
| Authority composition | 25/25 PASS |
| Authority / containment guard tests | 18/18 / 14/14 PASS |
| Both source guards | PASS |
| Functions TypeScript `noEmit` | PASS |
| Functions build / root build | PASS / PASS |
| `git diff --check` | PASS |

## Stop condition

No `createDiscoveryLead`, browser, Happy Path, token exchange, Discovery session resolution, AI evaluation, completion, deploy, rollback, IAM/Secrets/Rules mutation, Production, Staging, commit, push, or PR was executed.
