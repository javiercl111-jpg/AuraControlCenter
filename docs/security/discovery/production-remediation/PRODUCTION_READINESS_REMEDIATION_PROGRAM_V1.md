# Production Readiness Remediation Program v1

**Programa:** Aura Intelligence Production Readiness Remediation Program

**Base canónica:** merge P9 `f7db8b6ee0a6642fde347069da3f8f1aee933123`

**Estado:** diseño documental; ninguna configuración o autorización operativa se concede por este documento

**Dictamen de diseño:** **PRODUCTION REMEDIATION PROGRAM DESIGNED — READY FOR CONTROLLED EXECUTION**

## 1. Objetivo y límites

Este programa convierte los 17 controles P0, 15 controles P1 y tres guardrails P2 de P9 en una secuencia pequeña, reversible y verificable. La primera ejecución permitida es el slice de decisiones R1A; cualquier escritura sobre Firebase, Google Cloud, IAM, Firestore, App Check, Vercel, secretos o datos requiere su propio PR, aprobación humana y gate explícito.

Fuentes canónicas, sin repetir la auditoría:

- [Production Configuration Verification v1](../production-verification/PRODUCTION_CONFIGURATION_VERIFICATION_V1.md)
- [Production Configuration Matrix v1](../production-verification/PRODUCTION_CONFIGURATION_MATRIX_V1.json)
- [Production Configuration Blockers v1](../production-verification/PRODUCTION_CONFIGURATION_BLOCKERS_V1.md)
- [Production Configuration Evidence Index v1](../production-verification/PRODUCTION_CONFIGURATION_EVIDENCE_INDEX_V1.md)

No se accede a servicios externos durante este diseño. Los comandos descritos son comandos futuros esperados y no fueron ejecutados.

## 2. Principios de ejecución

1. **Ambiente antes que despliegue.** R1–R3 cierran targeting, trust root e IAM antes de desplegar P1–P8 en cualquier proyecto real.
2. **Staging primero.** R4A alinea el backend sólo en Staging. R4B promueve Production después de R5–R10 y una aprobación independiente.
3. **Fail closed antes de tráfico.** Las superficies costosas comienzan deshabilitadas, con cuotas de emergencia en cero, colas pausadas y `minInstances=0`.
4. **Rules seguras no retroceden.** El rollback nunca restaura escrituras cliente sobre autoridad o datos server-owned.
5. **Identidades de workload, no credenciales personales.** Deploy e inspección usan Workload Identity Federation o auditoría de solo lectura; no se permiten claves persistentes.
6. **Evidencia por read-back.** Un cambio no cierra un control hasta que la configuración efectiva se vuelve a leer y se adjunta al PR/slice.
7. **Un owner slice principal por control.** La matriz asigna los 35 controles exactamente una vez, aunque otros slices sean dependencias.
8. **Separación de preparación y activación.** Desplegar código con flags apagados no habilita tráfico. La habilitación requiere un gate posterior.

## 3. Dominios consolidados y subdivisiones

| Dominio | Resultado | Subdivisión para PR pequeño |
|---|---|---|
| R1 — Environment Separation and Deployment Targeting | Cuatro ambientes explícitos y selección imposible de confundir | R1A decisiones/recursos; R1B manifests, aliases, CI y Vercel targeting |
| R2 — Administrative Trust Root and Firestore Rules Closure | Autoridad backend-only y Rules desplegables sin escalamiento cliente | R2A migración de trust root; R2B Rules, compatibilidad y certificación |
| R3 — Runtime IAM and Service Account Least Privilege | Workload identities dedicadas y retiro progresivo de privilegios legacy | R3A identidades/WIF; R3B bindings, secretos, claves y acceso humano |
| R4 — Backend Deployment Alignment with P1–P8 | Staging y Production alineados al mismo artefacto inmutable | R4A despliegue Staging; R4B promoción Production tardía y deshabilitada |
| R5 — App Check Production Enforcement | Provider, enforcement, métricas y debug-token closure | Un slice; primero Staging y después configuración Production aprobada |
| R6 — Firestore TTL and Indexes | Retención, índices y recuperación verificables | R6A Firestore TTL/indexes/recovery; R6B Storage/signer/signed URLs |
| R7 — Runtime Quotas and Cloud Tasks Limits | Cost bounds efectivos y fan-out acotado | R7A límites Functions; R7B Tasks y notification gateway |
| R8 — Production Kill Switches and Emergency Policy | Policy inmutable, fail-closed, expirable y con rollback | Un slice con herramienta trusted y activación separada por ambiente |
| R9 — Logging, Metrics, Dashboards and Alerts | Alertas P0, ownership, escalación y costos | R9A observabilidad técnica; R9B budgets y provider cost controls |
| R10 — Incident Response, Rollback and Break-Glass | Operación segura y probada antes de Production | Un slice documental/tabletop; no concede accesos por sí mismo |
| R11 — Read-Only P9 Revalidation | Cierre remoto de cada control con evidencia sanitizada | Un slice estrictamente read-only |
| R12 — Final Production Readiness Certification | Decisión independiente basada en gates cerrados | Un slice final; no incluye deployment |

