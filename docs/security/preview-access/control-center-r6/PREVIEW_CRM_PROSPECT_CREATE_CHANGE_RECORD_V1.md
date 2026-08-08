# Preview CRM Prospect Create Change Record V1

## Cambios realizados

- Se creó únicamente el conjunto de cuatro documentos de evidencia R6.
- Se creó un worktree aislado basado exactamente en `origin/main` para preservar el gate.
- Se seleccionó localmente el alias Firebase `preview` ya versionado; no produjo cambios en el worktree ni operaciones cloud.

## Acciones read-only

- Trazado estático del flujo CRM create.
- Auditoría de Firestore Rules, RBAC y ProtectedRoute.
- Consulta sanitizada de logs existentes de denegaciones Firestore.
- Intento read-only de obtener la release desplegada de Rules, detenido por IAM 403.

## Acciones no realizadas

- No se repitió el create.
- No se enumeraron prospectos.
- No se modificó el rol ni custom claims.
- No se modificaron Firestore, Rules, código o configuración versionada.
- No se ejecutó provisioning, deploy, login, logout, commit, push o PR.
- No se accedió a Production ni Staging.

## Resultado

El diagnóstico queda detenido para revisión con clasificación `E. CLIENT_AUTHORITY_MODEL_MISMATCH`. La corrección propuesta requiere diseño e implementación separados; R6 no la implementa.
