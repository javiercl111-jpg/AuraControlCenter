# AI-02H1E.3D — Authority Invocation Boundary Audit

## 1. Executive summary

**Dictamen: NO-GO para handlers de Authority y para activación productiva.** La persistencia, el planner, el adaptador Firestore Admin, su certificación transaccional y la composición oscura existen, pero todavía no existe una frontera de invocación capaz de demostrar conjuntamente identidad canónica, tenant canónico, autorización tenant-scoped, construcción segura del command, idempotencia namespaced y respuesta externa sanitizada.

La única frontera oficial recomendada es `AuthorityInvocationBoundary`. Es el punto de entrada de aplicación para cualquier transporte futuro y orquesta autenticación ya verificada, App Check cuando corresponda, resolución de principal y tenant, autorización, construcción del command y del contexto, y mapeo de la respuesta. Internamente delega la ejecución a `AuthorityApplicationService`, que recibe artefactos ya resueltos, invoca exclusivamente `AuthorityMutationRepositoryPort` y no contiene reglas de mutación.

```text
External Request
  → Authentication Boundary
  → App Check Boundary
  → Principal Resolution
  → Tenant Resolution
  → Authorization Decision
  → Command Construction
  → Invocation Context Construction
  → Authority Application Service
  → AuthorityMutationRepositoryPort
```

`AuthorityRepositoryInvocationContextV1` se clasifica como **INSUFFICIENT** para una integración productiva multi-tenant. Vincula principal, actor, tipo de operación, versión de autorización, request/correlation IDs y tiempos, pero no contiene ni obliga a validar tenant scope, membership/version, resource scope, assurance, canal o evidencia de resolución. Una autorización válida para un `operationType` podría acompañar un command dirigido a otro tenant sin que el validador actual detecte esa diferencia.

También existe un bypass previo al nuevo repositorio: el cliente web crea y actualiza directamente `platform_tenants`, y las reglas actuales permiten `read, write` a cualquier usuario autenticado. Este camino debe retirarse y las reglas deben cerrarse en un slice separado antes de producción. Esta auditoría no modifica reglas, código, contratos, tests ni handlers.

## 2. Scope

Esta fase es exclusivamente pasiva y documental. Se inspeccionaron Functions, identidad, tenants, RBAC, policy, contratos, planner, persistencia, composición, package boundary, tests arquitectónicos, reglas y escritores cliente existentes.

Quedan fuera de alcance y no se autorizan:

- callable, HTTP, scheduled, task, Pub/Sub o Firestore handlers nuevos;
- resolvers, adapters, contratos, tests o Composition Root productiva;
- cambios a UI, Discovery, rules, indexes, migrations, outbox o delivery workers;
- flags, variables de activación, tráfico, deploy, commit, push o PR.

La ubicación sigue la convención existente `docs/architecture/aura-intelligence/`, donde ya viven las auditorías AI-02G y AI-02H. Por eso no se creó un segundo árbol paralelo `docs/architecture/intelligence-os/`.

## 3. Current state

### 3.1 Git gate

| Verificación | Resultado |
|---|---|
| Rama | `audit/intelligence-os-authority-invocation-boundary` |
| HEAD | `34826d67ae158f68cccf5a382249071115a18930` |
| `origin/main` | `34826d67ae158f68cccf5a382249071115a18930` |
| Base esperada | `34826d6` |
| Worktree antes de escribir | Limpio |
| PR #57 | Incluido por `34826d6 Merge pull request #57 ... authority-dark-composition` |
| Gate | PASS |

### 3.2 Estado funcional

- `FirestoreAuthorityMutationRepository` implementa `AuthorityMutationRepositoryPort`, valida command/context y ejecuta un plan certificado dentro de una transacción.
- El planner concentra invariantes de mutación, precondiciones, idempotency ledger, operation binding, audit y outbox.
- Dark Composition solo admite `DISABLED` o `TEST_ONLY`, Firestore Emulator loopback, proyecto `demo-*` y capability interna no serializable.
- `functions/src/index.ts` no importa el adaptador ni Dark Composition.
- El package expone únicamente `@aura/intelligence-os/server`.
- Los registries de `serverComposition` contienen solo consumidores/sources de contract test y transporte `INTERNAL_TEST`.
- No existe application service, invocation boundary, principal resolver productivo, tenant resolver productivo ni authorization producer para mutaciones de autoridad.
- Ningún handler actual invoca el repositorio certificado.
- Sí existen caminos cliente que escriben directamente `platform_tenants`, fuera del repositorio.

## 4. Inspected components

| Área | Componentes inspeccionados |
|---|---|
| Exports/handlers | `functions/src/index.ts` y los 19 exports desplegables |
| Auth/RBAC | `functions/src/auth/resolvePlatformPrincipal.ts`, Firebase Auth usage, custom claims, listas locales de roles |
| App Check | opciones `enforceAppCheck` y comprobaciones `request.app` |
| Tenant/data | `platform_tenants`, `tenant_memberships`, `platform_global_admins`, `platform_sales_advisors`, clients/organizations y reglas |
| Direct writers | `platformTenantService`, `provisioningService`, `subscriptionLifecycleService` y sus callers |
| Authority contracts | commands, invocation context, authorization decision, IDs, fingerprints, operation binding |
| Authority runtime | planner, Firestore adapter, read/write sets, errors, emulator tests |
| Identity/policy | `serverIdentity`, `serverPolicy`, `serverComposition`, `serverIntegrationValidation` |
| Composition | Authority Dark Composition y patrones actuales de DI en Functions |
| Distribution | package `server.ts`, `package.json`, staging y `intelligenceOsConsumption.cjs` |
| Protection | `firestore.rules`, consumption gate y architecture tests |

