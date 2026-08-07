# Preview `createDiscoveryLead` HTTP 429 Diagnosis V1

## Resultado

Clasificación: **A — EXPECTED_RATE_LIMIT_FROM_PRIOR_TEST**.

El único `POST` de R3C-R2 llegó al callable con App Check válido y fue rechazado por la cuota de emergencia global `INTAKE` de containment. La política activa de Preview permitía una solicitud por ventana fija de 86,400 segundos, sin burst. Un submit exitoso anterior había consumido el único cupo de la ventana. El fixture nuevo aisló navegador, datos e idempotencia, pero no podía aislar una clave de cuota definida como global por ambiente y operación.

No fue un límite histórico por correo o asesor, un replay de App Check, una colisión de idempotencia, una cuota de plataforma ni un 429 inesperado.

## Alcance y límites

- Ambiente inspeccionado: Preview únicamente.
- Callable: `createDiscoveryLead`.
- Intento correlacionado: R3C-R2, un solo `POST`, sin retry.
- No se ejecutó el callable durante este diagnóstico.
- No se abrió navegador, no se creó fixture, no se modificaron datos remotos y no se cambió configuración.
- No hubo cambios de código, deploy, commit, push ni PR.
- Production y Staging permanecieron fuera de alcance.

## Reconstrucción causal

1. La política activa de Preview estaba `ACTIVE`, con `publicIntakeEnabled=true` y regla `INTAKE` habilitada: ventana fija de 86,400 segundos, `maxRequests=1`, `burst=0`, límite efectivo 1.
2. El contador persistente `CUSTOM / preview / global intake` para la ventana iniciada el `2026-08-07T00:00:00Z` fue creado y quedó en `count=1` a las `2026-08-07T18:20:11.930Z`, consistente con el submit exitoso anterior.
3. El `POST` único de R3C-R2 inició a las `2026-08-07T18:34:18.170466Z`. La verificación callable registró App Check `VALID`; la autenticación era `MISSING`, condición permitida para intake público.
4. `createDiscoveryLead` validó App Check y el payload, y luego ejecutó primero containment para `PUBLIC_INTAKE`.
5. `P2DiscoveryEmergencyQuotaConsumer` evaluó una clave `CUSTOM`, con esquema opaco y valor lógico `global.intake`. Esta clave no incorpora navegador, cookie, correo, idempotency key, lead, session ni fixture.
6. El repositorio encontró el contador en su límite efectivo 1/1. Devolvió `allowed=false` sin incrementar el contador.
7. La telemetría registró `containment.emergency_quota_exceeded`, resultado `DENIED`, razón interna `EMERGENCY_QUOTA_EXCEEDED`, en el mismo locator de correlación sanitizado del request.
8. `enforceDiscoveryContainmentV1` tradujo esa decisión a `HttpsError("resource-exhausted", "DISCOVERY_TEMPORARILY_UNAVAILABLE")`.
9. La plataforma devolvió HTTP 429. El catch del callable registró `intake.rejected / RESOURCE_EXHAUSTED`.
10. La ejecución terminó antes de `TOKEN_ISSUANCE`, resolución de asesor, idempotencia, límites históricos de 24 horas, creación del lead, transacción de persistencia y respuesta de éxito.

## Correlación sanitizada del intento

| Capa | Evidencia segura |
|---|---|
| Request | `POST`, `2026-08-07T18:34:18.170466Z`, HTTP 429, latencia 0.724381803 s |
| Trace locator | `sha256:ec423b77b059…/len:67` |
| Execution locator | `sha256:b2ccf79765c2…/len:12` |
| App Check | `VALID` |
| Auth | `MISSING`, esperado para intake público |
| Containment event | `2026-08-07T18:34:18.496Z`, `containment.emergency_quota_exceeded`, `DENIED`, `EMERGENCY_QUOTA_EXCEEDED` |
| Rejection event | `2026-08-07T18:34:18.686Z`, `intake.rejected`, `REJECTED`, `RESOURCE_EXHAUSTED` |
| Telemetry correlation locator | `sha256:cf6890fe320f…/len:53` en ambos eventos |
| Public error | `DISCOVERY_TEMPORARILY_UNAVAILABLE` |
| Persistencia | leads 1, sessions 1, completions 1 antes y después; delta 0/0/0 |

