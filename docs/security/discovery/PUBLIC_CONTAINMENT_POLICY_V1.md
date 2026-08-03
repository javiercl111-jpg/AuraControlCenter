# Public Containment Policy v1

**Estado:** contrato de diseño; almacenamiento/runtime no implementados

**Objetivo:** detener abuso o gasto sin redeploy cuando sea viable, con ownership, auditoría y rollback verificables.

## 1. Propiedades obligatorias

- Backend-owned y no controlable por frontend, Remote Config cliente ni payload público.
- Lectura bajo identidad de servicio; escritura IAM-restricted y segregada.
- Documento/schema versionado, validado y auditable.
- Fail-closed para IA, generación/descarga de documentos y notificaciones.
- Configurable sin redeploy cuando sea viable, con cache acotada e invalidación.
- Rollback explícito a una versión conocida y verificado con prueba funcional.
- El valor más restrictivo entre política ordinaria, bloqueo y cuota de emergencia siempre gana.

## 2. Schema lógico requerido

| Campo | Tipo / ejemplo no vinculante | Semántica | Default seguro ante ausencia/invalidez |
|---|---|---|---|
| `publicIntakeEnabled` | boolean | Permite crear nuevos intakes | `false` |
| `advisorCodeResolutionEnabled` | boolean | Permite resolver código comercial | `false` |
| `tokenIssuanceEnabled` | boolean | Permite exchange/emisión de capabilities | `false` |
| `sessionResolutionEnabled` | boolean | Permite resolver sesión vigente | `false`; modo read-only de incidente requiere aprobación |
| `sessionCompletionEnabled` | boolean | Permite completion/mutaciones | `false` |
| `conversationAiEnabled` | boolean | Permite llamadas al provider IA | `false`; usar fallback local |
| `externalReportGenerationEnabled` | boolean | Permite crear/regenerar radiografía externa | `false` |
| `documentDownloadEnabled` | boolean | Permite emitir nuevas URLs firmadas | `false` |
| `notificationFanoutEnabled` | boolean | Permite enqueue/delivery de completion | `false`; no afecta commit de completion |
| `blockedAppIds` | string[] allowlisted | Deniega instancias/applications comprometidas | Error de carga: aplicar deny global para costos; no ignorar lista |
| `blockedCommercialCodeHashes` | string[] HMAC versionados | Deniega códigos comprometidos sin almacenar valor crudo | Error de carga: resolver código/create fail-closed |
| `emergencyGlobalQuota` | objeto de enteros no negativos | Techo temporal por operación/ventana | `0` para operaciones costosas; nunca eleva cuota ordinaria |
| `policyVersion` | string inmutable/monótona | Identifica reglas en eventos y rollback | Ausente/inválida: policy inválida |
| `environment` | enum exacto | Impide aplicar policy de otro ambiente | Mismatch: policy inválida |
| `owner` | rol organizacional | Rol accountable por el cambio | Ausente: rechazar publicación |
| `reason` | safe text allowlisted, sin PII | Motivo/ticket/incidente | Ausente: rechazar publicación |
| `expiresAt` | timestamp | Caducidad de excepción/emergency policy | Expirada: no reabrir; volver a known-safe policy |
| `rollbackVersion` | policy version existente | Destino verificado de rollback | Ausente: rechazar cambio no inicial |

`blockedAppIds` y hashes MUST tener cardinalidad/tamaño máximos. Las razones no pueden contener payloads, emails, tokens, UIDs ni códigos crudos.

## 3. Evaluación por request

Orden obligatorio antes de trabajo costoso o mutación:

1. Verificar que policy carga, schema, firma/integridad, ambiente, versión y tiempo son válidos.
2. Aplicar flag global de la operación.
3. Aplicar `blockedAppIds` y `blockedCommercialCodeHashes` cuando correspondan.
4. Validar App Check/identidad/capability, expiración, estado y scope.
5. Aplicar el mínimo entre cuota ordinaria y `emergencyGlobalQuota`.
6. Aplicar schema/límites de payload.
7. Reservar idempotency/lease/budget de manera atómica.
8. Ejecutar; emitir evento redactado con `policyVersion` y resultado.

