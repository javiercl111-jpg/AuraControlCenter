# Preview `createDiscoveryLead` 429 Change Record V1

## Propósito

Registrar el slice documental R3D que identifica la causa del HTTP 429 observado en el único submit R3C-R2.

## Base de trabajo

- Base: `origin/main` en el estado auditado `ffecc346…`.
- Rama: `audit/intelligence-preview-create-lead-429`.
- Worktree aislado: sí; la ruta local se omite por política de sanitización.

## Cambios realizados

Se añadieron exactamente cuatro artefactos bajo `docs/security/discovery/end-to-end-preview/create-lead-429/`:

1. `PREVIEW_CREATE_DISCOVERY_LEAD_429_DIAGNOSIS_V1.md`
2. `PREVIEW_CREATE_DISCOVERY_LEAD_429_MATRIX_V1.json`
3. `PREVIEW_CREATE_DISCOVERY_LEAD_429_EVIDENCE_INDEX_V1.md`
4. `PREVIEW_CREATE_DISCOVERY_LEAD_429_CHANGE_RECORD_V1.md`

No se modificó código, configuración, tests, infraestructura, datos cloud ni estado del fixture anterior.

## Decisión documentada

- Clasificación: `A — EXPECTED_RATE_LIMIT_FROM_PRIOR_TEST`.
- Control exacto: cuota de emergencia global `INTAKE` de containment en Preview.
- Condición: contador fijo de 24 horas en 1/1 por el submit exitoso anterior.
- Resultado: `EMERGENCY_QUOTA_EXCEEDED` → `resource-exhausted` → `DISCOVERY_TEMPORARILY_UNAVAILABLE` → HTTP 429.
- Expiración del bucket: `2026-08-08T00:00:00Z`.
- El request R3C-R2 no alcanzó creación ni persistencia.

## Acciones explícitamente no realizadas

- No submit, retry, reload ni segundo intento.
- No navegador ni fixture nuevo.
- No reset, delete o modificación de limiter/counter.
- No cambio de política o bypass.
- No Production ni Staging.
- No deploy, commit, push ni PR.

## Validaciones requeridas

- El directorio contiene exactamente cuatro archivos.
- El JSON de matriz parsea correctamente.
- `git diff --check` no reporta errores.
- El diff solo contiene los cuatro documentos listados.
- La búsqueda de patrones prohibidos no encuentra rutas locales absolutas, correos, IPv4, tokens/API keys o IDs completos conocidos.

## Estado

Diagnóstico completo; listo para revisión y resolución dirigida. No se implementó remediación.
