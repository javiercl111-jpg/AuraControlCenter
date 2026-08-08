# PREVIEW CRM Lead Create Backend Change Record V1

## Cambios R7

- Se agregó un callable `createCrmLead` al deployment unit aislado de Preview con App Check obligatorio y runtime guard existente.
- Se definió y validó el contrato cerrado `CreateCrmLeadRequestV1`.
- Se agregó resolución canónica de principal activo más grant explícito `crm.leads.create`; ningún rol obtiene la capability automáticamente.
- Se agregó persistencia transaccional Admin SDK con ID y timestamps server-owned.
- Se agregó idempotencia `CREATED/REUSED/CONFLICT`, verificación del lead original y replay sin writes.
- Se reutilizó `platform_audit_logs` con un evento sanitizado y logging estructurado sin PII.
- Se migró exclusivamente el CREATE del frontend de `addDoc` a callable, sin retry automático ni optimistic duplicate.
- Se reforzaron Rules para mantener grants, idempotencia y audit fuera del cliente; `platform_leads` continúa deny para create/update/delete.
- Se agregaron suites backend/frontend y un guard de regresión de Rules.
- Se extendió el deployment manifest de Preview con el handler y su identidad runtime dedicada propuesta.

## Archivos funcionales

- `functions/src/crm/createCrmLeadContractV1.ts`
- `functions/src/crm/createCrmLeadCoreV1.ts`
- `functions/src/crm/firestoreCrmLeadCreateV1.ts`
- `functions/src/crm/createCrmLead.ts`
- `functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts`
- `functions/src/previewDiscoveryIndex.ts`
- `src/services/platformLeadService.ts`
- `src/pages/CrmPage.tsx`
- `src/services/rbacService.ts`
- `firestore.rules`
- `package.json`

## Archivos de prueba

- `functions/tests/crmLeadCreate/createCrmLead.test.ts`
- `functions/tests/vitest.crmLeadCreate.config.ts`
- `src/services/platformLeadService.test.ts`
- `scripts/tests/preview-crm-lead-rules-guard.test.cjs`

## No cambios

- No deploy.
- No grant real.
- No prospecto remoto.
- No cambio de `VIEWER`.
- No modificación de administrador global real.
- No apertura de Firestore Rules.
- No Production ni Staging.
- No commit, push ni PR.
