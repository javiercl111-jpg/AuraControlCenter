# Atomic Public Rate Limits v1

**Estado:** infraestructura implementada; aún no conectada a handlers públicos

**Slice:** AI-02H1E.4.2

**Autorización de producción:** no concedida

## Propósito y alcance

Este slice introduce un core reusable y un adapter Firestore para evaluar cuotas fijas multi-dimensionales de forma determinista, transaccional y fail-closed. No cambia `createDiscoveryLead`, `evaluateConversation`, `requestExecutiveDocument` ni `completeDiscoverySession`; tampoco implementa kill switches, lifecycle de capabilities, TTL/cleanup, payload schemas, telemetría, cambios App Check o configuración Firebase remota.

## Contratos

`RateLimitPolicyV1` contiene exclusivamente valores versionados y validados:

- `version`
- `dimension`
- `windowSeconds`
- `maxRequests`
- `burst`
- `enabled`
- `environment`
- `reason`
- `owner`

El límite efectivo de una ventana es `maxRequests + burst`. `burst` es capacidad adicional dentro de la misma ventana fija; no es un segundo contador ni una ventana móvil. Los valores provienen del policy provider, no de handlers ni números mágicos productivos.

Las dimensiones certificadas son `APP_ID`, `EMAIL_HASH`, `IP_HASH`, `COMMERCIAL_CODE_HASH`, `SESSION_HASH`, `LINK_HASH`, `GLOBAL` y `CUSTOM`. Cada evaluación devuelve key fingerprint, bucket, quota, window, remaining, retryAfter, decision, policy y metadata segura.

## Puertos

| Puerto / servicio | Responsabilidad | Dependencia Firestore |
|---|---|---|
| `RateLimitEvaluator` | Validar request/policy/reloj, calcular ventana y producir decisión | Ninguna |
| `RateLimitRepository` | Consumir cuota mediante una operación atómica | Ninguna en el contrato |
| `RateLimitPolicyProvider` | Resolver policy exacta por ambiente y dimensión | Ninguna |
| `RateLimitClock` | Entregar epoch milliseconds determinista | Ninguna |
| `StaticRateLimitPolicyProvider` | Provider configurable en memoria para composición/test | Ninguna |
| `FirestoreRateLimitRepository` | Adapter transaccional del repository port | Firestore Admin SDK |

El core bajo `functions/src/rateLimits` no importa Firebase ni conoce handlers, payloads o dominios de negocio. El adapter no está exportado desde `functions/src/index.ts` ni conectado a una Function.

## Claves y privacidad

`EMAIL_HASH`, `IP_HASH`, `COMMERCIAL_CODE_HASH`, `SESSION_HASH` y `LINK_HASH` rechazan cualquier key que no use `HMAC_SHA256_V1`. La derivación incluye purpose, dimensión y versión para separar dominios. El adapter persiste únicamente un SHA-256 fingerprint del descriptor HMAC; nunca persiste IP, email, código, sesión, link o HMAC raw.

`GLOBAL` usa la key canónica opaca `global`. `APP_ID` y `CUSTOM` soportan key opaca o HMAC cuando la clasificación del caller lo requiere.

## Almacenamiento

La colección dedicada es:

```text
public_rate_limit_counters_v1/{deterministicCounterId}
```

No se reutiliza `platform_rate_limits` porque el esquema legacy:

- está ligado a un contador IP/bucket concreto;
- no versiona contrato, policy ni ambiente;
- no representa dimensión, burst o effective limit;
- no certifica corrupción ni mismatch de policy;
- no ofrece un port reusable e independiente del handler.

Cada documento v1 contiene schema, dimensión, ambiente, key fingerprint/scheme/version, policy version, bucket, límites, ventana, count y timestamps numéricos. No se añade TTL ni cleanup en este slice.

El document ID es SHA-256 determinista de ambiente, dimensión, key fingerprint, policy version y bucket. Una nueva ventana o versión produce un contador separado.

## Atomicidad y concurrencia

`FirestoreRateLimitRepository.consume()` ejecuta dentro de `Firestore.runTransaction`:

1. lectura exacta del documento;
2. validación completa del contador y de su scope;
3. comparación contra `effectiveLimit`;
4. create o increment/update para requests permitidos;
5. retorno de count/remaining.

Una solicitud denegada se decide dentro de la transacción y no incrementa más allá del límite. Una cola local por counter ID evita conflictos redundantes dentro de una instancia; es solo una optimización. Firestore continúa siendo la autoridad atómica entre procesos e instancias, y sus transaction retries fueron certificados explícitamente.

## Fail-closed y errores

| Código | Comportamiento |
|---|---|
| `RATE_LIMIT_EXCEEDED` | Decisión `DENY`, remaining 0 y retryAfter hasta la siguiente ventana |
| `POLICY_NOT_FOUND` | Error normalizado; no se consulta ni escribe contador |
| `COUNTER_CORRUPTED` | Error normalizado ante schema/count/scope inconsistente |
| `CLOCK_ERROR` | Error normalizado; no se crea ventana |
| `CONFIGURATION_ERROR` | Error normalizado ante policy/key/metadata/provider inválido |
| `INTERNAL_RATE_LIMIT_FAILURE` | Error normalizado tras fallo inesperado; request queda denegado |

Una policy con `enabled=false` devuelve `DENY/POLICY_DISABLED` sin crear contador. La conversión de estos resultados a `HttpsError` pertenece a un slice futuro de integración de handlers.

## Certificación Emulator

La suite `test:firestore-rate-limit-emulator` usa únicamente Firestore Emulator en loopback y el proyecto `demo-aura-public-rate-limits`. Rechaza credenciales reales, configuración no-demo y hosts no-loopback.

Cobertura:

- dos requests simultáneos;
- 100 requests paralelos;
- quota exacta y burst;
- window rollover;
- remaining y retryAfter;
- HMAC determinista, consistency y separación por propósito;
- ocho dimensiones sin compartir counters;
- policy disabled/missing;
- clock/config/provider/repository failures;
- counter corrupto;
- retry real de transaction conflict;
- aislamiento del core, adapter y handlers prohibidos.

La suite no despliega, no usa proyecto productivo y no modifica Rules/índices/configuración remota.
