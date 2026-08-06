# Preview Containment Policy Readiness V1

Change ID: `AI-02H2.2E-R1-PREVIEW-CONTAINMENT-POLICY-READINESS-20260806-01`

## Dictamen

**B. CONDITIONAL — CONTAINMENT IMPLEMENTATION EXISTS BUT REQUIRES CERTIFICATION**

Readiness classification: `IMPLEMENTATION_REQUIRES_CERTIFICATION`.

El repositorio contiene un modelo, evaluator fail-closed, provider, adapter Firestore transaccional, audit e implementación de rollback. No existe un mecanismo operativo oficial que invoque esos métodos desde un principal confiable: no hay application service, provisioning service, CLI, script administrativo, migration, bootstrap ni control plane. La activación cloud no está lista ni autorizada.

## Gate

| Control | Resultado |
|---|---:|
| Worktree dedicado | VERIFIED |
| Rama | `audit/intelligence-preview-containment-policy-readiness` |
| HEAD = `origin/main` | `182be2ea52e1…`, VERIFIED |
| Estado inicial | CLEAN |
| Node | `v20.20.2` |
| Firebase alias | Preview |
| GCP target | `aura-intel-preview` |
| Functions ACTIVE | 5/5 |
| Cloud Run READY | 5/5 |

No se invocó ningún handler ni se ejecutó navegador.

## Read-back cloud

Las consultas fueron count-only y no leyeron documentos ni IDs:

| Colección | Conteo |
|---|---:|
| `discovery_containment_active_v1` | 0 |
| `discovery_containment_policies_v1` | 0 |
| `discovery_containment_audit_v1` | 0 |

Preview continúa fail-closed con `CONTAINMENT_POLICY_NOT_FOUND`.

## Arquitectura encontrada

| Ruta | Símbolo | Responsabilidad |
|---|---|---|
| `functions/src/discovery/containment/discoveryContainmentTypes.ts` | `DiscoveryContainmentPolicyV1`, decision y audit contracts | Modelo cerrado de switches, cuotas, estado y lifecycle |
| `functions/src/discovery/containment/discoveryContainmentValidation.ts` | policy/request/audit validators | Bounds, enumeraciones, listas, timestamps y roles |
| `functions/src/discovery/containment/discoveryContainmentPorts.ts` | provider, evaluator, audit y quota ports | Núcleo provider-neutral |
| `functions/src/discovery/containment/DefaultDiscoveryContainmentEvaluator.ts` | evaluator | Policy lookup, validación, switches, selective blocks y cuotas |
| `functions/src/discovery/containment/enforceDiscoveryContainment.ts` | runtime integration | Environment resolution, telemetry y caller-safe denial |
| `functions/src/discovery/containment/P2DiscoveryEmergencyQuotaConsumer.ts` | P2 adapter | Cuotas por environment, policy version y operation |
| `functions/src/infrastructure/firestore/discoveryContainment/firestoreDiscoveryContainmentCollections.ts` | collection constants | Policies, active pointers y audit |
| `functions/src/infrastructure/firestore/discoveryContainment/FirestoreDiscoveryContainmentRepository.ts` | provider/repository | Immutable versions, atomic activation, lifecycle transitions y rollback |
| `functions/src/discovery/runtimeContracts/runtimeEnvironmentV1.ts` | `resolveRuntimeEnvironmentV1` | Binding fail-closed entre `PREVIEW` y el proyecto Preview |
| `functions/tests/emulator/containment/firestoreContainmentEmulator.test.ts` | 36 cases | Emulator coverage del adapter/evaluator |
| `firestore.rules` | explicit deny rules | Bloqueo total de clientes para las tres colecciones |
| `docs/security/discovery/KILL_SWITCHES_AND_EMERGENCY_QUOTAS_V1.md` | P7 design/runbook | Declara que el control plane operativo es trabajo futuro |

No se encontró implementación de containment en `packages/aura-intelligence-os` ni `src/modules/intelligence`, ni tooling operativo en `scripts` o `functions/scripts`.

## Trace exacto de `createDiscoveryLead`

1. El callable exige App Check.
2. El payload público se valida y normaliza.
3. Se deriva el App ID desde el contexto confiable y el commercial-code hash cuando aplica.
4. `enforceDiscoveryContainmentV1` evalúa `PUBLIC_INTAKE`.
5. El mismo helper evalúa `TOKEN_ISSUANCE`.
6. Si existe commercial code, evalúa `ADVISOR_CODE_RESOLUTION`.
7. Solo después se deriva idempotency, se reserva el intento y se crean lead/link/capability.

