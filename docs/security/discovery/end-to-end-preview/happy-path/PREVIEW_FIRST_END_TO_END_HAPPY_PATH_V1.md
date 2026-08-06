# Preview First End-to-End Happy Path V1

Change ID: `AI-02H2.2E-PREVIEW-FIRST-END-TO-END-HAPPY-PATH-20260806-FINAL-01`

Test run: `AI02H2-2E-PREVIEW-HAPPY-PATH-20260806-FINAL-01`

## Dictamen

**C. BLOCKED — PREVIEW END-TO-END HAPPY PATH FAILED**

El flujo se detuvo en `createDiscoveryLead`. Preview aplicó fail-closed porque no existe una policy de containment activa. No se creó lead, link, sesión, capability, conversación ni completion; las fases posteriores no fueron ejecutadas.

## Alcance y gate

La ejecución se limitó al proyecto Preview, a su dominio público y al worktree dedicado. El gate local verificó la rama `audit/intelligence-preview-first-happy-path`, HEAD igual a `origin/main` en `2defd876d2b6`, y worktree limpio.

| Control | Resultado |
|---|---:|
| Functions gen2 ACTIVE | 5/5 |
| Cloud Run services READY | 5/5 |
| Cloud Run revisions FAILED | 0 |
| Vercel project | `aura-control-center-preview` |
| Vercel deployment | READY |
| App Check debug tokens | 0 |
| Consola antes del submit | 0 errors, 0 warnings |
| reCAPTCHA Enterprise assets | READY, HTTP 200 |
| Requests al host Production | 0 |
| Requests directas a `a.run.app` | 0 |

El target interno de Vercel se denomina `production`, pero pertenece al proyecto aislado `aura-control-center-preview`; no es el proyecto Production de Aura.

## Baseline agregado

No se leyeron documentos completos ni PII.

| Superficie | Baseline |
|---|---:|
| Discovery links | 0 |
| Leads | 0 |
| Sessions | 0 |
| Capability metadata | 0 |
| Completions | 0 |
| Completion outbox | 0 |
| Idempotency records | 0 |
| Idempotency namespaces | 0 |
| Conversation budgets | 0 |
| Abuse telemetry | 2 |
| Platform events | 0 |
| Discovery reports | 0 |
| Storage funcional | 0 buckets / 0 objects |
| Cloud Tasks | API disabled; no queue surface available |

Los 2 buckets y 8 objetos preexistentes fueron clasificados exclusivamente como artefactos de build, no como Storage funcional.

## Ejecución controlada

Se usaron únicamente datos sintéticos. El primer request efectivo a `createDiscoveryLead` fue rechazado antes de cualquier write de negocio:

- `containment.policy_missing`;
- outcome `DENIED`;
- reason `CONTAINMENT_POLICY_NOT_FOUND`;
- respuesta caller-safe normalizada como `UNAVAILABLE`.

La automatización del navegador integrado no reflejó la llamada en navegación, consola ni conteos de negocio. Antes de inspeccionar el delta de telemetría se produjo una segunda activación UI, también rechazada por el mismo control. El delta final demuestra dos requests efectivos rechazados, por lo que el requisito exactly-once de esta certificación no se satisfizo. No se realizará otro intento bajo este test run.

Una sesión aislada posterior no alcanzó la Function: reCAPTCHA Enterprise cargó correctamente, pero `exchangeRecaptchaEnterpriseToken` respondió HTTP 403 y App Check aplicó `initial-throttle` por 24 horas. Esa sesión no generó writes ni telemetría de backend.

## Read-back posterior

| Superficie | Baseline | Final | Delta |
|---|---:|---:|---:|
| Discovery links | 0 | 0 | 0 |
| Leads | 0 | 0 | 0 |
| Sessions | 0 | 0 | 0 |
| Capability metadata | 0 | 0 | 0 |
| Completions | 0 | 0 | 0 |
| Completion outbox | 0 | 0 | 0 |
| Idempotency records | 0 | 0 | 0 |
| Idempotency namespaces | 0 | 0 | 0 |
| Conversation budgets | 0 | 0 | 0 |
| Abuse telemetry | 2 | 6 | +4 |
| Platform events | 0 | 0 | 0 |
| Discovery reports | 0 | 0 | 0 |
| Storage funcional objects | 0 | 0 | 0 |

Los cuatro eventos nuevos forman dos pares `containment.policy_missing` + `intake.rejected`. No existe duplicado de lead porque no existe lead.

## Causa raíz y bloqueadores

1. **Containment Preview no provisionado.** Los conteos de `discovery_containment_active_v1`, `discovery_containment_policies_v1` y `discovery_containment_audit_v1` son 0. El runtime niega correctamente la operación.
2. **App Check no utilizable en la sesión headless de fallback.** El exchange reCAPTCHA Enterprise devuelve 403 y queda throttled; no se intentó bypass ni debug token.
3. **Referencia Production latente en el response del handler.** `createDiscoveryLead` construye `discoveryUrl` con el host Production tanto en creación como en replay idempotente. El cliente actual ignora ese campo y navega mediante una ruta relativa, pero el valor se devolvería al cliente en una ejecución exitosa y contradice el aislamiento requerido.
4. **Exactly-once no certificado.** Hubo dos invocaciones rechazadas dentro de este intento de certificación; ninguna produjo datos de negocio.

## Fases no ejecutadas

`exchangeDiscoveryToken`, `resolveDiscoverySession`, `evaluateConversation` y `completeDiscoverySession` no fueron invocadas. No hubo Gemini, fallback, HMAC consumption, PDF, Tasks, notifications, report generation ni Storage funcional.

## Remediación mínima requerida

1. Provisionar mediante un cambio separado y autorizado una policy Preview válida, activa, vigente, auditada y con rollback.
2. Eliminar del contrato de respuesta la URL Production o resolverla de forma explícita y fail-closed para Preview, manteniendo navegación relativa.
3. Revalidar App Check desde un navegador controlado no throttled, sin debug tokens ni bypass.
4. Iniciar un slice nuevo con un nuevo test run; no reutilizar ni reintentar el presente.

## Invariantes de cierre

- Functions: 5/5 ACTIVE.
- Cloud Run: 5/5 READY; 0 revisiones FAILED.
- Vercel Preview: READY.
- Production y Staging: no accedidos ni modificados.
- Código, IAM, Secret Manager, Rules, Firebase, Vercel e infraestructura: sin cambios.
- Deploy, commit, push y PR: no ejecutados.
