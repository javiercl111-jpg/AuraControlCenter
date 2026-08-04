# Environment Provisioning Plan v1

**Programa:** AI-02H1E.5.0 — Production Readiness Remediation Program

**Slice:** AI-02H1E.5.R1B — Environment Resource Provisioning Design

**Estado:** diseño ejecutable futuro; cero recursos externos creados o modificados

**Dictamen:** **CONDITIONAL — PROVISIONING APPROVALS REQUIRED**

## 1. Alcance

Este plan convierte R1A en un runbook futuro, parametrizado, verificable y reversible para crear Preview/Staging y preparar el candidato Production. Ningún comando de escritura documentado aquí fue ejecutado. Los placeholders, decisiones abiertas y nombres no reservados bloquean provisioning.

Fuentes canónicas: los cinco artefactos R1A, la secuencia del programa y sus gates. No se repitieron R1A ni P9 y no se consultaron servicios externos.

## 2. Decisiones externas clasificadas

Las 16 decisiones permanecen `OPEN_EXTERNAL_APPROVAL`.

| ID | Clasificación | Decisión / recomendación | Owner / approver | Evidencia y fecha relativa | Dependencia, impacto y bloqueo |
|---|---|---|---|---|---|
| R1A-DEC-01 | `REQUIRED_BEFORE_PROVISIONING` | Modelo C: tres proyectos cloud separados | Platform/SRE / Product + Security | Architecture sign-off; antes de PR de provisioning | Bloquea toda creación; define blast radius/costo |
| R1A-DEC-02 | `REQUIRED_BEFORE_PROVISIONING` | Aprobar/reservar `aura-intel-preview` | Platform/SRE / Product | Availability + project record; antes de paso 2 | Bloquea Preview y targeting |
| R1A-DEC-03 | `REQUIRED_BEFORE_PROVISIONING` | Aprobar/reservar `aura-intel-staging` | Platform/SRE / Product | Availability + project record; antes de paso 2 | Bloquea Staging y todos sus slices |
| R1A-DEC-04 | `REQUIRED_BEFORE_PRODUCTION` | Conservar `aura-control-center-debb3` condicionado o reclasificar Legacy | Platform/SRE / Product + Security | Ownership, billing, IAM/data attestation; antes de Production manifest | Bloquea alias/migration Production |
| R1A-DEC-05 | `REQUIRED_BEFORE_PROVISIONING` | Billing/cost center/budgets separados | FinOps / Product | Billing approval; antes de project linkage | Sin billing aprobado se abandona proyecto vacío |
| R1A-DEC-06 | `REQUIRED_BEFORE_PROVISIONING` | US, compute/Tasks `us-central1`, Firestore `nam5`, Storage `US` | Platform/SRE / Privacy + Security | Residency assessment; antes de recursos location-locked | Bloquea bases y buckets |
| R1A-DEC-07 | `REQUIRED_BEFORE_STAGING_DEPLOYMENT` | Vercel Staging separado | Release Engineering / Deployment Approver | Project/protection plan; antes de Vercel non-prod | Bloquea frontend Staging |
| R1A-DEC-08 | `REQUIRED_BEFORE_PRODUCTION` | Nuevo bucket Production de reportes | Platform/SRE / Security + Privacy | Storage plan/retention; antes de R6B Production | Bloquea Storage productivo |
| R1A-DEC-09 | `REQUIRED_BEFORE_STAGING_DEPLOYMENT` | Queues exclusivas, paused, 1/s y concurrency 1 | Notification / Platform + FinOps | Queue contract; antes de queue creation | Bloquea notificaciones |
| R1A-DEC-10 | `REQUIRED_BEFORE_STAGING_DEPLOYMENT` | Retention/PITR/delete protection por ambiente | Platform/SRE / Privacy | Data policy; antes de Firestore/Storage data use | Bloquea TTL/lifecycle y certificación |
| R1A-DEC-11 | `REQUIRED_BEFORE_PROVISIONING` | Identity por frontera, WIF, cero keys | Cloud/IAM / Security | Permission-resource matrix; antes de SA creation | Bloquea identities/workloads |
| R1A-DEC-12 | `REQUIRED_BEFORE_PROVISIONING` | Asignar owners/approvers/on-call fuera de Git | Product / Security | Organizational assignment; antes de todo write | Bloquea aprobación humana |
| R1A-DEC-13 | `REQUIRED_BEFORE_PRODUCTION` | CI WIF + Deployment Approver + Security concurrence | Release Engineering / Deployment Approver | WIF/change-control design; antes de R4B | Bloquea deployment Production |
| R1A-DEC-14 | `REQUIRED_BEFORE_STAGING_DEPLOYMENT` | Rollback legacy provisional; artifact certificado después | Release Engineering / Deployment Approver + Incident Commander | Artifact/config inventory; antes de R4A | Bloquea promoción |
| R1A-DEC-15 | `REQUIRED_BEFORE_PRODUCTION` | Preserve/reconcile/recreate/migrate según R1A | Platform/SRE / Product + Security + Privacy | Migration sign-off; antes de writes Production | Bloquea cambios destructivos |
| R1A-DEC-16 | `REQUIRED_BEFORE_STAGING_DEPLOYMENT` | Fakes Local/Preview; accounts separadas Staging/Production | Backend Discovery / Product + FinOps + Security | Provider/residency/quota record; antes de provider test | Bloquea Gemini/notification connectivity |

