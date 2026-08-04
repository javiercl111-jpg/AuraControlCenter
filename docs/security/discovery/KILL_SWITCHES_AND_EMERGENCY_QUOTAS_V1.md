# Kill Switches and Emergency Quotas V1

**Slice:** AI-02H1E.4.7  
**Contract:** `DISCOVERY_CONTAINMENT_POLICY_V1`  
**Status:** implemented for architectural review  
**Production:** not authorized

## Purpose and boundary

This slice introduces backend-owned operational containment for public Discovery. It is independent of the frontend and public payload, does not grant authority, and does not change IAM, App Check configuration, Firestore Rules, remote configuration, or deployment state. No administrative callable or HTTP endpoint is exported.

Containment is evaluated after the minimum trusted transport/payload checks needed to identify the surface and before the relevant side effect. Public failures are opaque and never reveal the switch, policy version, blocked subject, commercial code, App ID, or internal configuration.

## Focused surface inventory

| Surface | Caller / credential | Cost and side effects | Existing controls | P7 enforcement and fail behavior | Replay / disable impact |
|---|---|---|---|---|---|
| Public intake | Callable, App Check, optional platform auth | Advisor lookup, idempotency reservation, lead/link write, capability issuance | P2/P3/P5, App Check | `PUBLIC_INTAKE` before idempotency; `ADVISOR_CODE_RESOLUTION` before code lookup; `TOKEN_ISSUANCE` before capability construction; fail closed | Quota counts requests; retries remain bounded; disabled intake creates no lead |
| Advisor code resolution | Intake caller, normalized commercial code | Two Firestore reads and attribution | P5 payload bounds | HMAC selective block and dedicated switch before lookup | Does not block unrelated codes; disabled code resolution rejects opaquely |
| Token issuance | Callable, App Check plus link/session context | EXCHANGE/SESSION/REPORT token generation or consumption | P4 capability lifecycle | Dedicated switch in intake, exchange, and completion before issuance/consumption effects | Existing tokens retain their lifecycle; no new capability is returned |
| Session resolution | Callable, App Check, SESSION capability | Capability read/authorization | P4/P5 | Dedicated switch before repository authorization | Disabled resolution returns no session data |
| Conversation AI | Callable, App Check, SESSION capability | Cost lease and Gemini calls | P4/P5 | Switch and emergency quota after capability authorization, before P5 lease/Gemini | Replays cannot exceed atomic quota; disabled AI never calls Gemini |
| Completion | Callable, App Check, SESSION capability | Exactly-once reservation, dossier/lead writes, outbox | P3/P4/P5 | Switch and quota before `completeWithEffect`; token issuance checked before REPORT capability | Disabled completion reserves nothing and emits no completion effects |
| Report generation | Authorized callable or completion workflow | Metadata reservation, PDF, Storage write, lifecycle event | P4/P5 | Service-level switch and quota before metadata transaction | Disabled generation writes no `GENERATING` record |
| Document download | REPORT capability or platform principal | Optional generation, cost reservation, signed URL, delivery event | P4/P5 | Switch and quota before generation/download path and signed URL | Disabled download creates no URL or delivery event |
| Notification fan-out | Internal Cloud Task payload | OIDC client, gateway request, inbox projection | P5 task bounds | Switch and quota before OIDC client/fan-out | Disabled notification returns without delivery or projection |

The audit found no contradiction involving roles, claims, tenant authority, or IAM. IP blocking is excluded because no certified trusted IP source exists in this slice.

## Policy contract

`DiscoveryContainmentPolicyV1` is a closed contract containing:

- `version`, immutable `policyVersion`, and mandatory `environment`;
- nine independent boolean switches;
- bounded `blockedAppIds` and `blockedCommercialCodeHashes` lists;
- six explicit emergency quota rules;
- stable `reason`, role-based `ownerRole` and `approvedByRole`;
- `createdAt`, `updatedAt`, mandatory emergency `expiresAt`;
- optional `rollbackVersion` and `ACTIVE | EXPIRED | REVOKED | INVALID` status.

