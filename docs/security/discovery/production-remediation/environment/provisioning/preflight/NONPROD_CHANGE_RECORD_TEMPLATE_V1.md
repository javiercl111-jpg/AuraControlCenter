# Non-Production Change Record Template v1

**Slice:** target AI-02H1E.5.R1C-B — Controlled Non-Production Provisioning Execution

**Template state:** `DRAFT_BLOCKED_NOT_ISSUED`

## 1. Change identity

| Field | Required value |
|---|---|
| Change ID | `AI-02H1E.5.R1C-B-NONPROD-PROVISIONING-<YYYYMMDD>-01` |
| Date | `<YYYY-MM-DD>` |
| Window start/end UTC | `<APPROVED_START_UTC>` / `<APPROVED_END_UTC>` |
| Environments | `PREVIEW`, `STAGING` only |
| Production | Explicitly excluded; `REMEDIATION_HOLD` |
| Source commit | `<CERTIFIED_ORIGIN_MAIN_SHA>` |
| R1B manifest hash | `<SHA256>` |
| Preflight evidence hash | `<SHA256>` |
| Status | `<DRAFT|APPROVED|IN_PROGRESS|ABORTED|COMPLETED|ROLLED_BACK>` |

El Change ID se emite únicamente cuando APR-01 a APR-12 están cerradas. El valor anterior es un patrón propuesto, no un change autorizado.

## 2. Approved decisions

| Field | Restricted reference / sanitized status |
|---|---|
| Preview project ID | `<APPROVED_PREVIEW_PROJECT_ID>` |
| Staging project ID | `<APPROVED_STAGING_PROJECT_ID>` |
| Parent | `<APPROVED_ORGANIZATION_OR_FOLDER_REFERENCE>` |
| Billing Account | `<APPROVED_MASKED_BILLING_REFERENCE>`; full ID only in restricted system |
| Regions | `<APPROVED_COMPUTE_TASKS_REGION>`, `<APPROVED_FIRESTORE_LOCATION>`, `<APPROVED_STORAGE_LOCATION>` |
| Cost envelope | `<APPROVED_BUDGET_AND_THRESHOLD_RECORD>` |
| WIF/key policy | `<APPROVED_WIF_ZERO_KEY_RECORD>` |
| Vercel | `<APPROVED_NONPROD_PROJECT_RECORD>` |

## 3. Roles

| Responsibility | Required role |
|---|---|
| Implementer | Platform/SRE Operator or specialized Cloud/IAM/Firebase executor recorded outside Git |
| Primary approver | Deployment Approver |
| Security concurrence | Security Owner |
| Billing concurrence | FinOps Owner + Product Owner |
| Data/location concurrence | Privacy/Compliance Approver |
| Abort owner | Incident Commander |
| Evidence reviewer | Readiness Auditor |

Implementer no puede ser el único approver. No se registran nombres personales en este template.

## 4. Authorized resources

R1C-B debe enumerar un allowlist exacto. Máximo propuesto:

- two empty Google Cloud/Firebase projects;
- approved billing linkage and labels;
- approved APIs from R1B manifest;
- dedicated non-production service accounts and WIF;
- seven empty secret resources per environment, without values unless a separately approved population step is included;
- Firestore/Auth/Storage metadata resources only as explicitly approved;
- one paused Cloud Tasks queue per environment;
- non-production monitoring, dashboards, alerts and budgets;
- separate Preview/Staging Vercel projects only if included in the approved wave.

Production project, Production billing/config changes, data migration, TTL, Rules deployment, Functions deployment, provider traffic and secret values are denied unless a later change explicitly authorizes them.

## 5. Allowed command IDs

Select exact IDs from `ENVIRONMENT_PROVISIONING_COMMAND_CATALOG_V1.md`:

