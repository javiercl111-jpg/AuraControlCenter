# Public Surface Contract v1

**Estado:** propuesta normativa pendiente de aprobación

**Aplica a:** superficies Discovery públicas y sus downstreams internos

**Autorización de producción:** no concedida

## 1. Lenguaje del contrato

`MUST`, `MUST NOT` y `SHOULD` expresan el contrato objetivo para los slices P2–P9; no describen necesariamente el runtime actual. Los límites numéricos se toman de `PUBLIC_INTAKE_LIMITS_V1.md` y siguen siendo propuestas hasta su aprobación.

App Check demuestra attestation de una instancia de aplicación. **No equivale a identidad humana, autenticación de usuario, membership, ownership, rol ni autoridad tenant.**

## 2. Invariantes globales

1. Ningún campo público MUST conceder rol, claim, membership, ownership de asesor o autoridad tenant.
2. `tenantId` y `organizationId` son server-owned. El backend MUST rechazarlos o eliminarlos de todo input público y resolverlos desde estado confiable.
3. `prospectId` y `resolutionStatus` MUST NOT exponerse en respuestas públicas.
4. Completion MUST ocurrir exactamente una vez por sesión; replays MUST devolver un resultado opaco estable sin repetir efectos.
5. La expiración, revocación, estado y scope de la capability MUST validarse antes de toda lectura sensible o mutación.
6. El backend MUST aplicar schema cerrado, allowlist, límite en bytes, profundidad, campos, arrays y strings antes de trabajo costoso.
7. Tokens, PII cruda, URLs firmadas e IDs internos MUST NOT aparecer en logs.
8. Las operaciones costosas MUST tener cuota, presupuesto, concurrency, timeout, kill switch y telemetría.
9. Errores públicos MUST ser opacos, estables y no permitir enumeración; detalles internos solo en telemetría redactada.
10. Una respuesta o contador cacheado MUST respetar igualmente revocación, expiración y policy version vigente.

## 3. Matriz de exposición y credenciales

`Intencional propuesta` requiere la decisión DR-001; hasta entonces no representa aprobación.

| Superficie | Exposición objetivo | Credencial mínima | App Check | Capability / identidad requerida | Operaciones permitidas | Operaciones prohibidas |
|---|---|---|---|---|---|---|
| `createDiscoveryLead` | Intencional propuesta | App Check + idempotency key; Auth opcional solo para CRM | MUST | Ninguna para público; principal server-resolved para atribución CRM | Crear un único link con PII/consentimientos permitidos | Elegir tenant/org/rol/owner; crear recursos ilimitados; reusar key con payload distinto |
| `resolveAdvisorByCode` | Intencional propuesta | App Check | MUST | Ninguna | Validar un código normalizado y devolver contexto público mínimo | Enumerar, listar, revelar IDs/estado interno/contacto del asesor |
| `exchangeDiscoveryToken` | Intencional propuesta | App Check + one-time token | MUST | One-time capability scoped a `linkId` | Consumir una vez y emitir session capability | Reemitir tras consumo/expiración; cambiar scope |
| `resolveDiscoverySession` | Intencional propuesta | App Check + session token | MUST | Session capability scoped a `linkId` | Leer contexto público mínimo de su sesión vigente | Leer PII adicional, IDs internos u otra sesión |
| `evaluateConversation` | Intencional propuesta, solo dentro de sesión | App Check + session token | MUST | Session capability vigente y budget handle server-owned | Proponer el siguiente turno limitado | Invocar sin sesión, definir modelo/prompt/presupuesto, persistir autoridad |
| `completeDiscoverySession` | Intencional propuesta, terminal | App Check + session token | MUST | Session capability vigente, estado `ACTIVE` | Completar una vez el dossier permitido | Completar expirado/cerrado; elegir IDs, tenant/org, prospecto, advisor o campos server-owned |
| `generateDiscoveryReport` | Intencional propuesta para externo; autenticada para interno | App Check + session token, o Auth | MUST | Capability scoped y sesión completada; o principal server-resolved | Generar radiografía externa propia; roles autorizados pueden generar interno | Público genera briefing interno, fuerza regeneración o cruza scope |
| `requestExecutiveDocument` | Intencional propuesta para externo; autenticada para CRM | App Check + session token, o Auth | MUST | Capability scoped y sesión completada; o principal server-resolved | Obtener URL firmada corta para tipo permitido | Descargar otra sesión/prospecto; público fuerza regeneración; URL sin expiración |
| `DiscoveryReportGenerationService` | Interna | Identidad de servicio/call stack autorizado | N/A | Contexto de autorización ya validado + lease server-owned | Generar una versión/idempotency key aprobada | Invocación cliente, path/tipo/force controlado por público |
| Notification fan-out | Interna | Cloud Tasks/OIDC/IAM | N/A | Evento de completion server-owned | Un evento a un destinatario aprobado | URL pública, destinatarios arbitrarios, fan-out > límite, payload extra |

