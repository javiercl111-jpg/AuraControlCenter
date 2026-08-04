# Non-Production IAM, WIF and Secrets Baseline v1

**Slice:** AI-02H1E.5.R2A

**Estado:** diseño; no se creó identity, binding, key, pool, provider, secret o versión

## 1. Principios

1. Preview y Staging no comparten principals, secrets ni impersonators.
2. Cero `USER_MANAGED` keys; creación/upload de keys debe estar denegada por policy.
3. Ningún runtime usa default compute, `Owner`, `Editor` o credencial personal.
4. Firestore usa el rol mínimo viable a nivel proyecto; el aislamiento por colección se refuerza con proyectos separados, Rules y contratos server-owned.
5. `secretAccessor`, queue, bucket, invoker, signer y `actAs` se asignan al recurso/SA exacto.
6. No existe una service account genérica “secret accessor”: cada consumer runtime recibe acceso sólo a su secret.
7. Deployer y approver son roles distintos; deployer no puede leer valores secretos.

## 2. Identidades dedicadas

| Purpose | Preview SA | Staging SA | Roles máximos / bindings exactos | Impersonator |
|---|---|---|---|---|
| Intake runtime | `ai-prev-fn-intake` | `ai-stg-fn-intake` | Firestore runtime mínimo, log writer; accessor idempotency + IP salt | Deployer mismo ambiente sólo `actAs` |
| Capability/session runtime | `ai-prev-fn-session` | `ai-stg-fn-session` | Firestore runtime mínimo, log writer; accessor HMAC | Deployer mismo ambiente |
| AI runtime | `ai-prev-fn-ai` | `ai-stg-fn-ai` | Firestore mínimo, log/metric writer; accessor Gemini | Deployer mismo ambiente |
| Completion runtime | `ai-prev-fn-complete` | `ai-stg-fn-complete` | Firestore/log; enqueuer sólo queue exacta | Deployer mismo ambiente |
| Report writer | `ai-prev-fn-report` | `ai-stg-fn-report` | Firestore/log; objectCreator sólo bucket exacto | Deployer mismo ambiente |
| Storage signer | `ai-prev-fn-signer` | `ai-stg-fn-signer` | Firestore/log; objectViewer bucket; token creator sólo sobre sí misma si se demuestra necesario; accessor signing | Deployer mismo ambiente |
| Notification runtime | `ai-prev-fn-notify` | `ai-stg-fn-notify` | Log/metric writer; accessor notifications; invocación sólo Tasks caller | Deployer mismo ambiente |
| Tasks caller | `ai-prev-tasks-caller` | `ai-stg-tasks-caller` | Sin rol general; invoker sólo notification service exacto | Cloud Tasks service agent estándar |
| Telemetry writer | `ai-prev-telemetry` | `ai-stg-telemetry` | Log/metric writer + Firestore mínimo; cero secrets | Runtimes allowlisted, no CI |
| Deployer | `ai-prev-deployer` | `ai-stg-deployer` | Developer roles aprobados; `serviceAccountUser` sólo runtime targets; sin secret access | GitHub WIF mismo ambiente |
| Monitoring reader | `ai-prev-monitor` | `ai-stg-monitor` | Monitoring/logging viewer; cloud asset viewer sólo si se aprueba | Auditor federation/read-only group |
| Incident responder | `ai-prev-incident` | `ai-stg-incident` | Read-only por defecto; cualquier write vía elevación temporal | PAM/two-person gate |

La cuenta automática `firebase-adminsdk-fbsvc` se inventariará y revisará por effective permissions. No se elimina ni reutiliza como runtime dedicado sin una decisión separada.

## 3. Binding layers

| Scope | Permitido | Prohibido |
|---|---|---|
| Project | Firestore runtime mínimo donde no existe scope menor; logging/monitoring | Owner, Editor, broad Secret Accessor, cross-env principal |
| Service account | Deployer → runtime `actAs`; signer → self token creator sólo si se requiere | Personal standing `serviceAccountUser`; token creator project-wide |
| Secret | Consumer exacto → secret exacto | Accessor a todos los secrets, deployer/monitor/auditor con valor access |
| Queue/service | Completion → enqueuer queue exacta; Tasks caller → notification invoker | tasks admin o run invoker project-wide |
| Bucket | Report writer objectCreator; signer objectViewer | storage.admin, public principals, legacy ACL |
| Monitoring | Telemetry writer write; monitor reader view | IAM/config writes por reader |

Antes de usar `roles/datastore.user`, R3A debe evaluar una custom role con los permisos efectivos del runtime. Si la custom role no es viable, la excepción de scope project-level requiere aprobación Security y pruebas negativas.

## 4. Orden seguro de IAM

1. Capturar policy/effective permissions/key inventory pre-state.
2. Crear SA sin roles ni keys y aplicar labels/key-denial.
3. Añadir un binding mínimo por vez en el scope más estrecho.
4. Añadir secret/resource bindings exactos.
5. Configurar WIF y `actAs` sólo para deployer mismo ambiente.
6. Ejecutar positive/negative permission tests sin tráfico.
7. Asignar un workload Preview y leer metadata efectiva.
8. Confirmar cero dependencia de default compute/Editor.
9. Repetir Staging después de evidencia Preview.
10. Retirar un binding heredado por vez; nunca quitar el último acceso recuperable.

