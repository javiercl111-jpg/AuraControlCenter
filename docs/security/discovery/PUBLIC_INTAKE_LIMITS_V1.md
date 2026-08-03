# Public Intake Limits v1

**Estado:** valores iniciales para revisión; ninguno está aprobado

**Principio:** los valores son techos, no objetivos de consumo ni evidencia de configuración efectiva.

## 1. Etiquetas

| Etiqueta | Significado |
|---|---|
| `PROPOSED` | Punto de partida conservador sujeto a validación |
| `PRODUCT DECISION REQUIRED` | Cambia UX, capacidad o economía; Producto debe decidir |
| `SECURITY MINIMUM` | El control no puede quedar menos restrictivo sin excepción de riesgo aprobada |
| `PLATFORM CONFIGURATION REQUIRED` | Debe materializarse y verificarse en la plataforma/ambiente |

Un límite puede tener más de una etiqueta. `SECURITY MINIMUM` significa “al menos este nivel de protección”, no aprobación del número por sí solo.

## 2. Payload y estructura

Los bytes se miden sobre UTF-8 del body decodificado antes de normalización. Los límites por campo siguen aplicando aunque el envelope sea menor.

| Control | Valor inicial | Superficie | Clasificación | Motivo / decisión |
|---|---:|---|---|---|
| Payload bytes universal | 64 KiB máximo | Toda callable pública | SECURITY MINIMUM | Rechazar antes de trabajo downstream |
| Payload create | 8 KiB máximo | Create | PROPOSED, PRODUCT DECISION REQUIRED | Cubre PII/consentimientos sin blobs |
| Payload advisor/token/resolve/download | 4 KiB máximo | Operaciones pequeñas | SECURITY MINIMUM | Solo IDs/capabilities/código |
| Payload AI por turno | 32 KiB máximo | Evaluate | PROPOSED, SECURITY MINIMUM | Controla prompt y costo |
| Payload completion | 64 KiB máximo | Completion | PROPOSED, PRODUCT DECISION REQUIRED | Requiere validar UX/historial real |
| Profundidad | 8 niveles | Todas | SECURITY MINIMUM | Evita estructuras patológicas |
| Número total de campos | 64; completion 128 | Todas | PROPOSED, SECURITY MINIMUM | Incluye campos anidados |
| String genérico | 2,000 caracteres | Todas | SECURITY MINIMUM | Campos específicos pueden ser menores |
| Nombre/empresa | 100 caracteres | Create | PROPOSED | Alineado al uso actual |
| Email | 254 caracteres | Create | SECURITY MINIMUM | Normalizado; formato estricto |
| Teléfono | 32 caracteres | Create | PROPOSED | Permite formato internacional, no texto libre |
| Puesto/ciudad/estado | 80 caracteres | Create | PROPOSED | Evita amplificación |
| Commercial code | 20 caracteres | Resolve/Create | SECURITY MINIMUM | Alfabeto cerrado y normalizado |
| Historial serializado | 24 KiB | AI/Completion | PROPOSED, PRODUCT DECISION REQUIRED | Presupuesto separado del envelope |
| Mensajes máximos | 40 | AI/Completion | PROPOSED, PRODUCT DECISION REQUIRED | 20 turnos de usuario + sistema |
| Contenido por mensaje | 1,500 caracteres | AI/Completion | PROPOSED, SECURITY MINIMUM | Truncado no silencioso; rechazar o resumir server-side |
| Arrays genéricos | 50 elementos | Completion | SECURITY MINIMUM | Allowlist puede imponer menos |
| Campos desconocidos | 0 | Todas | SECURITY MINIMUM | Schema cerrado |
| Campos server-owned en input | 0 | Todas | SECURITY MINIMUM | Rechazo de `tenantId`, `organizationId`, roles, IDs internos, etc. |

## 3. Intake y enumeración

Ventanas simultáneas se aplican en conjunto; superar cualquiera deniega antes de writes costosos. IP/email/código se almacenan como HMAC por propósito. `App ID` proviene de attestation validada, no de input.

