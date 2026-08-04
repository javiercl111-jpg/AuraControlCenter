# Non-Production Firestore Rules Baseline v1

**Slice:** AI-02H1E.5.R2A

**Estado:** diseño; `firestore.rules` no fue modificado ni desplegado

## 1. Hallazgo actual

Las Rules del repositorio son `UNSAFE` para la trust root: cualquier usuario autenticado puede escribir `platform_global_admins`, `platform_tenants` y múltiples colecciones administrativas. También existen lecturas públicas amplias y writers cliente directos. El ruleset remoto de Preview/Staging no se asume igual al repositorio; R2B debe capturar pre-state y hash antes de cualquier write.

## 2. Modelo de confianza objetivo

- `request.auth` sólo prueba autenticación, no autoridad administrativa ni tenant.
- Claims como `SUPER_ADMIN`, `admin`, email o campos del payload no son autoridad canónica.
- La autoridad canónica reside en documentos server-owned escritos por Admin SDK mediante identidades dedicadas y auditadas.
- Una membresía tenant válida se obtiene de `tenant_memberships` server-owned con sujeto, tenant, status, versión y vigencia exactos.
- Admin SDK no necesita un `allow` especial: bypass de Rules queda controlado por IAM y service account.
- Toda colección o subcolección no declarada explícitamente termina en `allow read, write: if false`.

## 3. Helpers objetivo

La implementación R2B debe mantener helpers pequeños, totales y fail-closed:

```text
signedIn()                 request.auth != null
subjectUid()               request.auth.uid o cadena inválida
globalAdmin()              documento UID server-owned activo y versión aceptada
activeMembership(tid)      membresía UID/tenant activa, no expirada y server-owned
sameTenant(tid)            tenant del recurso coincide con membresía activa
onlyAllowedFields(list)    affectedKeys está contenido exactamente en allowlist
immutable(fields)          campos server-owned no cambian
```

Está prohibido hacer fallback a documento por email, aceptar variantes de role/status, leer autoridad desde una colección client-writable o conceder acceso cuando falta/corrompe un documento.

## 4. Matriz mínima de acceso cliente

| Collection/path | Read cliente objetivo | Create/update/delete cliente | Autoridad de escritura |
|---|---|---|---|
| `platform_global_admins/{uid}` | Sólo el propio UID para perfil mínimo si la UI lo requiere; otros documentos sólo global admin autorizado | Deny | Authority backend/Admin SDK |
| `platform_tenants/{tenantId}` | Global admin o miembro activo del mismo tenant; proyección sin secretos | Deny | Authority backend/Admin SDK |
| `tenant_memberships/{membershipId}` | Sólo sujeto de la membresía o global admin, con ID determinista y query acotada | Deny | Authority backend/Admin SDK |
| `tenant_aliases/{id}` | Global admin; cliente ordinario sin acceso directo | Deny | Authority backend/Admin SDK |
| `authority_idempotency/{id}` | Deny | Deny | Authority backend/Admin SDK |
| `authority_operation_bindings/{id}` | Deny | Deny | Authority backend/Admin SDK |
| `authority_audit_events/{id}` | Global admin/auditor sólo si un producto posterior define la lectura | Deny | Authority backend/Admin SDK |
| `authority_outbox_events/{id}` / `authority_outbox_delivery/{id}` | Deny | Deny | Authority backend/Admin SDK |
| `public_rate_limit_counters_v1/{id}` | Deny | Deny | Intake runtimes |
| `discovery_intake_idempotency/{id}` | Deny | Deny | Intake runtime |
| `discovery_intake_idempotency_namespaces_v1/{id}` | Deny | Deny | Intake runtime/cleanup interno |
| `discovery_capabilities_v1/{id}` | Deny | Deny | Capability/session runtime |
| `discovery_completions_v1/{id}` | Deny | Deny | Completion runtime |
| `discovery_completion_outbox_v1/{id}` | Deny | Deny | Completion/notification runtime |
| `discovery_sessions/{sessionId}` | Global admin o miembro tenant vinculado; acceso público sólo por callable/capability | Deny | Session/completion/report runtimes |
| `market_discovery_links/{linkId}` | Global admin o advisor vinculado mediante autoridad server-owned; público sólo por callable | Deny | Intake/capability runtime |
| `discovery_reports/{reportId}` | Global admin o principal tenant/advisor vinculado; descarga pública sólo por callable REPORT | Deny | Report writer/signer runtime |
| `discovery_conversation_budgets_v1/{id}` | Deny | Deny | AI runtime |
| `discovery_download_budgets_v1/{id}` | Deny | Deny | Storage signer runtime |
| `discovery_abuse_telemetry_v1/{id}` | Deny | Deny | Telemetry writer |
| `discovery_abuse_metrics_v1/{id}` | Auditor/global admin si se aprueba una vista; de otro modo deny | Deny | Telemetry writer |
| `discovery_containment_policies_v1/{id}` | Auditor/global admin; nunca cliente público | Deny | Control plane interno aprobado |
| `discovery_containment_active_v1/{environment}` | Deny directo | Deny | Control plane interno aprobado |
| `discovery_containment_audit_v1/{id}` | Auditor/global admin si se aprueba | Deny | Control plane interno aprobado |
| `platform_inbox/{uid}` | Sólo `request.auth.uid == uid` | Deny | Notification runtime |
| `platform_inbox/{uid}/notifications/{id}` | Sólo `request.auth.uid == uid` | Deny, incluso mark-read directo | Notification runtime/callable controlado |
| Cualquier otra colección | Deny salvo contrato aprobado y probado | Deny | Ninguna por defecto |