El retiro de Owner personal, Editor heredado y default compute es una wave R3B separada. El rollback restaura sólo un binding previo específico ya demostrado seguro, nunca un rol blanket.

## 5. WIF Preview y Staging

| Elemento | Preview | Staging |
|---|---|---|
| Pool | `aura-github-preview` | `aura-github-staging` |
| Provider | `github-aura-preview` | `github-aura-staging` |
| Deployer SA | `ai-prev-deployer` | `ai-stg-deployer` |
| Repository | `<APPROVED_GITHUB_ORG>/AuraControlCenter` exacto | Igual |
| Ref/environment | PR/ref allowlisted + environment `preview` | `refs/heads/main` + environment `staging` |
| Token lifetime | 900 s máximo | 900 s máximo |
| Approval | Branch policy + Change ID | Deployment Approver + evidencia Preview |

Attribute mapping mínimo:

```text
google.subject=assertion.sub
attribute.repository=assertion.repository
attribute.ref=assertion.ref
attribute.environment=assertion.environment
attribute.actor_id=assertion.actor_id
```

La condition combina repository, ref y environment con AND; audience es exacta. Wildcards, fork repositories, reusable workflow no allowlisted, missing environment o subject no esperado causan deny. Evidencia guarda hashes/role codes, no nombres personales.

Rollback WIF: deshabilitar provider, revocar `workloadIdentityUser` y `actAs`, verificar token exchange denied y congelar deploy. No se entrega key como fallback.

## 6. Secrets por ambiente

| Purpose | Preview | Staging | Consumer | Rotation contract |
|---|---|---|---|---|
| Capability HMAC | `aura-preview-hmac-v1` | `aura-staging-hmac-v1` | Session runtime | 90 d; overlap ≥ máximo capability TTL + skew; retirar previa tras negative replay tests |
| Idempotency | `aura-preview-idempotency-v1` | `aura-staging-idempotency-v1` | Intake runtime | 90 d; dual-version ≥ 7 d para no romper replay COMPLETED |
| IP hash salt | `aura-preview-ip-hash-salt-v1` | `aura-staging-ip-hash-salt-v1` | Intake runtime | 90 d; nueva policy/key version y ventana anterior expirada |
| Gemini | `aura-preview-gemini-v1` | `aura-staging-gemini-v1` | AI runtime | ≤90 d o incidente/provider; smoke antes de revocar anterior |
| Notifications | `aura-preview-notifications-v1` | `aura-staging-notifications-v1` | Notification runtime | ≤90 d; queue pausada durante cutover; provider credential previa revocada |
| Signing | `aura-preview-signing-v1` | `aura-staging-signing-v1` | Signer runtime | ≤90 d; downloads OFF, verify 5-minute grants, then revoke prior |
| App Check server config | `aura-preview-app-check-v1` | `aura-staging-app-check-v1` | Sólo runtime server-side aprobado | 180 d o provider change; metadata/config, nunca debug tokens compartidos |

Replication target es automatic en el proyecto del ambiente. Cada secret tiene owner role, labels, versión habilitada única salvo overlap aprobado, accessor exacto y auditoría Data Access. Values nunca aparecen en Git, logs, CLI arguments, evidence o outputs sanitizados.

Los nombres legacy de código (`IDEMPOTENCY_SECRET`, `IP_HASH_SALT`, `GEMINI_API_KEY`) requieren un mapping de deploy por ambiente. `IDEMPOTENCY_SECRET` actualmente sirve tanto intake como capability; la implementación debe separar HMAC y idempotency antes de conceder acceso por trust boundary.

## 7. Pruebas mínimas

- cada runtime puede ejecutar sólo su path positivo;
- runtime Preview no puede acceder a recurso Staging y viceversa;
- deployer puede `actAs` sólo las runtime SAs aprobadas y no leer secrets;
- monitor/incident responder no escriben ni acceden a valores;
- Tasks caller sólo invoca notification service exacto;
- report writer no lee objetos; signer no crea objetos;
- telemetry writer no lee secrets ni authority fuera de contrato;
- WIF token falla con repository/ref/environment/audience alterados;
- key inventory muestra `USER_MANAGED=0` para todas las SAs;
- default compute y automática Firebase no son runtime de las Functions objetivo.

## 8. Stop conditions y decisiones

Detener ante principal wildcard/cross-env, key, Owner/Editor, secret global, self-approval, token lifetime mayor, inability to enumerate effective permissions, custom-role decision abierta o riesgo de lockout. Antes de R3A deben aprobarse repository owner exacto, owners/approvers nominales, custom roles y break-glass/PAM.

## 9. Evidencia y rollback

Repositorio conserva sólo IDs lógicos, roles, scopes, condition/audience hashes, key count, secret version state/count y read-back normalizado. Raw policies quedan restringidas. Rollback deshabilita consumer/version/provider/binding exacto, mantiene workload y tráfico OFF y preserva logs; nunca restaura credencial personal o blanket role.
