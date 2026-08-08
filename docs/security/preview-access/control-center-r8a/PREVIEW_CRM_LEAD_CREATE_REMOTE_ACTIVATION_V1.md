# PREVIEW CRM Lead Create Remote Activation V1

## Dictamen

**PREVIEW CRM LEAD CREATE REMOTE ACTIVATION CERTIFIED — READY FOR ONE CONTROLLED SYNTHETIC PROSPECT CREATE**

## Scope

- Firebase/GCP target: `aura-intel-preview`.
- Production: `NOT TARGETED`.
- Staging: `NOT TARGETED`.
- Frontend redeploy: `NOT PERFORMED`.
- Firestore Rules deploy: `NOT PERFORMED`.
- Functional callable invocation: `NOT PERFORMED`.

## Capability activation

The certified R8 provisioner was executed once after a fresh dry-run.

| Check | Result |
|---|---|
| Dry-run action | `WOULD_CREATE` |
| Dry-run writes | `0` |
| Apply invocations | `1` |
| Apply action | `CREATED` |
| Role before / after | `VIEWER / VIEWER` |
| Required capability | `crm.leads.create` |
| Unexpected capabilities | `0` |
| Contract validity | `PASS` |

The apply produced the two certified atomic writes: the exact capability grant and its sanitized audit record. No replay was executed.

## Runtime identity and IAM

A dedicated Preview runtime identity named `preview-crm-lead-runtime` was created because the authoritative discovery found it missing. No downloadable key was generated.

Read-back confirmed:

- runtime identity exists;
- user-managed keys: `0`;
- Datastore User: `PRESENT`;
- Logs Writer: `PRESENT`;
- unexpected privileged roles: `0`.

Each IAM binding was applied separately and read back before the next change.

## Predeploy gate

| Gate | Result |
|---|---:|
| R7 backend | 30/30 PASS |
| R7 frontend | 5/5 PASS |
| Capability provisioner | 22/22 PASS |
| Selective deployment guard | 5/5 PASS |
| CRM Rules guard | 4/4 PASS |
| Preview deployment unit | 22/22 PASS |
| Preview runtime contracts | 18/18 PASS |
| Preview Rules target guard | 15/15 PASS |
| Total tests | 121 PASS / 0 FAIL |
| TypeScript noEmit | PASS |
| Functions build | PASS |
| Selective deployment guard | PASS |
| `git diff --check` | PASS |

## Selective deployment and health

Exactly one deploy command targeted `functions:preview-discovery:createCrmLead`. No second deploy was executed. The Firebase pipeline performed its standard required-API and service-identity readiness checks, but selected no other Function, Rules, Hosting, Production, or Staging target.

Postdeploy read-back confirmed:

- Function `createCrmLead`: `ACTIVE`;
- region: `us-central1`;
- runtime identity: dedicated identity expected by source;
- Cloud Run service: `READY`;
- latest created revision: ready;
- failed revisions: `0`;
- App Check enforcement: required by the deployed callable options contract.

The callable was not functionally invoked.

## Frontend and client boundary

The existing Preview frontend returned HTTP 200 and its served bundle contained the `createCrmLead` callable path. Source and tests confirm that `createLead` uses the callable and does not perform `addDoc(platform_leads)`.

`FRONTEND_DEPLOY_REQUIRED = NO`.

Client create, update, and delete access to `platform_leads` remains denied by the certified Rules guard.

## Final chain

`Firebase Auth user → active VIEWER principal → exact crm.leads.create grant → App Check protected callable → dedicated least-privilege runtime → server-side Firestore transaction`

Final authority read-back preserved `VIEWER`, found exactly `crm.leads.create`, found zero unexpected capabilities, and detected no role escalation.

Prospects created during R8A: `0`.

## Non-blocking lifecycle notices

The deploy reported that Node.js 20 is deprecated and scheduled for decommissioning, and that the installed `firebase-functions` version is outdated. These notices did not affect this activation or its health read-back, but require a separate authorized upgrade before the runtime deadline.

## Detention

No synthetic prospect create, second capability apply, second deploy, role change, frontend redeploy, Rules deploy, Production/Staging operation, commit, push, or pull request was performed.
