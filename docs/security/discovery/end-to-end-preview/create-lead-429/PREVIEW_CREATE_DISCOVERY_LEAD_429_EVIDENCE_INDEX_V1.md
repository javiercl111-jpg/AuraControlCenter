# Preview `createDiscoveryLead` 429 Evidence Index V1

## Sanitización

Este índice no contiene IP, PII, payloads, correos, tokens, API keys, secretos, IDs completos ni rutas locales absolutas. Los locators de ejecución, trace y correlación son digests truncados con longitud del valor original. Los documentos remotos se describen por función y campos no sensibles, no por nombre completo.

## Evidencia runtime de Preview

| Ref | Fuente read-only | Evidencia sanitizada | Conclusión |
|---|---|---|---|
| R-01 | Cloud Logging, request del callable | `POST` a las `2026-08-07T18:34:18.170466Z`, HTTP 429, 0.724381803 s, trace `sha256:ec423b77b059…/len:67` | El único submit alcanzó backend y recibió 429 |
| R-02 | Cloud Logging, verificación callable | App Check `VALID`, auth `MISSING`, execution `sha256:b2ccf79765c2…/len:12` | Descarta replay/rechazo de App Check; auth ausente es compatible con intake público |
| R-03 | Telemetría estructurada | `2026-08-07T18:34:18.496Z`, `containment.emergency_quota_exceeded`, `DENIED`, `EMERGENCY_QUOTA_EXCEEDED` | Identifica la decisión interna exacta |
| R-04 | Telemetría estructurada | `2026-08-07T18:34:18.686Z`, `intake.rejected`, `REJECTED`, `RESOURCE_EXHAUSTED` | Confirma la traducción del callable |
| R-05 | Correlación derivada | Ambos eventos usan `sha256:cf6890fe320f…/len:53` | Une containment y rechazo al mismo request |
| R-06 | Política activa de containment | `ACTIVE`; public intake activo; INTAKE activo; 86,400 s; max 1; burst 0; límite efectivo 1 | Define el control que podía negar |
| R-07 | Contador global INTAKE | Ventana `2026-08-07T00:00:00Z` a `2026-08-08T00:00:00Z`; count 1/1; creado y actualizado `2026-08-07T18:20:11.930Z` | El intento previo consumió el único cupo; los rechazos no incrementaron count |
| R-08 | Conteos contemporáneos de certificación | 1 lead, 1 session, 1 completion antes y después; delta 0/0/0 | El 429 ocurrió antes de persistencia |
| R-09 | Secuencia cliente certificada | Un click; handler/validation/App Check/precondition/service/network dispatch observados; network failed; sin retry | Conserva la semántica de intento único |

## Evidencia de código

| Ref | Archivo y líneas | Control observado |
|---|---|---|
| C-01 | `functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts:68-82` | `enforceAppCheck: true` para callables Preview |
| C-02 | `functions/src/discovery/createDiscoveryLead.ts:60-98` | Entrypoint, guard App Check y validación de payload |
| C-03 | `functions/src/discovery/createDiscoveryLead.ts:108-148` | `PUBLIC_INTAKE` se evalúa antes de token issuance, idempotencia y límites históricos |
| C-04 | `functions/src/discovery/containment/DefaultDiscoveryContainmentEvaluator.ts:35-45` | `PUBLIC_INTAKE` selecciona la operación de cuota `INTAKE` |
| C-05 | `functions/src/discovery/containment/DefaultDiscoveryContainmentEvaluator.ts:137-165` | Consume regla activa y devuelve `EMERGENCY_QUOTA_EXCEEDED` al negar |
| C-06 | `functions/src/discovery/containment/P2DiscoveryEmergencyQuotaConsumer.ts:17-49` | Política dinámica y clave lógica `global.<operation>` en dimensión `CUSTOM` |
| C-07 | `functions/src/rateLimits/RateLimitEvaluator.ts:53-79` | Buckets fijos alineados al epoch y cálculo de retry-after |
| C-08 | `functions/src/rateLimits/RateLimitEvaluator.ts:185-236` | Límite efectivo `maxRequests + burst` y decisión allow/deny |
| C-09 | `functions/src/infrastructure/firestore/rateLimits/FirestoreRateLimitRepository.ts:197-247` | El contador se crea en 1; al alcanzar el límite se niega sin incrementar |
| C-10 | `functions/src/discovery/containment/enforceDiscoveryContainment.ts:81-106` | Telemetría exacta y traducción de emergency quota a 429 + mensaje público |
| C-11 | `functions/src/discovery/createDiscoveryLead.ts:42-58` | Rama 429 separada para cardinalidad de idempotencia |
| C-12 | `functions/src/infrastructure/firestore/discoveryIntakeIdempotency/FirestoreDiscoveryIntakeIdempotencyRepository.ts:228-236` | Condición de cardinalidad activa por namespace |
| C-13 | `functions/src/discovery/createDiscoveryLead.ts:259-310` | Límites móviles de 24 h por asesor o correo, con mensaje `RATE_LIMITED` |
| C-14 | `functions/src/discovery/discoverySecurityService.ts:19-46` | Config de límites históricos y cache; esos límites no usan el contador containment |
| C-15 | `functions/src/discovery/discoveryPayloadHandlerSupport.ts:3-16` | Mapper genérico de budgets; sus 429 no son emitibles por el parser de intake |
| C-16 | `functions/src/discovery/payloadBounds/discoveryPayloadBounds.ts:183-227` | El parser de intake solo emite errores estructurales/validación, no budgets 429 |
| C-17 | `functions/src/discovery/createDiscoveryLead.ts:313-420` | Creación y persistencia ubicadas después de todos los controles anteriores |
| C-18 | `functions/src/discovery/createDiscoveryLead.ts:431-462` | Rechazo, cierre seguro de intento y rethrow del `HttpsError` |

## Encadenamiento probatorio

`R-02 + C-01/C-02` descarta App Check. `R-03 + C-04/C-05/C-06` identifica la cuota global INTAKE. `R-06 + R-07 + C-07/C-08/C-09` demuestra por qué el segundo consumo fue negado y fija la expiración. `R-04 + C-10` explica HTTP 429 y el mensaje público. `R-08 + C-03/C-17` confirma que la ejecución no llegó a creación o persistencia. `C-11` a `C-16` diferencian las demás ramas 429 por orden, condición y mensaje.

## Integridad del diagnóstico

- No se usó el navegador durante R3D.
- No se llamó `createDiscoveryLead`.
- No se leyó ni mostró payload, correo, IP, token, secreto o ID completo.
- Las lecturas remotas fueron selectivas y no mutantes.
- No se reseteó, eliminó ni alteró el contador.