## 5. Current invocation paths

### 5.1 Exported Functions

| Grupo | Exports | Observación de confianza |
|---|---|---|
| Market import | `processMarketImportJob` | Trigger sobre un job Firestore; escribe múltiples colecciones. No usa Authority. |
| Intelligence | `evaluateConversation` | App Check obligatorio; no exige Firebase Auth; no muta Authority. |
| Discovery | `createDiscoveryLead`, `completeDiscoverySession`, `resolveDiscoverySession`, `exchangeDiscoveryToken`, `generateDiscoveryReport`, `requestExecutiveDocument` | Combinan App Check con sesión token o principal de plataforma. Tenant proviene de documentos Discovery, no de Authority. |
| Advisors | `createSalesAdvisorUser`, `provisionCommercialAdvisor`, `resolveAdvisorByCode`, `manageAdvisorAccess` | Mutan Auth y perfiles; RBAC embebido. `createSalesAdvisorUser` desactiva App Check. |
| Prospects | `processProspectLifecycle`, `updateProspectCommercialStage`, `replenishAdvisorPipeline`, `discardPipelineProspect`, `reactivatePipelineProspect` | RBAC embebido; `processProspectLifecycle` tiene el control admin comentado y no bloquea. |
| Notifications | `emitDiscoveryCompletedNotification`, `markNotificationAsRead` | Task interna y callable autenticado; el callable no exige App Check. |

No se encontró `onRequest`. Predominan `onCall`, un trigger Firestore y una task.

### 5.2 Ruta de identidad/RBAC heredada

```text
Firebase callable
  → request.auth.uid
  → resolvePlatformPrincipal
  → platform_global_admins/{uid}
  → fallback por email/document ID/query
  → normalización de role
  → posible reconciliación mutante
  → lista de roles local al handler
  → escritura Firestore/Auth directa
```

El resolver mezcla resolución y persistencia: en el fallback por email crea el documento UID, actualiza advisor, elimina el documento heredado y escribe audit log. No es un resolver puro ni un reemplazo de `serverIdentity`.

### 5.3 Ruta Authority certificada actual

```text
Tests / Dark Composition TEST_ONLY
  → FirestoreAuthorityMutationRepository
  → validate command + invocation context
  → read set cerrado
  → pure mutation planner
  → revalidación de reads
  → una transacción Firestore
  → authority records + idempotency + operation binding + audit + outbox
```

No hay ruta desde `functions/src/index.ts`, handler, tráfico, env var o feature flag hacia esta composición.

### 5.4 Bypass actual sobre la colección canónica

```text
Browser/UI service
  → Firebase Web SDK
  → platform_tenants
  → firestore.rules: allow read, write if isAuthenticated()
```

Evidencia:

- `platformTenantService` crea tenants con auto-ID y actualiza status directamente.
- `provisioningService` crea `platform_tenants` durante provisioning.
- `subscriptionLifecycleService` actualiza status/licencia de tenants.
- `firestore.rules` permite escritura autenticada sobre `platform_tenants`.

Este bypass permite formas legacy y cambios fuera de command, invocation context, planner, audit/outbox e idempotency certificados.

## 6. Target trust boundaries

```text
[Untrusted Caller]
        │
        ▼
[Transport Boundary]
        │ request cerrado, límites y IDs operacionales
        ▼
[Authentication Trust Boundary]
        │ credencial verificada; App Check si es app cliente
        ▼
[Principal Resolution Boundary]
        │ principal canónico y binding vigente
        ▼
[Tenant Trust Boundary]
        │ tenant + membership/scope canónicos y versionados
        ▼
[Authorization Trust Boundary]
        │ permiso explícito, tenant/resource scope y policy version
        ▼
[Authority Invocation Boundary]
        │ command + context cerrados y mutuamente vinculados
        ▼
[Authority Application Boundary]
        │ única invocación de AuthorityMutationRepositoryPort
        ▼
[Persistence Boundary]
          planner certificado + transacción + ledger + audit + outbox
```

| Frontera | Input | Validación | Confianza obtenida | Confianza no obtenida | Fallo | Evidencia |
|---|---|---|---|---|---|---|
| Transport | Body/route/header no confiables | shape cerrada, tamaño, tipos, unknown fields | Intención sintáctica | identidad, tenant, permiso | `invalid-argument` | requestId, transport, schema |
| Authentication | Token Firebase u OIDC/IAM | firma, audience, issuer, expiry, revocation policy | sujeto autenticado | rol, membership, tenant | `unauthenticated` | subject/provider/fingerprint |
| App Check | token de aplicación | verificación y replay protection aplicable | origen app atestado | identidad o autorización | respuesta indistinguible de acceso denegado | app ID/token hash no reversible |
| Principal | sujeto verificado | binding server-owned, estado, versión | principal canónico | tenant/permiso | acceso denegado genérico | binding/resolver versions |
| Tenant | selector no autoritativo + resource scope | tenant activo, alias canónico, membership vigente | scope tenant/platform explícito | permiso para operación | acceso denegado genérico | tenant/membership versions |
| Authorization | principal + tenant + intent | policy exacta y deny-by-default | permiso scoped y obligations | validez futura ilimitada | `permission-denied` | decision ID/version/reason |
| Application | artefactos resueltos | bindings cruzados y command factory | command/context listos | éxito de persistencia | rechazo interno mapeado | operation/correlation IDs |
| Persistence | command + context | validadores, reads, planner, transaction | mutación atómica certificada | autenticación de transporte | result seguro | ledger/audit/outbox |

## 7. Principal resolution

### 7.1 Identidad canónica

La identidad canónica no debe ser email, `employeeId`, role, claim ni un ID enviado por payload. Debe ser `canonicalPrincipalId` de un binding server-owned:

