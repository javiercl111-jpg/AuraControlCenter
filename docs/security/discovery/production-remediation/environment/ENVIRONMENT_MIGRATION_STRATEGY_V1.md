# Environment Migration Strategy v1

**Slice:** AI-02H1E.5.R1A

**Estado:** estrategia documental; ninguna migración fue ejecutada

## 1. Objetivo

Separar Preview y Staging, reconciliar el candidato productivo y preservar una ruta de rollback sin copiar datos productivos a ambientes no productivos. Cada ejecución futura requiere su propio slice, PR, aprobación, backup y read-back.

## 2. Disposición de componentes

| Componente | Preserve | Migrate | Recreate | Deprecate | Delete later |
|---|---|---|---|---|---|
| Frontend actual | Deployment Production estable y dominios aprobados | Variables/targeting a manifests explícitos | Proyecto Vercel Staging recomendado | Variables ambiguas y Preview con config Production | Deployments Preview expirados según policy |
| Backend legacy | Metadata, source provenance y config como evidencia/rollback provisional | Mismo artifact certificado desde Staging a Production | Runtimes con SAs dedicadas y límites | Revisions pre-P1–P8 después de rollback window | Revisions sin tráfico tras aprobación |
| Firestore data | Datos Production, audit y authority records | Sólo transformación aprobada/in-place o proyecto replacement si candidato se rechaza | Datasets sintéticos Preview/Staging | Writers cliente y records incompatibles tras migración | Datos legacy sólo por retention policy |
| Auth users/config | Users/config Production sin lectura en R1A | Sólo si se reemplaza el proyecto Production, mediante plan específico | Auth exclusivo Preview/Staging con test identities | Providers/config obsoletos después de compatibility proof | Cuentas de prueba expiradas |
| Storage | Objetos actuales hasta inventory/backup | Reportes autorizados a bucket Production nuevo | Buckets Preview/Staging/Production endurecidos | Bucket actual como legacy/read-only | Bucket legacy tras verification, retention y rollback window |
| Functions | Contratos P1–P8 y suites | Artifact inmutable a Staging y luego Production | Service config/identity bindings por ambiente | Default compute y config amplificadora | Revisions stale después de evidencia |
| Aliases | Ninguno como autoridad implícita | Workflows a `preview`, `staging`, `production` | Manifest de ambiente | `default` | Mapping legacy tras dependency scan |
| Domains | Dominios Production aprobados | Staging/Preview a domains aislados | Domains temporales/protegidos | Domain mapping ambiguo | Preview domains expirados |
| Secrets | Nombres/version metadata y consumers legítimos | Valores mediante rotación controlada a namespaces por ambiente | Secrets exclusivos por purpose/consumer | Broad access y versiones superseded sin owner | Versiones retiradas después de rollback window |
| Queues | Retry semantics útiles | Ningún payload Production a non-prod | Queues por ambiente, paused y bounded | Queue Production con 500/s y 1000 concurrency | Queue legacy tras drain/recovery evidence |
| IAM | Audit evidence y acceso recuperable | Workloads a dedicated identities/WIF | SAs y bindings mínimos | Editor, default compute general y personal standing privilege | Bindings legacy tras positive/negative tests |

`Delete later` nunca significa una autorización de borrado; requiere un change separado, inventory exacto, retention approval y rollback closure.

## 3. Fases de migración

### M0 — Freeze y baseline

- Mantener `REMEDIATION_HOLD` sobre nuevas promociones.
- Registrar metadata read-only del candidato, artifact rollback, reglas, identities y recursos.
- Resolver las decisiones externas R1A.
- Detener si no se puede leer una configuración crítica o si aparece un proyecto ambiguo.

### M1 — Provisioning design y aislamiento

- Aprobar IDs/billing/regions de Preview y Staging.
- Diseñar manifests, aliases y guards R1B.
- Definir buckets, queues, Auth, App Check y budgets exclusivos.
- No importar datos Production.

### M2 — Identidades y trust root

- Diseñar/crear WIF y identities por ambiente en R3A.
- Migrar authority writers a backend-owned contracts en R2A/R2B.
- Probar permisos positivos/negativos en Staging.
- Retirar privilegios legacy sólo después de read-back y break-glass probado.

### M3 — Staging equivalente

- Construir un artifact desde commit certificado.
- Desplegarlo a Staging OFF/paused/minimal.
- Aplicar Rules, App Check, TTL, índices, Storage, quotas, queues y observabilidad Staging mediante slices autorizados.
- Ejecutar suites, smoke tests sintéticos, rollback y restore exercises.

### M4 — Reconciliación Production