## 5. Campos server-owned

Aunque un futuro contrato permita una escritura cliente acotada, nunca puede aceptar cambios a:

- IDs de tenant, subject, advisor, capability, session, report o authority;
- role, permissions, status autoritativo, owner, approver o policy version;
- counters, attempts, leases, hashes, generations, quotas o budgets;
- `createdAt`, `updatedAt`, expiry/TTL, audit fields o idempotency keys;
- service-account, secret, artifact, environment o project references;
- report storage path, signed URL state, completion/outbox state o telemetry aggregates.

R2B debe fallar si `affectedKeys()` contiene un campo desconocido. No se permite `allow update: if signedIn()` ni validación basada sólo en que el valor anterior exista.

## 6. Dependencias cliente que bloquean deploy

El inventario local detecta writers directos en UI/servicios, incluido `discovery_sessions` y colecciones administrativas/market. Antes de Preview Rules deploy, cada writer debe tener una decisión trazable:

1. migrar a callable/backend con principal resolver y audit;
2. retirar la función cliente; o
3. definir un contrato client-writable separado, field-allowlisted y tenant-bound, aprobado por Security.

La opción 3 no aplica a authority, tenants, counters, idempotency, capabilities, completions, telemetry, containment o report metadata.

## 7. Suite Emulator obligatoria

Las Rules candidatas, no el archivo test-only deny-all, deben ejecutarse contra casos independientes:

| Caso | Resultado esperado |
|---|---|
| No autenticado lee/escribe server-owned | DENY |
| Usuario autenticado ordinario muta authority | DENY |
| Claim forjado `SUPER_ADMIN` sin documento server-owned | DENY |
| Documento admin client-created o corrupto | DENY |
| Write directo a `platform_tenants` | DENY |
| Write a counter/idempotency/capability/completion | DENY |
| Update de campo server-owned | DENY |
| Membresía de tenant A intenta recurso tenant B | DENY |
| Usuario lee su inbox | ALLOW |
| Usuario lee inbox ajeno | DENY |
| Admin SDK con proyecto demo exacto escribe server-owned | ALLOW por bypass controlado |
| Rules rollback target | Mantiene todos los writes sensibles cerrados |

Se conservan las suites D.9/D.8, authority, rate limit, idempotency, capability, payload, telemetry, containment y 22 casos de abuso. Una suite verde con Rules deny-all no sustituye la certificación de las Rules candidatas.

## 8. Orden de migración

1. Congelar inventory de writers y hash de Rules candidatas.
2. Ejecutar Emulator baseline y comparar con tests existentes.
3. Capturar ruleset/release Preview pre-state.
4. Desplegar sólo Rules a `aura-intel-preview` con proyecto explícito.
5. Leer release/ruleset y verificar hash normalizado.
6. Ejecutar pruebas negativas cliente y path Admin SDK positivo.
7. Observar errores sin introducir datos reales.
8. Promover el mismo hash a Staging con aprobación separada.
9. Revalidar, capturar evidencia y detenerse.
10. Production permanece intacta.

## 9. Stop y rollback

Detener ante writer cliente no migrado, remote pre-state ilegible, hash distinto, cross-tenant allow, Admin SDK roto, suite roja o proyecto ambiguo. Rollback sólo puede seleccionar un ruleset previamente certificado que sea igual o más restrictivo. Nunca se restaura el archivo actual permisivo ni se añade un allow temporal amplio.
