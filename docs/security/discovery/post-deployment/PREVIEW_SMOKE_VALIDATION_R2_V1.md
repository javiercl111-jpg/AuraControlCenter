# Preview Functional Smoke Validation Retry V1

## Dictamen

**PREVIEW SERVER-SIDE SMOKE VALIDATION CERTIFIED — READY FOR CLIENT PREVIEW REMEDIATION AND CONTROLLED HAPPY PATH**

- Change ID: `AI-02H1E.7-R2-PREVIEW-SMOKE-VALIDATION-20260805-01`
- Programa: `AI-02H1E.5.0`
- Fase: `AI-02H1E.7-R2`
- Target único: `aura-intel-preview` / `us-central1`
- Production: `REMEDIATION_HOLD` — **NOT AUTHORIZED**

## Continuidad y cierre del bloqueo anterior

El dictamen C de `AI-02H1E.7` registró `BLOCKED_NOT_REACHED`: Cloud Run IAM detenía cada request antes de Functions Framework. `AI-02H1E.8` corrigió exclusivamente esa frontera mediante cinco bindings `allUsers` / `roles/run.invoker` por servicio, sin binding de proyecto.

Este retry demuestra que `BLOCKED_NOT_REACHED` está cerrado:

- los cinco endpoints responden desde la frontera HTTP/Firebase;
- no hubo 401/403 de IAM;
- CORS, protocolo callable y App Check producen rechazos seguros;
- ninguna solicitud alcanzó un happy path ni produjo persistencia.

## Gate

| Control | Resultado |
|---|---|
| Rama | `audit/intelligence-preview-smoke-validation-r2` |
| HEAD | `1fac4c4ab65feab1cef957fc61ffb1286aea1657` |
| HEAD = `origin/main` | PASS |
| Worktree inicial | CLEAN |
| Firebase alias | `aura-intel-preview` |
| GCP project | `aura-intel-preview` |
| Node / npm | `v20.20.2` / `10.8.2` |
| Firebase CLI | `15.25.1` |
| Functions | 5/5 `ACTIVE`; 0 no activas |
| Cloud Run | 5/5 `READY` |

## Read-back de infraestructura

| Function | Revisión | Runtime identity | Timeout | Memoria | Secret binding |
|---|---|---|---:|---:|---|
| `createDiscoveryLead` | `creatediscoverylead-00001-yuv` | `preview-public-intake-runtime` | 60 s | 256 Mi | idempotency v3 |
| `exchangeDiscoveryToken` | `exchangediscoverytoken-00001-jaj` | `preview-discovery-session-rt` | 60 s | 256 Mi | ninguno |
| `resolveDiscoverySession` | `resolvediscoverysession-00001-nep` | `preview-discovery-session-rt` | 60 s | 256 Mi | ninguno |
| `evaluateConversation` | `evaluateconversation-00001-zuk` | `preview-conversation-runtime` | 15 s | 256 Mi | Gemini v2 |
| `completeDiscoverySession` | `completediscoverysession-00001-tav` | `preview-discovery-complete-rt` | 60 s | 256 Mi | HMAC v2 |

En las cinco Functions:

- runtime `nodejs20`;
- ingress `ALLOW_ALL`;
- min/max instances no fijados explícitamente (`null` en read-back);
- URI alojada en `a.run.app`;
- un único `allUsers:roles/run.invoker` por servicio;
- cero `roles/run.invoker` a nivel proyecto.

Parámetros comunes confirmados:

- `AURA_RUNTIME_ENVIRONMENT=PREVIEW`;
- `DISCOVERY_SHADOW_EVALUATION=false`;
- `DISCOVERY_PRIMARY_EVALUATION=false`;
- `EXECUTIVE_DISCOVERY_TIMEOUT_MS=10000`;
- `EXECUTIVE_DISCOVERY_ENDPOINT` vacío.

Artifact Registry conserva cleanup `DELETE`, `ANY`, 604800 segundos. Cloud Tasks permanece deshabilitado. Solo existen dos buckets administrados por Cloud Functions; no hay superficie Storage funcional.

App Check conserva el estado heredado `INHERITED_OFF_NOT_API_VERIFIED`; el read-back control-plane continúa restringido con 403 y no se cambió enforcement. La única Web App Preview y una key reCAPTCHA Enterprise fueron observadas por metadata; dominios permitidos: `localhost` y `preview-controlcenter.auranexus.io`. Debug tokens: 0. Independientemente del control-plane global, las cinco callable conservan `enforceAppCheck: true`, comprobado por HTTP 401 ante ausencia de attestation.

## Matriz live no mutante

Se ejecutaron 35 probes sintéticos: siete por handler.

| Caso | Resultado | Total |
|---|---|---:|
| OPTIONS desde dominio Preview | HTTP 204 | 5/5 |
| GET inválido | HTTP 400 / `INVALID_ARGUMENT` | 5/5 |
| POST sin body ni longitud | HTTP 411 / `LENGTH_REQUIRED` equivalente | 5/5 |
| Content-Type incorrecto | HTTP 400 / `INVALID_ARGUMENT` | 5/5 |
| JSON sin envelope callable | HTTP 400 / `INVALID_ARGUMENT` | 5/5 |
| Body vacío | HTTP 400 / `INVALID_ARGUMENT` | 5/5 |
| Envelope válido sin App Check | HTTP 401 / `UNAUTHENTICATED` | 5/5 |

Totales:

- 35/35 respuestas controladas;
- 0 errores de transporte;
- 0 denegaciones IAM;
- 0 respuestas de negocio;
- 0 mutaciones.

El HTTP 411 ocurre en el frontend HTTP para un POST sin `Content-Length`; no alcanza el callable, no expone datos y falla closed. Los otros cinco casos por handler sí prueban CORS, Functions Framework/Firebase callable o App Check.