- `USER`: Firebase UID es el `providerSubjectId` verificado y puede coincidir con el principal canónico solo si un binding vigente lo declara.
- `SERVICE`: identidad OIDC/IAM de service account o workload identity; nunca un header libre.
- `SYSTEM`: identidad interna asignada por una composición certificada, con invoker y source allowlisted.

No se encontró una relación authority-grade entre `users.uid`, employee y principal en Functions. `employeeId` no participa en autorización. `platform_global_admins` y `platform_sales_advisors` son fuentes heredadas de plataforma, no equivalen al binding canónico de `serverIdentity`.

### 7.2 Claims

- La verificación de Firebase Functions aporta autenticidad básica de `uid` y token claims.
- Email y custom claims pueden estar obsoletos y no deben conceder Authority por sí solos.
- Roles/memberships deben releerse de fuentes server-owned con versión y estado.
- `IdentityClaimsProjectionV1` ya declara `authorityUse: PROHIBITED`; debe respetarse.
- Para operaciones elevadas debe existir evidencia de revocation check y assurance suficiente.

### 7.3 Contrato recomendado

Se requiere `ResolvedAuthorityPrincipalV1`, como envelope de aplicación que reutilice `TrustedServerPrincipalV1` y no replique su semántica:

```text
schemaVersion
principal: TrustedServerPrincipalV1
providerSubjectId
firebaseUid?              // solo USER/FIREBASE_AUTH
platformUserId?           // binding explícito, no lookup por email
bindingVersion
resolverVersion
credentialVersion
assurance
revocationCheckedAt
claimsFingerprint?
resolvedAt
source
```

Las memberships no deben incrustarse como una lista de “company memberships” en el principal: pertenecen a la resolución tenant por solicitud, evitando snapshots amplios y obsoletos.

Superadmin no es una identidad ni un bypass. Es una concesión de policy versionada, con permiso explícito, scope, assurance reforzada, razón obligatoria y auditoría. Support tampoco hereda superadmin.

Datos prohibidos desde payload: principal ID canónico, actor, UID efectivo, provider, roles, claims version, assurance, service/system identity y estado del principal.

## 8. Tenant resolution

Se requiere `ResolvedAuthorityTenantV1`.

```text
schemaVersion
scopeType: TENANT | PLATFORM_BOOTSTRAP | LEGACY_MIGRATION
tenant?: CanonicalTenantAuthorityV1
membership?: TrustedTenantMembershipV1
selectorStrategy
resourceScope
tenantAuthorityVersion?
membershipVersion?
resolverVersion
resolvedAt
evidenceFingerprint
```

Invariantes:

1. `tenantId` del route/body es únicamente selector no autoritativo.
2. Para tenant existente, `platform_tenants/{canonicalTenantId}` es la autoridad canónica y debe estar en estado admisible.
3. Para usuario tenant-scoped se exige membership canónica activa, principal/tenant coincidentes y versión observada.
4. `companyId`, organization reference, slug o client ID requieren resolución a tenant; nunca sustituyen `tenantId`.
5. No hay fallback al primer tenant, tenant de email, hostname, UI state ni claim.
6. Un resource-bound request debe resolver el tenant del recurso y comparar con la selección; no autorizar usando solo el tenant contenido en el documento objetivo.
7. Platform admin requiere grant de plataforma explícito y aun así queda ligado al tenant objetivo.
8. `CREATE_TENANT_AUTHORITY` usa `PLATFORM_BOOTSTRAP`: el ID objetivo es reservado/generado por servidor y no finge una membership de un tenant inexistente.
9. `CANONICALIZE_LEGACY_TENANT` usa `LEGACY_MIGRATION`, identidad de migración certificada y source record cerrado; no es una operación interactiva.
10. La misma resolución debe alimentar autorización, command y context; no se permiten tres lookups independientes con resultados distintos.

## 9. Authorization

El RBAC actual no es reutilizable directamente para Authority:

- las listas de roles están duplicadas por handler;
- existen aliases amplios (`SUPER_ADMIN`, `FOUNDER`, `PARTNER`);
- custom claims se escriben, pero las decisiones suelen provenir de documentos legacy;
- no hay permiso por operation type, tenant ni target resource;
- `serverPolicy` autoriza ejecución OS `SHADOW_ONLY` en fixtures, no mutaciones administrativas.

Se requiere `AuthorityAuthorizationDecisionV1` en la capa de aplicación:

```text
decision: ALLOWED | DENIED
permission
principalId/principalType
scopeType
tenantId?
resourceType/resourceId?
allowedOperationTypes
policyVersion
decisionId
evidenceReferences/fingerprint
decidedAt
expiresAt
reasonCode
obligations
```

La autorización ocurre después de principal/tenant resolution y antes de command construction. El application service vuelve a comprobar los bindings entre decision, command y invocation context inmediatamente antes del repository. El repository conserva validación defensiva de la decisión y operation type, pero no autentica ni calcula permisos. El planner sigue siendo la fuente de invariantes de transición y mutación, no de permisos humanos.

La decisión existente `AuthorityRepositoryAuthorizationDecisionV1` es una proyección interna útil, pero no basta como decisión completa porque carece de tenant/resource scope, permission, evidence y obligations.

## 10. Command construction

`AuthorityCommandFactory` debe aceptar un DTO cerrado de intención más los artefactos resueltos. Debe ignorar/rechazar campos reservados aunque el caller los envíe, normalizar valores permitidos y usar los factories/validators del package.

### 10.1 Clasificación

