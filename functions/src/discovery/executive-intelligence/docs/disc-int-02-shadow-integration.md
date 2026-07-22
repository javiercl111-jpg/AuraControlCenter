# DISC-INT-02 — Integración canónica de cierre en modo shadow

## Alcance

`completeDiscoverySession` conserva el diagnóstico y la respuesta legacy como fuente oficial. Después de que la transacción legacy termina y se intenta encolar su notificación, el backend ejecuta una evaluación adicional mediante el Executive Intelligence Adapter. El resultado shadow nunca se usa para responder al usuario, actualizar UI, resolver prospectos, generar reportes o producir PDFs.

El hotfix de despliegue mantiene la integración remota bloqueada por seguridad. No construye signer, cliente HTTP ni adapter real hasta que exista un despliegue explícito de identidad aprobada; no habilita tráfico productivo.

## Flujo

```text
completeDiscoverySession
  -> validar y persistir sesión legacy
  -> persistir legacyDiagnosis inmutable
  -> conservar notificación legacy
  -> resolver feature flags
  -> construir ExecutiveDiscoveryEvaluationInput
  -> Executive Intelligence Adapter
  -> ExecutiveDiagnosis
  -> comparar siete dimensiones
  -> actualizar únicamente campos shadow
  -> registrar telemetría segura
  -> responder con el payload legacy original
```

Una falla de configuración, request, autenticación, red, timeout, servicio, diagnóstico o persistencia shadow se contiene dentro de esta etapa. La sesión legacy ya confirmada no se elimina ni se sobrescribe y el caller recibe la respuesta legacy normal.

## Feature flags

| Clave canónica | Parámetro Firebase | Default | Comportamiento |
|---|---|---:|---|
| `discovery.shadowEvaluation` | `DISCOVERY_SHADOW_EVALUATION` | `false` | Ejecuta o salta la evaluación shadow; requiere habilitación explícita. |
| `discovery.primaryEvaluation` | `DISCOVERY_PRIMARY_EVALUATION` | `false` | Reservado. El resolver fuerza siempre `false`, incluso si la configuración solicita `true`. |

No existe una ruta de ejecución primary en este sprint.

## Configuración server-side

- `EXECUTIVE_DISCOVERY_ENDPOINT`: endpoint no productivo de `evaluateExecutiveDiscoveryV1`.
- `EXECUTIVE_DISCOVERY_TIMEOUT_MS`: timeout reservado para el cliente; default de 10 segundos.
- `EXECUTIVE_DISCOVERY_SERVICE_TOKEN` no está declarado ni vinculado a `completeDiscoverySession` en este hotfix.

El endpoint no se expone mediante variables `VITE_*`. No se agregó token, API key, valor vacío sustituto ni credencial pública. Con shadow desactivado, la evaluación persiste `SKIPPED_DISABLED` sin crear el adapter. Si shadow se activa accidentalmente, endpoint ausente produce `ENDPOINT_NOT_CONFIGURED`; con endpoint presente, la compuerta de seguridad produce `AUTHENTICATION_REQUIRED` sin llamada remota y sin afectar la respuesta legacy.

## Construcción del request

La integración entrega al adapter identidades técnicas de tenant, organización, compañía y sesión, locale, correlación, idempotencia, consentimiento y evidencia estructurada. El adapter completa `schemaVersion`, `capabilityVersion` y `requestedAt` para formar `ExecutiveDiscoveryApiRequest`.

La evidencia se limita a campos normalizados del dossier y al score legacy. No se incorporan historial de conversación, respuestas completas, nombres, email ni teléfono. Si los consentimientos de privacidad y procesamiento diagnóstico no están afirmados, la validación del adapter falla de forma segura y se registra `shadowStatus = FAILED`.

## Persistencia

La creación de `discovery_sessions/{sessionId}` agrega una sola vez:

- `legacyDiagnosis`: proyección normalizada del diagnóstico oficial legacy;
- los campos legacy preexistentes, sin cambio de semántica.

La escritura posterior usa `update` y contiene exclusivamente:

- `shadowDiagnosis`;
- `shadowMetadata`;
- `shadowExecution`;
- `shadowTimestamp`;
- `shadowStatus`;
- `shadowErrorCode`, solo cuando falla;
- `adapterVersion`;
- `capabilityVersion`.

La actualización shadow nunca incluye `legacyDiagnosis`. Además, el backend elimina todos esos campos controlados de cualquier payload recibido del cliente antes de construir la sesión.

Estados:

- `SUCCEEDED`: diagnóstico válido persistido y comparación disponible;
- `FAILED`: `shadowDiagnosis = null`, con código seguro, correlación y duración;
- `SKIPPED`: feature flag shadow desactivado, sin invocar el adapter.

## Comparación neutral

`compareDiscoveryDiagnoses` compara de forma exacta y sin ponderación:

1. maturity;
2. recommendations;
3. risks;
4. opportunities;
5. confidence;
6. missing evidence;
7. warnings.

Para escalares se guardan ambos valores y `matches`. Para listas se guardan conteos y `matches`; los diagnósticos persistidos contienen el detalle original. `differences` enumera únicamente las categorías no coincidentes. No se declara cuál diagnóstico es mejor ni se calcula una preferencia.

## Logging seguro

Cada ejecución shadow registra solo:

- `correlationId`;
- `durationMs`;
- `status`;
- `capabilityVersion`;
- `adapterVersion`;
- `errorCode`, cuando corresponde.

No se registran email, teléfono, nombres, respuestas, consentimientos, evidencia, diagnosis, tokens, bodies HTTP ni otros datos personales.

## Pruebas

`runDiscoveryShadowIntegrationTests.ts` cubre:

- Legacy PASS e inmutabilidad del input;
- Shadow PASS;
- Shadow FAIL;
- timeout;
- diagnosis inválido;
- comparación de las siete dimensiones;
- feature flag OFF;
- feature flag ON;
- bloqueo permanente de primary;
- no pérdida de sesión cuando falla la persistencia shadow;
- minimización de request y logging.

Después de compilar Functions:

```text
node functions/lib/discovery/executive-intelligence/tests/runDiscoveryShadowIntegrationTests.js
```

También debe seguir pasando el runner contractual del adapter de DISC-INT-01.

## Próximo sprint

Una futura activación de shadow requiere un despliegue de seguridad separado y explícito: identidad OIDC/IAM u otro mecanismo aprobado, endpoint configurado, issuer/audience/subject cuando aplique, grants mínimos exactos y prueba contractual extremo a extremo. Activar `discovery.primaryEvaluation` requiere otra decisión explícita; este código no permite hacerlo.
