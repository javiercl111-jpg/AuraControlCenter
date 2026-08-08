# AI-02H2.2G Final Preview Certification V1

Date: 2026-08-08  
Target: `aura-intel-preview`  
Environment: Preview  
Verdict: **CONDITIONAL — CERTIFIED WITH DOCUMENTED NON-BLOCKING GAPS**

## Executive certification

Aura Intelligence OS Preview is certified across Authority, Containment, containment policy renewal v2, final Discovery validation, Control Center access, CRM restoration, and least privilege. The complete chain remained Preview-only and fail-closed at client persistence boundaries.

The final verdict is conditional solely because the existing Replay Exactly Once certification retains `GAP-2F-01`: the live replay exercised the official completed-session resolution path rather than issuing a second remote `completeDiscoverySession` call. Remote recovery/replay produced zero persistence delta, while identical replay, conflicting replay, concurrent convergence, transaction retry, stable identifiers, and deterministic effects passed the isolated Firestore suites. This is documented as non-blocking and was not retested during this assembly.

## Consolidated control status

| Control domain | Certified state | Status |
|---|---|---|
| Authority | Canonical Preview principals, tenant binding, exact memberships and capabilities; actor/approver separation enforced | CERTIFIED |
| Containment | Preview-only activation control plane, closed schemas, immutable versioning, compare-and-set, atomic audit and fail-closed authority | CERTIFIED |
| Policy Renewal v2 | `preview-containment-v2` applied; active pointer present; policy `ACTIVE` and not expired at final validation | CERTIFIED |
| Discovery Final Validation | One synthetic intake completed; App Check and Authentication `VALID`; containment `ALLOW`; callable and completion HTTP 200 | CERTIFIED |
| Replay Exactly Once | Remote completed-session replay had zero functional delta; isolated suites certified completion replay and concurrency | CONDITIONAL / NON-BLOCKING GAP |
| Control Center Access | Authenticated Preview session operational with global-admin resolution and effective `VIEWER` access | RESTORED |
| CRM Restoration | `createCrmLead` active and ready; exactly one synthetic prospect created; count 2→3; duplicates 0 | RESTORED |
| Least Privilege | `VIEWER` preserved; exact `crm.leads.create` grant; unexpected capabilities 0; client Firestore writes remain denied | PRESERVED |

## Authority

The certified Authority chain resolves canonical principals and a single active membership against the exact Preview tenant. The containment actor and approver are separate identities with distinct exact capabilities: `containment.policy.activate` and `containment.policy.approve`. Wrong project, wrong environment, inactive or ambiguous authority, crossed capabilities, wildcard authority, global privilege fields, payload-supplied authority, and non-canonical selectors fail closed.

No platform-owner or super-administrator role is introduced by the Discovery authority chain. Control Center access uses the minimum login-compatible role, `VIEWER`.

## Containment and policy renewal v2

The `PreviewContainmentActivationControlPlaneV1` contract provides immutable policy versions, deterministic fingerprints, separation of duties, compare-and-set pointer changes, atomic audit, idempotent replay, and conflicting-replay rejection.

The expired v1 condition was remediated through a planned and dry-run-validated immutable renewal. Post-apply authoritative read-back during final Discovery validation confirmed:

- policy: `preview-containment-v2`;
- status: `ACTIVE`;
- active pointer: present;
- expired: no at validation time;
- runtime resolver: success;
- intake and completion decisions: `CONTAINMENT_ALLOWED`.

The policy allows the bounded Preview flow while report generation, download and notification fan-out remain disabled.

## Final Discovery validation

Exactly one synthetic fixture traversed the governed path:

`App Check VALID` → `Authentication VALID` → containment `ALLOW` → `createDiscoveryLead SUCCESS` → session completion `COMPLETION_COMPLETED`.

Authoritative aggregate read-back:

| Resource | Before | After | Delta |
|---|---:|---:|---:|
| Discovery leads | 2 | 3 | +1 |
| Discovery sessions | 2 | 3 | +1 |
| Discovery completions | 2 | 3 | +1 |

The exact fixture matched one Discovery link, one platform lead and one completion. Persisted duplicates were zero. Cloud Task creates, Storage object creates, emitted notification telemetry, report telemetry and replay telemetry were zero for the validation slice.

## Replay Exactly Once

The certified remote recovery plus replay returned the same completed-session result with App Check valid and no mutation. Leads, sessions, completions, capabilities, completion outbox, intake idempotency, namespaces, platform events, notifications, quota counters, Tasks and functional Storage remained unchanged.

The isolated suites additionally certified:

- identical completion replay;
- conflicting replay fail-closed;
- convergence under two and one hundred simultaneous completions;
- stable event, notification and report-capability identifiers;
- transaction conflict and caller retry behavior;
- corrupt and legacy capability failure;
- concurrent quota enforcement.

`GAP-2F-01` remains: a live remote `completion.replayed` result was not generated because the original session credential was not extracted and no unsupported replay harness was created.

## Control Center and CRM restoration

The authenticated Preview Control Center session is operational with effective role `VIEWER`. CRM creation follows the protected backend chain:

`authenticated VIEWER` → exact `crm.leads.create` capability → App Check protected `createCrmLead` callable → dedicated runtime → server-side Firestore transaction.

The controlled CRM certification created one synthetic prospect, changed the authoritative count from 2 to 3 and found zero duplicates. The Function remained `ACTIVE`, Cloud Run remained `READY`, and failed revisions remained zero.

## Least privilege and environment isolation

- Effective role: `VIEWER`.
- Role escalation: none.
- Exact additional capability: `crm.leads.create`.
- Unexpected capabilities: 0.
- Client Firestore create/update/delete for platform leads: `DENY`.
- Trusted writes occur only through the protected backend callable.
- Production: untouched.
- Staging: untouched.

## Assembly boundary

This final assembly created documentation only. It executed no browser action, Discovery or CRM operation, replay, deployment, provisioning, policy change, role/capability change, Production or Staging access, commit, push, or pull request.

## Final statement

**CONDITIONAL — CERTIFIED WITH DOCUMENTED NON-BLOCKING GAPS**

Aura Intelligence OS Preview is certified for its validated Preview scope. `GAP-2F-01` is retained transparently and does not invalidate the certified functional restoration, containment, authority, or least-privilege results.
