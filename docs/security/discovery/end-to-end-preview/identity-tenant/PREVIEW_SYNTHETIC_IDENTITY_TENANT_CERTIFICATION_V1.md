# Preview Synthetic Identity and Tenant Certification V1

## Dictamen

**CONTROLLED PREPARATION REQUIRED — IDENTITY OR TENANT MUST BE CREATED**

- Change ID: `AI-02H2.2A-PREVIEW-SYNTHETIC-IDENTITY-TENANT-20260806-01`
- Programa: `AI-02H2`
- Slice: `AI-02H2.2A`
- Target único: `aura-intel-preview` / `us-central1`
- Approved use: `CONTROLLED_PREVIEW_HAPPY_PATH`
- Production: `REMEDIATION_HOLD` — **NOT AUTHORIZED**
- Staging: fuera de alcance

## Resultado ejecutivo

No existe una combinación reutilizable de identidad Firebase Auth sintética y tenant Preview controlado:

- Firebase Auth respondió `CONFIGURATION_NOT_FOUND`; el inventario de usuarios no es enumerable y no existe candidato seleccionable.
- `platform_global_admins`: 0 registros.
- `platform_tenants`: 0 registros.
- `tenant_memberships`: 0 registros.
- `tenant_aliases`: 0 registros.
- relación identidad–tenant: `NOT_ESTABLISHED`.
- política aprobada de retención para este Happy Path: `RETENTION_POLICY_REQUIRED`.

No se infirió identidad por correo, nombre o dominio. No se creó configuración Auth, usuario, principal, tenant, membership, claim ni dato de prueba.

## Gate

| Control | Resultado |
|---|---|
| Rama exacta | PASS |
| `HEAD = origin/main` | PASS |
| Worktree inicial limpio | PASS |
| Firebase alias | `preview` → `aura-intel-preview` |
| GCP project | `aura-intel-preview` |
| Node | `v20.20.2` |
| Functions | 5/5 `ACTIVE`; 0 no activas |
| Cloud Run | 5/5 `READY` |
| Vercel | `aura-control-center-preview`; dominio autorizado `READY` |

## Inventario sanitizado de identidad

| Fuente | Resultado | Candidatos | Clasificación |
|---|---|---:|---|
| Firebase Auth Admin read-back | `CONFIGURATION_NOT_FOUND` | 0 seleccionables | `NOT_ELIGIBLE` |
| `platform_global_admins` | colección vacía | 0 | `NOT_ELIGIBLE` |
| Cuentas de prueba documentadas | ningún locator concreto | 0 | `NOT_ELIGIBLE` |

No se registran correos ni UID porque no existe candidato. El error de configuración es metadata de control y no contiene PII.

## Inventario sanitizado de tenants

| Colección autoritativa | Total | Candidato activo | Clasificación |
|---|---:|---:|---|
| `platform_tenants` | 0 | 0 | `NOT_ELIGIBLE` |
| `tenant_memberships` | 0 | 0 | `NOT_ELIGIBLE` |
| `tenant_aliases` | 0 | 0 | `NOT_ELIGIBLE` |

No se leyeron campos de PII. Las consultas Firestore usaron proyecciones limitadas a estado, versiones, roles, relación y señales sintéticas; no devolvieron documentos.

## Relación autoritativa

El runtime Discovery resuelve un principal autenticado exclusivamente desde un documento UID-addressed en `platform_global_admins`. Las Rules declaran que email, custom claims y payload cliente no otorgan autoridad. La autoridad multi-tenant usa `platform_tenants` y `tenant_memberships`, con una relación cerrada entre `principalId` y `tenantId`.

Estado observado:

| Control | Resultado |
|---|---|
| Firebase UID | `NOT_ASSIGNED` |
| Principal canónico | `NOT_ASSIGNED` |
| Tenant canónico | `NOT_ASSIGNED` |
| Membership canónica | `NOT_ASSIGNED` |
| Claims como autoridad | prohibidos |
| Privilegios Production | ninguno observado; no existe identidad |
| Scope Staging | ninguno observado; no existe identidad |
| Cross-tenant | no evaluable sin relación |

La composición Authority disponible es oscura y de pruebas: no ofrece un resolver productivo ni un handler para crear esta relación. El writer cliente de tenant y los provisionadores legacy de advisor no son mecanismos aceptables para este slice.

## Aptitud para los cinco handlers

No se invocó ningún handler.