R6B y R7B absorben los P1 de Storage, signed URLs y notification gateway que no tenían dominio explícito en el orden mínimo. No se crea un dominio paralelo que pudiera dejar estos controles sin dueño.

## 4. Inventario de slices

| Slice | Nombre | Objetivo | Controles P9 principales |
|---|---|---|---|
| R1A | Environment Decision and Resource Allocation | Aprobar proyectos, clasificación, owners y aislamiento | ENV-01, APP-01 |
| R1B | Explicit Targeting and Promotion Guardrails | Eliminar selección implícita y aislar Preview/Staging | ENV-02, CFG-01, VER-01, VER-02, VER-03 |
| R2A | Administrative Trust Root Migration | Sustituir writes cliente por autoridad Admin SDK auditada | Prerrequisito de FS-04 |
| R2B | Firestore and Storage Rules Closure | Negar writes cliente server-owned y probar compatibilidad | FS-03, FS-04 |
| R3A | Workload Identities and WIF | Crear modelo de runtime/deployer identities | IAM-01 |
| R3B | Privilege and Secret Access Cutover | Retirar Editor, claves y acceso humano permanente | FN-04, IAM-02, IAM-03, SEC-01, SEC-02 |
| R4A | Staging Backend Alignment | Desplegar P1–P8 en Staging, todo deshabilitado | FN-01 |
| R5 | App Check Enforcement and Debug Token Closure | Verificar provider/enforcement y cerrar bypass | APP-02, APP-03 |
| R6A | Firestore TTL, Indexes and Recovery | Activar retención/indexes primero en Staging | FS-01, FS-02, FS-05 |
| R6B | Storage and Signed URL Hardening | Cerrar UBLA/PAP/lifecycle/signer/TTL efectivo | STO-01, STO-02, STO-03 |
| R7A | Functions Runtime Quotas | Aplicar límites por superficie aprobados | FN-03 |
| R7B | Cloud Tasks and Notification Gateway | Acotar cola, caller, audience, replay y backlog | TASK-01, NOTIFY-01 |
| R8 | Kill Switches and Emergency Policy | Materializar policy, auditoría, expiry y rollback | QUOTA-01 |
| R9A | Abuse Observability and P0 Alerts | Crear métricas, dashboards y alertas operables | OBS-01, OBS-02, OBS-03 |
| R9B | Budgets and Provider Cost Controls | Crear thresholds, owners y contención de costo | COST-01 |
| R10 | Incident Response, Rollback and Break-Glass | Completar runbooks y table-tops | OPS-01, OPS-02 |
| R4B | Controlled Production Backend Promotion | Promover el artefacto certificado con tráfico apagado | FN-02 |
| R11 | Read-Only P9 Revalidation | Repetir evidencia efectiva sin writes ni tráfico | Todos como verificación secundaria |
| R12 | Final Production Readiness Certification | Emitir decisión final independiente | Todos como gate final |

La especificación completa por slice —incluidos comandos, writes, pruebas, rollback y stop conditions— vive en `PRODUCTION_READINESS_REMEDIATION_MATRIX_V1.json`.

## 5. Estrategia de ambientes

