# DISC-INT-02.1 — Shadow debug y hardening mínimo

## Evidencia observada y alcance de la investigación

La prueba reportó que Discovery terminó, conservó el flujo legacy y generó la Radiografía, mientras la consola del navegador mostró `[SHADOW] LLM Fallback Used. No comparison made.`. También mostró identidad incorrecta en portada, un score 50, `Hallazgo 1`/`Hallazgo 2` y menos preguntas de las esperadas.

La investigación distingue dos mecanismos llamados “shadow” que no comparten endpoint ni contrato:

1. El mensaje observado pertenece al shadow conversacional del frontend (`ConversationOrchestrator` → `AuraLLMGateway` → callable `evaluateConversation`).
2. DISC-INT-02 agregó después del cierre el shadow EIS del backend (`completeDiscoverySession` → Executive Intelligence Adapter → Aura Intelligence).

El texto observado no prueba que el adapter EIS haya sido invocado ni identifica su resultado. No se modificó el frontend porque queda fuera del alcance autorizado de este sprint.

## Respuestas exactas sobre “LLM Fallback Used”

1. La condición inmediata fue `llmResult.fallbackUsed === true` en `src/modules/intelligence/engine/services/ConversationOrchestrator.ts:201-203`.
2. No demuestra falta de `EXECUTIVE_DISCOVERY_ENDPOINT`; usa la callable `evaluateConversation`, no el endpoint EIS.
3. No fue shadow conversacional deshabilitado: la evaluación solo se lanza cuando `llmModeForSession !== "HEURISTIC_ONLY"`.
4. No pasó por `DevelopmentExecutiveDiscoveryRequestSigner`.
5. No se puede concluir 401/403. El gateway agrupa errores de callable en códigos seguros.
6. Timeout es una causa posible cuando vence el límite local de 12 segundos (`AuraLLMGateway.ts:8-17`), pero el mensaje fijo no permite demostrarlo.
7. El mensaje no identifica respuesta inválida; el gateway no valida un contrato EIS.
8. Una callable ausente/no disponible es posible, pero no demostrable con el texto conservado.
9. Sí: fue una ruta conversacional legacy distinta al adapter EIS.
10. El código seguro se pierde al entrar a `compareAndLogShadowEvaluation`: el gateway devuelve `safeErrorCode` (`AuraLLMGateway.ts:23-38`), pero el orchestrator registra solo el texto fijo (`ConversationOrchestrator.ts:200-203`).

No se atribuye una causa HTTP concreta sin logs o registros de ejecución. La CLI de Firebase no estaba instalada y el repositorio no contiene estado remoto de Preview/Production.

## Flujo EIS real

| Paso | Archivo / función | Entrada | Salida | Configuración | Falla/fallback y observabilidad previa |
|---|---|---|---|---|---|
| Cierre legacy | `completeDiscoverySession.ts` / `completeDiscoverySession` | link, token y dossier del caller | sesión y `legacyDiagnosis` persistidos | App Check, Firestore y secret declarado | Una falla shadow ocurre después de la transacción y no revierte el cierre legacy. |
| Orquestación shadow | `DiscoveryShadowEvaluation.ts` / `runDiscoveryShadowEvaluation` | contexto minimizado, flags, correlación, adapter | outcome y registro shadow | `DISCOVERY_SHADOW_EVALUATION` | Antes solo distinguía `SUCCEEDED/FAILED/SKIPPED`; errores no tipados acababan en `SHADOW_EVALUATION_FAILED`. |
| Adaptación | `DefaultExecutiveDiscoveryAdapter.ts` / `evaluate` | `ExecutiveDiscoveryEvaluationInput` | `ExecutiveDiagnosis` válido | schema/capability 1.0 | Traduce 401, 403, 422, 429/5xx y valida diagnóstico. |
| Cliente HTTP | `HttpExecutiveDiscoveryApiClient.ts` / `evaluate` | request serializado | envelope HTTP | endpoint, timeout, signer | Captura signing, timeout, aborto, red y respuesta inválida sin bodies ni tokens. |
| Signer | `DevelopmentExecutiveDiscoveryRequestSigner.ts` / `sign` | request | Bearer server-side | `EXECUTIVE_DISCOVERY_SERVICE_TOKEN` | Token vacío lanzaba `Error` antes de poder distinguir autenticación. |
| Endpoint Aura Intelligence | fuera de este repositorio | request HTTP | envelope API | Development Verifier y grants remotos | No se inspeccionó ni modificó el repo de Aura Intelligence. |
| Validación | `validation.ts` y adapter | envelope/diagnóstico | diagnóstico aceptado o error seguro | contratos 1.0 | Respuesta/diagnóstico inválidos se rechazan. |
| Comparación | `DiscoveryDiagnosisComparison.ts` / `compareDiscoveryDiagnoses` | legacy + EIS válido | comparación de siete dimensiones | ninguna adicional | Solo se invoca después de obtener un EIS válido. |
| Persistencia | callback de `completeDiscoverySession` | registro shadow | update de la sesión | Firestore | Una falla se contiene; previamente no quedaba un `persisted` explícito. |