| Dimensión | Valor inicial | Clasificación | Notas |
|---|---:|---|---|
| Intake por IP hash | 3 / 15 min; 10 / 24 h | PROPOSED, PRODUCT DECISION REQUIRED | NAT/accesibilidad requieren revisión |
| Intake por App ID | 60 / min; 500 / 24 h | PROPOSED, PLATFORM CONFIGURATION REQUIRED | No sustituye cuota global |
| Intake por email hash | 3 / 24 h; 10 / 30 días | PROPOSED, PRODUCT DECISION REQUIRED | Respuesta opaca; no revelar existencia |
| Intake por commercial code | 10 / 15 min por IP+App; 200 / 24 h por código válido | PROPOSED, PRODUCT DECISION REQUIRED | El código válido no debe convertirse en amplificador |
| Resolve code por IP hash | 10 / h | PROPOSED | Conservar respuesta uniforme |
| Resolve code global | 300 / min | PROPOSED, PLATFORM CONFIGURATION REQUIRED | Emergency quota puede reducirlo |
| Intake global | 300 / h; 2,000 / 24 h | PRODUCT DECISION REQUIRED, PLATFORM CONFIGURATION REQUIRED | Requiere forecast y alerta 50/75/90% |
| Nuevas idempotency keys por IP/App | 10 / h; 30 / día | SECURITY MINIMUM | Control de cardinalidad antes de crear record |

## 4. Capabilities, IA y completion

| Control | Valor inicial | Clasificación | Notas |
|---|---:|---|---|
| One-time token TTL | 30 min público; 72 h solo link CRM aprobado | PRODUCT DECISION REQUIRED, SECURITY MINIMUM | Separar tipos de enlace; valor actual no es certificación |
| Session token TTL | 2 h desde exchange, sin superar link TTL | PROPOSED, PRODUCT DECISION REQUIRED | Revocable; validado en cada operación |
| IA por sesión | 12 llamadas; 2 intentos internos máximo por turno | PROPOSED, PRODUCT DECISION REQUIRED | Replays de `turnId` no vuelven a facturar |
| IA concurrency por sesión | 1 | SECURITY MINIMUM | Segunda llamada recibe `PROCESSING`/fallback |
| IA global | 60 llamadas/min; 1,000/día | PRODUCT DECISION REQUIRED, PLATFORM CONFIGURATION REQUIRED | Ajustar con costo real |
| Presupuesto IA diario | equivalente a 25 USD/día en ambiente productivo inicial | PRODUCT DECISION REQUIRED, PLATFORM CONFIGURATION REQUIRED | Moneda/valor se revisan; hard stop + fallback |
| Completion por sesión | 1 éxito total | SECURITY MINIMUM | Exactamente una vez |
| Intentos completion | 3 / 15 min; 5 durante TTL | PROPOSED, SECURITY MINIMUM | Conflictos/replays cuentan sin repetir efectos |
| Completion global | 120 / min | PROPOSED, PLATFORM CONFIGURATION REQUIRED | Protege Firestore/Tasks/downstreams |

## 5. PDF, descarga y notificaciones

| Control | Valor inicial | Clasificación | Notas |
|---|---:|---|---|
| Report generation por sesión/tipo/versión | 1 artefacto; 2 intentos / 24 h | SECURITY MINIMUM, PROPOSED | Lease/idempotencia; segunda ejecución solo recovery |
| Regeneración forzada | 1 / 24 h por reporte, solo admin autorizado | PROPOSED, PRODUCT DECISION REQUIRED | Auditada; público nunca fuerza |
| Generación global | 20 / min; 500 / día | PRODUCT DECISION REQUIRED, PLATFORM CONFIGURATION REQUIRED | Hard stop y cola/backpressure |
| Tamaño PDF externo | 5 MiB | PROPOSED, PRODUCT DECISION REQUIRED | Abort antes de Storage si excede |
| Tamaño PDF interno | 10 MiB | PROPOSED, PRODUCT DECISION REQUIRED | Nunca público |
| Downloads por sesión/IP | 5 / 15 min; 20 / 24 h | PROPOSED, PRODUCT DECISION REQUIRED | Emitir URL cuenta como download grant |
| URL firmada | 10 min, rango permitido 5–15 min | SECURITY MINIMUM, PRODUCT DECISION REQUIRED | No 30 min sin excepción aprobada |
| Download grants globales | 100 / min; 2,000 / día | PROPOSED, PLATFORM CONFIGURATION REQUIRED | Egress alertado |
| Notification fan-out | 1 tipo de evento, 1 destinatario, 1 inbox item por completion | SECURITY MINIMUM | Cero listas/targets del cliente |
| Notification retries | 3 con backoff; ventana 15 min | PROPOSED, PLATFORM CONFIGURATION REQUIRED | 4xx no retry; DLQ/revisión definida |