Se requieren dos proyectos Firebase/Google Cloud nuevos: uno para Preview y otro para Staging. No se crean en este slice. Production conserva inicialmente el proyecto identificado por P9, sujeto a la decisión de endurecer o reemplazar su bucket. Local/demo no usa proyecto real.

| Atributo | Local/demo | Preview | Staging | Production |
|---|---|---|---|---|
| Firebase project | Sólo `demo-*` y Emulator | Nuevo proyecto aislado; ID aprobado en R1A | Nuevo proyecto aislado; ID aprobado en R1A | Proyecto existente identificado por P9 |
| Google Cloud project | No aplica | Mismo boundary del Firebase Preview | Mismo boundary del Firebase Staging | Proyecto existente, siempre explícito |
| Vercel environment | Local development | Preview del proyecto web, variables sólo Preview | Proyecto Vercel separado o aislamiento equivalente aprobado | Production del proyecto web existente |
| Functions runtime identity | Emulator/fake | SAs dedicadas no productivas | SAs dedicadas equivalentes a Production | SAs dedicadas por trust boundary |
| Storage bucket | Fake/Emulator | Bucket exclusivo, datos sintéticos | Bucket exclusivo, datos sintéticos/deidentificados | Bucket exclusivo endurecido o replacement aprobado |
| Cloud Tasks | Fake ledger | Cola Preview con techo mínimo | Cola Staging pausada por default | Cola Production pausada hasta R7B/R8/R9 |
| App Check | Seam/fake; debug local permitido | App/provider exclusivos; debug sólo con expiry y owner | Provider production-like, sin debug permanente | Provider aprobado; cero debug tokens |
| Secrets | Fixtures no sensibles | Secret versions exclusivas | Secret versions exclusivas | Secret versions exclusivas y runtime-bound |
| Data classification | Sintético | Sintético, sin PII productiva | Sintético/deidentificado, sin PII productiva | Clasificación P9; PII sólo bajo contrato aprobado |
| Deployment authority | Developer local | CI con WIF + branch policy | CI con WIF + Deployment Approver | CI con WIF + Deployment Approver + Security gate |
| Allowed traffic | Loopback | Equipo interno y pruebas automatizadas | Canarios internos/sintéticos aprobados | Cero hasta G9; luego enablement gradual aprobado |
| Rollback target | Descartar/recrear | Deployment Preview previo | Artefacto Staging previo + policy deny-all | Artefacto certificado previo + policy deny-all + queue pause |

Decisiones R1A obligatorias:

1. IDs, billing owner y región de los dos proyectos nuevos.
2. Proyecto Vercel separado para Staging versus aislamiento equivalente demostrable.
3. Endurecer el bucket Production in place o migrar a uno nuevo.
4. Data retention/PITR/delete-protection por ambiente.
5. Roles organizacionales nominados fuera del repositorio para approvals y on-call.

## 6. Estrategia de Rules y trust root

### 6.1 Modelo objetivo

- `platform_global_admins` y `platform_tenants` son authority records backend-owned.
- `public_rate_limit_counters_v1`, `discovery_intake_idempotency`, capability records y documentos Discovery server-owned niegan create/update/delete desde clientes.
- Admin SDK sólo opera desde runtimes dedicados con permisos mínimos; no convierte un callable público en autoridad administrativa.
- Custom claims son una señal de sesión/cache y nunca la fuente canónica de rol o tenant.
- `resolvePlatformPrincipal` o su sucesor resuelve identidad, membership, status, tenant y versión canónica antes de cualquier mutación.

### 6.2 Orden de migración

1. Congelar cualquier deploy del ruleset P9 local y obtener hash read-only del ruleset efectivo.
2. Inventariar writers de autoridad por análisis estático y pruebas Staging; no leer PII productiva.
3. Implementar comandos Admin SDK internos para los writers legítimos, con principal resolver, razón estable, idempotencia y audit record.
4. Migrar UI/clientes para dejar de escribir autoridad directamente; durante compatibilidad sólo se mantienen reads mínimos y ninguna nueva ruta client-write.
5. Bootstrap inicial mediante procedimiento offline de dos roles, una sola vez, sin endpoint público y con audit append-only.
6. Propagar/revocar custom claims y sesiones después del cambio canónico; revocación del record canónico prevalece de inmediato.
7. Desplegar Rules cerradas en Staging y ejecutar Emulator/adversarial tests y canarios sintéticos.
8. Confirmar cero dependencia client-write antes de Production.

