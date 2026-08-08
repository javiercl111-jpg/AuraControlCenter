# PREVIEW CRM Lead Create Remote Activation Change Record V1

## Authorized remote changes

1. Executed one certified capability apply in Preview.
   - Created the exact `crm.leads.create` grant.
   - Created one sanitized audit record in the same certified transaction.
   - Preserved role `VIEWER`.
   - Added no other capability.
2. Created one dedicated Preview runtime identity named `preview-crm-lead-runtime`.
   - Generated no user-managed key.
3. Granted exactly two project roles to that runtime identity.
   - Datastore User.
   - Logs Writer.
4. Executed one selective Firebase deployment.
   - Target: `functions:preview-discovery:createCrmLead`.
   - Result: Function created and active.

Every remote change was followed by an authoritative read-back before the next change. The initial service-account read-back required one read-only retry while the newly created identity propagated; no mutation was repeated.

## Local evidence changes

Created exactly the four R8A evidence documents in this directory. No application source, backend source, frontend source, Firestore Rules, deployment configuration, or package dependency was changed as part of R8A.

## Read-only certification

- Function: `ACTIVE`.
- Cloud Run: `READY`; failed revisions `0`.
- Runtime identity: dedicated, expected, and least privilege.
- Authority: `VIEWER` plus exactly `crm.leads.create`.
- Frontend: ready; served callable path present; no redeploy required.
- Client Firestore create boundary: deny preserved.

## Operations not executed

- No functional callable invocation.
- No prospect creation.
- No second capability apply.
- No second deploy.
- No role escalation or Firebase Auth mutation.
- No manual Firestore write.
- No frontend or Rules deployment.
- No Production or Staging operation.
- No commit, push, or pull request.

## Follow-up outside R8A

Node.js 20 runtime lifecycle and the outdated `firebase-functions` dependency require a separately authorized upgrade. No upgrade was attempted in this activation.