`enforceDiscoveryContainmentV1` resuelve el environment mediante `AURA_RUNTIME_ENVIRONMENT` y exige correspondencia exacta con el proyecto. Para Preview, cualquier ausencia, valor desconocido o project mismatch falla antes de resolver policy.

El provider consulta el documento `PREVIEW` de `discovery_containment_active_v1`. El pointer debe declarar:

- `version = DISCOVERY_CONTAINMENT_ACTIVE_V1`;
- `environment = PREVIEW`;
- `policyVersion` string.

La versión se busca en `discovery_containment_policies_v1` mediante un document ID derivado de environment + policy version. Si no existe pointer o la versión apuntada no existe, `getActivePolicy` devuelve `null`; el evaluator genera `CONTAINMENT_POLICY_NOT_FOUND`. Un pointer malformed genera `CONTAINMENT_POLICY_CORRUPTED`.

Una policy solo permite la operación cuando:

- pasa validación de schema y bounds;
- su environment coincide;
- su status es `ACTIVE`;
- no está expirada;
- el App ID o commercial-code hash no está bloqueado;
- el switch de la surface es `true`;
- la emergency quota aplicable permite el request.

No existen defaults permisivos.

## Modelo de policy

El contrato real se denomina `DiscoveryContainmentPolicyV1` y contiene exactamente los campos normalizados siguientes:

- `version`, `policyVersion`, `environment`;
- nueve switches booleanos por surface;
- `blockedAppIds`, `blockedCommercialCodeHashes`;
- seis reglas obligatorias en `emergencyGlobalQuota`;
- `reason`, `ownerRole`, `approvedByRole`;
- `createdAt`, `updatedAt`, `expiresAt`;
- `rollbackVersion` y `status`.

No contiene `policyId`, tenant allowlist/constraint, fingerprint, firma, change ID, principal IAM, activation ID ni metadata de aprobación verificable. El document ID se deriva de environment + policy version, pero no es fingerprint del contenido.

Los timestamps son suministrados por el caller del repository; no se generan con server timestamp. El validator normaliza campos conocidos, pero no rechaza campos top-level inesperados.

## Modelo de active pointer

No existe una interfaz pública equivalente a `ActiveContainmentPolicyPointer`. El adapter usa un contrato interno con:

- `version`;
- `environment`;
- `policyVersion`;
- `updatedAt` al escribir.

La lectura valida los tres primeros campos, pero no valida `updatedAt`, no rechaza extras y no exige una versión previa esperada. Un documento por environment proporciona unicidad física, y la transacción evita writes parciales, pero no implementa compare-and-set semántico para rechazar un operador con estado stale.

## Mecanismo de creación

Classification: `IMPLEMENTATION_EXISTS_BUT_NOT_CERTIFIED`.

`FirestoreDiscoveryContainmentRepository.activatePolicy` puede crear por primera vez, en una sola transacción:

1. el documento immutable de policy;
2. el pointer único del environment;
3. el audit record determinista.

No existe un método separado de draft/create. La policy debe llegar ya con status `ACTIVE`. El único consumer localizado de `activatePolicy` es la suite Emulator. No existe un principal operativo, comando project-explicit, dry-run, approval guard, read-back runner ni manifest de policy revisado.

## Mecanismo de activación

Classification: `IMPLEMENTATION_EXISTS_BUT_NOT_CERTIFIED`.

Fortalezas implementadas:

- transacción Firestore para policy + pointer + audit;
- un pointer document por environment;
- document ID de policy derivado y versión immutable;
- rechazo de overwrite con contenido distinto;
- audit ID determinista y replay básico;
- separación por environment;
- rollback y terminal transitions versionados.

Gaps de certificación:

1. No hay control plane confiable ni binding del actor a IAM/Authority.
2. `actorRole` y `approverRole` son strings del caller; no se exige que sean distintos.
3. No existe `expectedActiveVersion`/CAS; una operación stale puede reintentarse sobre un pointer más nuevo.
4. Los timestamps son caller-owned.
5. No existe fingerprint o firma de contenido.
6. Una actualización puede omitir `rollbackVersion` aunque ya exista policy activa.
7. Un audit ID preexistente puede causar `REPLAY` sin validar el contenido del audit ni garantizar que pointer/version quedaron aplicados.
8. El pointer no tiene validator cerrado exportado.
9. No existe mecanismo de expiración automática ni monitor de propagación.
10. No existe bloqueo explícito para que un tooling Preview intente activar Production; hoy depende del environment suministrado y de que no exista tooling público.

## Rollback e idempotencia