No hay decisiones `INFORMATIONAL`: todas protegen un write o deployment posterior.

## 3. Project provisioning

### 3.1 Preview

| Campo | Diseño |
|---|---|
| Project ID / display | `aura-intel-preview` / `Aura Intelligence Preview`, `PROPOSED_NAME_NOT_RESERVED` |
| Organization/folder | `organizations/<ORG_ID>` / `folders/<NONPROD_FOLDER_ID>` |
| Billing | `<BILLING_ACCOUNT_ID>` y `<PREVIEW_COST_CENTER>` aprobados |
| Labels | app, environment=preview, program, managed-by, data-class=synthetic, cost-center, owner-role |
| Firebase | Enablement sobre proyecto explícito; alias `preview` por PR de repositorio |
| Firestore/Auth/Storage | `nam5`, test identities, bucket `aura-intel-preview-reports` |
| Functions/Tasks | `us-central1`; runtime SAs Preview; queue paused |
| Secrets/App Check | Siete secrets vacíos metadata-only; app/provider Preview |
| Logging/Monitoring/Budget | Recursos Preview y budget bajo |
| Owner / approver | Platform/SRE Owner / Product Owner; writes ejecutados por roles especializados |
| Rollback/abandon | Disable providers/API no compartida, unlink billing y marcar project `ABANDONED`; delete sólo tras cooling period y aprobación |

### 3.2 Staging

| Campo | Diseño |
|---|---|
| Project ID / display | `aura-intel-staging` / `Aura Intelligence Staging`, `PROPOSED_NAME_NOT_RESERVED` |
| Organization/folder | `organizations/<ORG_ID>` / `folders/<NONPROD_FOLDER_ID>` |
| Billing | `<BILLING_ACCOUNT_ID>` y `<STAGING_COST_CENTER>` aprobados |
| Labels | app, environment=staging, program, managed-by, data-class=synthetic, cost-center, owner-role |
| Firebase | Enablement sobre proyecto explícito; alias `staging` por PR de repositorio |
| Firestore/Auth/Storage | `nam5`, test identities, bucket `aura-intel-staging-reports` |
| Functions/Tasks | `us-central1`; production-equivalent artifact/identities; queue paused |
| Secrets/App Check | Siete secrets vacíos; provider production-like sin debug permanente |
| Logging/Monitoring/Budget | Dashboards/alerts/routing de certificación y budget aislado |
| Owner / approver | Platform/SRE Owner / Product Owner + Deployment Approver |
| Rollback/abandon | Freeze, preserve evidence, unlink billing; delete sólo tras confirmar que nunca fue promotion source |

No se crea un proyecto Local/Demo. Preview y Staging nunca se ubican en el folder Production ni heredan bindings productivos.

## 4. Production preparation

`aura-control-center-debb3` permanece en `REMEDIATION_HOLD`; R1B no lo modifica.

