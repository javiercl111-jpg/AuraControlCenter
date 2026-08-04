# Preview Runtime Trust Binding V1

## Decision

**BLOCKED — RUNTIME TRUST BINDING INCOMPLETE**

Preview now has separate runtime identities, minimum project IAM, exact empty-secret consumer bindings, STS, and four log-based metrics. The trust plane is not ready for a Function deployment because WIF was not materialized, all secret resources still have zero versions, App Check has no provider, alert and budget controls are incomplete, and two runtime code contracts conflict with Preview safety.

This record authorizes no workload deployment or traffic.

## Change control

| Field | Value |
| --- | --- |
| Slice | `AI-02H1E.5.R2C-P2` |
| Change ID | `AI-02H1E.5.R2C-P2-PREVIEW-TRUST-BINDING-20260804-01` |
| Target | Preview / `aura-intel-preview` only |
| Branch | `security/intelligence-preview-runtime-trust-binding` |
| Gate HEAD | `5c6e14d7a1587922861f66a15306668f9c99fe31` |
| Gate `origin/main` | `5c6e14d7a1587922861f66a15306668f9c99fe31` |
| Node / npm | `v20.20.2` / `10.8.2` |
| Actor role | `RUNTIME_PROVISIONING_IMPLEMENTER`; nominal identity excluded |
| Required approver roles | `SECURITY_OWNER` and `DEPLOYMENT_APPROVER`; nominal receipts pending |
| Final cloud read-back | `2026-08-04T23:31:23Z` |
| Production control state | `REMEDIATION_HOLD` |

The gate passed before cloud writes: exact branch, clean worktree, `HEAD == origin/main`, R2C-P present in `origin/main`, exact Preview alias, no default alias, required runtime versions, and Production hold.

## Authoritative pre-state

- 49 APIs enabled; IAM Credentials enabled and STS disabled.
- Existing R2C-P accounts: generic functions runtime, deployer, generic secret accessor, and telemetry writer.
- Generic functions runtime had log/metric writer. Deployer and generic secret accessor had no roles.
- Four secret containers existed with zero versions and no consumer bindings.
- One Firebase Web app existed; zero debug tokens; no App Check provider or enforcement change was present.
- Zero WIF pools/providers, log-based user metrics, Functions, Cloud Run services, buckets, or Cloud Tasks.
- Budget read was unavailable and the normalized alert-policy count was zero.
- All enumerated service accounts had zero user-managed keys.

## Handler-to-trust-boundary map

| Handler / result | Runtime identity | Firestore scope observed in code | Secret consumer | Caller controls | Tenant boundary | Required IAM | Explicitly prohibited |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `createDiscoveryLead` | `preview-public-intake-runtime` | intake idempotency + namespaces, discovery links, advisor lookup, containment, abuse telemetry/metrics, canonical principal reads when authenticated | `discovery-idempotency-secret-preview` | declarative and manual App Check; Auth optional; payload, rate/cost, containment and idempotency controls | advisor/tenant context comes from canonical principal or resolved link data; public caller grants no tenant authority | Firestore data user, log writer, exact secret accessor | deploy, Gemini, HMAC completion secret, IP-salt secret, Storage, Tasks, cross-environment access |
| `exchangeDiscoveryToken` | logical `preview-discovery-session-runtime`; account ID `preview-discovery-session-rt` | discovery capabilities, discovery links, containment, abuse telemetry/metrics | none | manual `request.app`; one-time capability exchange | capability is bound to the resolved link; no caller-supplied tenant grant | Firestore data user, log writer | all secrets, deploy, Storage, Tasks, broad impersonation |
| `resolveDiscoverySession` | logical `preview-discovery-session-runtime`; account ID `preview-discovery-session-rt` | discovery capabilities, discovery links, containment, abuse telemetry/metrics | none | manual `request.app`; session capability | session token and stored link binding define scope | Firestore data user, log writer | all secrets, deploy, Storage, Tasks, cross-link reads outside repository contract |
| `evaluateConversation` | `preview-conversation-runtime` | discovery capabilities, discovery links, conversation budgets, containment, abuse telemetry/metrics | `discovery-gemini-api-key-preview` | declarative App Check; session capability; bounded schema/cost policy | capability-bound session/link; model receives no authority | Firestore data user, log writer, exact Gemini accessor | idempotency/HMAC/IP-salt secrets, deploy, completion writes, Storage, Tasks |
| `completeDiscoverySession` | logical `preview-discovery-completion-runtime`; account ID `preview-discovery-complete-rt` | capabilities, completions, completion outbox, sessions, links, leads, prospect identity index, platform events, containment, abuse telemetry/metrics | `discovery-hmac-secret-preview` | manual `request.app`; session capability; completion validation/idempotency | capability-bound link/session with stored tenant/organization context | Firestore data user, log writer, exact HMAC accessor | deploy, Gemini/idempotency/IP-salt secrets, Storage permissions, Tasks |
| structured result | same completion identity | committed completion/session data and public result projection | no additional secret | generated only after completion transaction and capability validation | inherited from completion binding | no additional IAM | PDF, bucket objects, download/signing, notifications |

