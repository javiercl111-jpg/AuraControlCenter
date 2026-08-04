# Production Configuration Blockers v1

**Slice:** AI-02H1E.4.9

**Audit target:** `aura-control-center-debb3` / `aura-control-center`

**Evidence cutoff:** 2026-08-04T10:31:05.6674617-06:00

**Verdict:** **NOT READY — CRITICAL PRODUCTION CONFIGURATION GAPS**

No external configuration was changed. This file records blockers for architectural and operational review; it is not a deployment instruction.

## P0 blockers

| ID | Blocker | Verified evidence | Minimum containment before remediation | Closure evidence |
|---|---|---|---|---|
| P0-01 | No governed separation of Preview, Staging, and Production | `.firebaserc` defines only `default`; Preview deployments exist without a declared isolated Firebase project | Freeze production configuration changes and require explicit project arguments for every future command | Approved environment inventory with distinct projects, identities, buckets, aliases, and promotion rules |
| P0-02 | Backend hardening P1–P8 is not deployed | Scoped Functions were updated 2026-07-23/24; P1–P8 merged 2026-08-03/04; Vercel Production is already at HEAD | Do not promote backend or claim frontend/backend compatibility | Deployed source provenance at an approved commit plus complete P9 re-verification |
| P0-03 | Idempotency TTL is absent | Firestore returns zero TTL field configurations; 49 idempotency documents exist | Prevent further production promotion and monitor collection growth manually without writing data | `discovery_intake_idempotency.expiresAt` reports ACTIVE and TTL/cardinality alerts exist |
| P0-04 | Production public App Check app retains a debug token | Aura Nexus Public debug-token count is one | Identify its approved owner/context; restrict release activity until revoked under change control | Production debug-token count is zero and audit evidence is retained |
| P0-05 | Effective App Check provider/enforcement cannot be verified | App Check configuration API returned HTTP 403 | Treat App Check posture as untrusted; do not broaden invoker or deploy new public surfaces | Metadata-only provider/enforcement evidence for Functions, Firestore, and Storage |
| P0-06 | Production containment policy is absent | Active pointer GET returned 404; active/policy/audit collection counts are all zero | Keep all rollout work paused; do not seed policy outside a separately authorized change | Valid active PRODUCTION policy, bounded quotas, expiry, rollback pointer, and audit record |
| P0-07 | No P0 observability or alerting | Zero log-based metrics, alert policies, dashboards, telemetry documents, and aggregate metric documents | Establish manual operational ownership before any further readiness activity | Reviewed dashboards/alerts with routing, owner, escalation, runbook, and non-production exercise |
| P0-08 | Repository Rules permit authority mutation by any authenticated client | Local `firestore.rules` allows authenticated read/write on `platform_global_admins` and `platform_tenants`; deployed rules are unknown due HTTP 403 | Prohibit deployment of the current Rules file; preserve current remote state until it can be read | Backend-only authority rules, adversarial Emulator coverage, and exact deployed hash match |
| P0-09 | Deployed Rules cannot be compared | Firebase Rules release/ruleset API returned HTTP 403 | Do not infer that production is safe or that repository rules are deployed | Least-privilege read access and normalized local/remote hash comparison |
| P0-10 | Runtime amplification limits exceed the contract | All scoped Functions use concurrency 80 and maxInstances 20; most have timeout 60 seconds | Avoid load tests and production traffic generation; retain current no-invocation audit posture | Approved per-function limits deployed and read back from ServiceConfig |
| P0-11 | Notification queue amplification is excessive | Queue permits 500 dispatches/s and 1,000 concurrent dispatches | Do not enqueue production tasks for verification | Approved low-rate queue limits, backlog alert, recovery/DLQ strategy, and runbook |
| P0-12 | Runtime IAM is not least privilege | Eight scoped Functions use the default compute service account; it has project Editor and accesses all three scoped secrets | Do not add consumers or permissions; plan identity split before release | Dedicated accounts and effective-permission evidence per function/secret |
| P0-13 | Preview backend/data isolation is unverified | Feature/test branches auto-produce READY Preview deployments; Vercel env targets/protection were unavailable | Do not treat Preview as a safe test environment for production data | Vercel environment-name/target evidence plus distinct Preview Firebase resources |

## P1 remediation queue

- Remove permanent personal `Owner` and personal `serviceAccountUser` in favor of governed, time-bound access.
- Prove zero user-managed service-account keys; the auditor lacked key-list permission.
- Version and deploy a reviewed Firestore index manifest.
- Decide delete protection and point-in-time recovery for Firestore.
- Restrict each secret to its dedicated runtime identity and retire or justify superseded enabled versions.
- Enable Uniform Bucket-Level Access and enforced public-access prevention; approve report lifecycle/retention.
- Verify signed-URL signer permissions and effective five-minute TTL from deployed source provenance.
- Verify notification gateway authentication, provider quotas, and Vercel environment variables by name/target.
- Provide budget metadata for GCP, Gemini, Vercel, Cloud Tasks, Storage, and notifications.
- Pin/certify Vercel Node; project metadata currently reports `24.x` against the Node 20 audit baseline.
- Create approved incident response, secret rotation, IAM revocation, queue backlog, cost-spike, rollback, and break-glass runbooks.

## Conditions to resume certification

1. Close every P0 with read-back evidence; configuration intent is insufficient.
2. Resolve the deployed Rules unknown before any Rules change.
3. Establish environment separation before testing Preview against live backends.
4. Promote backend only through a separately authorized release after IAM, TTL, App Check, containment, quota, and alert blockers are closed.
5. Repeat all remote metadata queries and P8/local regressions from a clean certified commit.

The next action is architectural and operational remediation planning. No commit, push, pull request, deployment, or external configuration mutation was performed by this audit.
