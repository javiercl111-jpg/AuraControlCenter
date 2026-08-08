# PREVIEW CRM Lead Create Deployment Change Record V1

## Cambios locales R8

- Nuevo provisioner `preview-crm-lead-capability-provisioning.cjs` con dry-run/apply separados, target Preview fijo, UID desde archivo externo, contrato exacto, auditoría sanitizada e idempotencia.
- Nueva suite de 22 tests para least privilege, target guards, dry-run, replay y sanitización.
- Nuevo guard `preview-crm-lead-create-deployment-guard.cjs` para un único target codebase/function.
- Nueva suite de 5 tests del deployment guard.
- Nuevos scripts npm para test, dry-run de capability, guard y deploy selectivo futuro.
- Corrección del Rules guard heredado para certificar deny por match explícito o por fallback final, sin relajar Rules.
- Cuatro documentos R8 bajo el directorio de evidencia autorizado.

## Inventario sin cambios

- Backend R7 no fue modificado.
- Frontend R7 no fue modificado.
- Firestore Rules no fueron modificadas.
- El rol real sigue `VIEWER`.
- El grant real continúa ausente.
- La Function real continúa ausente.
- El frontend servido ya está actualizado; no se planifica redeploy.

## Operaciones no ejecutadas

- No capability apply.
- No creación de identidad/IAM.
- No Firebase deploy.
- No Vercel deploy.
- No prospect create.
- No Production ni Staging.
- No commit, push ni PR.