The project-level `roles/datastore.user` role cannot restrict a service account to collection paths. The collection split above is therefore an application contract, not an IAM boundary. A future deploy must prove the repository composition and negative cross-handler tests. No custom role was created because it would reduce permission verbs but still could not enforce collection-level scope.

## Runtime identities

Four new accounts were created. Two requested logical names exceeded the 30-character service-account ID limit, so their materialized IDs are shortened without collapsing trust boundaries:

| Logical identity | Materialized account ID | Project roles | User-managed keys | State |
| --- | --- | --- | --- | --- |
| `preview-public-intake-runtime` | same | `roles/datastore.user`, `roles/logging.logWriter` | 0 | provisioned, no workload |
| `preview-discovery-session-runtime` | `preview-discovery-session-rt` | `roles/datastore.user`, `roles/logging.logWriter` | 0 | provisioned, no workload |
| `preview-conversation-runtime` | same | `roles/datastore.user`, `roles/logging.logWriter` | 0 | provisioned, no workload |
| `preview-discovery-completion-runtime` | `preview-discovery-complete-rt` | `roles/datastore.user`, `roles/logging.logWriter` | 0 | provisioned, no workload |

`preview-functions-runtime` had both project roles removed and is parked with no roles. `preview-secret-accessor` remains parked with no roles. `preview-telemetry-writer` remains a purpose-specific account with log/metric writer from R2C-P. `preview-deployer` still has no project or service-account roles because WIF approval did not complete. Default compute and automatic Firebase identities were not selected as runtimes.

No runtime has Owner, Editor, deploy, key-admin, token-creator, service-account-user, global secret access, Storage, Tasks, or cross-environment privileges.

## Secret trust

| Secret | Exact consumer | Versions | State |
| --- | --- | --- | --- |
| `discovery-idempotency-secret-preview` | `preview-public-intake-runtime` | 0 | binding verified; value pending secure operator channel |
| `discovery-ip-hash-salt-preview` | none in the five audited handlers | 0 | intentionally unbound |
| `discovery-hmac-secret-preview` | `preview-discovery-complete-rt` | 0 | binding verified; value pending secure operator channel |
| `discovery-gemini-api-key-preview` | `preview-conversation-runtime` | 0 | binding verified; operator key pending |

No secret value was read, printed, passed as a visible argument, stored in a file, or committed. An attempted in-memory generation/upload of the three internal values was rejected by the execution security control before the command ran because that control requires operator-supplied material through a secure channel. No version was created. The IP salt remains unbound because the audited minimal handler set does not consume it; `resolveAdvisorByCode` is outside this slice.

The code uses logical parameters `IDEMPOTENCY_SECRET` and `GEMINI_API_KEY`, while the remote resource names differ. The deployment slice must provide an explicit per-function secret environment mapping; broad aliasing or a shared global accessor is prohibited.

## WIF design and result

The approved design candidate is:

- pool: `aura-github-preview`;
- provider: `github-aura-preview`;
- issuer: `https://token.actions.githubusercontent.com`;
- repository: `javiercl111-jpg/AuraControlCenter` exactly;
- ref: `refs/heads/security/intelligence-preview-runtime-trust-binding` exactly;
- GitHub environment: `preview` exactly;
- subject: `repo:javiercl111-jpg/AuraControlCenter:environment:preview` exactly;
- mapped claims: subject, repository, ref, environment, repository owner, event name;
- audience: canonical provider resource only;
- target: `preview-deployer` only;
- target access-token lifetime in workflow: 900 seconds;
- required external control: protected Preview GitHub Environment with approval receipt.

The environment security reviewer rejected provider creation before execution because those exact persistent federation conditions require an additional explicit approval. No pool, provider, principal binding, deploy role, `actAs`, or credential was created. STS was enabled in preparation, but it has no configured trust path. Other repositories, forks, other refs, missing/wrong environment, ambiguous subject, Staging, and Production remain unable to federate because no provider exists.

