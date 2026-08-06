# Preview Synthetic Cloud Provisioning V1

## Dictamen

**PREVIEW SYNTHETIC IDENTITY AND TENANT PROVISIONED — READY FOR CONTROLLED END-TO-END HAPPY PATH**

- Change ID: `AI-02H2.2D-PREVIEW-SYNTHETIC-CLOUD-PROVISIONING-20260806-01`
- Programa: `AI-02H2`
- Slice: `AI-02H2.2D`
- Target único: `aura-intel-preview` / `us-central1`
- Readiness: `READY_FOR_HAPPY_PATH`
- Production: `REMEDIATION_HOLD` — **NOT AUTHORIZED**
- Staging: fuera de alcance

## Resultado ejecutivo

Se aprovisionó una fixture sintética y permanente de Preview formada por una
identidad Firebase Auth, un principal UID-addressed, un tenant sintético y una
membership activa. El provisioning Authority produjo un audit record y el
retry exacto devolvió `REPLAYED` sin documentos adicionales.

La identidad pudo autenticarse mediante el mismo provider que usa el cliente
Preview. El resolver privado confirmó la relación UID → principal → membership
→ tenant, environment `PREVIEW`, cero ambigüedad, cero acceso cross-tenant y
capabilities exactamente `[]`.

No se llamó ninguna Function Discovery, no se generaron leads, sesiones,
completions ni tokens Discovery y no hubo deploy.

## Gate

| Control | Resultado |
|---|---|
| Rama exacta | `ops/intelligence-preview-controlled-synthetic-provisioning` |
| HEAD | `6deb6f5970ec06038034335c6eb4fe7a2ca3d4ec` |
| `HEAD = origin/main` | PASS |
| Worktree inicial | limpio |
| Node | `v20.20.2` |
| npm | `10.8.2` |
| Firebase alias | `preview` → `aura-intel-preview` |
| GCP project activo | `aura-intel-preview` |
| Functions Preview | 5/5 `ACTIVE` |
| Cloud Run Preview | 5/5 `READY` |
| Vercel Preview | `Ready` |
| Capacidad AI-02H2.2C en `origin/main` | presente |

Staging conservó Cloud Functions API deshabilitada. Production y Staging se
consultaron únicamente en modo read-only y no recibieron cambios.

## Firebase Authentication

Estado inicial: `CONFIGURATION_NOT_FOUND`.

Se utilizó el endpoint oficial de inicialización de Identity Platform y se
configuró exclusivamente:

- Email/Password: enabled;
- password required: true;
- anonymous: disabled;
- external/social providers enabled: 0;
- duplicate emails: disabled;
- authorized domains: 4, todos pertenecientes a localhost o Preview;
- dominios Staging/Production: 0.

El cliente usa `signInWithEmailAndPassword`, por lo que no se habilitó ningún
provider adicional.

## Caso sintético y retención

- test identity label: `AI02H2-PREVIEW-SYNTHETIC-IDENTITY-01`;
- test tenant label: `AI02H2-PREVIEW-SYNTHETIC-TENANT-01`;
- approved use: `CONTROLLED_PREVIEW_HAPPY_PATH`;
- prohibited use: Staging, Production, load test, pentest, personal data y
  operación comercial.

La identidad y el tenant son fixtures permanentes en Preview; la membership se
retiene mientras exista el ambiente. Los datos de un Happy Path posterior se
retendrán 30 días. Cleanup exige un procedimiento separado, versionado,
aprobado y auditado.

## Baseline pre-provisioning

| Recurso | Total | Fixture objetivo |
|---|---:|---:|
| Firebase Auth users | 0 | 0 |
| Platform principals | 0 | 0 |
| Platform tenants | 0 | 0 |
| Tenant memberships | 0 | 0 |
| Tenant aliases | 0 | 0 |
| Authority audit records | 0 | 0 |
| Discovery links | 0 | 0 |
| Discovery sessions | 0 | 0 |
| Discovery capabilities | 0 | 0 |
| Discovery completions | 0 | 0 |

No se leyeron ni imprimieron documentos con PII.

## Identidad creada

| Metadata sanitizada | Resultado |
|---|---|
| Synthetic identity locator | `ai02h2...y-01` |
| Email locator | `sy***@au***.invalid` |
| Provider | `password` |
| Disabled | false |
| Email verified | true |
| Custom claims | 0 |
| Global privileges | 0 |
| Credential storage | Google Secret Manager |
| Enabled credential versions | 1 |

