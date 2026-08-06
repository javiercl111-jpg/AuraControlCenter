# Preview Client Enablement Evidence Index V1

Change ID: `AI-02H2.1-PREVIEW-CLIENT-ENABLEMENT-20260805-01`

Toda la evidencia está sanitizada. No contiene valores de variables, API keys, App IDs, site keys, credenciales, correos, URLs firmadas ni rutas locales absolutas.

| ID | Fase | Evidencia | Resultado sanitizado |
|---|---|---|---|
| E01 | Gate | Git branch, SHA, origin y status | Rama y SHA exactos; worktree inicialmente limpio |
| E02 | Gate | Node y npm | `v20.20.2`; `10.8.2` |
| E03 | Target | `.firebaserc` y configuración GCP | Alias `preview`; proyecto `aura-intel-preview` |
| E04 | Vercel inventory | Project inspect y Project API | Proyecto exacto, Vite, repo y rama interna certificados |
| E05 | Vercel inventory | Domain y target metadata | Dominio Preview asociado al target interno Production |
| E06 | Firebase Web App | Apps list y SDK config en memoria | Una Web App; project/auth/identificadores coherentes |
| E07 | reCAPTCHA | Key list en memoria | Una key Enterprise Preview; dominios permitidos certificados |
| E08 | Source | Configuración Firebase/App Check | Siete variables exactas; fail-closed; debug OFF |
| E09 | Source | Discovery navigation boundary | Origen del response no confiado; ruta relativa codificada |
| E10 | Guard | `preview-client-enablement-guard.test.cjs` | `23/23 PASS` |
| E11 | Guard | Source-only | `PREVIEW_CLIENT_SOURCE_GUARD_PASS` |
| E12 | Guard | Read-back real in-memory | `PREVIEW_CLIENT_ENABLEMENT_GUARD_PASS` |
| E13 | Unit tests | Preview client configuration | `16/16 PASS` |
| E14 | Regression | Preview trust completion | `20/20 PASS` |
| E15 | Regression | Runtime contracts | `18/18 PASS` |
| E16 | Regression | Preview deployment unit | `22/22 PASS` |
| E17 | Regression | Invocation boundary | `13/13 PASS` |
| E18 | Build | TypeScript noEmit y root build | PASS |
| E19 | Bundle | Búsqueda de targets/URLs prohibidas | Preview presente; Production y `a.run.app` ausentes |
| E20 | Vercel variables | Env metadata read-back | Siete project variables; ambos scopes; cero Shared |
| E21 | Deployment | Inspect y target read-back | Proyecto exacto; target `production`; `READY` |
| E22 | Browser | Carga, consola y activos observados | Login visible; reCAPTCHA Enterprise; cero errores |
| E23 | Browser | Inventario de recursos observados | Cero Production y cero `a.run.app` |
| E24 | Local hygiene | Status y archivos temporales | Sin `.env.local`; sin enlace `.vercel` persistente |
| E25 | Final validation | Git diff/status/stat/name-status | PASS; solo cambios previstos y artefactos nuevos del slice |

## Límites de evidencia

- No se ejecutó el happy path.
- No se leyó ni registró material de configuración pública sensible para el operador.
- No se inspeccionaron valores de variables Vercel después de crearlas; se usó metadata de nombre, scope, tipo y fecha.
- App Check se corroboró mediante carga sin errores y activos reCAPTCHA Enterprise; enforcement no se modificó.
- Las advertencias de dependencias y tamaño de bundle se registran como riesgo, no como fallo de aislamiento.
