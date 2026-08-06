# Preview Functional Smoke Validation Retry Evidence Index V1

Change ID: `AI-02H1E.7-R2-PREVIEW-SMOKE-VALIDATION-20260805-01`

## Evidencia

| ID | Evidencia | Resultado |
|---|---|---|
| R2-E01 | Gate Git/toolchain/targets | PASS exacto |
| R2-E02 | Describe individual de Functions | 5/5 `ACTIVE`, `nodejs20` |
| R2-E03 | Cloud Run read-back | 5/5 `READY`; revisiones exactas |
| R2-E04 | IAM por servicio/proyecto | cinco bindings exactos; proyecto 0 |
| R2-E05 | Runtime identities | cinco mappings exactos |
| R2-E06 | Secrets metadata-only | intake v3, Gemini v2, HMAC v2; valores no leídos |
| R2-E07 | Parameters | Preview/flags/timeout/endpoint exactos |
| R2-E08 | App Check/Firebase app | una Web App; callable enforcement; control-plane sin cambio |
| R2-E09 | Debug token CLI | 0 tokens; valores no observados |
| R2-E10 | reCAPTCHA Enterprise metadata | una key; solo localhost y dominio Preview |
| R2-E11 | Artifact cleanup | policy activa a 7 días |
| R2-E12 | Tasks/Storage | Tasks deshabilitado; solo buckets Functions |
| R2-E13 | Firestore baseline previo | 13 colecciones, todas 0 |
| R2-E14 | Storage baseline previo | 5 y 3 objetos administrados |
| R2-E15 | Matriz HTTPS | 35/35; sin transporte ni IAM |
| R2-E16 | Preflight | 5/5 HTTP 204 |
| R2-E17 | Protocolo callable | 20/20 HTTP 400 `INVALID_ARGUMENT` |
| R2-E18 | POST sin longitud | 5/5 HTTP 411 fail-closed |
| R2-E19 | App Check ausente | 5/5 HTTP 401 `UNAUTHENTICATED` |
| R2-E20 | Firestore baseline posterior | 13 colecciones sin cambio |
| R2-E21 | Storage/Tasks posterior | sin cambio |
| R2-E22 | Suites contractuales directas | 121/121 |
| R2-E23 | Idempotency/rate/payload/replay | 104/104 |
| R2-E24 | Shadow integration | 15/15 |
| R2-E25 | Authority/tenant | 19/19 |
| R2-E26 | Preview Rules | 14/14 |
| R2-E27 | Total automatizado | 273/273 |
| R2-E28 | Logging 24 h | cinco servicios/revisiones, 102 requests, latencia 102/102 |
| R2-E29 | Logging intervalo R2 | 29 requests observados, 0 HTTP 403 |
| R2-E30 | Escaneo sanitizado | cero PII, tokens, secretos y URLs Production ejecutadas |
| R2-E31 | Vercel proyecto/dominio | aislado y READY |
| R2-E32 | Vercel env names-only | cero variables en ambos targets; valores no leídos |
| R2-E33 | Cliente source | inicialización Firebase/App Check fail-closed presente |
| R2-E34 | Referencias Production | dos, no ejecutadas, pendientes de happy path |
| R2-E35 | Scope final | sin cambios externos, deploy o happy path |

## Archivos de evidencia

- `docs/security/discovery/post-deployment/PREVIEW_SMOKE_VALIDATION_R2_V1.md`
- `docs/security/discovery/post-deployment/PREVIEW_SMOKE_VALIDATION_R2_MATRIX_V1.json`
- `docs/security/discovery/post-deployment/PREVIEW_SMOKE_VALIDATION_R2_EVIDENCE_INDEX_V1.md`
- `docs/security/discovery/post-deployment/PREVIEW_SMOKE_VALIDATION_R2_CHANGE_RECORD_V1.md`

## Manejo de evidencia

No se conservaron bodies crudos, tokens, valores secretos, identidades personales, URLs de logs ni documentos Firestore. Firestore se verificó exclusivamente mediante agregaciones `count`. Vercel se inspeccionó desde un directorio temporal sin crear `.vercel` ni enlazar el worktree; se listaron únicamente nombres de variables y nunca valores.

Los artefactos compilados creados para ejecutar el runner shadow fueron restaurados/eliminados exclusivamente bajo `functions/lib`; eran regenerables y el worktree volvió a limpio antes de crear esta documentación.
