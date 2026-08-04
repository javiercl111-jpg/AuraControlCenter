# Public Intake Emulator Abuse Certification V1

Status: certification evidence for architectural review. This document does
not apply remote configuration, deploy code, or grant production approval.

## Scope

AI-02H1E.4.8 certifies the public Discovery intake controls implemented by
P2-P7 across intake creation, advisor-code resolution, token exchange, session
resolution, conversation evaluation, exactly-once completion, report and
document access, notification fan-out, containment, quotas, and abuse
telemetry.

The certification is test-only except for correcting the exact expected
`firebase.json` predeploy array in the existing access-integrity test. No
product handler, Firebase Rule, production export, IAM policy, App Check
setting, provider, or deploy configuration is changed.

## Closed harness architecture

The canonical command is:

```text
npm.cmd run test:public-intake-abuse-certification
```

The runner requires Node `v20.20.2`, rejects
`GOOGLE_APPLICATION_CREDENTIALS`, accepts only loopback emulator hosts, invokes
each non-redundant domain suite once, and checks that every configured
Firestore port is released after its suite. A nonzero child result or retained
port fails the aggregate command.

Only isolated demo projects are used:

| Domain | Environment | Port |
| --- | --- | ---: |
| P2 rate limits | Firestore Emulator, `demo-aura-public-rate-limits` | 8090 |
| P3 idempotency | Firestore Emulator, `demo-aura-discovery-idempotency` | 8092 |
| P4 capabilities | Firestore Emulator, `demo-aura-discovery-capabilities` | 8093 |
| P5 payload/cost | Firestore Emulator, `demo-aura-discovery-payload-bounds` | 8094 |
| P6 telemetry | Firestore Emulator, `demo-aura-discovery-abuse-telemetry` | 8095 |
| P7 containment | Firestore Emulator, `demo-aura-discovery-containment` | 8096 |
| D.9 Authority | Firestore Emulator, `demo-aura-intelligence-os-authority-e2e` | 8089 |

All Emulator configurations use `127.0.0.1`, disable the Emulator UI, and use
`firestore.emulator.rules`. The test harness contains no remote endpoint,
credential, real project identifier, production token, or absolute workstation
path. The runner is not imported or exported by `functions/src/index.ts`.

## Fakes and deterministic seams

- App Check: explicit test-only verifier states `MISSING`, `INVALID`, and
  `VALID`, synthetic App IDs, deterministic attestation IDs, and optional
  replay rejection.
- Containment and quotas: real P7 and P2 cores/adapters against Firestore
  Emulator; App Check composition uses an in-memory call ledger.
- Gemini, PDF, signed URL, and notification gateways: zero-call ledgers in the
  App Check seam plus the existing P5/P7 provider-neutral downstream seams.
- Clock and IDs: existing P2-P7 injectable clocks and deterministic synthetic
  fixtures.
- Cloud Tasks and Storage: no real provider is invoked; durable notification
  keys, report capabilities, scope, quotas, and zero-downstream behavior are
  asserted through existing fakes and Firestore state.

The Functions Emulator does not reproduce real App Check attestation
verification. P8 therefore certifies handler enforcement declarations and the
explicit seam behavior. Provider registration, debug-token prohibition,
attestation replay settings, and effective enforcement remain P9 checks.

## Canonical CT-01 through CT-22 matrix

The executable source of truth is
`functions/tests/publicIntakeAbuseCertification/publicIntakeAbuseCertificationMatrix.ts`.
Every row is blocking and references tracked evidence tokens that are verified
by the P8 matrix suite.

| ID | Threat / surface | Controls and executed evidence | Expected result | Result |
| --- | --- | --- | --- | --- |
| CT-01 | Missing, invalid, or replayed App Check / all callables | P7/P8 App Check seam and handler guards | Deny before state, quota, or cost | PASS |
| CT-02 | Malformed payload / create, AI, completion, report | P5 strict schemas and safe mapping | Opaque invalid argument; zero downstream | PASS |
| CT-03 | Byte, depth, field, array, and string amplification | P5 UTF-8 and structural bounds | Boundary accepted; excess denied | PASS |
| CT-04 | Commercial-code enumeration / advisor resolution | Approved uniform invalid-code contract | No advisor, role, UID, or tenant disclosure | PASS |
| CT-05 | Intake replay / create | P3 active COMPLETED replay | One authoritative link and result | PASS |
| CT-06 | Concurrent intake and token rotation / create | P3 transaction and deterministic capability | One link and one usable generation | PASS |
| CT-07 | IP/App flooding / create and advisor code | P2 atomic parallel counters | Exact allowed/denied counts; no overshoot | PASS |
| CT-08 | Distributed identity rotation / create | P2 purpose dimensions including GLOBAL | Rotation cannot bypass global ceiling | PASS |
| CT-09 | Email enumeration/flooding / create | P2 EMAIL_HASH and P6 redaction | Stable private quota; no plaintext email | PASS |
| CT-10 | Unlimited idempotency keys / create | P3 namespace cardinality | Ceiling fails closed | PASS |
| CT-11 | Expired, reused, revoked, manipulated token | P4 lifecycle | Opaque denial and zero secondary effect | PASS |
| CT-12 | Cross-session capability / resolve, complete, report | P4 scope and report access integrity | No cross-session read/write/artifact | PASS |
| CT-13 | Repeated/concurrent completion | P4 exactly-once transaction | One dossier, event, notification key, report capability | PASS |
| CT-14 | Switch/config missing or disabled | P7 fail-closed containment | DENY before state or expensive work | PASS |
| CT-15 | Authority/server-field injection | P5 server-owned-field rejection | No roles, claims, admin, tenant, org, or arbitrary-path mutation | PASS |
| CT-16 | Tokens, PII, payloads, prompts, or URLs in logs | P6 allowlisted telemetry and canary scans | No sensitive free-form value | PASS |
| CT-17 | Expired cache and retention growth | P3 semantic expiry, cleanup, TTL manifest | Expired result unused; active record retained | PASS |
| CT-18 | Gemini cost amplification / evaluate | P5 budget and P7 AI switch | Bounded attempts; zero Gemini after DENY | PASS |
| CT-19 | PDF/Storage amplification / generate | P4 report capability, P5 bounds, P7 switch | No duplicate generation/save after DENY | PASS |
| CT-20 | Download amplification/token theft | P4 REPORT scope, P5 quota, P7 switch | Bounded grant; no cross-scope or logged URL | PASS |
| CT-21 | Notification fan-out amplification | P4 stable key, P5 fan-out bound, P7 switch | At most one logical fan-out; zero when OFF | PASS |
| CT-22 | Config, environment, telemetry, or regression drift | P2-P8 runner, rollback, redaction, D.9/D.8 | All local domains green; P9 remains blocking | PASS |

