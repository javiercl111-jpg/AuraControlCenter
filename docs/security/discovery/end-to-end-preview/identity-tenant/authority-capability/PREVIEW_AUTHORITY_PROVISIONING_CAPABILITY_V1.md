# Preview Authority Provisioning Capability V1

## Dictamen

**PREVIEW AUTHORITY PROVISIONING CAPABILITY CERTIFIED — READY FOR CONTROLLED CLOUD PROVISIONING**

- Change ID: `AI-02H2.2C-PREVIEW-AUTHORITY-PROVISIONING-CAPABILITY-20260806-01`
- Programa: `AI-02H2`
- Slice: `AI-02H2.2C`
- Target arquitectónico: Aura Intelligence Authority
- Target cloud futuro: `aura-intel-preview`
- Production: `REMEDIATION_HOLD` — **NOT AUTHORIZED**
- Staging: fuera de alcance

## Resultado ejecutivo

Se implementó una capacidad server-only, privada, determinista y auditable que
modela y resuelve la cadena Firebase UID → principal → membership → tenant →
capabilities. El servicio no crea usuarios Auth ni documentos durante este
slice: todas las escrituras futuras quedan detrás de un puerto transaccional y
de una composición privada sin transport.

La capacidad queda lista para que un procedimiento operativo posterior,
versionado y autorizado aprovisione la fixture sintética de Preview. No se
ejecutó ese procedimiento, no se llamó ninguna Function y no hubo cambios cloud.

## Gate

| Control | Resultado |
|---|---|
| Rama | `feature/intelligence-preview-authority-provisioning` |
| HEAD | `0f2d21559e33ce530707fb7a6bcd6ad5ef10b68a` |
| `HEAD = origin/main` | PASS |
| Worktree inicial | limpio |
| Node | `v20.20.2` |
| Firebase alias | `preview` → `aura-intel-preview` |
| GCP project activo | `aura-intel-preview` |

## Auditoría pasiva

- `resolveDiscoveryPrincipalV1` resuelve documentos UID-addressed en
  `platform_global_admins`.
- `serverTenantScopeResolution`, `serverAuthorityApplicationService` y los
  contratos de persistencia se reutilizan como referencia arquitectónica.
- `authorityDarkHandlerComposition` y su harness son exclusivamente
  `TEST_ONLY`; no se modificaron ni se promovieron a runtime.
- ya existía un adapter productivo para mutaciones administrativas generales,
  pero no existían repositorios ni un resolver productivo para esta operación
  sintética cerrada.
- Firestore Rules mantienen las escrituras cliente cerradas. Email, claims y
  payload cliente no constituyen autoridad.
- `previewDiscoveryIndex.ts` conserva exclusivamente los cinco handlers
  Discovery certificados.

## Modelo y contratos

`PlatformPrincipalV1`, `PlatformTenantV1` y `TenantMembershipV1` son esquemas
versionados, cerrados y exclusivos de `PREVIEW`. Registran IDs canónicos,
estado, timestamps inyectados y metadata sintética certificada. Membership
contiene la única lista de capabilities efectivas.

`AuthorityProvisioningServiceV1` expone únicamente `version` y tres métodos
cerrados:

- `provisionSyntheticIdentityAuthority`;
- `resolveAuthority`;
- `inspectAuthority`.

Los requests no aceptan tokens, claims, documentos Firestore, credenciales,
Admin SDK, email ni roles globales. Las respuestas exponen estado, locators
truncados, resultado idempotente y fingerprint SHA-256 sanitizado.

## Operación mínima

`ProvisionSyntheticPreviewAuthorityV1` valida `requestId`, `correlationId`,
`idempotencyKey`, UID, labels sintéticos, environment, capabilities, retención
y timestamp. IDs y fingerprint se derivan determinísticamente mediante puertos
inyectados. Principal, tenant, membership y audit se leen y crean dentro de una
sola transacción; cualquier estado parcial, conflicto o fallo aborta la unidad.

La idempotencia usa un audit ID determinista y compara el fingerprint completo
del request. Un replay idéntico devuelve `REPLAYED`; la reutilización de la key
con otro request falla con `IDEMPOTENCY_CONFLICT`.

## Resolver productivo

El resolver consulta UID → principal → memberships activas → tenant activo y
devuelve únicamente locators y capabilities efectivas. Falla de forma cerrada
ante principal, membership o tenant ausente/deshabilitado, memberships
ambiguas, documentos inválidos, environment mismatch y cross-tenant. No tiene
fallback por email, nombre, claims o tenant aportado por cliente.

## Puertos y adapter

El dominio no importa Firebase ni Firestore. Inyecta repositorios de principal,
tenant, membership y audit, clock, IDs, fingerprint y transacción.

El adapter Admin SDK usa los nombres autoritativos confirmados:

- `platform_global_admins/{authUid}`;
- `platform_tenants/{tenantId}`;
- `tenant_memberships/{membershipId}`;
- `authority_audit_events/{auditId}` para evidencia sanitizada.

Cada lectura se decodifica mediante el schema V1 cerrado. Los snapshots nunca
salen del adapter y los errores de persistencia no controlados se reducen a
`PERSISTENCE_FAILURE`.

## Composición privada

La composición server-only usa SHA-256 para IDs/fingerprints y un clock
inyectado. No está exportada desde `previewDiscoveryIndex.ts`, no forma parte de
la allowlist desplegable y no crea callable, HTTP endpoint ni superficie de
navegador. Su consumo futuro requiere un script operativo, job privado o
transport interno certificado en otro change.

## Capabilities

La allowlist de Authority para Discovery Preview es exactamente vacía. No se
inventó una capacidad administrativa:

- `createDiscoveryLead` es intake público previo a principal;
- exchange y session usan capabilities server-issued de Discovery;
- conversation y completion usan la capability de sesión certificada;
- no se asignan `platform admin`, `super admin` ni roles globales.

## Retención

`PreviewSyntheticAuthorityRetentionPolicyV1` fija:

- principal y tenant como fixtures permanentes de Preview;
- membership durante la vida del ambiente Preview;
- datos del Happy Path durante 30 días;
- cleanup exclusivamente mediante procedimiento versionado, aprobado y
  auditado;
- reutilización en Staging o Production prohibida.

Este slice no implementa ni ejecuta disable/cleanup.

## Validación

| Suite/control | Resultado |
|---|---:|
| Authority Provisioning | 25/25 PASS |
| Guard negativo | 17/17 PASS |
| Guard sobre fuentes reales | PASS |
| Adapter Firestore privado | 8/8 PASS |
| Intelligence OS architecture | 17/17 PASS |
| Authority Application Service + tenant scope | 395/395 PASS |
| D.8 Authority Dark Handler | 81/81 PASS |
| D.9 Authority end-to-end emulator | 40/40 PASS |
| Runtime contracts | 18/18 PASS |
| Preview deployment unit | 22/22 PASS |
| Firestore Authority adapter heredado | 30/30 PASS |
| TypeScript noEmit | PASS |
| Functions build | PASS |
| Root build | PASS |

## Límites y detención

No se creó identidad Auth, principal, tenant, membership ni alias. No se
invocaron Functions, no se ejecutó Happy Path y no hubo deploy. IAM, Secret
Manager, App Check, Vercel, Rules, Staging y Production permanecieron intactos.
No hubo commit, push ni PR.