No se registró `rateLimit.denied`, `idempotency.replay` ni `intake.accepted` para este request.

## Ventana y expiración exactas

- Inicio de la ventana del contador: `2026-08-07T00:00:00Z`.
- Fin y reset natural del contador: **`2026-08-08T00:00:00Z`**.
- Estado observado: `count=1`, límite efectivo 1, remaining 0.
- Primera ocupación del cupo: `2026-08-07T18:20:11.930Z`.
- La política activa tenía su propia expiración posterior: `2026-08-08T14:47:47.742Z`.

El tiempo relevante para volver a disponer de un cupo era el fin de la ventana del contador, no la expiración de la política. Un request posterior al reset seguía sujeto a que ningún otro intake Preview consumiera antes ese único cupo.

## Por qué el fixture nuevo no aisló esta cuota

| Dimensión | Aislada por R3C-R2 | Usada por la cuota que negó |
|---|---:|---:|
| Contexto/cookies/storage del navegador | Sí | No |
| Datos sintéticos y correo | Sí | No |
| Idempotency key y namespace | Sí | No |
| Lead/session/completion | Sí; no se crearon nuevos | No |
| App Check token/app | Token válido | No en la clave del contador |
| Ambiente Preview | Compartido | Sí |
| Operación `INTAKE` | Compartida | Sí |

La clave efectiva se construye como `environment=preview`, `dimension=CUSTOM`, `value=global.intake`, más versión de política y bucket temporal. Por diseño, dos fixtures distintos dentro de la misma ventana compiten por el mismo cupo.

## Matriz de salidas 429 y de indisponibilidad temporal

| Rama | Condición | Error interno | Error público | HTTP | ¿Coincide? |
|---|---|---|---|---:|---:|
| Cuota de emergencia containment | `PUBLIC_INTAKE` habilitado; regla `INTAKE` habilitada; contador en límite | `EMERGENCY_QUOTA_EXCEEDED` | `DISCOVERY_TEMPORARILY_UNAVAILABLE` | 429 | Sí |
| Otra denegación containment | Política ausente/corrupta/expirada/revocada, switch apagado, sujeto bloqueado o fallo interno | Código `CONTAINMENT_*` correspondiente | `DISCOVERY_TEMPORARILY_UNAVAILABLE` | 503 | No; status distinto |
| Cardinalidad de idempotencia | Namespace nuevo con máximo de records activos alcanzado | `IDEMPOTENCY_CARDINALITY_EXCEEDED` | mismo código | 429 | No; ocurre después de containment y mensaje distinto |
| Límite de asesor 24 h | Primer intento, caller autorizado y conteo reciente mayor o igual al máximo | `ADVISOR_DAILY_LIMIT` en telemetría | `RATE_LIMITED` | 429 | No; no fue evaluado y mensaje/evento distintos |
| Límite de correo 24 h | Primer intento público y conteo reciente del correo mayor o igual al máximo | `EMAIL_DAILY_LIMIT` en telemetría | `RATE_LIMITED` | 429 | No; no fue evaluado y mensaje/evento distintos |
| Mapper genérico de budgets | Error de conversación, reporte o download | código de budget | mismo código | 429 | No alcanzable desde `parsePublicDiscoveryIntakeV1` |
| Throttle App Check | Rechazo previo o guard `request.app` ausente | App Check no válido/ausente | no usa el mensaje observado | no coincide | No; App Check fue `VALID` |
| Cuota de plataforma | Rechazo externo sin decisión de containment en el handler | externo | externo | potencial 429 | No; hubo evento interno exacto de containment |

## Trazado de código

