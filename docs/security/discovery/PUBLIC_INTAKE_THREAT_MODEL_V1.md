# Public Intake Threat Model v1

**Estado:** baseline propuesta; pendiente de aprobación de Producto y Seguridad

**Programa:** AI-02H1E.4.0 — Aura Intelligence Production Hardening

**Slice:** AI-02H1E.4.1

**Dictamen permitido:** **THREAT-MODEL BASELINE COMPLETE — PENDING PRODUCT AND SECURITY APPROVAL**

**Autorización de producción:** no concedida

## 1. Propósito

Establecer una línea base versionada para reducir abuso, escalamiento de autoridad, exposición de datos y amplificación de costo en el flujo público Discovery. Este documento convierte los hallazgos congelados de D.10P en amenazas, propietarios por rol, mitigaciones objetivo y evidencia verificable. No aprueba decisiones de producto ni configuración de producción.

## 2. Alcance

Incluye pre-intake, resolución de código comercial, emisión e intercambio de capabilities, resolución y cierre de sesión, redacción asistida por IA, generación/descarga de PDF y fan-out de notificaciones. Incluye las callables relacionadas `generateDiscoveryReport` y `requestExecutiveDocument`, el servicio interno de generación y la tarea interna de notificaciones.

## 3. Exclusiones

- No implementa rate limiting, TTL, schemas, tokens, kill switches o telemetría runtime.
- No cambia handlers, Firebase, App Check, Rules, Storage ni despliegues.
- No reabre D.10S salvo evidencia puntual necesaria para estas superficies.
- No certifica providers, cuotas, TTL, ambientes o configuración efectiva.
- No define obligaciones legales; las decisiones de compliance quedan pendientes.

## 4. Arquitectura del flujo

```text
Navegador público
  -> resolveAdvisorByCode
  -> createDiscoveryLead
  -> exchangeDiscoveryToken
  -> resolveDiscoverySession
  -> evaluateConversation (0..N)
  -> completeDiscoverySession (exactamente una vez, objetivo)
       -> ProspectResolutionEngine / Firestore
       -> emitDiscoveryCompletedNotification (Cloud Tasks, interno)
  -> generateDiscoveryReport
       -> DiscoveryReportGenerationService -> PDF -> Storage
  -> requestExecutiveDocument -> URL firmada -> descarga

Usuario CRM autenticado
  -> createDiscoveryLead / generateDiscoveryReport / requestExecutiveDocument
```

La aplicación y App Check delimitan una instancia de software, no una persona. La capability de sesión delimita el recurso público. La identidad Firebase y la resolución de principal delimitan el flujo CRM. Firestore, Storage, Gemini, Cloud Tasks y el gateway de notificaciones son boundaries separados.

## 5. Actores legítimos

| Actor | Necesidad legítima | Autoridad máxima esperada |
|---|---|---|
| Prospecto público | Iniciar y completar su propio diagnóstico; descargar su radiografía | Una sesión y su reporte externo mediante capability vigente |
| Asesor comercial | Crear enlaces y operar prospectos atribuidos | Recursos asignados; nunca autoridad tenant por input público |
| Dirección/administración de plataforma | Operación y soporte autorizados | Según principal server-resolved y política de rol |
| Servicios backend | Resolver, persistir, generar, notificar y auditar | Service account mínima; contratos internos cerrados |
| Producto, Seguridad, Plataforma/SRE, Privacidad/Compliance | Aprobar política y verificar controles | Gobierno; no acceso implícito a datos de prospectos |

## 6. Atacantes

- Automatización con un token App Check válido o una aplicación legítima instrumentada.
- Atacante distribuido que rota IP, App ID, email o código comercial.
- Poseedor no autorizado de link, one-time token, session token o URL firmada.
- Cliente manipulado que envía campos no documentados, estructuras profundas o PII hostil.
- Usuario autenticado que intenta cruzar prospecto, sesión, tenant u organización.
- Actor que busca amplificar costo de Gemini, PDF, Storage, egress o notificaciones.
- Falla accidental de configuración, rollout o limpieza con efecto equivalente a abuso.

## 7. Activos

- PII del prospecto, conversación, dossier y radiografía.
- Tokens/capabilities, hashes, códigos comerciales y atribución de asesor.
- IDs internos de prospecto, tenant, organización, sesión, eventos y reportes.
- Integridad de ownership, claims, membership, roles y scope tenant.
- Presupuesto Gemini, CPU/memoria de PDF, Storage, egress y Cloud Tasks.
- Disponibilidad del intake y reputación de correo/notificaciones.
- Evidencia de auditoría y configuración de seguridad.