## 4. Contrato de campos y respuesta

| Superficie | Campos públicos permitidos | Campos server-owned | Respuesta pública permitida |
|---|---|---|---|
| Create | Empresa, nombre, email, teléfono, puesto, ubicación, rango, código comercial, origen allowlisted, consentimientos/version, idempotency key | Link ID, hashes, timestamps, expiración, usage, trust, advisor IDs/UIDs, tenant/org, attribution, audit | Estado opaco, próxima acción, link/capability necesarios, nombre público de asesor aprobado; nunca authority IDs |
| Advisor code | Código comercial | Advisor ID/UID, status detallado, counters y hashes | `VALID`/`INVALID`, mensaje uniforme; display name solo si DR-002 lo aprueba |
| Token exchange | `linkId`, one-time token | Hashes, expiry, usage, revocation, policy version | Session token, contexto público mínimo y decisión de entrega no sensible |
| Session resolve | `linkId`, session token | Hashes, tenant/org, advisor/prospect IDs | Empresa, nombre, estado público normalizado; no IDs internos |
| Conversation AI | Respuesta actual y contexto conversacional schema-limited | Session/budget ID, prompt/model/version, policy, telemetry | Pregunta siguiente o fallback seguro; telemetría pública sin costos/IDs internos |
| Completion | `linkId`, session token y dossier cerrado | Dossier/session ID, prospect resolution, tenant/org, advisor/owner, timestamps, trust, events | `status`, receipt opaco y disponibilidad de reporte; no `prospectId` ni `resolutionStatus` |
| Report generation | Session/report request allowlisted | `prospectId`, path, folio, version, metadata, lease y tipo efectivo | Estado opaco, receipt/report handle público; no Storage path |
| Document request | Report handle, link/session capability | Prospect/session mapping, Storage path, audit | Estado, URL firmada corta, expiración, retry hint acotado |
| Fan-out | Ninguno | Recipient UID, tenant, event ID, idempotency key, correlation | Ninguna al público; resultado interno agregado |

Campos desconocidos MUST producir `invalid-argument` antes de persistencia o downstream. Campos server-owned presentes en input MUST producir rechazo explícito de seguridad, no merge silencioso.

## 5. Lifecycle, replay e idempotencia

