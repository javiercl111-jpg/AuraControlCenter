# Preview Global Admin Provisioning Change Record V1

## Cambios realizados

- Se añadió `scripts/preview-global-admin-provisioning.cjs`.
- Se añadió `scripts/tests/preview-global-admin-provisioning.test.cjs`.
- Se añadieron los scripts npm `test:preview-global-admin-provisioning` y `dry-run:preview-global-admin-provisioning`.
- Se añadieron exactamente cuatro documentos de evidencia bajo `docs/security/preview-access/control-center-r3/`.

## Controles implementados

- Contrato `PreviewGlobalAdminProvisioningRequestV1` con cuatro campos exactos y rechazo de campos inesperados.
- Guards fail-closed para proyecto, entorno, colección, UID, rol e `isActive`.
- Allowlist derivado de `firestore.rules`, sin wildcard.
- Selección de `VIEWER` como rol mínimo recomendado.
- Idempotencia estricta: create ausente, no-op idéntico y conflicto ante cualquier divergencia.
- Documento de autoridad limitado a `isActive` y `role`.
- Auditoría transaccional en `platform_audit_logs` con timestamp de servidor y locator UID sanitizado.
- Dry-run con cero escrituras.
- Apply condicionado al change ID exacto `PREVIEW-GLOBAL-ADMIN-PROVISIONING-R3-V1`.
- Lectura del UID desde archivo local indicado por ruta; no se admite el UID directo como argumento de CLI.
- Errores CLI reducidos a códigos seguros.

## Cobertura agregada

La suite R3 contiene 20 pruebas: los 17 escenarios obligatorios y controles adicionales para colección no canónica, `isActive` distinto de `true` y confirmación explícita de apply. Todas pasaron.

## Cambios deliberadamente no realizados

- No se ejecutó apply ni se creó un documento real.
- No se ejecutó login ni deploy.
- No se modificaron custom claims.
- No se añadieron email, tenant, membership, password, secret o PII al contrato.
- No se modificó el grafo de Functions.
- No se tocó Production ni Staging.
- No se realizó commit, push o PR.

## Estado de revisión

El mecanismo queda detenido para revisión humana antes de cualquier dry-run controlado o apply posterior.
