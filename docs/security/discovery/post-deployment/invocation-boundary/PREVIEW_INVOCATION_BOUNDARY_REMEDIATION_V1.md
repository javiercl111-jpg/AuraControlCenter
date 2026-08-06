# Preview Invocation Boundary Remediation V1

## Dictamen

**PREVIEW INVOCATION BOUNDARY REMEDIATED — READY TO RESUME FUNCTIONAL SMOKE VALIDATION**

- Change ID: `AI-02H1E.8-PREVIEW-INVOCATION-BOUNDARY-20260805-01`
- Programa: `AI-02H1E.5.0`
- Slice: `AI-02H1E.8`
- Target único: `aura-intel-preview` / `us-central1`
- Production: `REMEDIATION_HOLD` — no autorizada

## Resultado ejecutivo

La causa heredada quedó confirmada: las cinco Functions Gen2 y los cinco servicios Cloud Run estaban sanos, pero cada política IAM carecía de `roles/run.invoker`. El manifiesto fail-closed fue certificado antes del cambio y autorizó exclusivamente un binding por servicio:

- member: `allUsers`;
- role: `roles/run.invoker`;
- scope: servicio Cloud Run individual;
- condición: ninguna;
- proyecto: `aura-intel-preview`;
- región: `us-central1`.

La corrección no creó una revisión, no ejecutó deploy y no cambió identidades runtime, secretos, App Check, Staging ni Production. El modelo es consistente con la documentación oficial de [acceso público de Cloud Run](https://cloud.google.com/run/docs/authenticating/public) y con el comando de [binding IAM por servicio](https://cloud.google.com/sdk/gcloud/reference/run/services/add-iam-policy-binding). La aplicación conserva la validación propia de HTTPS callable: Firebase deserializa el cuerpo y valida tokens de Authentication y App Check antes del handler, según [Call functions from your app](https://firebase.google.com/docs/functions/callable).

## Gate

| Control | Resultado |
|---|---|
| Rama exacta | `fix/intelligence-preview-invocation-boundary` |
| HEAD | `ce788f6f8ff05ae535df62e62e70438cf599eb2e` |
| HEAD = `origin/main` | PASS |
| Worktree inicial limpio | PASS |
| Firebase target | `aura-intel-preview` |
| GCP project | `aura-intel-preview` |
| Node | `v20.20.2` |
| Functions ACTIVE | 5/5 |
| Cloud Run READY | 5/5 |

## Certificación previa

El manifiesto `scripts/manifests/preview-invocation-boundary-v1.json` define exactamente cinco servicios. La guardia `scripts/preview-invocation-boundary-guard.cjs` valida proyecto, región, rol, principal, scope, identidades y preservación de App Check, secretos, revisiones, Staging y Production.

- suite: 13/13 PASS;
- caso positivo: 1/1 PASS;
- casos negativos requeridos: 12/12 PASS;
- guardia CLI: `PREVIEW_INVOCATION_BOUNDARY_GUARD_PASS`;
- `git diff --check`: PASS antes de la aplicación.

Negativas cubiertas: proyecto incorrecto, región incorrecta, servicio extra, servicio faltante, rol incorrecto, member incorrecto, scope de proyecto, identidad Production, cambio de App Check, identidad runtime incorrecta, cambio de secreto y cambio en Staging/Production.

## Delta IAM

| Function | Servicio | Antes | Después |
|---|---|---:|---|
| `createDiscoveryLead` | `creatediscoverylead` | 0 invokers | solo `allUsers` / `roles/run.invoker` |
| `exchangeDiscoveryToken` | `exchangediscoverytoken` | 0 invokers | solo `allUsers` / `roles/run.invoker` |
| `resolveDiscoverySession` | `resolvediscoverysession` | 0 invokers | solo `allUsers` / `roles/run.invoker` |
| `evaluateConversation` | `evaluateconversation` | 0 invokers | solo `allUsers` / `roles/run.invoker` |
| `completeDiscoverySession` | `completediscoverysession` | 0 invokers | solo `allUsers` / `roles/run.invoker` |

El binding de proyecto `roles/run.invoker` permaneció en cero. No se concedió `allAuthenticatedUsers`, ningún rol amplio ni acceso a servicios adicionales.

## Preservación de runtime

El read-back posterior confirmó:

- cinco Functions `ACTIVE`;
- cinco servicios `READY`;
- mismas cinco revisiones `00001`;
- mismos `updateTime` de Functions;
- identidades runtime exactas sin cambios;
- secretos asociados sin cambios y sin lectura de valores;
- `enforceAppCheck: true` conservado en el deployment unit;
- ninguna revisión o configuración funcional modificada.

## Probes no mutantes

El conjunto autoritativo contiene 30 requests inválidas/no mutantes. No se ejecutó happy path ni se enviaron datos de negocio.

| Caso | Resultado por servicio | Total |
|---|---|---:|
| Preflight Preview | HTTP 204 | 5/5 |
| App Check ausente | HTTP 401 / `UNAUTHENTICATED` | 5/5 |
| Content-Type incorrecto | HTTP 400 / `INVALID_ARGUMENT` | 5/5 |
| Body vacío | HTTP 400 / `INVALID_ARGUMENT` | 5/5 |
| Método incorrecto | HTTP 400 / `INVALID_ARGUMENT` | 5/5 |
| Auth ausente con App Check inválido | HTTP 401 / `UNAUTHENTICATED` | 5/5 |

Resultados agregados:

- 0 rechazos de IAM de plataforma;
- 0 errores de transporte en el conjunto autoritativo;
- 0 respuestas 2xx fuera de preflight;
- 0 escrituras de negocio;
- 0 tokens creados;
- 0 happy paths.

Los intentos iniciales afectados por el cliente PowerShell y por payloads inline deformados en Windows se excluyeron del conjunto autoritativo; no alteraron estado y fueron sustituidos por fixtures temporales no sensibles, eliminados al finalizar.

## Telemetría y seguridad

Ventana autoritativa: `2026-08-06T00:06:20Z` a `2026-08-06T00:06:35.803897Z`.

- cinco servicios presentes;
- 25 request logs para los casos no-preflight;
- latencia presente en 25/25;
- 10 respuestas 401 y 15 respuestas 400;
- 45 entradas stdout/stderr de runtime/framework;
- marcadores de rechazo App Check presentes;
- 0 correos/PII en payloads inspeccionados;
- 0 JWT;
- 0 API keys;
- 0 valores secretos;
- 0 respuestas con secretos o tokens.

`correlationId`, `durationMs` y `safeErrorCode` custom no aplican a este conjunto: App Check o el protocolo callable rechazaron cada request antes de la entrada al handler. La duración equivalente sí está registrada como `httpRequest.latency`, y los códigos seguros se verificaron en la respuesta callable (`UNAUTHENTICATED`, `INVALID_ARGUMENT`). Su verificación dentro del handler queda reservada al functional smoke con attestation válida.

## Límites y siguiente paso

Este slice certifica exclusivamente la frontera de invocación. No certifica happy paths, persistencia, replay, idempotencia ni lógica de negocio. El siguiente paso autorizado es reanudar `AI-02H1E.7 — Preview Functional Smoke Validation` con App Check válido y tráfico controlado.

No se tocó Vercel, el dominio productivo conocido, App Check enforcement, Firebase Rules, secretos, Storage, Tasks, Staging ni Production. No hubo deploy, commit, push ni PR.