`rollback` sigue el pointer activo, valida una cadena de máximo ocho versiones, rechaza ciclos, exige target existente, `ACTIVE`, no expirado y del mismo environment, y actualiza pointer + audit de manera atómica. Emite telemetry después del commit.

La activación repetida de la misma policy retorna `REPLAY` y conserva un único audit. La immutability rechaza contenido diferente bajo la misma policy version. Estas garantías están implementadas en el adapter, pero no están envueltas por un workflow operativo certificado.

## Policy mínima para el Happy Path

El modelo puede expresar el vector mínimo de surfaces:

| Switch | Valor mínimo |
|---|---:|
| `publicIntakeEnabled` | true |
| `advisorCodeResolutionEnabled` | false; el test no debe usar commercial code |
| `tokenIssuanceEnabled` | true |
| `sessionResolutionEnabled` | true |
| `sessionCompletionEnabled` | true |
| `conversationAiEnabled` | true |
| `externalReportGenerationEnabled` | false |
| `documentDownloadEnabled` | false |
| `notificationFanoutEnabled` | false |

También debe fijar `environment=PREVIEW`, `status=ACTIVE`, listas de bloqueo revisadas y las seis reglas completas de quota. `INTAKE`, `AI_EVALUATION` y `COMPLETION` deben usar límites explícitos aprobados; las otras operaciones pueden permanecer disabled. No se inventaron números, roles, timestamps, version, expiry ni rollback target.

La policy no otorga authority ni desactiva App Check, capability, idempotency o rate limits. Sin embargo, el modelo no contiene tenant constraints; la no-cross-tenant depende de los contratos de capability/Authority externos. Por esta razón no existe todavía una instancia de policy lista para activar.

## Test coverage

La suite contiene 36 casos. El command oficial arrancó correctamente un Firestore Emulator `demo-*`, pero no ejecutó Vitest porque la dependencia no está instalada en el worktree. No se instalaron dependencias; el log temporal fue eliminado y el worktree quedó limpio.

| Requisito | Cobertura | Evidencia |
|---|---|---|
| 1. no policy | COVERED | case 15 |
| 2. inactive policy | COVERED | cases 17 y 36 |
| 3. malformed policy | COVERED | case 16 |
| 4. wrong environment | PARTIAL | case 22 separa environments; no fixture de pointer/policy mismatch |
| 5. Production policy in Preview | MISSING | sin fixture exacto |
| 6. valid Preview policy | MISSING | solo `LOCAL_DEMO` y `STAGING` |
| 7. duplicate activation idempotent | COVERED | case 26 |
| 8. único active pointer | PARTIAL | garantizado estructuralmente; sin concurrencia de activaciones |
| 9. stale pointer | MISSING | sin fixture exacto |
| 10. rollback | COVERED | cases 23–25 |
| 11. audit record | COVERED | cases 26 y 36 |
| 12. fingerprint/version mismatch | PARTIAL | case 30 cubre version immutability; no fingerprint |
| 13. unexpected fields reject | MISSING | el validator los normaliza/ignora |
| 14. cross-tenant attempt | MISSING | el modelo no contiene tenant scope |
| 15. policy scope mismatch | COVERED | cases 2–10 |

Resumen: 7 COVERED, 3 PARTIAL, 5 MISSING.

El Rules baseline define 14 casos generales. El guard de targeting ejecutó 15/15 PASS. No existe un test Rules dedicado a los tres nombres de colección de containment.

## Firestore Rules y acceso

`firestore.rules` declara `allow read, write: if false` para policies, active pointers y audit. El navegador no puede leer, crear ni activar policies, incluso autenticado. El adapter usa Admin SDK y por ello depende de IAM del runtime/operador, no de Rules.

No existe callable o HTTP administrativo; el case 35 lo inspecciona estáticamente. No existe una identidad de operador certificada para activación.

## Readiness

La implementación es una base sólida para construir el mecanismo oficial, pero no debe usarse directamente desde consola, script ad hoc o Admin SDK manual. Antes de autorizar activación se requiere:

1. trusted provisioning/activation service o CLI project-explicit y environment-locked;
2. dry-run + schema cerrado + fingerprint;
3. binding de actor/aprobador a principals reales y dual control;
4. timestamps server-owned y expected-version CAS;
5. reglas para rollback obligatorio en updates;
6. tests faltantes y reproducción 36/36 desde checkout preparado;
7. tests Rules explícitos para las tres colecciones;
8. manifest Preview revisado con quotas/expiry/roles aprobados;
9. read-back, rollback y audit verification automatizados.

No se creó ni activó ninguna policy. No se modificó active pointer, IAM, Secrets, Rules, Staging o Production. No hubo deploy, commit, push ni PR.