## App Check

- Web app: one registered app named `Aura Intelligence Preview Web`.
- Debug tokens: zero.
- Provider: not configured at pre-state; no configuration command executed.
- Enforcement: not enabled and no enforcement command executed.
- Required provider: exclusive Preview reCAPTCHA Enterprise key.
- Missing inputs: approved site key metadata, exact Preview domains, client artifact/config hash, owner/approver receipt, and negative test plan.
- Debug policy: no debug token unless separately approved with Preview-only scope, expiry, and revocation evidence.

The provider metadata endpoint was unavailable to the active read-only credential. State is therefore supported by the authoritative pre-state plus the complete absence of any provider/enforcement mutation in this wave, not by a final provider API receipt.

## Observability, alerts, and budgets

Four project log-based metrics were created with no payload or PII labels:

- `preview_discovery_runtime_errors`;
- `preview_secret_access_denials`;
- `preview_iam_policy_changes`;
- `preview_appcheck_rejections`.

Invocation volume and latency remain available through platform metrics after workloads exist. Rate-limit denials are currently persisted as Firestore structured telemetry rather than emitted as a reliable log metric. Gemini usage/cost is unavailable until a provider key and an approved usage signal exist.

Alert-policy count is zero. No alert threshold was invented and no notification channel was created. Budget API read returned 403; the approved USD 5 and USD 10 cost signals could not be verified or created without expanding billing authority. Both budgets and alert routing remain pending.

## Blocking runtime findings

1. `resolveStructuredAbuseEnvironmentV1` classifies a Preview project running with production Node mode as telemetry environment `PRODUCTION`, because its environment resolver recognizes Staging but not Preview. No Function may deploy until a code/config slice makes Preview explicit and tests it.
2. `completeDiscoverySession` still calls `DiscoveryReportGenerationService.generateReport`, whose implementation initializes Firebase Storage and attempts PDF generation. The error is caught, but the call violates the structured-result-only boundary. This trust wave grants no Storage role and creates no bucket; a code slice must remove or feature-gate that path before deployment.
3. The secret parameter names and remote secret resource names require an explicit per-function deployment mapping.
4. App Check manual checks in three v1 handlers are not a substitute for certified provider/client integration and declarative enforcement review.

## Final read-back

| Control | Result |
| --- | --- |
| Enabled APIs | 50; STS and IAM Credentials enabled; Tasks disabled |
| New runtime accounts | 4 |
| User-managed keys across all Preview service accounts | 0 |
| WIF pools/providers | 0 / 0 |
| Secret versions | 0 across all four containers |
| Secret accessor bindings | 3 exact resource/consumer bindings |
| Log-based metrics | 4 |
| Alert policies | 0 |
| Budgets | read blocked by 403; no mutation |
| Firebase Web apps / debug tokens | 1 / 0 |
| Functions | 0 |
| Cloud Run services | 0 |
| Storage buckets | 0 |
| Cloud Tasks | 0 |
| Staging | ACTIVE; one automatic service account; zero buckets; no write target |
| Production | ACTIVE; no write target; `REMEDIATION_HOLD` |

## Rollback

No rollback was required for successfully applied changes. The first multi-metric attempt failed and removed any partial metric before the simplified metrics were created. The secret-version and WIF operations were rejected before execution and changed no resource.

If a later approved rollback is triggered: remove the three secret bindings, remove the eight runtime project bindings, disable/remove the four metrics, and only then remove the four unused accounts and consider disabling STS. Preserve secret containers, fail-closed Rules, evidence, Staging, and Production. Destructive rollback requires a separate authorization.

## Next slice

Before any Function deployment:

1. approve the exact WIF condition, GitHub Environment approval control, canonical audience, principal binding, and 900-second workflow token lifetime;
2. provide all four secret values through an approved secure operator channel and verify only version counts/states;
3. configure Preview reCAPTCHA Enterprise metadata and client integration without enforcement;
4. approve alert thresholds/channels and grant a budget reader/manager path for USD 5 and USD 10 controls;
5. remediate Preview telemetry classification, completion's PDF/Storage call, and secret deployment mapping in a separately authorized code slice;
6. run positive/negative permission, capability, App Check, and cross-handler tests before traffic.

No Function, Cloud Run service, Storage bucket, Cloud Task, Rule, Staging resource, or Production resource was deployed or modified. No commit, push, or pull request was created.