Policy versions are immutable. An existing version cannot be overwritten with different content. A rollback pointer must reference a previous valid policy in the same environment. Unknown, malformed, invalid, revoked, or expired active policies fail closed. The evaluator exposes `ALLOW`, `DENY`, and reserved `DEGRADED_ALLOW`; this implementation never uses degraded allowance for AI, completion, reports, downloads, or notifications.

## Independent switches

| Field | Surface |
|---|---|
| `publicIntakeEnabled` | Public intake |
| `advisorCodeResolutionEnabled` | Commercial-code lookup |
| `tokenIssuanceEnabled` | EXCHANGE/SESSION/REPORT capability issuance |
| `sessionResolutionEnabled` | Session resolution |
| `sessionCompletionEnabled` | Exactly-once completion |
| `conversationAiEnabled` | Gemini evaluation |
| `externalReportGenerationEnabled` | PDF/report generation |
| `documentDownloadEnabled` | Signed document download |
| `notificationFanoutEnabled` | External notification fan-out |

Each handler evaluates only its applicable switch set. A denied decision completes before its downstream side effect and records P6 telemetry best-effort.

## Selective blocks

App IDs are read from verified callable App Check context, never from `request.data`. Commercial codes are normalized with trim + uppercase and derived with purpose-scoped HMAC-SHA-256. Only the digest enters policy/evaluation; plaintext codes are not stored in P7 collections or telemetry.

Both lists are unique and limited to 100 values. Invalid entries, duplicates, or oversized lists make the policy corrupt and deny evaluation. Exact deterministic matching affects only the selected subject.

## Emergency global quotas

Rules exist for `INTAKE`, `AI_EVALUATION`, `COMPLETION`, `REPORT_GENERATION`, `DOWNLOAD`, and `NOTIFICATION`. Every rule has `enabled`, `windowSeconds`, `maxRequests`, and `burst`; there are no magic runtime numbers.

P7 reuses P2 through `P2DiscoveryEmergencyQuotaConsumer` and `RateLimitEvaluator`. Counters remain in `public_rate_limit_counters_v1`, are updated in Firestore transactions, and are keyed by environment, policy version, operation, and bucket. This separates environments and rollouts, bounds counter growth by fixed windows, and returns `retryAfterSeconds`. No frontend counter participates.

## Ports and core

The provider-neutral core defines:

- `DiscoveryContainmentPolicyProvider`;
- `DiscoveryContainmentEvaluator`;
- `DiscoveryContainmentAuditRepository`;
- `DiscoveryContainmentClock`;
- the additional `DiscoveryEmergencyQuotaConsumer` bridge to reusable quota infrastructure.

`DefaultDiscoveryContainmentEvaluator` has no Firestore or Firebase dependency. Firestore, P2 consumption, public error mapping, and P6 emission live in adapters/integration helpers.

## Firestore adapter and audit

| Collection | Purpose |
|---|---|
| `discovery_containment_policies_v1` | Immutable policy history; derived document IDs |
| `discovery_containment_active_v1` | One active pointer per environment |
| `discovery_containment_audit_v1` | Deterministic immutable lifecycle audit records |

Activation/update writes the immutable version, active pointer, and unique audit record in one Firestore transaction. Audit records contain audit/current/previous versions, action, environment, actor/approver roles, reason code, timestamps, rollback pointer, and result. They contain no public subject or policy payload.

There is no administrative UI or endpoint. `activatePolicy`, `append`, and `rollback` are backend adapter methods for trusted future orchestration and Emulator certification only.

## Rollback

Rollback starts from the active pointer and resolves `rollbackVersion` transactionally. It requires the same environment, a different existing active target, unexpired final policy, authorized owner/approver roles, no cycle, and no chain beyond eight versions. All reads occur before active-pointer and audit writes. The final policy is validated before activation.