Rollback: revertir aplicación/consumidor al artefacto compatible, pero conservar Rules backend-only. El rollback de Rules sólo puede usar un ruleset anterior ya certificado como deny-write para authority y server-owned data.

## 7. Estrategia IAM

### 7.1 Workload identities objetivo

| Identidad lógica | Uso | Permisos máximos esperados |
|---|---|---|
| Intake runtime | Intake y advisor resolution | Firestore collections mínimas; sólo sus HMAC/salt; sin Storage admin |
| Capability/session runtime | Exchange y session resolution | Capability/link/session documents mínimos; sin Gemini/Storage signing |
| AI runtime | Conversation evaluation | Session/cost/telemetry mínimos + versión Gemini asignada |
| Completion runtime | Exactly-once completion/outbox | Completion collections + enqueue en una cola concreta |
| Report runtime | Generación de reporte | Report metadata + object create en prefix aprobado; sin bucket admin |
| Download signer runtime | Signed URL grants | Sign sólo objetos/prefix aprobado; token creator únicamente si el mecanismo lo exige |
| Notification runtime | Consumir task y llamar gateway | OIDC audience fija + telemetry/inbox mínimos |
| Deployer | Deploy aprobado | WIF, impersonation acotada, sin key material persistente |
| Auditor | Revalidación | Viewer/metadata-only, sin secretos ni writes |
| Break-glass | Incidente | Time-bound, two-person approval, logging y revocación automática |

### 7.2 Secuencia de cutover

1. Crear SAs y WIF separados por ambiente sin asignar tráfico.
2. Crear matriz permiso-recurso y probar negative permissions en Staging.
3. Vincular secretos sólo a su consumidor y retirar versiones sin owner mediante slice separado.
4. Cambiar runtime identities en Staging y verificar access denied fuera de scope.
5. Cambiar Production con funciones deshabilitadas.
6. Retirar `Editor` sólo después del read-back y canario de cada identidad.
7. Inventariar y eliminar claves user-managed; una clave activa inesperada detiene todo el programa.
8. Sustituir Owner personal permanente por grupos/workloads y elevación temporal; nunca eliminar el último acceso recuperable antes de probar break-glass.

## 8. Estrategia de deployment

R4A construye una vez un artefacto inmutable desde commit certificado, registra hash/SBOM/provenance y lo despliega en Staging. R4B usa el mismo artefacto en Production; no recompila desde una rama mutable.

### 8.1 Estado inicial obligatorio

| Superficie | Estado inicial tras deploy | Límite inicial |
|---|---|---|
| Advisor resolution / intake | Switch OFF | `minInstances=0`, max 1, concurrency 1 |
| Token issuance / session resolution | Switch OFF | `minInstances=0`, max 1, concurrency 1 |
| Completion | Switch OFF | `minInstances=0`, max 1, concurrency 1 |
| Conversation AI | Switch OFF, quota 0 | `minInstances=0`, max 1, concurrency 1 |
| Report generation | Switch OFF, quota 0 | `minInstances=0`, max 1, concurrency 1 |
| Document download | Switch OFF, quota 0 | `minInstances=0`, max 1, concurrency 1 |
| Notification fan-out | Switch OFF, queue PAUSED | `minInstances=0`, max 1, concurrency 1 |

Los valores contractuales finales se activan por R7A/R7B después de aprobación Product/Security/FinOps. Los valores mínimos anteriores son containment de rollout, no nuevos límites de negocio.

### 8.2 Verificación post-deploy

- metadata read-back de commit/provenance, runtime, región, SA, secrets por nombre, ingress, max/concurrency/timeout;
- no public invoker inesperado;
- requests sin/mal App Check rechazados en Staging sin side effects;
- policy ausente/corrupta/expirada falla cerrada;
- suites P2–P8, D.9 y D.8 verdes;
- pruebas funcionales sólo con fixtures sintéticos del ambiente;
- cero enablement de Production hasta G9.