| Control | Preparación futura / evidencia |
|---|---|
| Ownership/billing/org/folder | Metadata-only verification y approval record; ningún identificador se copia al repo salvo placeholder/ID ya canónico |
| Labels | Aplicar sólo después de aprobación: app, environment=production, program, data-class=authorized-real, cost-center, owner-role |
| Hold marker | Manifest/release record `REMEDIATION_HOLD`; no se asume que una label por sí sola impida tráfico |
| Deployment guard | Project ID exacto, alias `production`, WIF environment, approved tag/digest y change record |
| Existing inventory | Firestore `nam5`, Functions stale, bucket `US-EAST1`, queue amplificadora, IAM/secret/App Check/observability gaps de P9 |
| Preserve | Firestore/Auth, logs/audit, domains y frontend stable deployment |
| Migrate | Certified Functions artifact, report objects a bucket nuevo, secrets a consumers dedicados |
| Recreate | Runtime/deployer identities, WIF, bounded queue y report bucket |
| Reconcile | Rules, TTL/indexes/recovery, App Check, quotas, IAM, budgets y alerts |
| Deprecate | Alias `default`, default compute general, implicit deploy y bucket/queue legacy |
| Rollback revision | Backend pre-P1–P8 sólo como provisional bajo containment; frontend P9 stable deployment |
| Data protection | Backup/PITR/delete-protection/retention approval antes de TTL o migration |
| Audit snapshot | Metadata, normalized IAM/config hashes, counts y artifact provenance sin payloads |
| No-write verification | Readiness Auditor compara estado pre/post R1B; debe ser idéntico |

Si ownership, billing o data policy no se aprueban, el candidato se reclasifica `LEGACY` y se diseña un proyecto Production nuevo; no se hace fallback silencioso.

## 5. API enablement plan

`P,S,R` significan Preview, Staging y Production preparation. Production no recibe enablement en R1B.

| Orden | API/service | Env | Propósito / dependencia | Verification futura | Disable/rollback | Riesgo |
|---:|---|---|---|---|---|---|
| 1 | `serviceusage.googleapis.com` | P,S,R | Gestionar APIs; project exists | `gcloud services list --enabled --project=<PROJECT_ID>` | No disable mientras se gestionan services | Lockout operativo |
| 2 | `cloudresourcemanager.googleapis.com` | P,S,R | Metadata/labels/IAM | Mismo list + project describe explícito | Mantener si project existe | Project mutation scope |
| 3 | `cloudbilling.googleapis.com` | P,S,R | Billing linkage metadata | billing describe por project ID | Unlink sólo en abandon plan | Interrupción total |
| 4 | `billingbudgets.googleapis.com` | P,S,R | Budgets tras billing | service list + budget metadata | Preserve alerts; unlink only on abandon | Budget no es spend cap |
| 5 | `iam.googleapis.com` | P,S,R | SAs/WIF dependencies | service list | No disable con workloads | Identity outage |
| 6 | `iamcredentials.googleapis.com` | P,S,R | WIF/token signing | service list | Disable WIF binding first | Token minting abuse |
| 7 | `sts.googleapis.com` | P,S,R | Federation exchange | service list | Disable provider/binding | Federation outage |
| 8 | `firebase.googleapis.com` | P,S,R | Firebase Management | service list + Firebase project metadata | Do not disable after Firebase use | Partial Firebase state |
| 9 | `firebaserules.googleapis.com` | P,S,R | Rules release/read-back | service list | Preserve safe Rules | Rules drift |
| 10 | `firestore.googleapis.com` | P,S,R | Firestore Native | database describe with `--project` | Never disable with data | Data unavailability |
| 11 | `identitytoolkit.googleapis.com` | P,S,R | Firebase Auth | service list + sanitized provider metadata | Disable providers before API | Login outage |
| 12 | `storage.googleapis.com` | P,S,R | Report buckets | bucket describe by exact name/project | Empty/quarantine then delete separately | Data loss/public exposure |
| 13 | `artifactregistry.googleapis.com` | P,S,R | Immutable artifacts | repositories list with project/location | Preserve rollback artifact | Lost rollback |
| 14 | `cloudbuild.googleapis.com` | P,S,R | Approved build path if used | builds config metadata | Disable trigger first | Supply-chain writes |
| 15 | `cloudfunctions.googleapis.com` | P,S,R | Gen2 Functions | functions list v2/project/region | Traffic OFF then undeploy separately | Public/runtime exposure |
| 16 | `run.googleapis.com` | P,S,R | Gen2 backing services | services list/project/region | Do not orphan Functions | Invoker drift |
| 17 | `eventarc.googleapis.com` | P,S,R | Gen2 event plumbing | triggers list/project/location | Remove dependent trigger first | Missed events |
| 18 | `pubsub.googleapis.com` | P,S,R | Platform dependencies/alerts if approved | topics/subscriptions metadata | Delete only empty non-shared resources | Message loss |
| 19 | `secretmanager.googleapis.com` | P,S,R | Secret resources/versions | secrets list metadata | Disable consumers, versions, then API | Runtime outage/value exposure |
| 20 | `cloudtasks.googleapis.com` | P,S,R | Bounded notification queue | queue describe explicit location/project | Pause before disable | Fan-out/backlog loss |
| 21 | `logging.googleapis.com` | P,S,R | Operational/audit logs | sinks/metrics list | Never remove all visibility | Blind operation |
| 22 | `monitoring.googleapis.com` | P,S,R | Metrics/dashboards/alerts | policies/dashboards list | Manual watch before rollback | Missed P0 |
| 23 | `clouderrorreporting.googleapis.com` | P,S,R | Error aggregation | service list | Monitoring fallback first | Missed errors |
| 24 | `firebaseappcheck.googleapis.com` | P,S,R | App Check registration/enforcement | metadata-only app config | Contain traffic before change | Public request outage/bypass |