## 8. Trust boundaries

| Boundary | Entrada no confiable | Salida/decisión server-owned |
|---|---|---|
| Navegador -> callable | Payload, headers, App ID, capabilities | Validación estricta, cuota, respuesta pública opaca |
| App Check -> identidad | Attestation de app | No concede identidad humana, rol, tenant ni ownership |
| Capability -> sesión | Token presentado | Hash, expiración, estado, scope y replay policy |
| Auth -> principal | Firebase Auth token | Rol, membership, advisor y tenant resueltos en backend |
| Handler -> Firestore | Datos validados | Campos server-owned, transacción e invariantes |
| Backend -> Gemini | Contexto limitado | Presupuesto, timeout, kill switch y salida validada |
| Backend -> PDF/Storage | Dossier y metadata | Tipo permitido, cuota, path server-owned y expiración |
| Completion -> Cloud Tasks/gateway | Evento interno | Destinatario acotado, idempotencia y fan-out máximo |
| Configuración -> runtime | Flags/cuotas/versiones | IAM, auditoría, validación, fail-closed y rollback |

## 9. Inventario canónico de superficies

`Pública` significa alcanzable desde el cliente; no significa anónima sin controles. Los propietarios son roles propuestos, no personas designadas.

| Superficie | Path / export | Caller | Auth / App Check / capability | PII y persistencia | Storage / downstream / costo | Control observado | Brecha congelada | Owner propuesto |
|---|---|---|---|---|---|---|---|---|
| Crear intake | `functions/src/discovery/createDiscoveryLead.ts` / `createDiscoveryLead` | `discoveryLinkService`, preform público y CRM | Auth opcional; App Check enforced; idempotency key | Nombre, email, teléfono, empresa, puesto, ubicación; `market_discovery_links`, `discovery_intake_idempotency`, advisor collections | Firestore; emite one-time token; costo bajo-medio | Envelope por longitud serializada, truncado parcial, consentimiento, idempotencia transaccional, límite por email/asesor | Límite no global/atómico; TTL no certificado; cardinalidad no acotada; schema/allowlist incompletos | Backend Discovery + Seguridad |
| Resolver código | `functions/src/advisors/resolveAdvisorByCode.ts` / `resolveAdvisorByCode` | Smoke page; el flujo principal aún contiene lectura cliente histórica | Sin Auth; App Check enforced; sin capability | Código y nombre público de asesor; `advisor_commercial_codes`, `platform_sales_advisors`, `platform_rate_limits` | Firestore; costo bajo | Respuesta inválida uniforme; contador transaccional por IP hash | Cobertura solo IP; App Check automatizable; cleanup/TTL y configuración no certificados | Backend Commercial + Seguridad |
| Intercambiar token | `functions/src/discovery/exchangeDiscoveryToken.ts` / `exchangeDiscoveryToken` | `discoveryLinkService` | Sin Auth; App Check comprobado; one-time token | Empresa/nombre; `market_discovery_links` | Firestore; emite session token | Transacción, hash, expiración y `usageCount == 0`; elimina hash previo | Sin cuota/kill switch; política de robo y replay incompleta; configuración efectiva no certificada | Backend Discovery + Seguridad |
| Resolver sesión | `functions/src/discovery/resolveDiscoverySession.ts` / `resolveDiscoverySession` | `discoveryLinkService` / `DiscoverPage` | Sin Auth; App Check comprobado; session token | Empresa, nombre, estado, trust decision; `market_discovery_links` | Firestore; costo bajo | Hash y expiración validados | Sin cuota/kill switch; respuesta y política de estados por cerrar | Backend Discovery |
| Evaluar conversación | `functions/src/intelligence/evaluateConversation.ts` / `evaluateConversation` | `AuraLLMGateway` | Sin Auth; App Check enforced; capability de sesión no exigida hoy | Conversación y dossier parcial; no persiste directamente | Gemini; costo variable/alto | Validación parcial, salida JSON schema, timeout 15 s, fallback | Sin vínculo a sesión, cuota, presupuesto, maxInstances ni kill switch | Backend Intelligence + Seguridad/FinOps |
| Completar sesión | `functions/src/discovery/completeDiscoverySession.ts` / `completeDiscoverySession` | `dossierBuilderService` / `DiscoverPage` | Sin Auth; App Check comprobado; session token | Conversación/dossier; `market_discovery_links`, `discovery_sessions`, `platform_leads`, `platform_events` | Prospect resolution, Cloud Tasks, shadow local gated; costo medio-alto | Hash del token, validación de completitud, transacción de writes | No valida expiración/estado exactamente una vez; payload abierto; campos de autoridad inyectables; expone `prospectId`/`resolutionStatus` | Backend Discovery + Seguridad |
| Generar reporte callable | `functions/src/discovery/reports/generateDiscoveryReport.ts` / `generateDiscoveryReport` | `DiscoverPage` | Auth server-resolved o capability; App Check comprobado | IDs de sesión/prospecto y dossier; `discovery_sessions`, `platform_leads`, `discovery_reports` | Servicio PDF y Storage; costo alto | Scope público cruza link/sesión/prospecto/tenant/org; público solo reporte externo | Sin cuota, presupuesto, maxInstances, kill switch o retención verificable | Backend Reports + Plataforma/SRE |
| Solicitar documento | `functions/src/discovery/reports/requestExecutiveDocument.ts` / `requestExecutiveDocument` | `DiscoverPage`, `ExecutiveBriefingDrawer` | Auth server-resolved o capability; App Check comprobado | Metadata/IDs; `discovery_reports`, sesiones, leads, settings, events | Puede regenerar PDF; URL firmada y egress; costo alto | Scope cruzado, tipos permitidos, URL 5–30 min | Sin cuota de generación/descarga; regeneración amplificable; retención no certificada | Backend Reports + Seguridad |
| Generar PDF interno | `functions/src/discovery/reports/DiscoveryReportGenerationService.ts` / clase | Solo handlers backend | No endpoint; hereda autorización del caller | Dossier, metadata, IDs; `discovery_reports`, `platform_events` | CPU/memoria, PDF, Storage | ID determinista y estado `GENERATING`/`READY`; tipo de reporte | Trabajo pesado fuera de transacción; sin lease/cuota/size bound/kill switch/cleanup | Backend Reports + Plataforma/SRE |
| Notification fan-out | `functions/src/notifications/emitDiscoveryCompletedNotification.ts` / task export | `completeDiscoverySession` vía Cloud Tasks | Interna; OIDC al gateway; no pública | Nombre, empresa, advisor UID, tenant; inbox/evento downstream | Cloud Tasks, gateway, inbox; costo/reputación | Allowlist de payload, tenant fijo, idempotency key | Fan-out/presupuesto/kill switch/retención y observabilidad de abuso insuficientes | Backend Notifications + Plataforma/SRE |