| Campo o familia | Clase | Regla |
|---|---|---|
| Intento de acción y valores de negocio permitidos | `CALLER_SUPPLIED` | DTO por operación, cerrado, con límites; nunca se pasa como command crudo |
| Client idempotency token | `CALLER_SUPPLIED` | Solo material no autoritativo; el servidor lo valida y namespacea |
| `schemaVersion`, `operationType` | `SERVER_GENERATED` | Seleccionados por endpoint/use case, no por body libre |
| `operationId`, `requestId`, `correlationId`, `requestedAt` | `SERVER_GENERATED` | Canonicalizados por infraestructura/aplicación |
| `actor` | `RESOLVED` | Derivado del principal canónico |
| `tenantId`, target principal, principal type | `RESOLVED` | De tenant/principal/target resolvers |
| `reasonCode` | `DERIVED` | Mapeo allowlisted del use case; texto libre va a evidencia separada y sanitizada |
| `idempotencyKey` del command | `DERIVED` | Namespace/version/hash de scope + token/causa |
| `precondition`, current status/version | `RESOLVED` / `DERIVED` | Desde read model autoritativo y policy; no desde caller |
| `membershipKey`, `aliasKey`, normalized alias | `DERIVED` | Factories deterministas del package |
| Desired roles/status/slug/reference | `CALLER_SUPPLIED` + `DERIVED` | El deseo puede venir del caller; el valor canónico se normaliza y autoriza |
| Activation prerequisite | `FORBIDDEN_FROM_CALLER` | Se arma desde tenant/membership reads versionados |
| Principal/actor/tenant authority evidence | `FORBIDDEN_FROM_CALLER` | Solo resolvers |
| Legacy canonicalization input y migration metadata | `FORBIDDEN_FROM_CALLER` | Solo proceso de migración certificado |
| Collection/path, audit/outbox IDs, timestamps/version | `FORBIDDEN_FROM_CALLER` | Planner/persistence |
| Campos desconocidos | `FORBIDDEN_FROM_CALLER` | Rechazo fail-closed |

Clasificación exhaustiva de los campos contractuales:

| Command/campo | Clase final |
|---|---|
| Todos: `schemaVersion` | `SERVER_GENERATED` |
| Todos: `operationType` | `SERVER_GENERATED` |
| Todos: `operationId` | `SERVER_GENERATED` |
| Todos: `idempotencyKey` | `DERIVED` |
| Todos: `actor` | `RESOLVED` |
| Todos: `requestedAt` | `SERVER_GENERATED` |
| Todos: `precondition` | `RESOLVED` / `DERIVED` |
| Todos: `reasonCode` | `DERIVED` |
| Todos: `requestId` | `SERVER_GENERATED` |
| Todos: `correlationId` | `SERVER_GENERATED` |
| Create tenant: `tenantId` | `SERVER_GENERATED` mediante reserva canónica |
| Create tenant: `initialStatus` | `SERVER_GENERATED` (`PENDING`) |
| Create tenant: `tenantSlug` | `CALLER_SUPPLIED` como candidato; valor final `DERIVED` |
| Create tenant: `organizationReference`, `clientReference` | `CALLER_SUPPLIED` como referencia; valor final `RESOLVED` |
| Update tenant: `tenantId` | `RESOLVED` |
| Update tenant: `currentStatus` | `RESOLVED` |
| Update tenant: `targetStatus` | `CALLER_SUPPLIED` como intención; valor final `DERIVED` tras autorización |
| Update tenant: `activationPrerequisite` | `FORBIDDEN_FROM_CALLER`; `RESOLVED` |
| Create membership: `principalType`, `principalId` | `FORBIDDEN_FROM_CALLER` como autoridad; `RESOLVED` |
| Create membership: `tenantId` | `RESOLVED` |
| Create membership: `roles` | `CALLER_SUPPLIED` como intención; valor final `DERIVED` por policy |
| Create membership: `initialStatus` | `SERVER_GENERATED` (`ACTIVE`) |
| Update membership: `membershipKey` | `DERIVED` |
| Update membership: `principalType`, `principalId`, `tenantId` | `RESOLVED` |
| Update membership: `roles` | `CALLER_SUPPLIED` como intención; valor final `DERIVED` |
| Change membership status: `membershipKey` | `DERIVED` |
| Change membership status: `principalType`, `principalId`, `tenantId`, `currentStatus` | `RESOLVED` |
| Change membership status: `targetStatus` | `CALLER_SUPPLIED` como intención; valor final `DERIVED` |
| Reserve/tombstone alias: `aliasKey` | `DERIVED` |
| Reserve/tombstone alias: `aliasType`, `normalizedAlias` | valor candidato `CALLER_SUPPLIED`; valor final `DERIVED` |
| Reserve/tombstone alias: `tenantId` | `RESOLVED` |
| Canonicalize legacy: `canonicalizationInput` completo | `FORBIDDEN_FROM_CALLER`; `RESOLVED` / `DERIVED` desde manifest y source certificado |

### 10.2 Reglas por payload

- `CREATE_TENANT_AUTHORITY`: ID reservado por servidor; slug/references normalizados; status inicial fijo `PENDING`.
- `UPDATE_TENANT_STATUS`: target tenant resuelto; current status y activation prerequisite server-owned.
- Membership: target principal resuelto; roles intersectados con permissions y vocabulario; membership key derivada.
- Alias: alias normalizado por tipo; key derivada; tenant resuelto.
- Legacy: solo un runner de migración con manifest y source allowlist.

## 11. Invocation context

### 11.1 Auditoría del contrato actual

El contrato contiene:

- `principal`, `actor`;
- `authorizationDecision`, `authorizedOperationTypes`, `authorizationVersion`;
- `consumerId`, `source`;
- `requestId`, `correlationId`, `initiatedAt`;
- `cancellationSignal`.

El validador demuestra:

