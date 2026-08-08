# PREVIEW CRM Lead Create Backend Certification V1

## Dictamen

**PREVIEW CRM LEAD CREATE BACKEND CERTIFIED — READY FOR CONTROLLED CAPABILITY PROVISIONING AND DEPLOY**

## Alcance certificado

- Firebase/GCP: `aura-intel-preview`.
- Vercel: `aura-control-center-preview`.
- Rol actual preservado: `VIEWER`.
- Capability mínima: `crm.leads.create`.
- Privilegios adicionales concedidos: `NONE`.
- No hubo deploy, asignación real de capability, creación remota de prospecto ni acceso a Production/Staging.

## Causa heredada y cierre arquitectónico

R6 clasificó la causa como `CLIENT_AUTHORITY_MODEL_MISMATCH`: el CREATE recorría `CrmPage → createLead → addDoc → platform_leads → Rules → DENY`. Ese deny era correcto y se conserva.

R7 reemplaza únicamente el CREATE por:

`CrmPage → createLead → createCrmLead callable → Authentication → App Check → crm.leads.create → validación V1 → Admin SDK transaction → platform_leads + idempotency + audit`.

Lecturas, filtros, pipeline, actualización, conversión y eliminación no se migraron en este slice.

## Contrato y validación

`CreateCrmLeadRequestV1` admite solo `schemaVersion`, `idempotencyKey` y un objeto `lead` cerrado. El objeto acepta exclusivamente los campos existentes necesarios: empresa, contacto, email, teléfono, fuente, etiquetas de fuente, módulos, valor estimado, notas y fecha de seguimiento. Aplica trimming, allowlists, unicidad, formato y límites.

Se rechazan campos inesperados y campos autoritativos controlados por cliente, incluidos ID, etapa, timestamps, actor, rol, capabilities, environment y metadata de auditoría. El servidor fija `NEW_LEAD`, genera el ID y controla timestamps y valores de conversión iniciales.

## Authentication, App Check y autorización

- Firebase Auth es obligatorio y se usa exclusivamente el UID autenticado.
- El callable hereda `enforceAppCheck: true` del deployment unit certificado y además falla cerrado si no existe evidencia App Check en el handler.
- La presencia de Auth, el email, UI state y el rol por sí solos nunca autorizan.
- El contrato R4 de `platform_global_admins` contiene exactamente `isActive` y `role`; no soporta un grant aislado.
- La extensión mínima R7 es el documento backend-owned `platform_global_admin_capability_grants/{canonical actor}` con schema `PlatformGlobalAdminCapabilityGrantV1`, environment `PREVIEW`, `isActive: true` y la única capability `crm.leads.create`.
- El principal canónico debe seguir activo y con un rol permitido, pero el rol no sustituye el grant explícito.
- `crm.leads.create` se agregó al vocabulario TypeScript sin asignarlo a ninguna matriz de rol. `VIEWER` permanece sin esa capability hasta provisioning controlado.

## Idempotencia y auditoría

La idempotency key se valida y se combina con el actor en un locator SHA-256. La transacción Admin SDK crea el lead, el registro `crm_lead_create_idempotency` y un evento sanitizado en la infraestructura existente `platform_audit_logs`.

- Primera solicitud: `CREATED`.
- Replay contractual idéntico: `REUSED`, lead original verificado, delta de writes `0`.
- Misma key con payload distinto o registro incoherente: fail-closed.
- Auditoría/logging: operation, environment, outcome, actor locator, lead locator, correlation locator e idempotency outcome.
- No se registra payload CRM, email, teléfono, identificadores completos ni tokens.

Los registros genéricos Authority y Discovery no se reutilizaron porque sus vocabularios, planners y lifecycles están cerrados a otros dominios. Forzarlos para CRM habría violado sus contratos certificados. Se reutilizaron Firebase Admin, el deployment unit Preview, App Check, runtime guard y `platform_audit_logs`.

## Rules y targets

Firestore conserva `create/update/delete = false` para `platform_leads`. Los grants y registros de idempotencia son explícitamente no legibles/no escribibles por clientes. El Admin SDK es una ruta trusted separada.

El deployment unit fija proyecto `aura-intel-preview`, environment `PREVIEW`, región y codebase. La nueva identidad runtime propuesta es Preview-only y requiere provisioning/IAM controlado antes del deploy. Production y Staging permanecen fail-closed.

## Validación

| Gate | Resultado |
|---|---:|
| Backend R7 | 30/30 PASS |
| Frontend R7 | 5/5 PASS |
| Rules guard R7 | 4/4 PASS |
| Deployment unit existente | 22/22 PASS |
| Runtime contracts existentes | 18/18 PASS |
| Preview Rules target guard existente | 15/15 PASS |
| TypeScript noEmit | PASS |
| Functions build | PASS |
| Root build | PASS |
| `git diff --check` | PASS |

Total registrado: 94 tests PASS, 0 FAIL. Los warnings de tamaño de chunks del build raíz son heredados y no bloquean este slice.

## Detención

El código queda listo para revisión humana. Los siguientes pasos requieren controles separados: provisionar la identidad runtime/IAM Preview, provisionar exactamente el grant aislado y desplegar únicamente a Preview. No se ejecutó ninguna de esas acciones.