## 10. Registro de amenazas

Severidad combina impacto y explotabilidad antes de la mitigación objetivo.

| ID | Amenaza mínima preservada | Escenario | Severidad | Mitigación objetivo | Prueba | Riesgo residual esperado |
|---|---|---|---|---|---|---|
| TM-01 | Automation with valid App Check | Bot usa app legítima y supera controles humanos inexistentes | Alta | Cuotas atómicas multidimensionales; App Check solo como señal | CT-02, CT-04 | Bot lento bajo cuotas |
| TM-02 | Replay | Repite request aceptado o capability | Crítica | Idempotencia con TTL; nonce/estado; exactamente una vez | CT-10, CT-14, CT-15 | Reintento benigno controlado |
| TM-03 | Flooding | Volumen alto contra una callable | Alta | Límites por ventana, backpressure y cuota global | CT-02, CT-03 | Picos dentro del presupuesto |
| TM-04 | Distributed abuse | Rota IP/email/App ID | Crítica | Cuota global y correlación de señales con privacidad | CT-03, CT-05 | Ataque de baja tasa distribuido |
| TM-05 | Email enumeration | Diferencias revelan existencia/estado | Alta | Respuesta y latencia opacas; hashes en counters | CT-05 | Inferencia estadística limitada |
| TM-06 | Commercial-code enumeration | Explora códigos y asesores | Alta | Respuesta inválida uniforme, rate limits y bloqueo por hash | CT-06 | Nombre público de asesor válido aprobado por Producto |
| TM-07 | Payload amplification | Strings, arrays, profundidad o campos extra agotan recursos | Crítica | Bytes antes de parse/proceso, schema estricto, allowlist y límites recursivos | CT-07 | Costo máximo de payload válido |
| TM-08 | PII injection | Inserta PII/secrets o contenido hostil en dossier/logs | Alta | Schema, redacción, logging seguro y políticas de prompt | CT-08, CT-22 | PII legítima mínima persiste |
| TM-09 | Token theft | Link/token/URL se filtra | Crítica | Tokens cortos de vida, hash, scope, revocación y no logs | CT-09, CT-20 | Riesgo durante ventana vigente |
| TM-10 | Token replay | Reutiliza one-time/session token fuera de política | Crítica | Consumo transaccional; estado/expiración antes de mutar | CT-10, CT-11, CT-13 | Reads permitidos dentro de sesión vigente |
| TM-11 | Session duplication | Compleciones concurrentes crean dossiers/prospectos múltiples | Crítica | CAS/transacción sobre estado y completion ID determinista | CT-14, CT-15 | Recuperación administrativa auditada |
| TM-12 | AI cost amplification | Multiplica turnos/requests Gemini | Crítica | Capability vinculada, presupuesto por sesión/global, concurrency y kill switch | CT-18 | Degradación a fallback local |
| TM-13 | PDF/Storage amplification | Regenera PDFs o descargas y aumenta egress | Crítica | Cuota, lease/idempotencia, tamaño, retención y kill switch | CT-19, CT-20 | Descargas legítimas acotadas |
| TM-14 | Notification fan-out | Replays producen múltiples destinatarios/eventos | Alta | Un evento/recipient por completion, idempotencia y switch | CT-21 | Retry idempotente |
| TM-15 | Idempotency cardinality | Claves únicas llenan Firestore indefinidamente | Alta | Máximo activo por actor/global, TTL y cleanup verificable | CT-16, CT-17 | Ventana activa limitada |
| TM-16 | Retention growth | PII, tokens, PDFs, events o logs crecen sin borrado | Alta | Calendario aprobado, TTL/cleanup, métricas y evidencia de delete | CT-16, CT-22 | Holds aprobados por compliance |
| TM-17 | Configuration failure | Flag/cuota/provider/TTL ausente o inválido abre costo | Crítica | Schema/versionado, validación, fail-closed y verificación por ambiente | CT-22 | Error humano con rollback acotado |
| TM-18 | Tenant/organization authority injection | Cliente escribe scope o autoridad en el documento | Crítica | `tenantId`/`organizationId` server-owned; strip/reject; scope cross-check | CT-08, CT-12 | Ninguno aceptado por contrato |