## 6. Idempotencia, retries y leases

| Control | Valor inicial | Clasificación | Notas |
|---|---:|---|---|
| Active idempotency keys por email hash | 3 | PROPOSED, SECURITY MINIMUM | Antes de write |
| Active idempotency keys por IP/App | 10 / h | SECURITY MINIMUM | Evita keys únicas ilimitadas |
| Active idempotency keys globales | 100,000 | PRODUCT DECISION REQUIRED, PLATFORM CONFIGURATION REQUIRED | Alerta 50/75/90%; deny controlado al 100% |
| Idempotency TTL completada | 7 días | PROPOSED, PRODUCT DECISION REQUIRED | Ventana de retry/soporte; no 30 días sin decisión |
| Idempotency TTL fallida/procesando abandonado | 24 h | PROPOSED | Mantiene evidencia mínima |
| Client retries | 3 | SECURITY MINIMUM | Backoff exponencial + jitter; misma key/turn/completion ID |
| Backend downstream retries | 3 | PROPOSED, PLATFORM CONFIGURATION REQUIRED | Solo errores retryable e idempotentes |
| Intake lease | 60 s | PROPOSED | Heartbeat no necesario si timeout menor |
| Report lease | 120 s, renovable una vez | PROPOSED, PLATFORM CONFIGURATION REQUIRED | Owner token y fencing |
| Lease recovery | 1 takeover tras expiry | SECURITY MINIMUM | Worker anterior queda fenced; después fail/manual retry |

## 7. Runtime, maxInstances, concurrency y timeouts

Estos valores deben configurarse por función y verificarse en P9; no se infieren de defaults de plataforma.

| Grupo | maxInstances | Concurrency por instancia | Timeout | Clasificación |
|---|---:|---:|---:|---|
| Advisor/create/token/resolve | 20 | 10 | 15 s | PROPOSED, PLATFORM CONFIGURATION REQUIRED |
| Evaluate AI | 5 | 2 | 15 s | SECURITY MINIMUM, PRODUCT DECISION REQUIRED, PLATFORM CONFIGURATION REQUIRED |
| Completion | 10 | 2 | 30 s | PROPOSED, PLATFORM CONFIGURATION REQUIRED |
| PDF generation | 3 | 1 | 120 s | SECURITY MINIMUM, PRODUCT DECISION REQUIRED, PLATFORM CONFIGURATION REQUIRED |
| Document request sin generación | 10 | 10 | 20 s | PROPOSED, PLATFORM CONFIGURATION REQUIRED |
| Notification task | 10 | 5 | 30 s | PROPOSED, PLATFORM CONFIGURATION REQUIRED |

## 8. Alertas y agotamiento

- Alertar al 50%, 75% y 90% de presupuestos globales; hard stop al 100%.
- Cuota/config ausente, inválida, futura o de ambiente incorrecto cierra IA, PDF, descargas y notificaciones; intake puede degradar solo si Seguridad aprueba explícitamente el modo.
- El cliente recibe `RATE_LIMITED` o fallback opaco con `retryAfter` acotado; nunca la dimensión exacta que disparó el límite.
- Emergency quota solo puede reducir límites ordinarios, nunca aumentarlos.

## 9. Aprobaciones pendientes

Producto debe aprobar fricción/UX, volúmenes, TTL, tamaños y regeneración. Seguridad debe aprobar mínimos, dimensiones y fail behavior. Plataforma/SRE debe confirmar capacidad, atomicidad y configuración. FinOps/Intelligence debe aprobar presupuesto IA. Privacidad/Compliance debe aprobar retención. Ningún valor se presenta como aprobado hasta registrar esas decisiones en `PUBLIC_INTAKE_DECISION_REGISTER_V1.md`.
