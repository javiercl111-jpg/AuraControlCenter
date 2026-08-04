# Environment IAM and Identity Plan v1

**Slice:** AI-02H1E.5.R1B

**Estado:** diseño `PROPOSED`; cero identities, bindings, keys o WIF creados

## 1. Principios

1. Cada environment tiene identities distintas; no existe impersonation cross-environment.
2. Ningún workload usa default compute, `Editor`, `Owner` ni credencial personal.
3. Todo permiso se asigna en el recurso más estrecho que lo soporte.
4. Secret access se concede por secret y consumer.
5. Deployers usan WIF; cero llaves permanentes y política organizacional de creación/upload de keys denegada.
6. El orden es identity → mínimo privilegio → impersonation → prueba positiva/negativa → retiro posterior de privilegio heredado.
7. R1B no retira aún ningún binding legacy.

## 2. Identidades por frontera

Los nombres exactos por environment están en `ENVIRONMENT_RESOURCE_NAMING_V1.md`. Cada fila se crea tres veces con los prefijos Preview, Staging y Production.

| Identity | Display name pattern | Purpose | Project-level roles máximos | Resource/SA/secret bindings | WIF/impersonators | Key policy | Audit y rollback |
|---|---|---|---|---|---|---|---|
| Intake runtime | `Aura <Env> Intake Runtime` | Intake, advisor lookup e idempotency | `roles/datastore.user`, `roles/logging.logWriter` | accessor sólo a idempotency e IP-salt; sin bucket/queue admin | Sólo Functions runtime service agent/deployer con `actAs` acotado | USER_MANAGED=0 | Data Access logs; volver a runtime previo específico bajo containment |
| Capability/session runtime | `Aura <Env> Session Runtime` | Capability exchange y session resolution | `roles/datastore.user`, `roles/logging.logWriter` | accessor sólo a HMAC | Igual que arriba | USER_MANAGED=0 | Revocar binding nuevo y restaurar identity previa segura |
| AI runtime | `Aura <Env> AI Runtime` | Conversation evaluation | `roles/datastore.user`, `roles/logging.logWriter`, `roles/monitoring.metricWriter` | accessor sólo a Gemini; provider quota resource-scoped | Igual que arriba | USER_MANAGED=0 | Switch AI OFF, quota 0, revocar secret binding |
| Completion runtime | `Aura <Env> Completion Runtime` | Exactly-once completion y enqueue | `roles/datastore.user`, `roles/logging.logWriter` | `roles/cloudtasks.enqueuer` sólo sobre queue del mismo environment | Igual que arriba | USER_MANAGED=0 | Switch OFF, queue pause, revert caller binding |
| Report writer | `Aura <Env> Report Writer` | Crear objeto y metadata de reporte | `roles/datastore.user`, `roles/logging.logWriter` | `roles/storage.objectCreator` sólo en bucket/prefix aprobado | Igual que arriba | USER_MANAGED=0 | Report switch OFF; revocar bucket binding |
| Storage signer | `Aura <Env> Storage Signer` | Leer metadata y firmar grants de cinco minutos | `roles/datastore.user`, `roles/logging.logWriter` | `roles/storage.objectViewer` en bucket; `roles/iam.serviceAccountTokenCreator` únicamente sobre sí misma si el mecanismo lo exige; signing config secret | Igual que arriba | USER_MANAGED=0 | Download switch OFF; revoke self-sign/token and secret access |
| Notification runtime | `Aura <Env> Notification Runtime` | Consumir task y llamar gateway | `roles/logging.logWriter`, `roles/monitoring.metricWriter` | accessor sólo notifications; egress/audience allowlist | Sólo Tasks caller del mismo environment puede invocar | USER_MANAGED=0 | Queue pause, gateway switch OFF, revoke invoker |
| Tasks caller | `Aura <Env> Tasks Caller` | OIDC identity de Cloud Tasks | Ningún rol general de proyecto | `roles/run.invoker` sólo sobre notification service del mismo environment | Cloud Tasks service agent/token minting estándar; no humanos | USER_MANAGED=0 | Pause queue y revocar invoker |
| Telemetry writer | `Aura <Env> Telemetry Writer` | Logs, sanitized metrics y aggregates | `roles/logging.logWriter`, `roles/monitoring.metricWriter`, `roles/datastore.user` | Write sólo a telemetry collections por contract; ningún secret | Runtimes aprobados la usan, no CI | USER_MANAGED=0 | Switch telemetry fallback/manual watch |
| Deployer | `Aura <Env> Deployer` | Deploy aprobado y config read-back | `roles/cloudfunctions.developer`, `roles/run.admin`, `roles/artifactregistry.writer`, `roles/serviceusage.serviceUsageConsumer` sólo donde se justifique | `roles/iam.serviceAccountUser` sólo sobre runtime SAs target; deploy de Rules/Storage/Tasks se separa por change role | GitHub WIF del mismo environment; approver gate obligatorio | USER_MANAGED=0 | Disable WIF provider/binding; freeze deploy; no restore de Owner/Editor |
| Monitoring reader | `Aura <Env> Monitoring Reader` | Read-only dashboards, logs y config | `roles/monitoring.viewer`, `roles/logging.viewer`, `roles/cloudasset.viewer` si se aprueba | Sin secrets ni writes | Readiness Auditor mediante WIF/read-only group | USER_MANAGED=0 | Revoke viewer binding |
| Incident responder | `Aura <Env> Incident Responder` | Triage read-only y solicitud de containment | Viewer roles por default | Cualquier write llega mediante elevación temporal aprobada | Incident Commander + Security Owner | USER_MANAGED=0 | Expiry/revoke; evidence preservation |
| Break-glass temporary role | `Aura <Env> Break Glass` | Recuperación excepcional | Custom role mínimo por scenario, nunca standing | Sólo recursos declarados en incident record | PAM/mecanismo aprobado, dos personas, expiry automático | No es una SA; cero keys | Audit immutable, post-incident revoke y R11 parcial |