- decision `ALLOWED`;
- command operation incluida;
- principal, actor y decision idénticos;
- actor del command idéntico;
- request/correlation IDs idénticos;
- orden temporal y expiry;
- lista de operaciones y authorization version idénticas.

Faltan:

- tenant y resource scope vinculados al command;
- membership/tenant authority version y evidence;
- permission/decision ID/obligations;
- assurance y channel/transport;
- causation ID;
- binding explícito del idempotency namespace.

### 11.2 Dictamen

**INSUFFICIENT.** No sobra información material; `cancellationSignal` es infraestructura legítima. La ausencia crítica es tenant-scoped authorization. La capa que lo construya debe ser `AuthorityApplicationService`, usando exclusivamente outputs congelados de los resolvers, authorization port, request identity factory y command factory. No puede construirlo el handler ni el repository.

Antes de producción debe aprobarse un contrato evolucionado o una envolvente certificada que fuerce el binding tenant/resource de forma verificable hasta el persistence boundary. Un audit log lateral no compensa un binding ausente.

## 12. Idempotency

### 12.1 Propiedad y namespace

`AuthorityInvocationBoundary` exige idempotency para toda mutación externa antes de resolver el command. `AuthorityApplicationService` genera la key canónica:

```text
authority|v1|<scopeType>|<tenant-or-platform-scope>|<principal>|<operationType>|<digest-del-token-o-causa>
```

El caller nunca controla la key final. Esto es obligatorio porque el ledger actual deriva el document ID únicamente de `command.idempotencyKey`, en un namespace global.

El replay exacto exige reconstruir el mismo command completo: el fingerprint incluye requestedAt, actor, request/correlation IDs y payload. Por ello el boundary debe recuperar/reusar el mismo `operationId` y command envelope para una key ya admitida; regenerar tiempos o IDs convierte un retry en conflicto.

### 12.2 Políticas por caller

| Caso | Entrada | Política |
|---|---|---|
| Mutación externa | Token obligatorio del cliente | Validar formato/entropía, namespace server-side; mismo token + mismo intent = exact replay |
| Sistema interno | Causation/event ID estable | Derivación determinista con service identity, tenant y operation |
| Migración | Manifest/run ID + source record ID | Key determinista, retención larga, no reutilizable fuera del manifest |
| Scheduled retry | Operation ID previamente persistido | Reusar command/key; nunca crear una operación nueva por timeout incierto |
| Herramienta admin | Token obligatorio + ticket/reason | Namespace por actor/tenant/permission; assurance reforzada |

Un timeout después de dispatch se responde como estado incierto y solo permite retry con la misma key. `SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY` gobierna el retry. La respuesta externa no expone la key cruda.

La retención no está definida hoy. Debe aprobarse por operación: al menos el máximo retry horizon más el periodo de auditoría; migraciones y operaciones irreversibles requieren retención prolongada/archival. No debe existir borrado oportunista sin preservar operation binding y evidencia.

## 13. Operation and correlation model

| Identificador | Generador | Persistencia | Exposición | Nunca usar para |
|---|---|---|---|---|
| `idempotencyKey` | Servidor desde material válido | Ledger, binding; log solo hash | No | autorización o correlación humana |
| `operationId` | Servidor; estable por operación lógica | Binding, result, audit, outbox | Puede devolverse como referencia opaca | tenant/principal resolution |
| `requestId` | Transport boundary por intento | Command/context y logs | Sí, opaco | idempotencia |
| `correlationId` | Servidor al inicio del flujo; se propaga | Command/context/result/audit/outbox/logs | Sí, opaco | autorización |
| `causationId` | Servidor desde evento/operación precedente | Audit técnico y envelope futuro | Solo soporte interno | identidad |
| `traceId` | Infraestructura de tracing | Telemetría, no command authority | No por defecto | business identity o permission |

Un ID suministrado por caller puede conservarse como `externalRequestReference` sanitizada, nunca reemplaza los IDs canónicos. Correlation spoofing se evita regenerando el ID externo y vinculando el valor recibido solo como metadata no autoritativa.

## 14. App Check

### 14.1 Estado actual

| Estado | Functions |
|---|---|
| Obligatorio/configurado | mayoría de Discovery, `evaluateConversation`, `resolveAdvisorByCode`, provisioning/access y prospect operations modernas |
| Verificación manual `request.app` | varios callables legacy |
| Ausente/desactivado | `createSalesAdvisorUser`, `markNotificationAsRead`, `processProspectLifecycle`; triggers/tasks no aplican igual |

La política futura es:

- usuario/app cliente: App Check obligatorio y verificado antes de principal resolution;
- internal service, scheduled, migration y recovery: App Check no aplica; requieren identidad OIDC/IAM separada y consumer/source allowlist;
- emulator/test: capability no serializable y composición dedicada; nunca header, boolean, env flag o claim de usuario;
- no se permite fallback “si falta App Check, aceptar por Auth”, ni bypass por superadmin/support.

App Check mejora assurance de origen, pero no autentica al usuario ni concede tenant/permission. Cada excepción se audita con caller class, service identity, consumer/source, motivo y policy version.

## 15. Caller taxonomy