| Superficie | Idempotencia | Expiración | Replay policy |
|---|---|---|---|
| Create | Key HMAC + hash canónico de request; una key activa por intento | Record y link con TTL/cleanup verificados | Mismo key/payload devuelve resultado estable; key/payload distinto falla; no reabre link consumido |
| Advisor code | No crea negocio; contador por intento | Counters expiran por ventana | Repetición consume cuota y conserva respuesta opaca |
| Exchange | CAS `pending + unused + unexpired` | Obligatoria antes del update | Primera gana; siguientes fallan opacamente sin token nuevo |
| Resolve | Read idempotente | Obligatoria en cada read | Permitido bajo cuota mientras capability esté vigente/no revocada |
| AI | `sessionId + turnId` server-validated | Sesión y budget vigentes | Mismo turn no factura dos veces; respuesta cacheada segura o fallback |
| Completion | Completion ID determinista/CAS sobre estado | Obligatoria antes de cualquier write | Exactamente una vez; mismo replay devuelve receipt opaco; payload distinto es conflicto |
| Report generation | `session + type + version`; lease único | Sesión vigente para público; lease expira recuperablemente | Replays leen estado/artefacto; no regeneran salvo operación administrativa autorizada |
| Download | No crea PDF si READY; cada URL auditada | Capability y URL firmada vigentes | Repetición consume cuota de descarga; URL expirada no se renueva fuera de policy |
| Notification | `discovery.completed:<session>` | Record de dedupe con retención aprobada | Replays no crean más inbox/eventos ni amplían destinatarios |

## 6. Errores públicos

- Categorías permitidas: `INVALID_REQUEST`, `NOT_AVAILABLE`, `RATE_LIMITED`, `SESSION_NOT_AVAILABLE`, `PROCESSING`, `INTERNAL_RETRYABLE`.
- Código inexistente, inactivo o mal formado SHOULD compartir respuesta, forma y latencia objetivo.
- Token inexistente, inválido, expirado, revocado o de otro scope SHOULD colapsar a `SESSION_NOT_AVAILABLE`, excepto donde el cliente necesite distinguir `PROCESSING` sin revelar estado sensible.
- Mensajes MUST NOT incluir IDs internos, existencia de email/prospecto, stack, provider, colección, Storage path o valor de configuración.
- Logs internos MUST usar safe error code, correlation ID no derivado de PII y dimensiones allowlisted.

## 7. Cuotas, kill switches y observabilidad

Cada superficie pública MUST aplicar, antes de trabajo costoso, los límites aprobados por IP hash, App ID, email hash/código cuando corresponda, sesión y global. Los contadores MUST ser atómicos o usar un servicio con semántica equivalente y cardinalidad acotada.

| Superficie | Kill switch mínimo | Señales obligatorias |
|---|---|---|
| Create | `publicIntakeEnabled`, blocked App/code, `emergencyGlobalQuota` | allow/deny, dimensión de cuota, latencia, payload bucket, policy version |
| Advisor code | `advisorCodeResolutionEnabled`, blocked App/code | valid/invalid agregado, limit reason, App Check result |
| Exchange | `tokenIssuanceEnabled`, blocked App | exchange/replay/expired agregado; nunca token/hash |
| Resolve | `sessionResolutionEnabled`, blocked App | resolve/invalid/expired agregado |
| AI | `conversationAiEnabled`, emergency quota | calls avoided/made, budget, fallback, latency, provider safe code |
| Completion | `sessionCompletionEnabled`, blocked App | completion winner/replay/conflict, effects count |
| Report/PDF | `externalReportGenerationEnabled` | lease/reuse/generation, bytes bucket, duration, error safe code |
| Download | `documentDownloadEnabled` | URLs issued, quota deny, expiry bucket; nunca URL |
| Notification | `notificationFanoutEnabled` | dedupe, recipients count, enqueue/delivery outcome |

## 8. Retención

La retención MUST seguir `PUBLIC_DATA_CLASSIFICATION_V1.md`, ser enforceable por TTL/cleanup, exponer métricas de backlog y producir evidencia de borrado. Ausencia, invalidez o desalineación de configuración MUST cerrar funciones costosas y bloquear nuevas mutaciones públicas según `PUBLIC_CONTAINMENT_POLICY_V1.md`.

## 9. Criterio de aceptación del contrato

El contrato solo puede marcarse aprobado cuando Producto y Seguridad resuelvan el decision register, cada requisito tenga prueba en emuladores, los providers/configuraciones de P9 estén certificados, no haya PII/tokens en logs y D.9 Authority permanezca verde. Hasta entonces es una baseline objetivo, no una garantía runtime.