APIs se habilitan por waves y se verifican tras cada wave. Un API no requerido por el artifact/config aprobado no se habilita.

## 6. Billing y cost controls

- Linkage sólo después de Product/FinOps approval y project/folder verification.
- Preview, Staging y Production tienen budget y cost-center separados.
- Thresholds propuestos: 50%, 75%, 90% y 100% del budget aprobado; forecast alert en 75%.
- Notification channels son roles/grupos aprobados fuera de Git; no se registran emails.
- Budgets alertan pero no garantizan hard cap. Containment real: provider quotas, Functions limits, queue pause y switches OFF.
- Labels obligatorios permiten attribution por environment/app/program/data-class/owner-role.
- Si billing se rechaza, el proyecto vacío se marca `ABANDONED`, no recibe datos ni secrets y se evalúa unlink/delete en change separado.

## 7. Firebase, Firestore y Auth

### Firebase initialization

Futuro orden: añadir Firebase al project explícito → registrar Web App → mapping de alias por PR → Firestore/Auth/Storage/Functions/App Check. No se usa project activo de CLI como authority.

### Firestore

| Control | Preview | Staging | Production preparation |
|---|---|---|---|
| Database/location | `(default)`, `nam5` | `(default)`, `nam5` | Preservar `(default)` `nam5` |
| Rules baseline | Deny-by-default/server-owned baseline | Production-like safe Rules | Leer/hash antes de cualquier cambio |
| Index manifest | Versionado, query-derived | Mismo candidate que Production | Comparar con manifest; no crear speculative indexes |
| TTL manifest | Documentado, no active hasta R6A | `expiresAt` primero aquí en R6A | No active hasta backup/approval/R6A |
| PITR/delete protection | Off sólo si data synthetic y approved | On propuesto | On propuesto, decisión externa |
| Backup | Re-seed | Daily/retention aprobada y restore exercise | Backup/PITR antes de migration/TTL |
| Seed/cleanup | Fixture versionado; reset por PR | Fixture representative; controlled reset | No seed; cleanup sólo por lifecycle autorizado |
| Access | Dedicated runtime SAs | Equivalent least privilege | Reconcile from default compute |

### Auth

- Preview/Staging providers reproducen sólo los flujos necesarios, con test identities y dominios exclusivos.
- Admin bootstrap usa procedimiento interno de dos roles; no crea standing superuser.
- Test accounts pueden quedar disabled por default y expiran según cleanup policy.
- Password policy, templates, provider callbacks, MFA y authorized domains se versionan como metadata sin contenido personal.
- Staging aplica MFA/provider posture equivalente cuando el contract lo requiera.
- No se exportan/copían Production users, UIDs, hashes, tokens ni emails.
- Production Auth se preserva hasta inventory metadata y migration approval.