Rollback inmediato: switches OFF, emergency quotas 0, queue pause, traffic/revision al artefacto certificado previo y preservation de Rules seguras/audit evidence.

## 9. TTL, índices y Storage

### 9.1 Firestore

- Manifest canónico existente: `manifests/DISCOVERY_INTAKE_IDEMPOTENCY_TTL_V1.json`.
- Collection group: `discovery_intake_idempotency`.
- Field: `expiresAt`, Firestore Timestamp.
- TTL esperado: estado remoto `ACTIVE`; la expiración semántica de código sigue siendo autoritativa.
- Comando futuro esperado: `gcloud firestore fields ttls update expiresAt --collection-group=discovery_intake_idempotency --enable-ttl --project=<STAGING_PROJECT_ID>` y, tras aprobación, el equivalente Production.
- Read-back: `gcloud firestore fields ttls list --project=<PROJECT_ID>` hasta estado activo, más métricas de lag/cardinalidad.
- Cleanup coexistente: componente bounded interno sólo como fallback, dry-run primero; no se exporta scheduler sin un slice propio.
- Índices: derivar desde queries bounded, versionar `firestore.indexes.json`, desplegar primero Staging y verificar `READY`.
- Rollback/mitigación: TTL no garantiza undelete; antes de Production se preserva evidencia/backup aprobado. Si lag o deletes son anómalos, detener nuevos writes con containment y no depender del disable como restauración.

Inventario inicial query-to-index, basado en el source certificado:

| Dominio | Query actual | Índice requerido en R6A |
|---|---|---|
| Idempotency cleanup | `expiresAt <= now`, `orderBy expiresAt ASC`, bounded `limit` | Índice single-field ascendente sobre `expiresAt`; verificar que no exista exemption. No justificar composite redundante |
| Intake/idempotency namespace | Deterministic document IDs y transactions | Ningún composite actual |
| Rate limits/emergency quota | Deterministic bucket/document IDs y transactions | Ningún composite actual |
| Capability/session completion | Deterministic document IDs y transactions | Ningún composite actual |
| Telemetry/metrics/containment | Deterministic document IDs y writes | Ningún composite actual para los paths certificados |
| Advisor codes | Lookup por document ID normalizado | Ningún composite actual |

R6A debe versionar `firestore.indexes.json` incluso si el inventario aprobado mantiene `indexes: []`, documentar single-field exemptions y ejecutar todas las queries Staging. Cualquier composite futuro requiere una query concreta, evidencia de fallo/plan y cardinalidad bounded; no se crean índices especulativos.

### 9.2 Storage

R6B decide hardening in place versus bucket replacement, activa UBLA/PAP/lifecycle/retention aprobados, restringe signer a prefix y TTL de cinco minutos, verifica ausencia de public ACLs y usa migración/copy sólo mediante un plan de datos separado. Preview, Staging y Production nunca comparten bucket.

## 10. Cuotas, Tasks y notification gateway

R7A materializa la tabla aprobada de `PUBLIC_INTAKE_LIMITS_V1.md` por función. El read-back debe comparar cada maxInstances/concurrency/timeout/memory; defaults de plataforma no cuentan como evidencia.

R7B reduce la cola antes de reanudarla, conserva tres attempts/backoff, limita caller/audience, define DLQ o recuperación equivalente, prueba idempotency/replay y enlaza backlog alert/runbook. El gateway debe demostrar auth OIDC, allowlist de audience, provider quota y owner operativo sin invocarlo en Production durante la verificación.

## 11. Kill switches y emergency policy

R8 crea una herramienta trusted sin endpoint público para validar, publicar y activar policies inmutables. Staging debe probar:

- los nueve switches;
- quotas por operación, nunca mayores al límite ordinario;
- `environment`, `policyVersion`, expiry y status;
- audit atómico y redacted telemetry;
- rollback pointer válido, sin ciclos y con two-role approval;
- fail-closed ante pointer/policy ausente, corrupta, revocada o expirada.

Production comienza con todos los switches OFF y cuotas costosas en cero. La activación gradual es una acción humana separada de R4B.

## 12. Observabilidad mínima P0

R9A debe crear métricas y alertas con owner/escalación para:

