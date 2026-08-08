# PREVIEW CRM Synthetic Prospect Create Change Record V1

## Authorized remote change

Exactly one synthetic CRM prospect was created in `aura-intel-preview` through the deployed `createCrmLead` callable.

The one backend transaction created:

1. one `platform_leads` record;
2. one `crm_lead_create_idempotency` record;
3. one `platform_audit_logs` record.

The operation returned `CREATED`. Aggregate read-back changed the prospect count from 2 to 3. The synthetic marker matched exactly one record, producing zero duplicates.

## Preserved authority and runtime

- Role remained `VIEWER`.
- `crm.leads.create` remained present.
- Unexpected capabilities remained zero.
- Function remained `ACTIVE`.
- Cloud Run remained `READY`.
- Firestore client write denies remained unchanged.

## Local evidence changes

Created exactly the four R9 evidence documents in this directory. No application source, backend source, frontend source, Firestore Rules, deployment configuration, or dependency was changed.

## Operations not executed

- No second prospect.
- No retry or remote replay.
- No second login or reload.
- No direct client Firestore create.
- No role or capability change.
- No deployment.
- No Production or Staging operation.
- No commit, push, or pull request.