## 8. Storage y Cloud Tasks

### Storage

| Control | Preview | Staging | Production proposed |
|---|---|---|---|
| Bucket | `aura-intel-preview-reports` | `aura-intel-staging-reports` | `aura-intel-production-reports` |
| Location | `US` | `US` | `US` |
| PAP/UBLA | Enforced/enabled at creation | Enforced/enabled at creation | Enforced/enabled at creation |
| Lifecycle | Delete fixtures at 30 days proposed | 30-day data lifecycle proposed; evidence retained separately | Per approved class |
| Retention | None beyond fixtures | Approved certification retention | Privacy-approved; lock only after restore/rollback review |
| CORS | Exact approved environment domain, GET/HEAD only where needed | Exact Staging domain | Exact Production domain |
| Signer/prefix | Dedicated signer; `reports/v1/<opaque-report-id>` | Igual | Igual; five-minute URL contract |
| Backup/restore | Re-seed | Restore exercise | Migration backup/checksum/rollback window |
| Verification | Metadata/IAM/ACL/CORS/lifecycle; no object names | Igual + restore | Igual + migration counts/checksums sanitized |

### Cloud Tasks

- Queue names: `discovery-notification-<environment>` in `us-central1`.
- Initial state: `PAUSED`; max dispatch 1/s; max concurrent 1.
- Retry: max attempts 3, min backoff 30s, max backoff 300s, max doublings 2.
- Caller: environment Tasks caller; fixed environment OIDC audience and endpoint placeholder `<ENV_NOTIFICATION_ENDPOINT>`.
- Recovery: Firestore recovery ledger/quarantine record with manual idempotent replay; Cloud Tasks no se trata como durable DLQ.
- Telemetry: age/count/retry/failure metrics, backlog alert y runbook.
- Rollback: pause immediately, revoke invoker, reconcile tasks via ledger; never redirect to another environment.

## 9. Secret Manager y App Check

### Secrets

Los 21 secret resources exactos están en el naming document. Creation produce recursos vacíos con labels y automatic/approved-US replication. Population es un paso humano separado: Secret Custodian agrega una versión mediante canal no loggeado, consumer owner valida metadata y el valor nunca entra en evidence.

- rotation target: 90 días propuesto o menor por provider;
- version labels/records: owner, consumer, created, rotate-by, rollback version;
- accessor sólo al runtime indicado en IAM plan;
- rollback selecciona versión previa del mismo environment; nunca copia cross-environment;
- superseded version se deshabilita tras rollback window y se destruye sólo por change separado.

### App Check

Provider Web recomendado: reCAPTCHA Enterprise, sujeto a Security/Firebase approval y disponibilidad del app. Debug sólo Preview, temporal, owner+expiry; Staging elimina debug antes de certification; Production prueba count cero.

Secuencia: registrar app/provider Preview → métricas → Staging unenforced validation → negative/valid token tests → Staging enforcement → Production metadata read-back → remover debug → change approval → enforcement por superficie con traffic contained → alert verification. Rollback contiene tráfico y revierte la última superficie; nunca deja un debug token Production como bypass.

## 10. Vercel

| Campo | Preview | Staging | Production |
|---|---|---|---|
| Project | `aura-control-center-preview` nuevo propuesto | `aura-control-center-staging` nuevo propuesto | `aura-control-center` existente condicionado |
| Git mapping | PR branches; audit/test build-only por default | `main`, deploy manual/protected | Approved release record; no auto-deploy por merge |
| Protection | Internal/SSO approved | Deployment protection + approver | Production protection + change gate |
| Node | 20.x pinned and certified | 20.x pinned and certified | Migrate 24.x metadata to approved Node 20 contract in R1B execution/change |
| Env var names | Preview Firebase public config + Preview endpoint names | Staging-only names | Production-only names |
| Secrets | Ningún Production secret; provider fakes default | Staging provider credentials only | Production provider credentials only |
| Domains | Preview pattern and expiry | Dedicated Staging pattern | Preserve approved Production domain |
| Cleanup/rollback | Remove closed-PR deployment | Previous Staging deployment | P9 stable then certified prior deployment |