## Validación por handler

### `createDiscoveryLead`

Protocolo y App Check rechazan antes de la lógica mutante. No se creó lead, idempotency record ni capability. Idempotencia/replay/payload/rate limit quedaron `VERIFIED_BY_CONTRACT` mediante suites locales. Persisten dos referencias a `controlcenter.auranexus.io` en el código de respuesta. No fueron ejecutadas por estos probes; son `BLOCKING_CLIENT_HAPPY_PATH`, no un bloqueo del smoke server-side.

### `exchangeDiscoveryToken`

Protocolo y App Check fallan closed. No se emitió token válido. Token ausente/malformado, replay e inexistencia sintética quedaron `VERIFIED_BY_CONTRACT` mediante capability/idempotency tests.

### `resolveDiscoverySession`

Protocolo y App Check fallan closed. No se resolvió sesión ni se expuso tenant. IDs, scope y cross-tenant quedaron `VERIFIED_BY_CONTRACT` mediante authority, Rules, payload y capability tests.

### `evaluateConversation`

Protocolo y App Check fallan closed. No se expuso Gemini, no se reservó budget y no hubo evaluación persistida. Shadow y primary permanecen `false`, endpoint remoto vacío y timeout contractual de 10000 ms; no se creó cliente ni llamada EIS.

### `completeDiscoverySession`

Protocolo y App Check fallan closed. No se expuso HMAC; no hubo completion, PDF, Storage, Task, reporte ni notificación. Completion replay y capacidades quedaron `VERIFIED_BY_CONTRACT`.

Firebase Auth no es una precondición obligatoria uniforme de estas cinco superficies: intake es público y las demás usan capabilities. Por ello bearer ausente/malformado no se presentó como evidencia independiente detrás de App Check; authority/capability se certificó por contrato sin crear identidades reales.

## Pruebas automatizadas

| Suite | Resultado |
|---|---:|
| Invocation boundary | 13/13 |
| Preview deployment unit | 22/22 |
| Parameter binding / shadow disabled | 15/15 |
| Runtime contracts | 18/18 |
| Preview trust / App Check client | 20/20 |
| Public intake / App Check seam | 33/33 |
| Firestore idempotency | 24/24 |
| Firestore rate limit | 17/17 |
| Discovery payload bounds | 34/34 |
| Capabilities / replay | 29/29 |
| Discovery shadow integration | 15/15 |
| Authority / tenant | 19/19 |
| Preview Rules | 14/14 |
| **Total** | **273/273** |

Las advertencias Vite sobre el futuro `configLoader: native` no afectaron resultados y se clasifican como deuda no bloqueante.

## No mutación

Antes y después de los probes, 13 colecciones relevantes permanecieron en cero: leads, sesiones, completions, capabilities, dos superficies de idempotencia, dos de telemetry/metrics, completion outbox, reportes, eventos y dos budgets.

Los buckets administrados conservaron exactamente 5 y 3 objetos. Cloud Tasks siguió deshabilitado. Por tanto, mutación observada atribuible: **NO**.

## Telemetría sanitizada

En 24 horas:

- cinco servicios y cinco revisiones observados;
- 102 request logs;
- latencia en 102/102;
- trace en 212 entradas e `insertId` en 287;
- 120 entradas stdout/stderr;
- App Check rejection observable;
- protocol rejection observable.

Los 16 HTTP 403 de la ventana de 24 horas son históricos, anteriores a la corrección AI-02H1E.8. En el intervalo R2 no hubo 403. El intervalo R2 produjo 29 request logs Cloud Run: los cinco HTTP 411 y un preflight quedaron en una capa anterior/no observada en request logging.

Escaneo de payloads de logging:

- 0 nombres/campos de persona;
- 0 correos, teléfonos, RFC o CURP;
- 0 raw payloads;
- 0 JWT, bearer o App Check tokens;
- 0 API keys, secretos o HMAC;
- 0 idempotency values completas;
- 0 URLs productivas ejecutadas.

El `trace`/`insertId` de plataforma está disponible; `correlationId` custom y `safeErrorCode` custom no fueron observados porque los rechazos ocurrieron antes del handler. Los códigos seguros sí fueron observados en las respuestas callable. Campos no observados se registran como `NOT OBSERVED`.

## Cliente Preview y dominios

Auditoría Vercel read-only:

- proyecto aislado `aura-control-center-preview` existente;
- dominio `preview-controlcenter.auranexus.io` READY;
- el dominio estable apunta al target interno Vercel `production` dentro del proyecto Preview aislado;
- cero variables en los targets Vercel `preview` y `production` de ese proyecto;
- ninguna variable `VITE_FIREBASE_*`;
- ninguna variable de site key App Check.

El source inicializa Firebase y reCAPTCHA Enterprise de forma fail-closed, pero el deployment publicado carece de configuración. Clasificación: `BLOCKING_CLIENT_HAPPY_PATH`. Esto no impide certificar los rechazos server-side, pero prohíbe el happy path end-to-end.

La especificación menciona `VITE_RECAPTCHA_SITE_KEY`; el contrato actual usa `VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY`. Ninguna existe remotamente. Debe resolverse en un slice de cliente/Vercel, sin reutilizar valores Production.

## Pendientes

- configurar Firebase/App Check exclusivamente en el proyecto Vercel Preview aislado;
- resolver el nombre contractual de la variable site key;
- corregir las dos referencias de dominio Production antes del happy path;
- realizar un happy path controlado con attestation válida en un change separado;
- mantener App Check control-plane enforcement OFF hasta autorización independiente.

No se modificó código, IAM, Secret Manager, Rules, App Check, Vercel, Storage, Tasks, Staging ni Production. No hubo deploy, happy path, commit, push ni PR.