- App Check missing/invalid y debug-token drift;
- rate-limit/containment/global-quota denials;
- Function errors, latency, instance saturation y deployment drift;
- Firestore transaction conflicts, TTL lag y cardinalidad idempotency;
- Cloud Tasks backlog/retry/age;
- Gemini attempts, fallback y cost proxy;
- PDF failures, signed URL grants y Storage growth;
- notification fan-out/failures;
- Secret Manager access anomalies e IAM policy/key changes.

Dashboards mínimos: Public Intake Security, Cost/Capacity, Data Lifecycle y IAM/Secrets. Cada alerta incluye severity, threshold aprobado, notification channel, owner role, runbook y prueba de routing en Staging.

R9B cubre billing alerts GCP, Gemini/API, Functions, Firestore, Storage, Tasks, Vercel y proveedor de notifications. Thresholds monetarios y recipients requieren Product Owner, FinOps Owner y Security Owner; este diseño no inventa valores.

## 13. Runbooks requeridos

R10 crea y table-top en Staging:

1. Public intake abuse.
2. Kill switch activation.
3. App Check failure/debug-token compromise.
4. Capability/token compromise.
5. Quota exhaustion.
6. Cost spike.
7. Firestore rollback/recovery.
8. Deployment rollback.
9. Queue backlog/DLQ recovery.
10. Secret rotation.
11. IAM revocation/key exposure.
12. Loss of administrators.
13. Break-glass activation and closure.

Cada runbook tiene trigger, severity, Incident Commander, executor/approver roles, evidence preservation, containment, rollback, communication/escalation, verification, expiry y post-incident review. Los contactos personales viven fuera del repositorio.

## 14. Decisiones externas pendientes

| Decisión | Accountable role | Gate |
|---|---|---|
| IDs/billing/regions de Preview y Staging | Product Owner | G1 |
| Staging Vercel separado o aislamiento equivalente | Deployment Approver | G1 |
| Bucket Production in-place versus replacement | Security Owner + Privacy/Compliance Approver | G5 |
| Provider App Check y política de debug temporal no productiva | Security Owner | G5 |
| Granularidad final de SAs y permisos | Security Owner | G3 |
| Límites finales, provider quotas y budgets | Product Owner + FinOps Owner | G6 |
| PITR/delete protection/retention/lifecycle | Platform/SRE Owner + Privacy/Compliance Approver | G5 |
| Owners de notification gateway y on-call | Incident Commander | G7 |
| Identidades nominales de approvers/on-call | Liderazgo organizacional fuera del repositorio | Antes de cada write slice |

Estas decisiones no bloquean comenzar R1A; sí bloquean cualquier slice que escriba configuración.

## 15. Riesgos del programa

- Crear ambientes sin billing/ownership puede reproducir el mismo targeting implícito.
- Cerrar Rules antes de migrar writers puede causar indisponibilidad; cerrarlas después de deploy inseguro preserva escalamiento.
- Retirar Editor o Owner antes del cutover/break-glass puede bloquear operación; hacerlo después sin fecha deja privilegio permanente.
- TTL es irreversible para documentos ya eliminados; requiere retención/evidencia aprobadas.
- Desplegar código antes de policy/alerts puede abrir gasto aunque las pruebas locales estén verdes.
- Preview automático puede apuntar a Production si R1B no bloquea env drift.
- Alertas sin routing probado crean seguridad aparente.
- Rollback de Rules a un ruleset inseguro reabre el trust root y está prohibido.

## 16. Criterio de cierre del programa

R12 sólo puede iniciar cuando R11 demuestra:

- cero P0 abiertos;
- P1 cerrados o excepciones de riesgo explícitas, aprobadas y con expiry;
- todos los ambientes inequívocos;
- Rules y IAM efectivos bajo mínimo privilegio;
- backend Production en artefacto certificado y aún bajo enablement controlado;
- App Check, TTL, indexes, quotas, containment, alerts, budgets y runbooks con read-back;
- P8, Authority D.9, Dark Handler D.8 y builds verdes;
- rollback y break-glass probados fuera de Production.

El cierre de R12 produce una recomendación de readiness independiente. Cualquier activación de tráfico o cambio posterior sigue requiriendo su autorización operativa separada.