Audit and active pointer are atomic. `containment.rollback_applied` telemetry is emitted after commit and is observational; audit remains authoritative if telemetry is unavailable. No remote rollback was performed.

## Telemetry and errors

P7 extends the closed P6 allowlist under `STRUCTURED_ABUSE_EVENT_CATALOG_V2`:

- `containment.allowed`;
- `containment.denied`;
- `containment.policy_missing`;
- `containment.policy_corrupted`;
- `containment.policy_expired`;
- `containment.selective_block`;
- `containment.emergency_quota_exceeded`;
- `containment.rollback_applied`.

Events contain stable reason codes but no policy document, plaintext subject, commercial code, App ID, token, signed URL, prompt, or model response.

Normalized internal errors are `CONTAINMENT_DISABLED`, `CONTAINMENT_POLICY_NOT_FOUND`, `CONTAINMENT_POLICY_CORRUPTED`, `CONTAINMENT_POLICY_EXPIRED`, `CONTAINMENT_SUBJECT_BLOCKED`, `EMERGENCY_QUOTA_EXCEEDED`, `CONTAINMENT_ROLLBACK_INVALID`, `CONTAINMENT_CONFIGURATION_ERROR`, and `CONTAINMENT_INTERNAL_FAILURE`. Callable responses use only `DISCOVERY_TEMPORARILY_UNAVAILABLE`; quota responses may include bounded `retryAfterSeconds`.

## Failure modes

| Failure | Behavior |
|---|---|
| Active pointer absent | Deny with policy-missing telemetry |
| Policy malformed or scope mismatch | Deny with critical corrupted-policy telemetry |
| Policy expired / revoked / invalid | Deny before side effects |
| Selective list malformed | Entire policy fails closed |
| P2 quota transaction/provider failure | Costly operation fails closed |
| P6 telemetry write failure | Business denial remains effective; sanitized warning only |
| Rollback invalid/cyclic/deep | Active pointer remains unchanged; normalized error |

## Emulator certification

The P7 suite runs only with Node `v20.20.2`, a `demo-*` project, no application credentials, and the isolated Firestore Emulator. It covers 36 cases including every switch, exact and over-quota decisions, `retryAfter`, 100 parallel requests, policy/environment separation, expiration/revocation, rollback, audit uniqueness, telemetry redaction, and side-effect ordering.

P6, P5, P4, P3, P2, D.9, both builds, and `git diff --check` remain mandatory regressions.

## Operational runbook (future trusted operator)

1. Confirm incident evidence and choose only the affected switch or quota.
2. Prepare a new immutable policy version for exactly one environment.
3. Set role-based owner and independent approver with a stable reason code.
4. Set a short mandatory expiry and valid previous rollback pointer.
5. Validate the contract and run P7 Emulator tests.
6. Activate through a future trusted backend control plane; never use public payload policy.
7. Verify atomic audit and sanitized containment telemetry.
8. Monitor denial rate, latency, cost, and unintended impact.
9. Roll back only to the validated pointer and verify its audit.
10. Expire or revoke the incident policy under the same two-role workflow.

This runbook describes future operations; no production control plane, activation, configuration, or deployment is authorized by P7.

## Risks, limitations, and P9 pending work

- Firestore is the implemented adapter; remote configuration is not introduced.
- Runtime integration fails closed when no active policy is seeded. A future authorized rollout must provision a reviewed policy before enabling handlers.
- App Check identifies an app signal, not a human or tenant authority.
- Audit is authoritative; telemetry is best-effort after lifecycle commits.
- There is no public/admin endpoint, scheduler, expiry job, or console.
- IP containment remains pending a trusted certified source.
- P9 must define the authorized control plane, secret/config distribution, dashboards/alerts, on-call approval, expiry automation, rollout ordering, and production certification evidence.

**PRODUCTION NOT AUTHORIZED.**