Una policy expirada MUST NOT reactivar automáticamente operaciones deshabilitadas. La versión known-safe o una policy de contención explícita toma el control.

## 4. Matriz de fail behavior

| Operación | Flag false / policy inválida | Efectos ya comprometidos |
|---|---|---|
| Create | Rechazar opacamente antes de crear idempotency/link | Reintento conserva key, sin nuevo efecto |
| Advisor code | Respuesta pública no disponible uniforme | Ninguno |
| Token issuance | No emitir/reemitir token | Token previo sigue su revocación/TTL; decisión de revocación masiva por incidente |
| Session resolve | Rechazar; read-only excepcional requiere policy separada aprobada | Ninguno |
| Completion | Rechazar antes de writes | Completion ya committed no se revierte; downstreams se controlan aparte |
| Conversation AI | Fallback local seguro, sin provider call | Budget reservado sin call se libera idempotentemente |
| Report generation | Estado `NOT_AVAILABLE`, sin PDF/Storage write | Artefacto READY puede permanecer; descarga tiene flag independiente |
| Document download | No emitir URL nueva | URLs ya emitidas expiran naturalmente o se revocan por mecanismo aprobado |
| Notification fan-out | No enqueue/delivery; completion permanece válida | Evento pendiente queda deduped para replay administrativo controlado |

## 5. IAM y ownership

| Acción | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Activar contención por incidente | Incident Commander / Plataforma-SRE | Seguridad | Backend owner, Producto | Soporte y stakeholders |
| Cambiar cuotas ordinarias | Plataforma-SRE | Producto + Seguridad | FinOps/Intelligence, Backend | Soporte |
| Bloquear App ID/código hash | Seguridad | Seguridad | Backend Commercial/Discovery | Producto |
| Rollback de policy | Plataforma-SRE | Seguridad | Backend owner | Producto/Incident Commander |
| Romper-glass | Dos operadores autorizados | Security leadership role | Plataforma-SRE | Auditoría/Compliance |

No se asignan personas en esta baseline. La decisión DR-011 debe confirmar roles y mecanismo de doble control.

## 6. Auditoría

Cada publicación, activación, expiración y rollback MUST registrar: versión anterior/nueva, ambiente, actor IAM, rol owner, razón segura, timestamp server-owned, diff de campos no sensibles, aprobación/referencia y resultado de validación. Los eventos MUST ser append-only o tener integridad equivalente y retención aprobada.

Cada request afectado registra solo: operation, allow/deny/fallback, safe reason, policy version, environment, quota bucket y correlation ID. Nunca registra policy secreta, PII, tokens, códigos crudos o URLs firmadas.

## 7. Cache, propagación y disponibilidad

- Staleness máximo propuesto: 30 s para flags; 5 s en modo incidente.
- Un proceso nuevo MUST cargar policy antes de aceptar operación costosa.
- Fallo de refresh después del staleness máximo aplica fail-closed.
- Métrica obligatoria: versión aplicada por instancia, edad de cache, refresh failures y requests deny/fallback.
- Mezcla de versiones más allá de la ventana de propagación bloquea el gate de rollback.

Estos valores son propuestas y requieren configuración/validación en P7/P9.

## 8. Rollback verificable

1. Confirmar que `rollbackVersion` existe, pertenece al ambiente y pasó schema validation.
2. Publicar una nueva versión que referencie el rollback; no mutar history.
3. Verificar propagación por instancia/emulador y policy version en eventos.
4. Ejecutar fixtures: operación barata permitida/denegada según policy; IA/PDF no llaman downstream cuando están off.
5. Confirmar ausencia de nuevos writes/tasks/URLs para operaciones bloqueadas.
6. Registrar resultado y dejar la policy de contención activa si alguna verificación falla.

## 9. Criterios de aceptación

- Storage concreto elegido y protegido con IAM; no accesible desde frontend.
- Schema y publish pipeline rechazan policy incompleta, expirada, de otro ambiente o sin rollback.
- Kill switches probados en emuladores para las nueve capabilities.
- Operaciones costosas fallan cerradas sin contacto a endpoints remotos.
- Auditoría/redacción y propagación verificadas.
- Runbook de incidente y ownership aprobados.

Este documento no selecciona ni implementa el almacenamiento de policy.
