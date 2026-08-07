# Preview Discovery Submit Dispatch Diagnosis V1

## Control record

- Change ID: `AI-02H2.2E-R3A-PREVIEW-DISCOVERY-SUBMIT-DISPATCH-20260807-01`
- Date: 2026-08-07
- Environment: Preview only
- Diagnostic mode: passive
- Root-cause classification: `H. ROOT_CAUSE_NOT_DETERMINED`
- Verdict: `BLOCKED`

No submit action, Discovery callable, lead creation, code modification, configuration modification, deployment, commit, push, or pull request was performed in this slice.

## Gate

The required worktree and branch were used. HEAD and `origin/main` matched at short revision `0403ee8`; the worktree was clean and Node was `v20.20.2`. The active GCP project was `aura-intel-preview`.

## Source trace

The audited path is:

```text
CLICK
→ HTML FORM
→ REACT EVENT
→ VALIDATION
→ HANDLER
→ APP CHECK
→ SERVICE
→ createDiscoveryLead
```

| Stage | Source evidence |
|---|---|
| Route | `src/App.tsx:35` maps `/discover` to `DiscoverPage`. |
| Form | `src/pages/DiscoverPage.tsx:823` attaches `onSubmit={handlePreformSubmit}`. |
| Button | `src/pages/DiscoverPage.tsx:881-886` places an enabled-capable `type="submit"` button inside the form. No `onClick` is required. |
| Native validation | `src/pages/DiscoverPage.tsx:827-875` defines required company, contact, email, and consent controls. |
| React guard | `src/pages/DiscoverPage.tsx:310-315` calls `preventDefault` and returns when company, contact, email, or consent state is missing. |
| Idempotency precondition | `src/pages/DiscoverPage.tsx:326-345` builds a signature and calls `createDiscoveryIdempotencyKey`. |
| Service call | `src/pages/DiscoverPage.tsx:348-366` calls `createDiscoveryLink`. |
| Client preconditions | `src/modules/discovery/services/discoveryLinkService.ts:51-59` requires secure UUID generation and validates the key. |
| Callable construction | `src/modules/discovery/services/discoveryLinkService.ts:82-117` builds the payload and invokes the `createDiscoveryLead` callable. |
| Functions instance | `src/config/firebase.ts:61-64` binds Functions to the configured Preview region. |
| App Check | `src/config/firebase.ts:66-103` initializes Enterprise reCAPTCHA App Check before exporting the client integration. |

Static wiring is correct: the button is in the form, its type is `submit`, the form references the handler, the handler references the service, and the service references `createDiscoveryLead`. No `stopPropagation`, debounce, throttle, or alternate `onClick` path exists in this chain.

## Native HTML validation audit

| Control | Native constraints | Passive valid-form result |
|---|---|---|
| Company | required, maximum 160 | valid |
| Contact | required, maximum 160 | valid |
| Email | required, `type=email`, maximum 254 | valid with reserved synthetic value |
| Phone | optional, maximum 32 | valid empty |
| Role | optional, maximum 100 | valid |
| Location | optional, maximum 100 | valid |
| Advisor code | optional, maximum 32 | valid empty |
| Acquisition source | optional select with valid default | valid |
| Consent | required checkbox | valid when checked |

There are no patterns, minimum lengths, hidden required controls, or invalid placeholder options. After synthetic values were entered without submission, every required control was valid, the form matched `:valid`, and the submit button remained enabled. Values persisted across subsequent controlled-input updates, which supports correct React input-event synchronization in the current deployment.

Therefore `A. NATIVE_FORM_VALIDATION_BLOCK` is not supported for the valid R3 form and is ruled out as a persistent defect.

## React and client paths that can yield zero requests

The following paths are distinct but externally equivalent without stage-level instrumentation:

1. No native `submit` event reaches React. The deployed wiring is correct, but R3 did not record an event-level receipt counter.
2. The React guard at `DiscoverPage.tsx:312-315` returns before the `try` block. This path produces an alert but no console error and no callable request. R3 did not capture the four React state values at handler entry.
3. `createDiscoveryIdempotencyKey` throws before service invocation. The enclosing catch maps it to a generic alert and logs an error.
4. `createDiscoveryLink` rejects its idempotency precondition before callable invocation.
5. Firebase obtains App Check evidence before the callable fetch. A transient client-side App Check failure can reject before the Functions boundary; the page catch reduces it to a generic alert.

The current passive browser session showed a clean console, Enterprise reCAPTCHA initialization, and a project-scoped App Check token-exchange request. This rules out a persistent missing Preview configuration but cannot prove the App Check state at the historical R3 click.

## Error handling