| Handler | Auth/runtime contract | Resultado de esta certificación |
|---|---|---|
| `createDiscoveryLead` | intake público; Auth opcional se resuelve por principal canónico | `NOT_READY_IDENTITY_ABSENT` |
| `exchangeDiscoveryToken` | capability + App Check | `NOT_EVALUATED_NO_CERTIFIED_CASE` |
| `resolveDiscoverySession` | capability + App Check | `NOT_EVALUATED_NO_CERTIFIED_CASE` |
| `evaluateConversation` | session capability + App Check | `NOT_EVALUATED_NO_CERTIFIED_CASE` |
| `completeDiscoverySession` | session capability + App Check | `NOT_EVALUATED_NO_CERTIFIED_CASE` |

Aunque Auth no es precondición uniforme de las cinco superficies, el Happy Path solicitado exige explícitamente una identidad y un tenant certificados. Ese prerrequisito no puede omitirse.

## Plan exacto de preparación controlada

Este plan requiere autorización independiente y un change posterior. Nada de lo siguiente se ejecutó:

1. Inicializar Firebase Auth exclusivamente en `aura-intel-preview` y habilitar únicamente el provider requerido por el cliente de prueba. Confirmar mediante read-back que Production y Staging no cambian.
2. Crear un manifiesto project-explicit y una guardia para exactamente una identidad sintética, un principal canónico, un tenant Preview y sus memberships. Exigir dry-run, target exacto y rechazo de IDs Production/Staging.
3. Crear una identidad Firebase Auth con correo no personal controlado. La credencial se entrega por canal seguro, nunca se imprime ni se versiona. No asignar custom claims administrativos.
4. Crear `platform_global_admins/{uid}` por Admin SDK con binding UID exacto, estado activo y rol mínimo `VIEWER`; sin advisor, owner, founder, super-admin ni Production scope.
5. Implementar y certificar un binding servidor UID → `principalId`; el runtime actual no ofrece un resolver productivo para esta relación. No usar email como fallback de autoridad.
6. Crear el tenant mediante los contratos oficiales `CREATE_TENANT_AUTHORITY`, `CREATE_TENANT_MEMBERSHIP` y `UPDATE_TENANT_STATUS`. La activación debe usar autoridad bootstrap auditada y retirar o revocar el privilegio bootstrap al concluir.
7. Dejar a la identidad sintética únicamente con `TENANT_MEMBER`, membership `ACTIVE` y binding al único tenant Preview. Verificar ausencia de roles administrativos y de cualquier relación adicional.
8. Ejecutar read-back sanitizado: Auth activo, principal UID-addressed, tenant `ACTIVE`, membership `ACTIVE`, relación exacta, 0 Production/Staging scope y 0 relaciones cross-tenant.
9. Aprobar la política de retención antes de autorizar el Happy Path.
10. Certificar el resultado en un change separado. Solo entonces reanudar `AI-02H2.2`.

## Política de retención

Estado: **`RETENTION_POLICY_REQUIRED`**.

Propuesta pendiente de aprobación:

- identidad: fixture sintético permanente de Preview, deshabilitable fuera de ventanas de prueba;
- tenant: fixture permanente y exclusivo de Preview;
- datos del Happy Path: conservar solo la ventana necesaria para evidencia, con máximo propuesto de 30 días;
- aprobadores: Release Engineering Owner, Deployment Approver y Privacy para la retención de datos;
- cleanup: mecanismo Admin SDK project-explicit, allowlisted, auditado y filtrado por `testRunId`;
- prohibido: borrado manual, script destructivo ad hoc, wildcard, cleanup sobre Production o Staging.

La propuesta no constituye aprobación. No se permite crear datos hasta registrar la política autorizada.

## Registro seguro de locators

| Campo | Valor |
|---|---|
| `syntheticIdentityLocator` | `NOT_ASSIGNED` |
| `previewTenantLocator` | `NOT_ASSIGNED` |
| `relationType` | `NOT_ESTABLISHED` |
| `authoritySource` | `UID_ADDRESSED_PRINCIPAL_AND_CANONICAL_MEMBERSHIP_REQUIRED` |
| `capabilityScope` | `NONE_ASSIGNED` |
| `retentionPolicy` | `RETENTION_POLICY_REQUIRED` |
| `approvedUse` | `CONTROLLED_PREVIEW_HAPPY_PATH` |
| `prohibitedUse` | `STAGING`, `PRODUCTION`, `LOAD_TEST`, `PENTEST`, `PERSONAL_DATA` |

## Detención

No se ejecutó Happy Path, no se llamaron Functions y no se emitieron tokens. No hubo cambios en Firebase Auth, IAM, Secret Manager, Rules, App Check, Vercel, GCP, Staging ni Production. No hubo deploy, commit, push ni PR.