## Causa raíz por problema

### A. Shadow fallback y ausencia de comparación

El mensaje reportado fue causado por el fallback del shadow conversacional, no por DISC-INT-02. El gateway convierte cualquier excepción de `evaluateConversation` en `{ fallbackUsed: true, safeErrorCode }`; el orchestrator descarta el código y omite la comparación.

En el shadow EIS existía además una debilidad independiente: `shadowEvaluation` tenía default `true`, pero `EXECUTIVE_DISCOVERY_ENDPOINT` tenía default vacío. El adapter configurado construía primero el signer y luego el cliente; token ausente o endpoint vacío producían errores genéricos que `safeErrorCode()` reducía a `SHADOW_EVALUATION_FAILED`. Por eso un registro previo con ese código no permite distinguir endpoint, secret, 401/403, timeout, API ausente o respuesta inválida.

La comparación EIS no se ejecuta cuando no hay diagnóstico válido. Esto es deliberado; inventar una comparación sería incorrecto.

### B. Personalización de la Radiografía

En el commit base, `DiscoveryReportGenerationService.ts:114-124` tomaba `companyName` y `contactName` de `platform_leads`, un prospecto potencialmente fusionado con sesiones anteriores, no de `discovery_sessions/{sessionId}`. Además leía `sessionData.smartBusinessDossier`, pero `completeDiscoverySession` persiste el objeto como `dossier`. El resultado quedaba vacío y activaba fallbacks genéricos.

La fuente canónica queda así:

- empresa: `market_discovery_links` de la sesión al cerrar; luego `discovery_sessions/{sessionId}.companyName` al generar;
- destinatario: `market_discovery_links` de la sesión; luego `discovery_sessions/{sessionId}.contactName`;
- asesor: `advisorId` independiente; nunca sustituye `contactName`;
- session/dossier ID: `dossier_{linkId}_{timestamp}`;
- report ID: `{sessionId}_{reportType}_v{documentVersion}`;
- prospect ID: vínculo CRM, no fuente de identidad para portada.

### C. Contenido genérico

El score 50 y `Hallazgo 1`/`Hallazgo 2` eran literales de fallback en `DiscoveryReportGenerationService`. Se activaban sistemáticamente por la clave incorrecta `smartBusinessDossier`. El score legacy real vive en `businessAssessmentDraft.score`; hallazgos/riesgos viven en `executiveBriefingDraft` y `businessAssessmentDraft`.

### D. Cierre prematuro

El motor conversacional contiene cinco preguntas predefinidas (`ConversationEngine.ts:121-147`) y cierra con cinco respuestas útiles, ocho turnos, o confianza ≥85 con cuatro respuestas (`ConversationEngine.ts:84-100`). También cierra al agotar preguntas. `ReflectionEngine.ts:210-218` puede pasar a resumen al acumular cinco actualizaciones de dimensión; después de la confirmación, el orchestrator marca la sesión completa. Ninguna de esas rutas comprobaba actividad, necesidad, objetivo, contexto organizacional, contacto y consentimientos antes de llamar al backend.

EIS shadow se ejecuta después de persistir la sesión, por lo que no pudo reducir preguntas ni cerrar la conversación.

No existe en el repositorio ni en la evidencia adjunta el historial de la sesión observada, por lo que no es posible afirmar el número exacto de preguntas de esa ejecución. El código permite un máximo nominal de cinco preguntas de negocio y puede resumir antes si alcanza el umbral de evidencia.

## Configuración efectiva encontrada

| Elemento | Default en código después del hardening | Repositorio | Preview / Production |
|---|---:|---|---|
| `shadowEvaluation` | `false` | no aparece en `.env` ni `.env.example` | valor remoto no disponible; requiere activación explícita |
| `primaryEvaluation` | `false`, forzado en el resolver | no configurable a `true` efectivamente | permanece `false` |
| EIS endpoint | cadena vacía | no hay endpoint versionado | no verificable; con valor ausente no puede alcanzar Aura Intelligence |
| timeout | 10 000 ms | default de Functions | override remoto no verificable |
| signer | Development Bearer | único signer conectado | no válido para producción |
| environment | proyecto Firebase `aura-control-center-debb3` | `.firebaserc` | alias separado Preview/Production no presente |
| audience / issuer / subject | no aplican al signer de desarrollo | ausentes | no aprovisionados en este repo |
| tenant / organization / company grants | no se configuran aquí | IDs salen del link/prospect con fallbacks controlados | grants remotos no verificables |
| Development Verifier | contrato documentado, implementación externa | no presente | estado remoto no verificable |

La configuración frontend solo contiene claves públicas `VITE_FIREBASE_*`; no contiene endpoint ni credencial EIS. No se leyeron ni registraron secretos.

## Correcciones implementadas

### Observabilidad shadow EIS

