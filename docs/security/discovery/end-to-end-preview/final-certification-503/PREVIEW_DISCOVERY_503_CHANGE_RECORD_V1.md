# Preview Discovery 503 Change Record V1

Date: `2026-08-08`

## Change

Added four local diagnostic evidence documents for the authenticated Preview `createDiscoveryLead` 503. No application, function, policy, Rules, infrastructure or runtime configuration was changed.

## Authoritative conclusion

- Classification: `A. CONTAINMENT_POLICY_EXPIRED`.
- Original response: HTTP 503 / `DISCOVERY_TEMPORARILY_UNAVAILABLE`.
- First break: semantic expiration of the active Preview containment policy.
- Emergency quota was exhausted but was not evaluated or consumed by this request and would map to HTTP 429.
- Functional persistence deltas: zero.
- Remediation: proposed only; not executed.

## Controls preserved

- No retry or new Discovery request.
- No browser action.
- No containment activation, TTL extension or Firestore write.
- No deploy, Production or Staging operation.
- No commit, push or pull request.
- Evidence contains no PII, identifiers, tokens, secrets or local absolute paths.

## Graph-aware source inspection

The repository has no committed `graphify-out/graph.json`. Because this slice authorizes exactly four evidence documents, no graph artifact was generated. The diagnosis used direct, read-only source inspection of the callable, containment evaluator, telemetry, rate limiter, Firestore adapters and certified activation control plane.
