# Preview Containment Policy Readiness Evidence Index V1

Change ID: `AI-02H2.2E-R1-PREVIEW-CONTAINMENT-POLICY-READINESS-20260806-01`

All evidence is passive and sanitized. No secret values, tokens, full cloud resource IDs, emails, API keys, signed URLs, document payloads or local absolute paths are recorded.

| Evidence | Source | Observation | Result |
|---|---|---|---|
| EV-01 | Git gate | Required branch, HEAD equal to `origin/main`, clean initial worktree | PASS |
| EV-02 | Runtime gate | Node `v20.20.2`, Preview alias and Preview GCP target | PASS |
| EV-03 | Functions/Run read-back | Five Functions ACTIVE and five services READY | PASS |
| EV-04 | Firestore aggregation | Active pointers 0, policies 0, audit records 0 | VERIFIED BLOCKER STATE |
| EV-05 | `discoveryContainmentTypes.ts` | Policy, decision, audit, nine surfaces and six quotas defined | IMPLEMENTED |
| EV-06 | `discoveryContainmentValidation.ts` | Bounds and known fields normalized; unexpected top-level fields not rejected | GAP |
| EV-07 | `DefaultDiscoveryContainmentEvaluator.ts` | Missing/malformed/expired/disabled/blocked/quota decisions fail closed | IMPLEMENTED |
| EV-08 | `runtimeEnvironmentV1.ts` | PREVIEW requires exact environment + project match | IMPLEMENTED |
| EV-09 | `createDiscoveryLead.ts` | PUBLIC_INTAKE and TOKEN_ISSUANCE enforced before idempotency; advisor switch conditional | IMPLEMENTED |
| EV-10 | `FirestoreDiscoveryContainmentPolicyProvider` | Pointer document keyed by environment; derived immutable policy lookup | IMPLEMENTED |
| EV-11 | `activatePolicy` | Policy + pointer + audit written in one transaction | IMPLEMENTED, NOT OPERATIONALIZED |
| EV-12 | Repository usage search | Mutation methods are invoked only by Emulator tests | BLOCKER |
| EV-13 | Scripts/package audit | No activation CLI, provisioning service, migration, bootstrap, dry-run or guard | BLOCKER |
| EV-14 | Active pointer source | No public schema, no expected-version CAS, partial field validation | GAP |
| EV-15 | Activation authorization source | Actor/approver are caller strings; no IAM binding and no distinct-role rule | BLOCKER |
| EV-16 | Policy persistence source | Timestamps supplied by caller; no content fingerprint | GAP |
| EV-17 | Version/audit source | Immutable version and deterministic audit IDs support basic replay | IMPLEMENTED |
| EV-18 | Replay source | Preexisting audit causes replay without audit content verification | GAP |
| EV-19 | Rollback source | Same-environment chain, cycle/depth/expiry validation, atomic pointer + audit | IMPLEMENTED |
| EV-20 | Policy minimum analysis | Five Happy Path surfaces expressible; report/download/notification can remain off | PARTIAL |
| EV-21 | Policy model analysis | No tenant constraint; cross-tenant safety remains external to containment | GAP |
| EV-22 | Containment test inventory | 36 Emulator cases defined | VERIFIED |
| EV-23 | Containment command execution | Emulator started isolated; Vitest unavailable, zero cases executed | NOT REPRODUCED |
| EV-24 | Required 15-case mapping | 7 covered, 3 partial, 5 missing | REQUIRES CERTIFICATION |
| EV-25 | Rules source | All three containment collections deny client read/write | PASS |
| EV-26 | Rules test inventory | 14 baseline cases, none dedicated to containment collection names | GAP |
| EV-27 | Preview Rules guard | 15/15 PASS | PASS |
| EV-28 | Export inspection | No public administrative callable or HTTP endpoint | PASS |
| EV-29 | P7 runbook | Explicitly identifies trusted control plane and rollout as future work | CONFIRMS CLASSIFICATION |
| EV-30 | Documentation comparison | Earlier design doc says storage/runtime unimplemented; later P7 doc says adapter implemented for review | DOCUMENTATION DRIFT |
| EV-31 | Final Git read-back | Only four evidence files added; no runtime or configuration files changed | PASS |

## Trace references

- Runtime entry: `functions/src/discovery/createDiscoveryLead.ts`.
- Environment binding: `functions/src/discovery/runtimeContracts/runtimeEnvironmentV1.ts`.
- Runtime enforcement: `functions/src/discovery/containment/enforceDiscoveryContainment.ts`.
- Evaluator: `functions/src/discovery/containment/DefaultDiscoveryContainmentEvaluator.ts`.
- Policy and audit model: `functions/src/discovery/containment/discoveryContainmentTypes.ts`.
- Validation: `functions/src/discovery/containment/discoveryContainmentValidation.ts`.
- Firestore adapter: `functions/src/infrastructure/firestore/discoveryContainment/FirestoreDiscoveryContainmentRepository.ts`.
- Collections: `functions/src/infrastructure/firestore/discoveryContainment/firestoreDiscoveryContainmentCollections.ts`.
- Tests: `functions/tests/emulator/containment/firestoreContainmentEmulator.test.ts`.
- Client access boundary: `firestore.rules`.

## Interpretation

The repository has enough implementation to justify a certification/remediation slice, but not enough operational controls to authorize direct activation. Calling `activatePolicy` manually from an ad hoc Admin SDK script would bypass the missing authority, approval, CAS, manifest, dry-run and evidence controls and is therefore not an official path.
