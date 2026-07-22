# DISC-INT-01 — Executive Intelligence Adapter

## Objetivo

Este módulo es la única frontera de comunicación entre Executive Discovery en Aura Control Center y `evaluateExecutiveDiscoveryV1` en Aura Intelligence. Construye y valida `ExecutiveDiscoveryApiRequest`, autentica la llamada de servicio, ejecuta un único POST, valida el envelope y el `ExecutiveDiagnosis`, y traduce fallos a errores públicos estables.

El sprint no integra todavía el adapter con `completeDiscoverySession` ni modifica UI, frontend, reportes, CRM, Prospect Resolution, Firestore, PDFs o Growth.

## Ubicación

```text
functions/src/discovery/executive-intelligence/
  adapter/
    DefaultExecutiveDiscoveryAdapter.ts
    validation.ts
  client/
    DevelopmentExecutiveDiscoveryRequestSigner.ts
    HttpExecutiveDiscoveryApiClient.ts
    serializeExecutiveDiscoveryApiRequest.ts
  contracts/
    ExecutiveDiscoveryAdapter.ts
    ExecutiveDiscoveryApiClient.ts
    ExecutiveDiscoveryApiRequest.ts
    ExecutiveDiscoveryApiResponse.ts
    ExecutiveDiscoveryTransportError.ts
    ExecutiveDiagnosis.ts
  tests/
    runExecutiveIntelligenceAdapterTests.ts
```

## Arquitectura

```text
Executive Discovery
  -> ExecutiveDiscoveryAdapter
  -> ExecutiveDiscoveryApiClient
  -> Aura Intelligence evaluateExecutiveDiscoveryV1
  -> ExecutiveDiagnosis
```

Ningún consumidor necesita conocer URL, headers, timeout, Bearer token, envelopes HTTP o códigos internos de Aura Intelligence.

## Compatibilidad con Aura Intelligence

Los DTO y validadores reflejan la frontera vigente de Aura Intelligence EIS-DISC-03:

- schema `1.0`;
- capability `1.0.0` por defecto;
- POST JSON a `evaluateExecutiveDiscoveryV1`;
- éxito `200` con `ExecutiveDiagnosis` en `data`;
- `401` para autenticación de servicio;
- `403` para autorización exacta de tenant, organización y compañía;
- `422` para request, evidencia o versión de schema inválidos;
- `500` para una falla segura de capability o proveedor.

El request transporta `requestId`, `correlationId`, `idempotencyKey`, identidades de organización/tenant/compañía/sesión, versiones, locale, evidencia, aserción de consentimiento y metadata escalar restringida. El adapter agrega `schemaVersion`, `capabilityVersion` y `requestedAt`; puede generar request y correlation IDs mediante dependencias inyectables.

## Autenticación y preparación para OIDC

`ExecutiveDiscoveryRequestSigner` es el puerto de autenticación. El cliente solo consume el resultado `{ scheme: "Bearer", token }` y nunca conoce cómo se obtuvo la credencial.

`DevelopmentExecutiveDiscoveryRequestSigner` entrega el token allowlisted que valida `DevelopmentServiceIdentityVerifier` en Aura Intelligence. El token debe proceder de configuración server-side controlada, no se incluye en el repositorio y este signer no es válido para producción.

Un futuro signer OIDC implementará el mismo puerto y podrá obtener un access token firmado para el audience de Aura Intelligence sin cambiar el adapter ni sus consumidores.

## Cliente HTTP

`HttpExecutiveDiscoveryApiClient` es el único uso de transporte HTTP del módulo. Implementa:

- método POST único;
- `Content-Type: application/json; charset=utf-8`;
- `Authorization: Bearer ...`;
- `X-Correlation-Id`;
- `Idempotency-Key`;
- timeout configurable, 10 segundos por defecto;
- cancelación externa y timeout mediante `AbortController`;
- límite por defecto de 1 MiB para request y 2 MiB para response;
- serialización JSON en un punto único;
- transporte inyectable para pruebas.

