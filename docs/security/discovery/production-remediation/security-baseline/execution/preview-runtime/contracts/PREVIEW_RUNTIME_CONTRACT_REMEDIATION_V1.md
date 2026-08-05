# Preview Runtime Contract Remediation V1

## Execution record

- Slice: `AI-02H1E.5.R2C-P3`
- Recorded at: `2026-08-04T18:07:42-06:00`
- Branch: `fix/intelligence-preview-runtime-contracts`
- Certified base: `f9e4ce1ba7b1c79c1f3df2f2529f155e6ba20f2d`
- Target project contract: `aura-intel-preview`
- External mutations: none

## Gate

The gate passed with a clean worktree, `HEAD == origin/main`, Node `v20.20.2`, npm `10.8.2`, and the four R2C-P2 trust-binding evidence files present. No deploy, IAM, WIF, secret-version, App Check, Storage, Cloud Tasks, Staging, or Production operation was executed.

## Contradictions found and remediated

1. Telemetry previously inferred environment from emulator presence, project-name patterns, and `NODE_ENV`; an unrecognized Preview runtime could therefore become `PRODUCTION`.
2. `completeDiscoverySession` directly dispatched its notification outbox through Cloud Tasks and called `DiscoveryReportGenerationService`, coupling core completion to PDF and Storage.
3. Completion used the intake idempotency environment variable instead of a dedicated canonical HMAC variable.
4. The inherited platform-principal resolver supported email fallback and was too broad for the Discovery Preview intake boundary.
5. Runtime identity boundaries and the status of the unused IP hash salt were not executable contracts.

No new contradiction affecting Authority, IAM, tenant trust, or privileges was found. IAM and external trust configuration were not changed.

## Explicit environment contract

`RuntimeEnvironmentV1` is closed to `LOCAL_DEMO`, `PREVIEW`, `STAGING`, and `PRODUCTION`. `AURA_RUNTIME_ENVIRONMENT` is mandatory, and its value must match the exact project ID:

| Environment | Project contract |
| --- | --- |
| `LOCAL_DEMO` | `demo-*` plus `FIRESTORE_EMULATOR_HOST` |
| `PREVIEW` | `aura-intel-preview` |
| `STAGING` | `aura-intel-staging` |
| `PRODUCTION` | `aura-control-center-debb3` |

Missing, unknown, conflicting, or mismatched values fail closed. `NODE_ENV`, branch, host name, and deployment-mode defaults grant no operational classification. Discovery telemetry now consumes this explicit contract.

## Preview MVP feature gates

| Capability | Preview value |
| --- | --- |
| Structured result | enabled |
| PDF generation | disabled |
| Storage | disabled |
| Signed URLs | disabled |
| Notifications | disabled |
| Cloud Tasks | disabled |

The core completion still validates the request, performs the authoritative transaction, persists the dossier/completion/audit state, and returns the structured `dossierId`, `trustDecision`, and `structuredResultAvailable`. It neither creates the notification outbox for the Preview contract nor invokes report generation or task dispatch. The repository flag defaults to the inherited behavior for other callers, preserving the P4 contract while Preview passes the closed gate explicitly.

Optional document, Storage, URL-signing, notification, and task ports remain modeled behind closed feature gates; they were not deleted and are not called by the Preview core path.

## Runtime identity boundaries

The exact executable source compositions are recorded in `PREVIEW_RUNTIME_COMPOSITION_MATRIX_V1.json`. Each composition exports only its authorized handler set. The legacy aggregate index was not modified and is not the Preview deployment composition.

## Authority and PII controls

- Discovery public intake resolves authenticated principals only by canonical UID document ID.
- The new resolver has no email query or email-token fallback.
- Contract tests inspect the five MVP handlers and new resolver for raw email, phone, UID, session token, one-time token, capability token, or prompt fields in log calls.
- Runtime errors and telemetry use bounded reason codes; no secret values are documented.

## Validation

| Validation | Result |
| --- | --- |
| Preview runtime contracts | 18/18 PASS |
| Preview Rules Emulator | 14/14 PASS |
| Preview targeting guard | 15/15 PASS |
| P8 abuse matrix | 33/33 PASS |
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

The Functions build generated derived `functions/lib` output. The gate proved that path clean, so tracked outputs were restored and build-only untracked outputs were removed. No compiled artifact remains in the slice diff.

## Risks and limitations

- Secret resources still have zero versions; no backend can consume them until an operator supplies values through an approved channel.
- WIF and App Check provider configuration remain pending external trust work.
- Storage and all document capabilities remain deferred.
- The completion persistence model retains its deterministic internal report-capability hash for compatibility, but the Preview result does not expose a report token and no document service is invoked.
- These contracts define deployment boundaries but do not deploy them.

## Verdict and next step

**PREVIEW RUNTIME CONTRACTS REMEDIATED — READY FOR TRUST COMPLETION**

The next authorized slice may complete Preview trust prerequisites, load only demonstrated secret versions through the approved channel, configure App Check, and deploy the four explicit compositions under their dedicated identities. Review is required before any external change.