`DiscoverPage.tsx:369-377` catches exceptions after the React guard, writes the raw error to the browser console, shows only a generic alert for most failures, and returns the button to enabled state. The early React guard uses only an alert and emits no diagnostic event. R3 retained no alert text, handler-entry marker, stage marker, or captured exception.

This creates a diagnostic ambiguity: a missed submit event, an early React return, or a pre-fetch client rejection can all produce the certified external observation of one attempted UI action and zero `createDiscoveryLead` requests.

## Deployed bundle correlation

The Preview domain resolved to project `aura-control-center-preview` in READY state. Deployment metadata identified the `main` deployment at short commit `0403ee8`, matching local HEAD and `origin/main`.

The active document loaded hashed bundle `index-DylVN4Vu.js`. An in-memory HTTP read returned 200 and confirmed that this bundle contains the submit label, `createDiscoveryLead`, secure-random and idempotency guards, the generic error text, and the relative `/discover/` navigation contract. The same bundle name was observed during R3. The repository service-worker strategy is NetworkFirst for documents and scripts (`vite.config.ts:66-77`).

These facts rule out `F. DEPLOYED_BUNDLE_MISMATCH` for the observed route. No Production host or direct `a.run.app` asset was used.

## Test coverage

The existing Preview client guard suite passed 23 of 23 tests. It validates configuration, source inventory, callable allowlisting, environment isolation, relative navigation, and App Check debug exclusion.

No explicit test was found for any of these behavioral contracts:

- valid form → one submit → exactly one `createDiscoveryLink` invocation;
- invalid form → zero service invocations;
- React guard rejection → visible deterministic error;
- App Check precondition failure → visible deterministic error → zero Functions requests.

The current tests are source/configuration guards, not form-event integration tests.

## Mandatory classification

| Classification | Result | Basis |
|---|---|---|
| A. Native form validation block | RULED OUT | Valid synthetic form matches `:valid`; all required controls valid. |
| B. React validation block | POSSIBLE, NOT PROVEN | Exact handler-entry state was not captured in R3. |
| C. Submit handler not wired | RULED OUT AS DEPLOYED DEFECT | Route, form, button, handler, and bundle wiring all correlate. Historical event delivery was not instrumented. |
| D. Client precondition block | POSSIBLE, NOT PROVEN | UUID, idempotency, or transient App Check rejection can occur before the callable request. |
| E. Silent client exception | POSSIBLE, NOT PROVEN | Most failures collapse to a generic alert; R3 retained neither dialog nor exception. |
| F. Deployed bundle mismatch | RULED OUT | Deployment commit, current source, and active hashed bundle correlate. |
| G. Other exactly identified client block | NOT IDENTIFIED | No unique additional condition is supported. |
| H. Root cause not determined | SELECTED | The remaining paths are observationally indistinguishable without a prohibited second submit or missing R3 telemetry. |

### Root-cause statement

No exact file condition can be safely named as the unique cause of R3. The unresolved boundary is between the browser action and `createDiscoveryLink` at `src/pages/DiscoverPage.tsx:310-348`, plus the pre-fetch callable boundary at `src/modules/discovery/services/discoveryLinkService.ts:51-117`. R3 proves zero Functions requests, but it does not prove which client stage stopped execution.

## Minimum remediation proposal — not implemented

No corrective behavior change is safe while classification remains H. The minimum next authorized slice should add diagnostics and tests first:

1. `src/pages/DiscoverPage.tsx`
   - replace ephemeral alert-only handling with a visible, sanitized `role="alert"` state;
   - record non-sensitive local stage codes for `SUBMIT_RECEIVED`, `REACT_GUARD_REJECTED`, `IDEMPOTENCY_READY`, `CALLABLE_DISPATCH_STARTED`, and `CALLABLE_REJECTED`;
   - do not log field values, tokens, keys, or identifiers;
   - do not change required constraints or App Check behavior.
2. `src/pages/DiscoverPage.test.tsx` plus only the minimum DOM-test harness dependency and lockfile update
   - valid form invokes the mocked service exactly once;
   - invalid required field and unchecked consent invoke it zero times;
   - secure-random failure is visible and invokes it zero times;
   - mocked App Check/pre-fetch rejection is visible and produces no Functions request.
3. Add a dedicated test script for this component contract.

Preview impact would be improved deterministic diagnostics with unchanged security controls. The shared page means a future deployment could also affect Production presentation, so the change requires a Production regression test even though Production execution remains out of scope. Risks are accidental exposure of sensitive values, duplicate telemetry, or changing submit timing; gates must enforce sanitized codes, single service invocation, unchanged native validation, unchanged App Check, and no cross-environment URLs.

## Verdict

BLOCKED —
SUBMIT DISPATCH ROOT CAUSE NOT SAFELY IDENTIFIED