## 11. Controles existentes observados

- App Check enforced o comprobado explícitamente en las callables inventariadas.
- Tokens opacos de 256 bits almacenados como SHA-256; intercambio transaccional de un solo uso.
- Validación de expiración en exchange, resolve y autorización de reporte.
- Idempotency key privada mediante HMAC y cierre de lead/idempotencia en una transacción.
- Scope de reporte público compara link, sesión, prospecto, tenant y organización.
- Roles CRM se resuelven en backend; Storage niega acceso directo por Rules.
- Gemini usa timeout y valida la salida; la tarea de notificación valida allowlist e idempotency key.

Estos controles son evidencia de implementación actual, no certificación de producción.

## 12. Brechas congeladas

1. Rate limiting público no atómico ni global para el flujo completo.
2. Idempotency records sin TTL verificable ni cardinalidad acotada.
3. Completion sin validación de expiración ni cierre exactamente una vez.
4. Payload de completion sin schema estricto, límites ni allowlist.
5. `tenantId` y `organizationId` pueden entrar desde el documento de sesión público.
6. Gemini sin cuota, presupuesto ni kill switch.
7. PDF/generación/descarga sin cuota.
8. Completion expone `prospectId` y `resolutionStatus`.
9. No hay kill switches backend por capability costosa.
10. Observabilidad, métricas y alertas de abuso insuficientes.
11. Retención y cleanup no verificables.
12. App Check, TTL, cuotas y ambientes efectivos no certificados.

## 13. Criterios de revisión

La baseline se revisa ante cambio de endpoint, caller público, provider App Check/IA/PDF/notificaciones, clasificación/retención, modelo de capability, configuración de cuota, incidente o cambio de trust boundary. También se revisa antes de P2, después de P8 y antes de reanudar D.10S.

## 14. Control de versión

| Versión | Estado | Cambio | Aprobación |
|---|---|---|---|
| v1.0-draft | Baseline propuesta | Inventario, amenazas, mitigaciones y pruebas de AI-02H1E.4.1 | Producto y Seguridad pendientes |

Cambios posteriores requieren nueva versión, vínculo a decision register, actualización del plan de certificación y aprobación por roles; editar silenciosamente una baseline aprobada queda prohibido.