```text
RO-PROJECT-01
RO-BILLING-01
RO-API-01
RO-FIREBASE-01
RO-SA-01
RO-KEY-01
RO-IAM-01
RO-WIF-01
RO-WIF-02
RO-FIRESTORE-01
RO-BUCKET-01
RO-BUCKET-IAM-01
RO-QUEUE-01
RO-SECRET-01
RO-SECRET-IAM-01
PRV-PROJECT-01
PRV-BILLING-01
PRV-LABELS-01
PRV-API-01
PRV-FIREBASE-01
PRV-WEBAPP-01
PRV-SA
PRV-WIF
PRV-SECRET
PRV-FS
PRV-AUTH-APPROVED-PROCEDURE
PRV-STORAGE
PRV-TASKS
PRV-OBS
PRV-BUDGET
PRV-VERCEL-NONPROD
```

Cada command body se copia sin cambios desde el catálogo aprobado y sustituye sólo placeholders aprobados. Cualquier comando ausente del allowlist detiene el change.

## 6. Execution waves

| Wave | Resources | Entry | Exit evidence | Rollback |
|---|---|---|---|---|
| 0 | Revalidation | Approvals/evidence current | Project names/parent/billing/policies exact | No writes |
| 1 | Projects/billing/labels | Exact IDs and parent approved | Two empty labeled projects | Mark abandoned; unlink billing if approved |
| 2 | APIs/Firebase | API manifest approved | Exact enabled set/Firebase metadata | Stop/abandon partial project; no inferred reversal |
| 3 | Identities/WIF | Effective org policies compatible | SAs, zero keys, scoped federation | Disable WIF/revoke bindings |
| 4 | Empty secrets/data resources | Data/location/consumer approval | Metadata-only read-back | Quarantine empty resources |
| 5 | Paused queues/observability/budgets | Caller/routing/billing approved | Queue paused; alerts/budgets metadata | Pause/revoke; manual watch |
| 6 | Vercel non-prod | Separate project approval | No Production variables/domains | Unlink/remove non-prod project |
| 7 | Isolation/evidence | All read-backs pass | Sanitized packet and zero shared IDs | Freeze; rollback failed wave |

Waves no se paralelizan salvo autorización explícita; cada exit gate se firma antes de continuar.

## 7. Stop conditions

- project ID no disponible o target distinto;
- parent/billing no coincide con el approved reference;
- Organization Policies siguen unknown o contradicen el plan;
- inherited Owner/Editor, cross-environment principal o key user-managed;
- API extra, region distinta o bucket público;
- queue no queda pausada o existe producer antes del pause read-back;
- secret value, token, PII, contact o banking detail aparece en output;
- Preview/Staging referencia Production;
- Vercel project contiene Production variable/domain;
- budget/routing/rollback owner ausente;
- Production aparece en un write command;
- cualquier command no incluido en allowlist.

## 8. Rollback

1. Detener wave y nuevos writes.
2. Pausar queue y revocar producer/invoker.
3. Deshabilitar WIF provider y revocar bindings nuevos.
4. Deshabilitar secret version accidental sin revelar el valor.
5. Quarantine/abandon empty resources; no borrar automáticamente.
6. Unlink billing sólo para project vacío y con FinOps approval.
7. Preservar logs/evidence; emitir `ABORTED` o `ROLLED_BACK`.
8. Nunca relajar Rules, asignar Owner/Editor, crear keys ni tocar Production.

## 9. Evidence destination

| Evidence | Destination |
|---|---|
| Raw restricted metadata | `<APPROVED_RESTRICTED_EVIDENCE_DESTINATION>` |
| Sanitized evidence index | `<APPROVED_REPOSITORY_EVIDENCE_PATH>` |
| Approval/audit record | `<APPROVED_CHANGE_MANAGEMENT_SYSTEM>` |
| Rollback receipts | `<APPROVED_RESTRICTED_EVIDENCE_DESTINATION>` |

No se usan rutas locales absolutas. Evidence capture sigue `ENVIRONMENT_PROVISIONING_EVIDENCE_PLAN_V1.md`.

## 10. Sign-off

El record requiere hashes/references de Product, Security, Platform/SRE, Cloud/IAM, Firebase, FinOps, Privacy, Release, Deployment, Incident y Readiness roles según la wave. Un campo placeholder o un approval vencido mantiene `DRAFT_BLOCKED_NOT_ISSUED`.