- Callable, App Check y parse: `functions/src/discovery/createDiscoveryLead.ts:60-98`.
- Orden de containment antes de idempotencia y rate limiting: `functions/src/discovery/createDiscoveryLead.ts:108-148`.
- Cardinalidad de idempotencia a HTTP 429: `functions/src/discovery/createDiscoveryLead.ts:42-58` y `functions/src/infrastructure/firestore/discoveryIntakeIdempotency/FirestoreDiscoveryIntakeIdempotencyRepository.ts:228-236`.
- Límites históricos de 24 horas: `functions/src/discovery/createDiscoveryLead.ts:259-310`.
- Creación y persistencia, no alcanzadas: `functions/src/discovery/createDiscoveryLead.ts:313-420`.
- Traducción containment a 429/503: `functions/src/discovery/containment/enforceDiscoveryContainment.ts:81-106`.
- Selección de cuota `PUBLIC_INTAKE -> INTAKE`: `functions/src/discovery/containment/DefaultDiscoveryContainmentEvaluator.ts:35-45`.
- Consumo y decisión de cuota: `functions/src/discovery/containment/DefaultDiscoveryContainmentEvaluator.ts:137-165`.
- Clave global por operación: `functions/src/discovery/containment/P2DiscoveryEmergencyQuotaConsumer.ts:17-49`.
- Ventana fija y retry-after: `functions/src/rateLimits/RateLimitEvaluator.ts:53-79`.
- Límite efectivo y decisión: `functions/src/rateLimits/RateLimitEvaluator.ts:185-236`.
- Persistencia del contador y no incremento al negar: `functions/src/infrastructure/firestore/rateLimits/FirestoreRateLimitRepository.ts:197-247`.
- App Check obligatorio en deployment: `functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts:68-82`.

## Acción segura y remediación mínima

Acción inmediata sin cambio: esperar hasta después de `2026-08-08T00:00:00Z`, confirmar de forma read-only que se está en un bucket nuevo y solicitar autorización humana para exactamente un submit. No debe hacerse retry automático.

No existe en el código inspeccionado un bypass oficial por fixture, test run, navegador, correo o idempotency key para la cuota de emergencia global.

Si la certificación necesita más de un intake por día, la remediación mínima es una actualización aprobada y auditable de la política **solo de Preview**, con TTL corto y un `maxRequests` de `INTAKE` igual al presupuesto explícito de ejecuciones certificadas. Debe conservarse la cuota habilitada, sin desactivar rate limiting global y sin afectar Production o Staging. No se implementó esa remediación en este slice.

Una mejora futura más aislada, que sí requiere diseño y código, sería una dimensión de cuota para un lane sintético autorizado y no falsificable. No debe construirse como parámetro libre del cliente ni como bypass general.

## Requisitos de regresión

1. Probar con reloj controlado que una regla `INTAKE` 1+0 permite el primer consumo y niega el segundo dentro del mismo bucket.
2. Verificar que la negación retorna `resource-exhausted`, mensaje público `DISCOVERY_TEMPORARILY_UNAVAILABLE` y `retryAfterSeconds` hasta el fin exacto del bucket.
3. Verificar que un correo, idempotency key y contexto de navegador distintos no cambian la clave global.
4. Verificar que el segundo request no crea lead, session ni completion y no incrementa el contador más allá del límite.
5. Verificar telemetría `containment.emergency_quota_exceeded / EMERGENCY_QUOTA_EXCEEDED` y `intake.rejected / RESOURCE_EXHAUSTED` con la misma correlación derivada.
6. Verificar que el primer request del bucket siguiente vuelve a ser permitido.
7. Verificar por separado que `EMAIL_DAILY_LIMIT`, `ADVISOR_DAILY_LIMIT` e idempotency cardinality conservan sus mensajes y condiciones propias.
8. Ejecutar la prueba en emulador o fixture controlado de Preview; Production y Staging deben permanecer fuera de alcance.

## Veredicto

CREATE DISCOVERY LEAD 429 ROOT CAUSE IDENTIFIED —
READY FOR TARGETED RESOLUTION
