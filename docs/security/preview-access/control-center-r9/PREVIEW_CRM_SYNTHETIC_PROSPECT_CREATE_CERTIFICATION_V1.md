# PREVIEW CRM Synthetic Prospect Create Certification V1

## Dictamen

**PREVIEW CRM SYNTHETIC PROSPECT CREATE CERTIFIED — CRM CREATE ACCESS RESTORED**

## Scope

- Target: `aura-intel-preview` only.
- Callable: `createCrmLead`.
- Fixture: unequivocally synthetic.
- Authorized submits: `1`.
- Executed submits: `1`.
- Automatic retries: `0`.
- Remote replays: `0`.
- Production and Staging: `NOT TARGETED`.

## Certified baseline

| Check | Result |
|---|---:|
| Prospect count before | 2 |
| Matching synthetic fixture before | 0 |
| Role | `VIEWER` |
| Required capability | `crm.leads.create` PRESENT |
| Unexpected capabilities | 0 |
| Function | `ACTIVE` |
| Cloud Run | `READY` |
| Failed revisions | 0 |

The existing authenticated Preview session rendered CRM Comercial. One synthetic form was prepared with reserved test data. Immediately before authorization, the form was valid, the create button was enabled, submits were zero, and callable requests were zero.

## Single controlled create

The human-authorized create button was pressed exactly once. The UI returned its success state, cleared the form, and displayed no safe error.

Cloud Logging correlated the operation with exactly:

- one POST request to the callable service;
- one backend `crm.leads.create` event with outcome `CREATED`;
- zero error entries in the execution window.

Because the deployed callable rejects missing authentication, missing App Check, inactive authority, or absent capability before persistence, the successful contractual `CREATED` outcome certifies:

| Boundary | Outcome |
|---|---|
| Firebase authentication | `VALID` |
| App Check | `VALID` |
| Authorization | `ALLOW` |
| Capability | `crm.leads.create` |
| Callable | `SUCCESS` |
| Backend | `CREATED` |
| Safe error | `NONE` |

## Persistence and audit read-back

| Check | Result |
|---|---:|
| Prospect count after | 3 |
| Prospect delta | +1 |
| Matching synthetic fixture after | 1 |
| Duplicates | 0 |
| Server-owned ID | PRESENT |
| Server timestamps | VALID |
| Lead contract | VALID |
| Idempotency records matching lead | 1 |
| Idempotency state | `ESTABLISHED` |
| Audit record | PRESENT |
| Audit operation | `crm.leads.create` |
| Audit outcome | `CREATED` |
| Correlation locator | PRESENT |
| Sanitized actor locator | PRESENT |
| Sanitized lead locator | PRESENT |

No locator value, record identifier, or synthetic payload is retained in this evidence.

## Client security and side effects

- Client creation uses `httpsCallable(functions, "createCrmLead")`.
- Client creation contains no direct `addDoc` path.
- Firestore client create, update, and delete remain `DENY`.
- The server transaction contains exactly three creates: lead, idempotency metadata, and audit.
- No Tasks, notifications, or Storage mutation path exists in the certified persistence adapter.
- No second lead, role change, additional capability, deployment, Production operation, or Staging operation occurred.

## Final state

| Field | Result |
|---|---:|
| Single submit | 1 |
| `createCrmLead` requests | 1 |
| Backend `CREATED` | 1 |
| Prospect delta | +1 |
| Duplicates | 0 |
| Role | `VIEWER` |
| `crm.leads.create` | PRESENT |
| Unexpected capabilities | 0 |
| Function | `ACTIVE` |
| Cloud Run | `READY` |

## Detention

No second prospect, retry, replay, reload, role/capability change, deploy, commit, push, or pull request was performed.
