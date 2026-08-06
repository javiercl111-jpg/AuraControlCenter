# Preview Invocation Boundary Evidence Index V1

Change ID: `AI-02H1E.8-PREVIEW-INVOCATION-BOUNDARY-20260805-01`

## Evidencia autoritativa

| ID | Evidencia | Resultado |
|---|---|---|
| E-01 | Gate Git, Firebase, GCP y Node | Rama/HEAD/target exactos; worktree inicial limpio |
| E-02 | Functions Gen2 read-back previo | 5/5 `ACTIVE`; identidades y secretos exactos |
| E-03 | Cloud Run read-back previo | 5/5 `READY`; cinco revisiones exactas |
| E-04 | IAM previo por servicio | 0 miembros `roles/run.invoker` en 5/5 |
| E-05 | IAM previo a nivel proyecto | 0 miembros `roles/run.invoker` |
| E-06 | Deployment unit source | `enforceAppCheck: true`; proyecto/región/identidades exactos |
| E-07 | Manifiesto V1 | Cinco servicios; `allUsers`; `roles/run.invoker`; scope individual |
| E-08 | Suite de guardia | 13/13 PASS; 12/12 negativas requeridas |
| E-09 | Guardia CLI | `PREVIEW_INVOCATION_BOUNDARY_GUARD_PASS` |
| E-10 | Aplicación IAM | Cinco operaciones exitosas, una por servicio |
| E-11 | IAM posterior por servicio | Una política exacta e incondicional por servicio |
| E-12 | IAM posterior a nivel proyecto | Permanece en 0 |
| E-13 | Preservación de revisiones | Las cinco revisiones `00001` no cambiaron |
| E-14 | Preservación de Functions | Mismos estados, identidades, secretos y `updateTime` |
| E-15 | Probes autoritativos | 30/30 respuestas; 0 denegaciones IAM; 0 transporte |
| E-16 | App Check | 10/10 casos relevantes: HTTP 401 / `UNAUTHENTICATED` |
| E-17 | Protocolo callable | 15/15 casos: HTTP 400 / `INVALID_ARGUMENT` |
| E-18 | CORS/preflight | 5/5 HTTP 204 desde dominio Preview |
| E-19 | Logging del intervalo | 25 request logs, latencia 25/25, cinco servicios |
| E-20 | Escaneo sanitizado de payloads | 0 PII/email, 0 JWT, 0 API keys, 0 secretos |
| E-21 | Scope negativo | Sin deploy, Vercel, Rules, App Check, Storage, Tasks, Staging o Production |

## Artefactos locales

- `scripts/manifests/preview-invocation-boundary-v1.json`
- `scripts/preview-invocation-boundary-guard.cjs`
- `scripts/tests/preview-invocation-boundary-guard.test.cjs`
- `package.json`
- `docs/security/discovery/post-deployment/invocation-boundary/PREVIEW_INVOCATION_BOUNDARY_REMEDIATION_V1.md`
- `docs/security/discovery/post-deployment/invocation-boundary/PREVIEW_INVOCATION_BOUNDARY_MATRIX_V1.json`
- `docs/security/discovery/post-deployment/invocation-boundary/PREVIEW_INVOCATION_BOUNDARY_EVIDENCE_INDEX_V1.md`
- `docs/security/discovery/post-deployment/invocation-boundary/PREVIEW_INVOCATION_BOUNDARY_CHANGE_RECORD_V1.md`

## Fuentes técnicas

- [Cloud Run — Allowing public access](https://cloud.google.com/run/docs/authenticating/public)
- [gcloud run services add-iam-policy-binding](https://cloud.google.com/sdk/gcloud/reference/run/services/add-iam-policy-binding)
- [Firebase — Call functions from your app](https://firebase.google.com/docs/functions/callable)

## Manejo de evidencia

No se guardaron cuerpos crudos, credenciales, tokens, valores secretos ni contenido de negocio. Los outputs documentados son conteos, estados, nombres de recursos, revisiones, identidades runtime y códigos de error seguros. Los fixtures temporales no sensibles usados para evitar deformación de argumentos en Windows fueron eliminados.