| Caller | Auth | Scope | Permiso | Idempotency | Actor | Permitido | Prohibido |
|---|---|---|---|---|---|---|---|
| Authenticated end user | Firebase ID token + App Check | tenant membership activa | permiso explícito de autoservicio | client token namespaced | `USER` | ninguno por defecto; solo use cases futuros expresos | admin, alias, tenant status, canonicalize |
| Tenant administrator | Firebase + App Check + reauth si elevado | un tenant resuelto | permiso tenant-admin por operación | obligatorio | `USER` | membership create/role/status dentro de límites | tenant create, legacy migration, platform grants |
| Platform administrator | Firebase + App Check + assurance reforzada | tenant objetivo o platform bootstrap explícito | permiso platform exacto | obligatorio + reason/ticket | `USER` | tenant lifecycle y membership según policy | bypass global o cross-tenant implícito |
| Internal service | OIDC/IAM/workload identity | tenants/sources allowlisted | service grant exacto | causation-derived | `SERVICE` | operaciones cerradas del servicio | impersonar user, comandos arbitrarios |
| Migration process | workload identity dedicada | manifest/source cerrado | migration permission | manifest/run/source key | `SERVICE` | `CANONICALIZE_LEGACY_TENANT` | interactive tenant admin commands |
| Scheduled task | OIDC/IAM de scheduler | scope del job persistido | scheduled permission | operation previamente ligada | `SERVICE` | retry/maintenance explícito | elegir tenant desde payload libre |
| Support operator | Firebase + App Check + step-up | tenant/ticket explícito | support grant temporal | obligatorio | `USER` | ninguno por defecto; break-glass separado | superadmin implícito, role grants |
| Automated recovery | service identity dedicada | operación fallida ligada | recovery permission | mismo operation/key | `SYSTEM` o `SERVICE` | retry/reconciliation allowlisted | crear nuevo intent o ampliar scope |

## 16. Application service

Se requieren ambas capas:

- `AuthorityInvocationBoundary`: facade oficial de aplicación y único dependency permitido para handlers.
- `AuthorityApplicationService`: ejecutor interno que arma el par final command/context, invoca el port y mapea resultados.

`AuthorityCommandGateway` es ambiguo porque puede sugerir transporte o acceso directo al repository. `AuthorityMutationService` se confunde con las reglas de mutación del planner. Por eso no son nombres oficiales.

### 16.1 Puertos mínimos

```text
AuthorityInvocationBoundaryPort.invoke(untrustedIntent, transportEvidence)
AuthorityPrincipalResolverPort.resolve(verifiedSubject)
AuthorityTenantResolverPort.resolve(principal, selector, resourceScope)
AuthorityAuthorizationPort.decide(principal, tenantScope, intent)
AuthorityCommandFactory.create(intent, resolvedArtifacts, requestIdentity)
AuthorityRequestIdentityFactory.create(transportEvidence)
AuthorityApplicationService.execute(resolvedInvocation)
```

El repository port es dependencia privada del application service, inyectada solo por Composition Root. No se expone a controller/handler.

### 16.2 Propiedad única de responsabilidades

| # | Responsabilidad | Único propietario |
|---|---|---|
| 1 | Autenticar caller | Authentication adapter/transport |
| 2 | Validar App Check | Transport boundary |
| 3 | Resolver principal | `AuthorityPrincipalResolverPort` |
| 4 | Resolver tenant | `AuthorityTenantResolverPort` |
| 5 | Resolver membership | `AuthorityTenantResolverPort` |
| 6 | Evaluar permisos | `AuthorityAuthorizationPort` |
| 7 | Construir command | `AuthorityCommandFactory` |
| 8 | Construir context | `AuthorityApplicationService` |
| 9 | Asignar operationId | Request identity/idempotency coordinator |
| 10 | Recibir client idempotency token | `AuthorityInvocationBoundary` |
| 11 | Generar correlationId | Request identity factory |
| 12 | Validar causationId | Request identity/idempotency coordinator |
| 13 | Asignar actor | Principal resolver + application service projection |
| 14 | Invocar repository | `AuthorityApplicationService` |
| 15 | Mapear resultado | External response mapper |
| 16 | Emitir audit técnico | Persistence ledger + boundary telemetry sink |
| 17 | Responder caller | Handler/transport mapper |
| 18 | Evitar cross-tenant leakage | Boundary transversal, con enforcement central en tenant resolver/authorization/response mapper |

## 17. Error boundary

El caller recibe categorías estables, mensajes genéricos y `requestId`/`correlationId`; internamente se conservan safe code, operation ID, decision/evidence versions y causa técnica. Tenant, membership, policy internals, paths, stack, tokens, claims, emails y existencia de recursos de otro tenant nunca se filtran.

| Interno | Externo recomendado | Retry |
|---|---|---|
| unauthenticated/token invalid | `unauthenticated` | tras nueva credencial |
| app-check-failed | `failed-precondition` o access denied uniforme | tras nueva attestation |
| unauthorized | `permission-denied` | no |
| tenant/membership not found/inactive | `permission-denied` uniforme | no; evita enumeration |
| invalid command/unknown fields | `invalid-argument` | corregir request |
| idempotent exact replay | misma respuesta segura | no nueva ejecución |
| idempotency/operation conflict | `already-exists` o `aborted` seguro | no con key distinta automática |
| stale version/precondition | `aborted` | reread y nuevo intent |
| resource not found propio | `not-found` | no |
| planner rejected | `failed-precondition` | según safe code |
| internal error | `internal` | solo si disposition permite |
| unavailable | `unavailable` | misma key |
| timeout incierto | `deadline-exceeded` | misma key exclusivamente |
| cancelled antes de dispatch | `cancelled` | nueva request o misma key según admisión |

Errores Auth/Admin actuales que concatenan `err.message` no son patrón aceptable para Authority. Logs deben estructurarse, limitar strings y neutralizar control characters para evitar log injection.

## 18. Threat model