Los retries automáticos no se ejecutan en este sprint. `ExecutiveDiscoveryRetryPolicy` y la clasificación `retryable` dejan preparada la infraestructura, pero la política vigente fija `maxAttempts: 1`. Evita duplicar evaluaciones antes de acordar idempotencia distribuida, backoff, jitter y presupuesto de latencia extremo a extremo.

## Validación

La validación local del request reproduce los límites de EIS: objetos estrictos, strings no vacíos, timestamps ISO con zona, valores JSON finitos, metadata escalar, uno a 500 elementos de evidencia, IDs de evidencia únicos, scores válidos y consentimientos de privacidad/procesamiento afirmativos.

La respuesta se valida en dos capas:

1. el cliente exige JSON y un envelope HTTP reconocido;
2. el adapter exige un `ExecutiveDiagnosis` completo, con identidades y versiones iguales al request, correlation/request IDs coincidentes, referencias de evidencia disponibles y referencias de acciones válidas.

Una respuesta tipada pero contextualmente ajena a la solicitud se rechaza; nunca se entrega al consumidor.

## Traducción segura de errores

| Origen | Error público | Retryable |
|---|---|---:|
| request local inválido | `INVALID_REQUEST` | no |
| evidencia 422 | `INVALID_EVIDENCE` | no |
| schema 422 | `UNSUPPORTED_SCHEMA_VERSION` | no |
| autenticación 401 | `AUTHENTICATION_REQUIRED` | no |
| autorización 403 | `ACCESS_FORBIDDEN` | no |
| otro rechazo 4xx/422 | `REQUEST_REJECTED` | no |
| timeout | `TIMEOUT` | sí |
| cancelación del caller | `ABORTED` | no |
| red/transporte | `NETWORK_FAILURE` | sí |
| 429 o 5xx | `SERVICE_FAILURE` | sí |
| JSON/envelope inválido | `INVALID_RESPONSE` | no |
| diagnosis inválido | `INVALID_DIAGNOSIS` | no |

`ExecutiveDiscoveryTransportError` solo expone código, mensaje fijo, retryability, status HTTP opcional y el correlation ID originado por Control Center. No conserva body, token, stack remoto, mensaje del proveedor, safeDetails upstream ni valores de evidencia.

## Composición futura

```ts
const signer = new DevelopmentExecutiveDiscoveryRequestSigner({
  token: controlledServerSideToken,
});

const apiClient = new HttpExecutiveDiscoveryApiClient({
  endpoint: auraIntelligenceEndpoint,
  signer,
});

const adapter = new DefaultExecutiveDiscoveryAdapter({ apiClient });
```

La composición debe vivir en backend. No debe exportar endpoint o credencial mediante variables `VITE_*` ni instanciar el cliente desde React.

## Pruebas

`runExecutiveIntelligenceAdapterTests.ts` cubre:

1. request válido y construcción determinista;
2. request inválido con short-circuit del cliente;
3. timeout;
4. HTTP 500 sin fuga del mensaje upstream;
5. HTTP 401;
6. HTTP 403;
7. HTTP 422 y traducción de error de negocio;
8. envelope inválido;
9. diagnosis inválido;
10. serialización, POST y headers técnicos.

Después de compilar Functions, el runner se ejecuta con:

```text
node functions/lib/discovery/executive-intelligence/tests/runExecutiveIntelligenceAdapterTests.js
```

## Limitaciones y siguiente sprint

- No existe integración con `completeDiscoverySession`.
- No existe OIDC productivo, service account, IAM o JWKS configurado desde Control Center.
- No hay retries automáticos, circuit breaker ni rate limiting distribuido.
- No hay persistencia de diagnósticos.
- No hay proveedor generativo real.

El próximo sprint debe aprovisionar una identidad OIDC no productiva de Control Center, implementar el signer OIDC, validar issuer/audience/subject y grants contra Aura Intelligence, y ejecutar una prueba contractual extremo a extremo. Solo después debe conectarse el adapter al flujo de finalización Discovery mediante una decisión separada sobre idempotencia, latencia y persistencia canónica.