## Results captured on the certified base

| Command/domain | Result |
| --- | --- |
| P8 matrix, App Check seam, architecture/access guards | 33/33 PASS |
| P2 Rate-limit Emulator | 17/17 PASS |
| P3 Idempotency Emulator | 24/24 PASS |
| P4 Capability Emulator | 29/29 PASS |
| P5 Payload/Cost Emulator | 34/34 PASS |
| P6 Abuse Telemetry Emulator | 25/25 PASS |
| P7 Containment Emulator | 36/36 PASS |
| Authority D.9 | 40/40 PASS |
| Dark Handler D.8 | 81/81 PASS |
| Discovery access integrity and report scope | 10/10 PASS |
| Functions typecheck/build | PASS |
| Root build | PASS |

P4's actual runner reports 29 test blocks; the title `22-23` contains two
public-response assertions in one block. The result above intentionally uses
the runner's real count.

## Telemetry and redaction evidence

P6 verifies deterministic correlation and request IDs, purpose-separated HMAC
subjects, bounded metrics, latency aggregates, exact concurrent aggregation,
and retention. Canary assertions reject or omit capability tokens,
idempotency keys, plaintext email/phone/name, conversations, dossiers, prompts,
model output, arbitrary exception messages, access tokens, signed URLs, and
free-form payload fields. P7 separately verifies that containment telemetry
does not contain blocked commercial codes or policy payloads.

## Kill switches and downstream cost

P7 individually certifies public intake, advisor resolution, token issuance,
session resolution, completion, conversation AI, external report generation,
document download, and notification fan-out. It also certifies missing,
corrupt, expired, environment-separated, activated, revoked, and rolled-back
policies; blocked App IDs and code HMACs; exact emergency quotas; concurrent
quota consumption; and zero downstream calls after DENY.

P5 certifies AI lease concurrency and attempts, report/PDF size and timeout
bounds, download quota, and notification payload/fan-out/retry limits. P4
certifies the durable exactly-once IDs used by completion and downstream
consumers.

## Reproducible commands

```text
npm.cmd run test:public-intake-abuse-certification
npm.cmd run build --prefix functions
node.exe functions/lib/discovery/tests/runDiscoveryAccessIntegrityTests.js
npm.cmd run build
git diff --check
```

The access-integrity CJS command is run only after the Functions build and its
generated `functions/lib` artifacts are removed before final diff validation.

## Limitations and residual risks

1. App Check provider cryptography, registration, attestation replay behavior,
   debug-token policy, and effective deployed enforcement are not reproducible
   by this local seam.
2. The suites certify provider-neutral Gemini, PDF, Storage, Cloud Tasks, and
   notification boundaries without invoking real providers. Provider IAM,
   timeout, quota, retry, and regional settings remain configuration evidence.
3. Firestore TTL deletion is eventual and is not activated by this slice; P3
   semantic expiration and cleanup are the local safety controls.
4. Demo Emulator behavior cannot establish production IAM, indexes, composite
   query performance, max instances, egress, alerting, or on-call procedures.
5. Valid low-rate automation remains a residual risk inside configured quotas.

## P9 requirements

P9 must verify, without using this harness against public traffic:

- effective App Check providers/enforcement and absence of production debug
  tokens;
- active P2/P7 policy versions, dimensions, quotas, environments, switch
  values, rollback target, expiry, ownership, and audit access;
- Firestore TTL policy for
  `discovery_intake_idempotency.expiresAt` and telemetry retention;
- service-account IAM and least privilege for Firestore, Gemini, Storage,
  Cloud Tasks, and notification delivery;
- Functions concurrency/max instances, timeouts, regions, secrets, indexes,
  Storage signed-URL TTL, provider quotas, dashboards, alerts, and runbooks;
- a credential/PII-safe configuration evidence bundle tied to the candidate
  commit.

## Closure criterion

P8 closes only when CT-01 through CT-22, all inherited regression domains,
builds, access integrity, report scope, isolation guards, port release checks,
secret/path scans, and `git diff --check` pass. Any future change to a public
surface, capability, quota, provider, retention rule, kill switch, or trust
boundary requires renewing the relevant evidence and this aggregate run.

