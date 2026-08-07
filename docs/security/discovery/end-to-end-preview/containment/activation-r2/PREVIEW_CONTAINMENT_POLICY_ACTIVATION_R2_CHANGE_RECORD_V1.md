# Preview Containment Policy Activation R2 Change Record V1

Change ID: `AI-02H2.2E-R1B-R2-PREVIEW-CONTAINMENT-ACTIVATION-20260806-01`

## Authorized change

Activate exactly one minimal containment policy in Preview project `aura-intel-preview`, region `us-central1`, through the certified private control plane and authority composition.

## Cloud mutation

One `apply=true` control-plane execution performed one atomic Firestore transaction that created one immutable policy (`preview-containment-v1`), one versioned active pointer, and one activation audit. No manual Firestore or ad hoc Admin SDK write was used.

An exact retry returned `REPLAY` and created no second policy, pointer, audit, or version.

## Policy decision

The policy enables public intake without commercial-code resolution, token issuance, session resolution, conversation AI, and session completion. Advisor-code resolution, reports, downloads, and notification fan-out remain disabled.

The 24-hour containment window permits one intake, up to 16 AI evaluations, and one completion. Ordinary rate limits, App Check, capability authorization, idempotency, tenant binding, and dual-control authority remain in force. TTL is 86,400 seconds; previous baseline and rollback version are null because this is the initial policy.

## Read-back

- Dry-run: `DRY_RUN_VALIDATED`; state 0/0/0.
- Apply: `APPLIED`; state 1/1/1.
- Exact retry: `REPLAY`; state 1/1/1.
- Runtime provider: active Preview policy found; pointer and fingerprint consistent.
- Production, Staging, wildcard scope: 0/0/0.
- Functional resources, Tasks, and functional Storage: zero.
- Rollback was not executed; readiness: `ROLLBACK_READY`.

## Repository mutation

Only the four evidence files in this directory were added. No application code, tests, Firebase Rules, deployment configuration, IAM, Secrets, or generated Functions artifact is part of the change.

## Validation

Containment 52/52 (base 36/36 and control plane 16/16), authority composition 25/25, authority guard 18/18, containment guard 14/14, both source guards, TypeScript `noEmit`, Functions build, root build, JSON parse, exact four-file count, and `git diff --check` passed.

## Explicit non-actions

No `createDiscoveryLead`, browser, Happy Path, token exchange, Discovery session resolution, AI evaluation, completion, report, download, notification, deployment, rollback, IAM/Secrets/Rules mutation, Production, Staging, commit, push, or PR was executed.

## Verdict

**PREVIEW CONTAINMENT POLICY ACTIVATED AND CERTIFIED — READY TO RESUME FIRST END-TO-END HAPPY PATH**
