# Preview Functional Smoke Validation V1

Change ID: `AI-02H1E.7-PREVIEW-SMOKE-VALIDATION-20260805-01`

## Dictamen

**BLOCKED — PREVIEW VALIDATION FAILED**

El deployment existe y sus recursos están sanos, pero el backend Preview no es funcionalmente invocable. No se autoriza Production.

## Gate

- Rama: `audit/intelligence-preview-smoke-validation`.
- HEAD y `origin/main`: `ad4986aaffc278c2c949488bde86f9a253e4e7a5`.
- Worktree inicialmente limpio.
- Firebase alias y proyecto GCP: `aura-intel-preview`.
- Node: `v20.20.2`.

## Read-back de infraestructura

| Control | Resultado |
|---|---|
| Functions | 5/5 `ACTIVE` |
| Cloud Run | 5/5 `READY` |
| Runtime | Node 20 en cinco Functions |
| Runtime identities | 5/5 bindings exactos |
| Secret resources | 3/3 existentes; una versión habilitada cada uno |
| Secret IAM | Un accessor exacto por secreto; cero bindings project-level |
| Artifact Registry | `gcf-artifacts`; una cleanup policy activa |
| Functions FAILED | 0 |
| Cloud Tasks API | Deshabilitada |

Los dos buckets observados están etiquetados como administrados por Cloud Functions y corresponden a fuentes/uploads de deployment. No se observó una superficie Storage funcional ni un trigger Storage.

## Bloqueador funcional primario

Los cinco servicios Cloud Run tienen cero bindings `roles/run.invoker`. En consecuencia, Cloud Run rechaza el tráfico antes del Functions Framework:

- 5 preflight `OPTIONS`: HTTP 403;
- 5 POST sin App Check: HTTP 403;
- 5 POST con attestation App Check inválida: HTTP 403;
- 5 POST con autenticación inválida: HTTP 401.

Los 20 probes fueron no mutantes. No crearon datos de negocio, tokens, secretos o recursos.

La ausencia del invoker impide evaluar App Check y la lógica callable. Un endpoint callable público debe poder atravesar IAM de plataforma para que Firebase Functions aplique sus verificaciones de App Check, autenticación y payload. Este cambio IAM no está autorizado en el slice de auditoría.

## Matriz funcional

| Caso | Estado live | Evidencia |
|---|---|---|
| Request válido | `BLOCKED_NOT_REACHED` | IAM de plataforma rechaza antes del handler |
| Request inválido | `BLOCKED_NOT_REACHED` | IAM de plataforma rechaza antes del handler |
| Parámetros faltantes | `BLOCKED_NOT_REACHED` | IAM de plataforma rechaza antes del handler |
| App Check ausente | `PLATFORM_DENIED` | HTTP 403; App Check no llegó a evaluarse |
| App Check inválido | `PLATFORM_DENIED` | HTTP 403; App Check no llegó a evaluarse |
| Autenticación incorrecta | `PLATFORM_DENIED` | HTTP 401 de Cloud Run |
| Tenant incorrecto | `BLOCKED_NOT_REACHED` | No existe sesión live gobernada accesible |
| Replay | `BLOCKED_NOT_REACHED` | No pudo crearse capability live |
| Idempotencia | `BLOCKED_NOT_REACHED` | No pudo ejecutarse intake live |
| Timeout | `BLOCKED_NOT_REACHED` | Runtime no alcanzado |
| Rate limit | `BLOCKED_NOT_REACHED` | Runtime no alcanzado |

## Hallazgo de aislamiento

`createDiscoveryLead` construye una URL de dominio Production en las ramas nueva y cached. Se detectaron dos referencias dentro del source desplegable. Esto incumple el requisito “cero URLs productivas” y requiere remediación de código separada antes de repetir el smoke.

El cliente Preview publicado tampoco inicializa Firebase porque su configuración runtime está incompleta. Aunque el provider reCAPTCHA Enterprise y su dominio Preview/localhost existen, no hay un cliente Preview operativo certificado desde el cual ejecutar la attestation y el flujo completo.

## Seguridad

- Fail-closed de plataforma: verificado; el tráfico no autorizado es rechazado.
- Fail-closed de aplicación/App Check: no evaluable live por el bloqueo IAM anterior.
- PII expuesta por probes: 0.
- Secretos o tokens expuestos por probes: 0.
- Exports desplegados: exactamente cinco.
- Storage triggers/exports: 0.
- Tasks triggers/exports: 0; API deshabilitada.
- PDF exports: 0.
- Notification exports: 0.
- URL Production en código desplegable: 2 referencias; FAIL.

## Logging y telemetría

Cloud Logging registró los rechazos HTTP de plataforma. El análisis sanitario no encontró PII, secretos o tokens en payloads de aplicación. En una ventana de 24 horas se encontraron cero eventos estructurados con `correlationId`/`correlationKey`, `durationMs`, `safeErrorCode`/`reasonCode` o `measurements`.

La telemetría de runtime no puede certificarse porque los handlers no recibieron tráfico.

## Remediación requerida antes del retry

1. Aprobar y aplicar la política invoker correcta para las cinco callables Preview, manteniendo App Check y los guards de aplicación.
2. Eliminar la construcción de URL Production y resolver el dominio exclusivamente desde configuración Preview fail-closed.
3. Completar la configuración runtime del cliente Preview sin compartir variables Production.
4. Preparar un fixture smoke gobernado, no sensible y con lifecycle/cleanup definido.
5. Repetir todos los casos live y certificar telemetría de runtime.

## Límites del slice

No se modificó código, IAM, Firebase, Vercel, GCP, Staging o Production. No hubo deploy, commit, push o PR.