| Amenaza | Prob. | Impacto | Mitigación actual | Gap/control obligatorio |
|---|---|---|---|---|
| forged tenantId | Alta | Crítico | selector validators parciales | resolver canónico + decision/context tenant-bound |
| forged principalId | Media | Crítico | Firebase UID en callables | binding server-owned; campo caller prohibido |
| forged role | Alta | Crítico | algunos roles releídos | permission policy; claims nunca autoridad |
| stolen Firebase token | Media | Alto | firma/expiry | revocation check, assurance, App Check, step-up |
| stale claims | Alta | Alto | roles a veces en Firestore | versioned reread y claims projection prohibida |
| App Check bypass | Media | Alto | cobertura inconsistente | obligatorio para app callers; IAM separado |
| replay attack | Alta | Alto | ledger certificado | key namespaced y command estable |
| idempotency collision | Media | Alto | hash global de key | namespace tenant/principal/operation |
| cross-tenant operationId reuse | Media | Crítico | operation binding global | operation scope binding y architecture tests |
| confused deputy | Media | Crítico | consumer/source tests only | registry productivo cerrado + target scope |
| privilege escalation | Alta | Crítico | listas de roles locales | permission matrix deny-by-default |
| superadmin overreach | Alta | Crítico | bypasses amplios actuales | no bypass; grant, reason, step-up, audit |
| TOCTOU membership | Media | Crítico | context sin membership version | version binding/precondition inmediatamente antes |
| stale authorization | Media | Alto | optional expiry | TTL corto + authority versions obligatorias |
| command tampering | Media | Crítico | validators/fingerprint | factory privada y command/context mutual binding |
| unknown fields | Alta | Medio | OS closed records | DTO closed records antes de resolución |
| log injection | Media | Medio | logs ad hoc | structured safe codes, truncation/sanitization |
| tenant enumeration | Alta | Alto | mensajes variados | respuestas uniformes y no IDs internos |
| audit suppression | Baja | Crítico | transaction audit/outbox | audit write atómica; telemetry secondary |
| correlation spoofing | Alta | Medio | caller patterns ad hoc | server ID; external ref separada |
| internal impersonation | Media | Crítico | no runtime actual | OIDC/IAM audience + registry + service binding |
| migration abuse | Media | Crítico | canonicalize contract cerrado | identity/manifest/source allowlist y dry audit |
| direct repository import | Alta futura | Crítico | consumption gate parcial | mandatory module graph architecture test |
| boundary bypass | Alta actual | Crítico | adapter allowlist; rules abiertas | deny client writes + single application facade |

## 19. Direct repository access prevention

Control obligatorio: un test arquitectónico de grafo/imports y escritores, ejecutado en CI, fail-closed.

Debe demostrar:

1. ningún handler importa `FirestoreAuthorityMutationRepository`, `AuthorityMutationRepositoryPort` ni `@aura/intelligence-os/server`;
2. solo el adapter importa la clase/contratos de persistencia que necesita;
3. solo una Composition Root certificada instancia el adapter;
4. solo `AuthorityApplicationService` recibe `AuthorityMutationRepositoryPort`;
5. handlers importan únicamente `AuthorityInvocationBoundaryPort` o un facade local cerrado;
6. ninguna producción fuera del adapter escribe las ocho colecciones Authority;
7. ninguna UI/browser escribe `platform_tenants`, memberships, aliases, ledger, audit u outbox;
8. nuevos consumidores/package specifiers quedan rechazados por defecto.

El consumption gate actual y el package `./server` cerrado son reutilizables, pero no suficientes: hoy certifican import del adapter y un type import de Dark Composition, no la topología handler → boundary → service → repository. Dependency-cruiser o lint pueden complementar; no sustituyen el test de grafo. Firestore Rules deben negar escrituras cliente como segunda barrera.

## 20. Audit evidence

### 20.1 Antes de ejecutar

- provider subject/UID verificado y canonical principal ID;
- authentication method, assurance, credential/binding/resolver versions;
- revocation checked at y claims fingerprint, nunca token/claims completos;
- App Check outcome o service identity/audience;
- tenant selector strategy, canonical tenant ID/scope y authority version;
- membership ID/version/status/roles fingerprint;
- permission, decision ID, policy version, reason y obligations;
- consumer, source, transport e invocation class.

### 20.2 Durante

- request, correlation, causation y operation IDs;
- hash de idempotency key, nunca la key cruda;
- command type, resource type/ID seguro, precondition/version;
- initiated/requested timestamps, latency y cancellation/deadline;
- command fingerprint y authorization expiry/version.

### 20.3 Después

- result status/safe code, resulting version/reference;
- retry disposition y replay/conflict classification;
- audit/outbox event IDs;
- error category y internal incident reference;
- total latency.

No registrar tokens, cookies, headers, raw claims, email como identidad, free-form payloads, PII innecesaria, stack externo, credentials, secrets o full legacy records.

## 21. Gap matrix

| Capability | Exists | Certified | Reusable | Gap | Risk |
|---|---:|---:|---:|---|---|
| Authentication | Parcial | No para Authority | Firebase/IAM primitives | verified subject + revocation adapter | Alto |
| App Check | Parcial | No uniforme | Callable support | policy por caller y cero bypass | Alto |
| Principal resolution | Contratos sí, runtime no | Contratos | `serverIdentity` | binding resolver productivo | Crítico |
| Tenant resolution | Contratos base sí, runtime no | Contratos | canonical tenant/membership types | scope resolver y creation/migration modes | Crítico |
| Authorization | Repos decision parcial | No | validators defensivos | permission + tenant/resource scope | Crítico |
| Command factory | Factories genéricos | Contratos | validators/IDs | factory por use case, DTO cerrado | Alto |
| Invocation context | Sí | Contrato | actor/op bindings | tenant/membership/assurance/causation | Crítico |
| Application service | No | No | — | capa completa | Crítico |
| Repository port/in-memory | Sí | Sí | Sí | acceso solo por service | Bajo |
| Planner | Sí | Sí | Sí | no agregar auth | Bajo |
| Firestore persistence | Sí | Sí | Sí | composición productiva prohibida aún | Medio |
| Emulator certification | Sí | Sí | Sí | falta E2E de boundary | Medio |
| Dark Composition | Sí | Sí | Solo tests | no producción por diseño | Bajo |
| External error mapping | Patrones dispersos | No | response sanitizer conceptual | catálogo Authority y anti-enumeration | Alto |
| Audit evidence | Persistence parcial | Parcial | audit/outbox atómicos | auth/tenant/policy evidence y causation | Alto |
| Direct-import prevention | Parcial | Sí para consumo actual | gate/package boundary | graph test + rules + eliminar client writes | Crítico |

