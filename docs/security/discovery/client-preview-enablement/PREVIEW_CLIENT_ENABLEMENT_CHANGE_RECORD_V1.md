# Preview Client Enablement Change Record V1

## Control

- Change ID: `AI-02H2.1-PREVIEW-CLIENT-ENABLEMENT-20260805-01`
- Fecha: `2026-08-05`
- Rama: `fix/intelligence-preview-client-enablement`
- Target único: `aura-intel-preview`
- Proyecto Vercel único: `aura-control-center-preview`
- Production: `REMEDIATION_HOLD / NOT AUTHORIZED`

## Cambios de repositorio

- Se agregó un contrato Preview de siete variables, project/auth/host exactos y validación fail-closed.
- Se renombró la variable de site key al contrato solicitado `VITE_RECAPTCHA_SITE_KEY`.
- Se retiró `VITE_FIREBASE_STORAGE_BUCKET` del contrato requerido de arranque.
- Se eliminó logging de metadata Firebase en desarrollo.
- Se fijó Functions SDK a `us-central1` a través del contrato inmutable.
- Se mantuvo App Check Enterprise con auto-refresh y debug desactivado.
- Se sustituyó la confianza en `discoveryUrl` por una ruta relativa construida con campos validados y codificados.
- Se aplicó el mismo boundary a la ruta principal y al harness de desarrollo.
- Se agregó guard fail-closed y cobertura negativa para las quince clases de rechazo solicitadas, más casos complementarios.
- Se actualizaron las pruebas heredadas del contrato App Check.
- Se creó evidencia durable sanitizada.

## Cambios Vercel

- Se agregaron exactamente siete variables project-scoped al proyecto `aura-control-center-preview`.
- Cada variable se asignó a los scopes internos `preview` y `production`.
- Las variables se almacenaron como sensibles y sus valores no se imprimieron ni documentaron.
- No se usaron Shared Variables; read-back final: cero.
- Se ejecutó un deploy forzado al target interno Production del proyecto aislado Preview.
- Read-back final: `READY` y dominio `preview-controlcenter.auranexus.io` asociado.
- El proyecto `aura-control-center` no fue modificado.

## Higiene local

El enlace explícito de Vercel generó automáticamente un `.env.local` con material OIDC temporal. El archivo no se leyó ni usó y fue eliminado inmediatamente. La modificación automática redundante de `.gitignore` fue revertida de forma quirúrgica. Después del read-back se eliminó el directorio local `.vercel`. Ninguno de esos artefactos permanece.

## Acciones no realizadas

- Happy path end-to-end.
- Deploy de Functions.
- Mutación Firebase, IAM, Secret Manager o Rules.
- App Check enforcement.
- Cambios Staging.
- Cambios Production.
- Commit.
- Push.
- PR.

## Commit sugerido

`fix(intelligence): enable isolated preview client`

No se creó el commit.