## 11. Observability resources

Cada cloud environment crea los exact names del naming document:

- six log-based metrics for App Check, rate-limit, function errors, queue backlog, secret access and IAM changes;
- one operational dashboard plus Storage growth and Gemini/provider cost widgets;
- eight alert policy families with owner, severity, threshold, routing and runbook;
- notification channel logical name resolved outside Git;
- uptime check only against a safe health/metadata endpoint, never a costly handler;
- budget alerts and provider usage caps;
- audit log alerts for IAM/key/secret changes.

Alert evidence contiene policy metadata y synthetic routing receipt, no contact addresses.

## 12. Provisioning order

| Paso | Precondition | Future command group | Expected output/evidence | Rollback | Stop condition |
|---:|---|---|---|---|---|
| 1. Approve decisions | R1B docs reviewed | AP-01 sign-off, no CLI | 16 decision records | No writes | Any required decision open |
| 2. Reserve names | Decision owners assigned | RO-NAME then PRV-NAME | Availability record + approved manifest | Release reservation | Collision or unexpected project |
| 3. Create projects | IDs/folder/org approved | PRV-PROJECT | Two empty project metadata records | Mark abandoned; cooling period | Wrong org/folder or inherited broad IAM |
| 4. Link billing | FinOps/Product approval | PRV-BILLING | Linked account metadata, no sensitive ID in repo | Unlink empty project | Wrong account/cost center |
| 5. Apply labels | Project/billing verified | PRV-LABELS | Exact label read-back | Restore prior labels | Missing/ambiguous environment |
| 6. Enable APIs | Approved API manifest | PRV-API by ordered wave | Enabled service list | Disable only unused API after dependency check | Unexpected API or partial wave |
| 7. Enable Firebase | APIs ready | PRV-FIREBASE | Firebase project metadata | Abandon empty project if partial state unsafe | CLI target mismatch |
| 8. Create identities | IAM approval/key policy | PRV-SA | SA metadata, USER_MANAGED=0 | Delete unused zero-binding SA | Key or inherited broad role |
| 9. Configure WIF | Repo/branch/env conditions approved | PRV-WIF | Pool/provider/binding read-back | Disable provider and binding | Wildcard condition/audience |
| 10. Create empty secrets | Consumers/replication approved | PRV-SECRET | 7 empty secret metadata records/env | Delete empty unused resource | Value appears in log/evidence |
| 11. Create data resources | Region/data policies approved | PRV-FS, PRV-AUTH, PRV-STORAGE | Location/policy metadata | Quarantine/abandon empty resources | Wrong region/public bucket |
| 12. Create paused queues | Caller/audience/retry approved | PRV-TASKS | Queue state PAUSED and bounds | Pause/delete empty queue | Any dispatch or wrong endpoint |
| 13. Monitoring/budgets | Owners/routing approved | PRV-OBS, PRV-BUDGET | Policies/dashboards/budget metadata | Manual watch; remove defective policy only | No owner/routing or secret field |
| 14. Configure Vercel non-prod | Projects/domains approved | PRV-VERCEL | Project/branch/Node/env-name metadata | Unlink/remove non-prod project | Production variable/target leak |
| 15. Validate isolation | All read-backs complete | RO-ISOLATION | Zero shared IDs/resources/identities | Freeze all provisioning | Any cross-environment reference |
| 16. Deliver evidence | Redaction scan PASS | EVD-CAPTURE | Signed evidence index and diff | Re-sanitize; preserve raw externally | PII/secret/token in packet |
| 17. Authorize next slice | Gates/approvers complete | AP-02 sign-off | G1 closure record | Keep environments disabled | Missing rollback or open P0 |

## 13. Global stop conditions

Stop on ambiguous project/alias; wrong organization/folder/billing; unapproved location; inherited Editor/Owner; key creation; secret value in output; public bucket; queue not paused; Production reference from non-prod; App Check debug without owner/expiry; Vercel env leak; failed rollback/routing; or any write not listed in the approved change manifest.