- Aprobar change manifest inmutable.
- Reconciliar IAM, secrets, Rules, App Check, TTL/indexes, bucket/queue y alerts antes o junto con el deployment según dependencias.
- Desplegar el mismo artifact con tráfico OFF y queue paused.
- Ejecutar read-back y R11 sin tráfico productivo.

### M5 — Enablement y deprecación

- Fuera de R1A y tras gates finales, habilitar gradualmente mediante cambio operativo separado.
- Observar SLO/cost/abuse y conservar rollback.
- Marcar legacy assets sin uso; borrar sólo tras retention, recovery y aprobación.

## 4. Estrategia por datos

### Firestore

La opción preferida conserva la base `(default)` `nam5` del candidato productivo. Preview/Staging reciben seeds sintéticos versionados. Si el proyecto candidato se rechaza, la migración Production debe incluir:

1. clasificación/count-only inventory sin leer PII en la fase de diseño;
2. backup/export cifrado y autorizado;
3. transform/validation por schema y tenant boundary;
4. rehearsal con dataset sintético;
5. cutover window con writes contenidos;
6. count/hash/invariant verification sanitizada;
7. rollback antes de reanudar writers;
8. retention y eliminación posterior aprobadas.

TTL se activa sólo después de backup/recovery y no se considera mecanismo de migración.

### Auth

R1A no leyó usuarios. Production Auth se preserva por defecto. Preview y Staging usan test identities exclusivas. Si se reemplaza Production, se requiere un plan dedicado para providers, UID mapping, claims no canónicos, session revocation, password/token compatibility, consent y rollback; ningún UID o email entra en evidencia Git.

### Storage

Se recomienda un bucket nuevo Production. La migración futura usa inventory metadata/counts, copy verificado, checksum, prefix allowlist, object classification y dual-read sólo si se aprueba. El bucket original se vuelve legacy/read-only antes del retiro. Signed URLs se emiten únicamente desde el nuevo signer después del cutover.

## 5. Frontend, backend y domains

- Frontend: reemplazar variables implícitas por manifest por ambiente; no cambiar dominios Production hasta probar Preview/Staging.
- Backend: artifact build-once/promote; el deployment P9 pre-hardening es rollback provisional con containment, no baseline certificada.
- Domains: Preview temporales protegidos, Staging dedicado, Production preservado. DNS changes requieren change/rollback separados.
- Compatibility: el frontend nunca adelanta un contract backend no desplegado; promotion record compara ambos digests/commits.

## 6. Secrets y queues

Secrets se rotan, no se copian entre ambientes. El rollback selecciona una versión anterior dentro del mismo ambiente y sólo para el mismo consumer. Toda versión superseded obtiene owner y retirement date.

Queues no se migran transfiriendo tareas pendientes entre ambientes. Antes del cutover se pausa, se registra backlog count, se drena o reconcilia mediante ledger idempotente y se habilita la queue nueva con mínimos. Un task Production jamás apunta a gateway Staging/Preview ni al revés.

## 7. IAM cutover

1. Crear nueva identity sin tráfico.
2. Conceder sólo permisos resource-scoped.
3. Ejecutar negative tests en Staging.
4. Cambiar workload y verificar read-back.
5. Revocar binding legacy específico.
6. Confirmar que no aparece dependencia de Editor/default compute.
7. Repetir workload por workload.

Rollback restaura sólo el binding específico anterior seguro; nunca `Editor` blanket ni una llave permanente. El último acceso recuperable no se elimina antes de probar break-glass.

## 8. Rollback targets

| Área | Target provisional | Target definitivo |
|---|---|---|
| Frontend Production | Deployment Vercel estable registrado en P9 | Último deployment certificado compatible |
| Backend Production | Revisions pre-P1–P8 con containment total | Último artifact promovido y certificado |
| Staging | Deployment anterior o entorno recreable | Artifact Staging previo certificado |
| Firestore | Backup/PITR aprobado; no rollback automático de deletes | Restore point probado y invariant check |
| Storage | Bucket original read-only durante window | Version/backup validado del bucket nuevo |
| IAM | Binding workload específico previo | Matriz least-privilege versionada |
| Queues | Queue pause + recovery ledger | Config versionada anterior bounded |

## 9. Criterios de abort

Abortar si falla backup/restore, count/invariant verification, compatibility frontend/backend, negative permissions, App Check, Rules, queue idempotency, alert routing o artifact provenance; si aparece PII en evidencia; si un ambiente referencia recursos de otro; o si el rollback no puede ejecutarse dentro de la ventana aprobada.

## 10. Evidencia requerida

Cada futura wave conserva: approved decision/change record, commands con project explícito, metadata pre/post sanitizada, artifact digest, config diff, tests, owner/approver, timestamps, abort/rollback result y residual risks. No conserva tokens, secretos, UIDs, emails, payloads ni signed URLs.
