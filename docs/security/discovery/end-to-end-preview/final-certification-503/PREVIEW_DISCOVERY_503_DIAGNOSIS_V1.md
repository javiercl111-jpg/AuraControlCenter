# Preview Discovery 503 Diagnosis V1

Date: `2026-08-08`

## Verdict

**PREVIEW DISCOVERY 503 ROOT CAUSE IDENTIFIED — READY FOR TARGETED REMEDIATION**

Classification: **A. CONTAINMENT_POLICY_EXPIRED**.

The single authenticated Preview request reached `createDiscoveryLead`. Callable verification recorded App Check and Auth as valid. The active containment pointer and policy were present and contract-valid, but `preview-containment-v1` had expired before the request. The evaluator therefore denied `PUBLIC_INTAKE` with `CONTAINMENT_POLICY_EXPIRED`, and the callable mapped that non-quota containment denial to HTTP 503 with the safe message `DISCOVERY_TEMPORARILY_UNAVAILABLE`.

## Gate and scope

- Repository gate: required worktree and branch; clean `HEAD = origin/main`.
- Commit: `6f66393ff6a7fdfd25fd515ff6eb84a7cdb3eca3`.
- Firebase/GCP target: `aura-intel-preview` only.
- Production and Staging: untouched.
- No browser interaction, retry, new Discovery request, policy mutation, deploy, commit, push or PR.

## Correlated request chain

The request is represented only by the sanitized locator `trace-sha256:aa311496281c`.

| Stage | Authoritative finding | Result |
|---|---|---|
| Transport | One HTTP 503 response at `2026-08-08T20:19:02.321908Z` | reached backend |
| App Check | callable verification `app=VALID` | PASS |
| Authentication | callable verification `auth=VALID` | PASS |
| Payload | no `payload.invalid` event in the correlated interval | no payload guard matched |
| Containment | `containment.policy_expired`, `CONTAINMENT_POLICY_EXPIRED` | DENY |
| Rate limit | expired-policy check precedes quota consumption | not reached |
| Authority | authority resolution occurs after containment in this handler | not reached |
| Persistence | all lead/session/idempotency deltas were zero | no functional write |
| Response | normalized `UNAVAILABLE` and HTTP 503 | contract-consistent |

## Active policy read-back

| Field | Actual |
|---|---|
| active pointer | present and contract-valid |
| policy | present; schema `DISCOVERY_CONTAINMENT_POLICY_V1` |
| environment | `PREVIEW` |
| status field | `ACTIVE` |
| public intake | enabled |
| token issuance | enabled |
| expiration | `2026-08-08T14:47:47.742Z` |
| expired at request | yes |
| block lists | both empty |

`DefaultDiscoveryContainmentEvaluator` checks semantic expiration before subject blocks, surface switches and emergency quota. An `ACTIVE` status does not override `expiresAt <= now`; the result is fail-closed `CONTAINMENT_POLICY_EXPIRED`.

## Quota discrimination

The `INTAKE` rule was enabled with a 86,400-second window, maximum 1, burst 0 and effective limit 1. The request-time `global.intake` counter existed with count 1 and remaining 0, but its last update was `2026-08-08T00:21:01.974Z`, nearly twenty hours before this request. It was not updated by the failed request.

This counter was not the first point of rupture. Source maps `EMERGENCY_QUOTA_EXCEEDED` to `resource-exhausted`/HTTP 429; every other containment denial maps to `unavailable`/HTTP 503. The exact telemetry event was policy expiration, not emergency quota exceeded.

## Persistence and infrastructure

Count-only reads for the correlated interval returned zero new `market_discovery_links`, `discovery_sessions`, `platform_leads`, idempotency records, idempotency updates and idempotency namespace updates. Source places containment before idempotency acquisition and functional persistence.

`createDiscoveryLead` is `ACTIVE` on Functions Gen 2. Its Cloud Run service is `READY`, failed revisions are zero, the Preview web shell responds HTTP 200, and source enforces App Check. These findings exclude an infrastructure runtime failure, Vercel outage and App Check precondition as the observed cause.

## Branch audit

| Branch | External response | Match |
|---|---|---|
| missing policy | 503 / temporary unavailable | no; policy exists |
| corrupted policy | 503 / temporary unavailable | no; pointer and policy validate |
| expired policy | 503 / temporary unavailable | **yes; exact telemetry** |
| revoked/disabled surface | 503 / temporary unavailable | no; status and intake switch allow |
| blocked subject | 503 / temporary unavailable | no; block lists empty |
| containment internal/configuration failure | 503 / temporary unavailable | no; exact decision was expiration |
| emergency quota exceeded | 429 / temporary unavailable | no; wrong status and no current consumption |
| App Check absent | failed precondition | no; App Check valid |

## Minimal remediation proposal — not executed

Open a separately authorized Preview-only change using the certified `PreviewContainmentActivationControlPlaneV1`. Create a new immutable policy version with a fresh server-owned bounded TTL, use `expectedCurrentVersion = preview-containment-v1`, preserve the reviewed switches/quotas, perform dry-run first, require separated activation/approval authority, then apply once and read back the policy, pointer and audit atomically.

Do not edit the expired document, extend its TTL, write Firestore manually or bypass the control plane. The repository guard fixes the target to Preview, rejects Production/Staging/wildcards, restricts writes to the three containment collections, requires tenant binding and fails closed on authority or CAS mismatch.