La credencial fue generada con entropía criptográfica, almacenada directamente
en el mecanismo seguro y nunca impresa ni escrita en el repositorio. No se
añadieron bindings runtime para accederla.

## Provisioning privado y retry

La ejecución usó exclusivamente
`createPrivatePreviewAuthorityProvisioningCompositionV1` y el adapter Firestore
certificado. El runner requiere project, environment y Change ID exactos.

| Resultado | Primera ejecución Authority | Retry exacto |
|---|---|---|
| Status | `PROVISIONED` | `REUSED` |
| Idempotency | `CREATED` | `REPLAYED` |
| Principal created | true | false |
| Tenant created | true | false |
| Membership created | true | false |
| Assigned capabilities | `[]` | `[]` |
| Fingerprint | `sha256:47f72bbf86...8ae9b303` | mismo |

El retry conservó los mismos locators:

- principal: `princi...a2f6`;
- tenant: `tenant...c400`;
- membership: `member...06e3`.

No hubo escritura parcial ni alias adicional.

## Read-back autoritativo

| Control | Resultado |
|---|---|
| Principal | active; `PREVIEW` |
| Tenant | active; synthetic test |
| Membership | active; única |
| Capabilities efectivas | `[]` |
| Ambigüedad | false |
| Cross-tenant | false |
| Global privileges | 0 |
| Email como autoridad | no |
| Claims como autoridad única | no |
| Authentication check | PASS |

La allowlist vacía es suficiente: intake es público y las superficies
posteriores usan capabilities Discovery emitidas por servidor, no permisos
administrativos de tenant.

## Auditoría operacional sanitizada

- request locator: `ai02h2...y-01`;
- correlation locator: `ai02h2...y-01`;
- safe status: `SUCCESS`;
- first/retry: `PROVISIONED` / `REUSED`;
- idempotency result: `REPLAYED`;
- duración: `5188.42 ms`;
- fingerprint: `sha256:47f72bbf86...8ae9b303`;
- cloud audit record: presente.

La evidencia y la salida del runner no contienen credencial, email completo,
UID completo, IDs de documentos completos, API key, token, payload completo ni
PII real.

## Post-baseline

| Recurso | Total final | Delta |
|---|---:|---:|
| Firebase Auth users | 1 | +1 |
| Platform principals | 1 | +1 |
| Platform tenants | 1 | +1 |
| Tenant memberships | 1 | +1 |
| Tenant aliases | 0 | 0 |
| Authority audit records | 1 | +1 |
| Discovery links | 0 | 0 |
| Discovery sessions | 0 | 0 |
| Discovery capabilities | 0 | 0 |
| Discovery completions | 0 | 0 |

## Ejecuciones fail-closed registradas

1. La inicialización Auth completó y el runner se detuvo antes de crear la
   identidad debido a una clasificación local demasiado amplia del dominio
   Preview. Se corrigió el guard y se añadió cobertura específica.
2. La identidad y su credencial segura se crearon; el runner se detuvo antes de
   Firestore porque la dependencia local `file:` no estaba materializada en
   `functions/node_modules`. Se añadió `npm ci --prefix functions` al
   procedimiento reproducible.
3. El retry reutilizó identidad/credencial y completó Authority sin duplicados.

En cada detención se hizo read-back antes de continuar. No se deshabilitó ni
eliminó ningún recurso real.

## Validación automatizada

| Suite/control | Resultado |
|---|---:|
| Controlled runner | 8/8 PASS |
| Authority Provisioning | 25/25 PASS |
| Provisioning guard | 17/17 PASS |
| Provisioning adapter | 8/8 PASS |
| Authority Application Service + tenant scope | 395/395 PASS |
| D.8 Authority Dark Handler | 81/81 PASS |
| D.9 Authority emulator | 40/40 PASS |
| Runtime contracts | 18/18 PASS |
| Preview deployment unit | 22/22 PASS |
| Firestore Authority adapter heredado | 30/30 PASS |
| TypeScript noEmit | PASS |
| Functions build | PASS |
| Root build | PASS |

`npm ci --prefix functions` informó hallazgos de auditoría de dependencias ya
presentes en el lockfile (1 low, 11 moderate, 4 high, 1 critical). No se aplicó
`npm audit fix`, no se alteraron dependencias y esta señal queda como riesgo
heredado para un slice separado.

## Detención

No se ejecutó Happy Path. No se llamó `createDiscoveryLead`, no se emitieron
tokens Discovery, no se resolvió ni evaluó ni completó una sesión. No se
modificó la allowlist, App Check Enforcement, Functions, Vercel, Staging ni
Production. No hubo commit, push ni PR.