## 22. Risks

1. `platform_tenants` sigue siendo escribible directamente por clientes autenticados.
2. El fallback por email puede reconciliar/mutar identidad durante una autorización.
3. Los roles amplios actuales no expresan permiso ni tenant scope.
4. `AuthorityRepositoryInvocationContextV1` no vincula autorización al tenant del command.
5. El ledger de idempotency usa namespace global de key.
6. El exact replay depende de reproducir el command completo, incluidos IDs y timestamps.
7. App Check no es uniforme y no aplica a service callers sin un modelo alterno.
8. No existe runtime para los contratos `serverIdentity`.
9. Registries y policy existentes son solo contract-test/`SHADOW_ONLY`.
10. No existe retención aprobada para idempotency/operation binding.
11. No hay causation ID en command/context/audit contract.
12. Una composición productiva prematura haría alcanzable un repository correcto desde una frontera incorrecta.

## 23. Constraints

- Repository no autentica y planner no autoriza.
- Autorización permanece fuera de persistencia, pero su evidencia debe llegar vinculada.
- Un único application service posee el repository port.
- Todos los DTOs y decisions son closed/frozen, versionados y fail-closed.
- No hay defaults de tenant, role, permission, assurance, source o consumer.
- No hay superadmin/support bypass.
- No hay email identity ni claims-only authority.
- No hay client writes a colecciones Authority.
- No hay activación por env var, remote config, document, header o payload.
- Cada slice futuro requiere gate, certificación propia y revisión antes del siguiente.

## 24. Decision

**NO-GO.**

| Pregunta | Respuesta |
|---|---|
| 1. ¿Puede implementarse ya una frontera? | No productiva. Solo pueden definirse primero contratos aislados y tests. |
| 2. ¿Faltan contratos? | Sí: resolved principal, resolved tenant/scope, tenant-scoped authorization, request identity/idempotency y response mapping. |
| 3. ¿Falta resolver identidad? | Sí; `serverIdentity` no tiene adapter runtime y el helper legacy no satisface el modelo. |
| 4. ¿Falta resolver tenant? | Sí; no existe resolver canónico ni binding de scope al context. |
| 5. ¿Falta autorización? | Sí; el RBAC actual y repository decision no expresan permission tenant-scoped. |
| 6. ¿Puede existir un handler ahora? | No. |
| 7. ¿Puede habilitarse producción? | No. |
| 8. ¿Siguiente slice exacto? | `AI-02H1E.3D.2 — Principal Resolution Contracts`, sin runtime ni Functions. |

Condiciones acumulativas para abandonar NO-GO:

1. contratos de principal, tenant/scope y autorización aprobados;
2. evolución/envelope de invocation context con tenant binding certificado;
3. idempotency namespace y exact replay definidos;
4. application service y boundary unit-certified;
5. graph test que impida imports/writes directos;
6. retiro de escritores cliente y cierre de rules en slice autorizado;
7. Dark Handler Composition inerte;
8. E2E Emulator sin endpoint público;
9. Production Readiness Audit separada.

## 25. Recommended slices

| Slice | Alcance | Justificación |
|---|---|---|
| `AI-02H1E.3D.2` | Principal Resolution Contracts | Primero fija identidad, binding, assurance y claims sin runtime. |
| `AI-02H1E.3D.3` | Tenant Resolution Contracts | Define tenant/platform/migration scope y membership evidence. |
| `AI-02H1E.3D.4` | Authorization Decision Contracts | Añade permission, tenant/resource scope, evidence y obligations. |
| `AI-02H1E.3D.5` | Invocation Identity, Idempotency and Context Closure | Cierra tenant binding, causation, namespace y exact replay antes del service. |
| `AI-02H1E.3D.6` | Authority Application Service | Implementa puertos/factories puros; repository in-memory, sin Functions. |
| `AI-02H1E.3D.7` | Boundary Unit Certification | Threat tests, error mapping, graph rules y fail-closed. |
| `AI-02H1E.3D.8` | Direct Writer Closure | Migra/retira browser writes y prepara rules cerradas; revisión separada por impacto. |
| `AI-02H1E.3D.9` | Dark Handler Composition | Composición no exportada, sin tráfico, solo capability de test. |
| `AI-02H1E.3D.10` | Emulator End-to-End Certification | Auth/App Check/IAM fixtures, tenant isolation, replay y transaction. |
| `AI-02H1E.3D.11` | Production Readiness Audit | Decide si un único handler específico puede proponerse. |

No se propone un handler hasta `.3D.11`. El orden evita implementar adapters contra contratos todavía ambiguos.

## 26. Explicit non-authorization

Este documento:

- no autoriza ningún handler, endpoint, trigger, task, job o worker;
- no autoriza importar el repository desde handlers;
- no autoriza Composition Root productiva;
- no autoriza tráfico real, shadow writes ni mutaciones automáticas;
- no autoriza rules/indexes/migrations/UI/Discovery changes;
- no autoriza usar el helper legacy como principal resolver de Authority;
- no autoriza usar `platform_tenants` directo desde navegador;
- no autoriza producción, deploy, commit, push, PR ni merge.

La auditoría termina aquí para revisión arquitectónica.