`roles/datastore.user` es project-scoped porque Firestore no ofrece aislamiento IAM por collection; el aislamiento adicional proviene del proyecto por ambiente, contract server-owned, Rules para clientes y tests adversariales. Si una custom role reduce permisos sin romper el runtime, R3A debe preferirla.

## 3. Capas de bindings

| Capa | Bindings permitidos | Prohibiciones |
|---|---|---|
| Project | Roles runtime mínimos que no admiten scope menor; logging/monitoring | Owner, Editor, broad secret accessor, cross-environment principals |
| Resource | Queue enqueuer/invoker, Artifact Registry, Firestore database cuando soporte | Wildcards organizacionales |
| Service account | `actAs` sólo deployer→runtime; signer token creator sólo sobre sí misma | Token creator project-wide; personal serviceAccountUser standing |
| Secret | accessor consumer→secret exacto | Accessor sobre todos los secrets |
| Bucket | objectCreator/objectViewer sobre bucket exacto | storage.admin y ACL legacy |
| Queue/service | enqueuer sobre queue; invoker sobre notification service | tasks admin/runtime invoker project-wide |

## 4. Orden seguro de IAM

1. Crear identity sin roles ni keys.
2. Aplicar labels y key-denial policy.
3. Añadir un binding mínimo por recurso.
4. Configurar impersonation/WIF únicamente para el deployer del mismo environment.
5. Ejecutar pruebas positivas y negativas en Preview/Staging.
6. Cambiar workload sin tráfico y hacer read-back.
7. Validar que no necesita Editor/default compute.
8. Retirar un binding heredado por vez en R3B, nunca en R1B.

Stop: key user-managed, permiso wildcard, principal cross-environment, self-approval, inability to enumerate effective permissions o pérdida del último acceso recuperable.

## 5. Workload Identity Federation

| Elemento | Preview | Staging | Production |
|---|---|---|---|
| Pool | `aura-github-preview` | `aura-github-staging` | `aura-github-production` |
| Provider | `github-aura-preview` | `github-aura-staging` | `github-aura-production` |
| Repository condition | `attribute.repository == '<APPROVED_GITHUB_ORG>/AuraControlCenter'` | Igual | Igual |
| Ref/event condition | Pull request refs y GitHub environment `preview` | `refs/heads/main` + environment `staging` | Release tag aprobado + environment `production` |
| Deployer SA | `ai-prev-deployer` | `ai-stg-deployer` | `ai-production-deployer` |
| Approver gate | Branch policy | Deployment Approver | Deployment Approver + Security concurrence |
| Token lifetime target | 900 segundos | 900 segundos | 900 segundos |

Attribute mapping mínimo:

```text
google.subject=assertion.sub
attribute.repository=assertion.repository
attribute.ref=assertion.ref
attribute.environment=assertion.environment
attribute.actor_id=assertion.actor_id
```

Audience exacta se deriva de `<PROJECT_NUMBER>`, pool y provider aprobados. No se acepta audience wildcard. El subject de evidencia se sanitiza; no se guardan nombres personales.

Vercel no recibe credenciales GCP por defecto. El frontend consume únicamente configuración web pública del environment. Si una integración necesita workload federation, requiere un provider distinto, audience distinta y un decision record separado.

## 6. Secret access

| Secret purpose | Consumer principal |
|---|---|
| HMAC | Capability/session runtime |
| Idempotency | Intake runtime |
| IP hash salt | Intake runtime |
| Gemini | AI runtime |
| Notifications | Notification runtime |
| Signing | Storage signer runtime |
| App Check server config | Sólo runtime que valida server-side, tras contract R5 |

Deployer, monitoring reader, incident responder y telemetry writer no leen valores. Evidence captura secret name, version state, replication, labels y IAM principal lógico, nunca payload.

## 7. Auditoría

Se habilitan Admin Activity y Data Access requeridos para IAM, service-account token generation, Secret Manager, Storage y Tasks. Alertas enlazan impersonation anómala, key creation/upload, secret access fuera de consumer, IAM change y break-glass activation.

## 8. Rollback

Un IAM rollback revoca el binding nuevo y restaura sólo el binding específico anterior que ya se haya demostrado seguro. Nunca restaura Editor/Owner blanket, una llave permanente o client writes. Si el workload falla, permanece OFF y el environment no avanza.