- default shadow cambiado a `false`; primary continúa forzado a `false`;
- endpoint ausente se clasifica antes de invocar el adapter;
- autenticación server-side ausente usa error tipado;
- persistencia y logs incluyen `safeErrorCode`, `correlationId`, `adapterStage`, HTTP status cuando existe, duración, `endpointConfigured`, `authenticationMode`, `comparisonStatus` y `persisted`;
- estados de comparación: `NOT_REQUESTED`, `SKIPPED_DISABLED`, `FAILED_TRANSPORT`, `FAILED_AUTHENTICATION`, `FAILED_AUTHORIZATION`, `FAILED_TIMEOUT`, `FAILED_INVALID_RESPONSE`, `COMPLETED`;
- no se registran headers, tokens, bodies, nombres, email, teléfono, consentimientos, prompts ni evidencia libre.

### Cierre comercial

`discoveryCompletionValidation.ts` bloquea la transacción antes de resolver prospecto o escribir sesión si faltan campos esenciales. El resultado seguro registra `questionsAskedCount`, `completionReason`, `missingRequiredFields` y `conversationDefinitionVersion`. Para compatibilidad con el flujo existente, la presencia se deriva de campos estructurados y de la existencia de respuestas a las preguntas comerciales conocidas; nunca persiste la evidencia libre en telemetría.

### Identidad y reporte

- el cierre sobrescribe la identidad recibida por la identidad canónica del link actual;
- el Prospect Resolution recibe esos mismos valores canónicos;
- el reporte usa la sesión solicitada, no nombres del prospecto fusionado;
- el reporte lee `dossier` y drafts reales;
- no hay fallback a `Empresa`, `Contacto`, score 50 o hallazgos numerados;
- sin evidencia diagnóstica se omite el gauge, se muestra `Evidencia insuficiente` y se omiten secciones vacías;
- todo diagnóstico legacy se etiqueta como resultado preliminar.

## Limitaciones

- El `safeErrorCode` del shadow conversacional sigue sin mostrarse porque ese archivo frontend está fuera del alcance autorizado.
- El motor de cinco preguntas no se rediseñó. El backend impide persistir un cierre incompleto, pero una experiencia de reanudación guiada requiere un sprint frontend separado.
- No se verificó configuración remota ni reachability real de Aura Intelligence.
- No existe todavía provider generativo real; EIS no es canónico.
- Discovery consultivo completo continúa pendiente.
- Commercial Discovery es la prioridad actual.
- La visión avanzada se retomará después del lanzamiento comercial.

## Pruebas

- adapter contractual existente: éxito, request inválido, timeout, 500, 401, 403, 422, respuesta inválida, diagnóstico inválido y serialización;
- shadow: endpoint ausente, disabled, 401, 403, timeout, 500, respuesta/diagnóstico inválido, éxito, persistencia fallida y estados de comparación;
- cierre: bloqueo por esenciales faltantes, cierre completo, conteo, razón, lista y versión;
- reporte: identidad de sesión, destinatario, asesor separado, aislamiento entre sesiones, report ID, ausencia de placeholders/score fijo y etiqueta preliminar.

Los resultados exactos de ejecución se completan en el entregable final del sprint.

## Pasos para una futura prueba shadow

1. Desplegar y validar el endpoint no productivo `evaluateExecutiveDiscoveryV1` en Aura Intelligence.
2. Confirmar el contrato 1.0 y el Development Verifier allowlisted; no usarlo en producción.
3. Aprovisionar el secret server-side sin exponerlo al frontend.
4. Configurar `EXECUTIVE_DISCOVERY_ENDPOINT` y, si aplica, `EXECUTIVE_DISCOVERY_TIMEOUT_MS` en el entorno exacto.
5. Verificar que tenant, organization y company del link tengan grants en Aura Intelligence.
6. Mantener `DISCOVERY_PRIMARY_EVALUATION=false`.
7. Activar `DISCOVERY_SHADOW_EVALUATION=true` solo en el entorno de prueba.
8. Ejecutar una sesión con todos los campos comerciales esenciales y consentimientos.
9. Confirmar `shadowStatus=SUCCEEDED`, `comparisonStatus=COMPLETED`, `persisted=true`, correlación y duración.
10. Si falla, diagnosticar por `safeErrorCode`, etapa y HTTP status; no inspeccionar PII ni tokens.
11. Desactivar de nuevo el flag al concluir la prueba.

## Fuera de alcance y siguiente reanudación

No se modificaron reglas, ProspectResolutionEngine, CRM, Pipeline, Landing, Growth Studio, Aura Intelligence ni el motor/UI conversacional. El siguiente punto de reanudación es DISC-INT-03: observabilidad del shadow conversacional y reanudación UX cuando el backend devuelve `DISCOVERY_REQUIRED_FIELDS_MISSING`, seguida por identidad OIDC no productiva y prueba contractual EIS. La promoción de EIS a diagnóstico canónico requiere una decisión posterior independiente.
