# Preview Global Admin Provisioning Certification V1

## Dictamen

**PREVIEW GLOBAL ADMIN PROVISIONING CERTIFIED — READY FOR CONTROLLED DRY-RUN AND APPLY**

Este dictamen certifica el mecanismo; no certifica que se haya ejecutado. Durante R3 no se realizó `apply`, login, deploy ni escritura remota.

## Alcance y gate

- Rama auditada: `feature/intelligence-preview-global-admin-provisioning`.
- Base y `HEAD`: `origin/main` en `ba9f75f1e9940b96cb7ef31d267deb80be0363f8` antes de los cambios R3.
- Firebase y GCP: `aura-intel-preview`.
- Entorno permitido: `PREVIEW` exclusivamente.
- Production no está autorizada y Staging está fuera de alcance.
- El worktree estaba limpio al iniciar.

## Rol mínimo

`RECOMMENDED_PREVIEW_ROLE = VIEWER`.

Las reglas productivas aceptan `VIEWER` para el login cuando el documento canónico existe y `isActive == true`. En el mapa RBAC, `VIEWER` concede únicamente `dashboard.read` y `market.read`. `SUPPORT` agrega `advisors.read`; `ADMIN` y `SUPER_ADMIN` reciben todas las capacidades, incluidas capacidades técnicas o destructivas. `READ_ONLY` no forma parte del allowlist de login y por ello no es una alternativa válida.

## Contrato certificado

`PreviewGlobalAdminProvisioningRequestV1` admite exclusivamente:

- `targetEnvironment`: debe ser exactamente `PREVIEW`.
- `firebaseUid`: string, con trim, no vacío, una sola línea y máximo 128 caracteres.
- `role`: valor exacto del allowlist productivo.
- `isActive`: debe ser exactamente `true`.

El target guard exige simultáneamente el proyecto `aura-intel-preview`, el entorno `PREVIEW` y la colección `platform_global_admins`. No se infiere el entorno por hostname.

## Modelo de escritura e idempotencia

El único documento de autoridad permitido es `platform_global_admins/{UID}` y su payload productivo exacto es:

```json
{
  "isActive": true,
  "role": "VIEWER"
}
```

- Documento ausente: `CREATED`.
- Documento idéntico: `REUSED`, sin escrituras.
- Documento distinto o con campos adicionales: fail-closed con `EXISTING_DOCUMENT_CONFLICT`.

No se persisten email, tenant, membership, custom claims ni PII. El UID sólo se acepta mediante archivo local indicado por ruta o por `AURA_PREVIEW_UID_FILE`; el valor no se acepta como argumento directo de CLI.

## Auditoría y privacidad

Una creación usa una transacción para escribir el documento de autoridad y un registro en la colección existente `platform_audit_logs`. El registro contiene target Preview, acción, rol, timestamp de servidor, locator UID sanitizado, estado previo y validez posterior. No contiene el UID completo ni PII. Un replay idéntico produce `REUSED` con cero escrituras.

## Dry-run

`--dry-run` ejecuta las mismas validaciones de request, target, rol, estado esperado e idempotencia y realiza cero escrituras. `--apply` requiere además el change ID exacto `PREVIEW-GLOBAL-ADMIN-PROVISIONING-R3-V1`.

## Validación

| Control | Resultado |
| --- | --- |
| Suite R3 de provisioning | PASS, 20/20 |
| Guard de reglas Preview | PASS, 15/15 |
| Sintaxis del runner | PASS |
| TypeScript `noEmit` | PASS |
| Root build | PASS, 2,134 módulos transformados |
| Functions build | No aplica; el grafo de Functions no fue modificado |
| JSON de matriz | PASS |
| `git diff --check` | PASS |
| Evidencia R3 | PASS, exactamente cuatro documentos |

## Condición de operación posterior

La ejecución posterior debe comenzar con dry-run, usar un archivo UID local no versionado, conservar los guards exactos de Preview y requerir revisión humana antes de cualquier apply. Esta certificación no autoriza por sí misma la ejecución.
