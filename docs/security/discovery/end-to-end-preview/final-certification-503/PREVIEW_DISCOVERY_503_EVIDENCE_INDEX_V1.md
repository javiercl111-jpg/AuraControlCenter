# Preview Discovery 503 Evidence Index V1

| ID | Evidence | Sanitized result |
|---|---|---|
| E-01 | Git gate | clean base; `HEAD = origin/main` |
| E-02 | Firebase/GCP target | `aura-intel-preview` only |
| E-03 | Cloud Logging HTTP entry | one correlated HTTP 503 |
| E-04 | Callable verification log | App Check `VALID`; Auth `VALID` |
| E-05 | Structured abuse telemetry | `containment.policy_expired`; `CONTAINMENT_POLICY_EXPIRED` |
| E-06 | Rejection telemetry | `intake.rejected`; normalized `UNAVAILABLE` |
| E-07 | Active pointer read-back | present; Preview contract valid |
| E-08 | Policy read-back | present; `ACTIVE`; expired before request |
| E-09 | Policy switches/block lists | public intake and token issuance enabled; lists empty |
| E-10 | Exact `global.intake` counter | count 1; no update from failed request |
| E-11 | Persistence count-only read-back | all lead/session/idempotency deltas zero |
| E-12 | Functions/Cloud Run status | Function `ACTIVE`; service `READY`; failed revisions 0 |
| E-13 | Preview web status | HTTP 200 |
| E-14 | Source response mapping | quota denial 429; other containment denials 503 |
| E-15 | Source evaluation ordering | expiration precedes block, switch and quota checks |
| E-16 | Certified control plane | immutable version, dry-run/apply, CAS, authority, audit and Preview guards |

## Source anchors

- `functions/src/discovery/createDiscoveryLead.ts`: App Check, containment ordering, idempotency and persistence boundary.
- `functions/src/discovery/containment/DefaultDiscoveryContainmentEvaluator.ts`: fail-closed decision ordering.
- `functions/src/discovery/containment/enforceDiscoveryContainment.ts`: telemetry and 429/503 mapping.
- `functions/src/discovery/containment/P2DiscoveryEmergencyQuotaConsumer.ts`: exact global intake key and rate policy.
- `functions/src/infrastructure/firestore/discoveryContainment/FirestoreDiscoveryContainmentRepository.ts`: pointer and immutable policy resolution.
- `functions/src/infrastructure/firestore/rateLimits/FirestoreRateLimitRepository.ts`: exact counter locator contract.
- `functions/src/discovery/containment/controlPlane/PreviewContainmentActivationControlPlaneV1.ts`: certified remediation boundary.
- `scripts/preview-containment-activation-guard.cjs`: Preview-only, collection and public-surface guards.

No raw request, UID, email, payload, IP, token, secret, document ID, full trace or local absolute path is included.
