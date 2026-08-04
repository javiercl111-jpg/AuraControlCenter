# Non-Production Provisioning Preflight v1

**Programa:** AI-02H1E.5.0 — Production Readiness Remediation Program

**Slice:** AI-02H1E.5.R1C-A — Controlled Non-Production Provisioning Preflight

**Modo:** metadata/read-only; cero recursos o configuración modificados

**Dictamen:** **BLOCKED — PROJECT OR BILLING PRECONDITIONS UNRESOLVED**

## 1. Objetivo y alcance

Este preflight determina si existe evidencia suficiente para autorizar un cambio R1C-B de provisioning para Preview y Staging. Se consultó únicamente metadata de Google Cloud necesaria para billing, proyectos, organization, folders y permisos. No se consultaron métodos de pago, recursos de datos ni valores sensibles; no se accedió a Vercel/Firebase remotos ni se ejecutó un comando de escritura.

Production candidate `aura-control-center-debb3` permanece en `REMEDIATION_HOLD`. Sólo se leyó metadata de project parent/lifecycle para confirmar que no era el target de provisioning.

## 2. Gate

| Control | Resultado |
|---|---|
| Rama | `ops/intelligence-nonprod-provisioning-preflight` — PASS |
| HEAD = origin/main | `f3ed700de88192041c28f208064b3f446f656e51` — PASS |
| Worktree inicial | Limpio — PASS |
| R1B | Merge #79 presente — PASS |
| Node | `v20.20.2` — PASS |
| npm | `10.8.2` — PASS |
| Google Cloud SDK | `578.0.0` — PASS |
| Firebase CLI | `15.25.1` — PASS |
| Vercel CLI | `58.4.4` — PASS |

Los wrappers Node/PowerShell requirieron ejecución fuera del sandbox local para leer versiones y metadata; esto no cambió ningún servicio.

## 3. Billing metadata

La evidencia heredada indicaba una sola Billing Account activa. La lectura actual encontró **dos** cuentas abiertas y accesibles. Esta contradicción impide elegir una cuenta sin aprobación explícita.

| Ref | Display name | Billing ID sanitizado | Estado | Master account | Organización visible | IAM/permission result | Clasificación |
|---|---|---|---|---|---|---|---|
| BA-01 | `Mi cuenta de facturación` | `01B**************669` | `OPEN` | No reportada | No expuesta por Billing metadata | IAM readable; active principal tiene `roles/billing.admin`; association create/delete permitidos | `ELIGIBLE_NOT_APPROVED` |
| BA-02 | `Mi cuenta de facturación 1` | `01E**************793` | `OPEN` | No reportada | No expuesta por Billing metadata | IAM readable; active principal tiene `roles/billing.admin`; association create/delete permitidos | `ELIGIBLE_NOT_APPROVED` |

Permisos efectivos verificados para ambas: `billing.accounts.get`, `billing.accounts.getIamPolicy`, `billing.resourceAssociations.create` y `billing.resourceAssociations.delete`.

La capacidad técnica de vincular no sustituye aprobación. FinOps Owner y Product Owner deben seleccionar una referencia única y registrar el ID completo exclusivamente en el sistema restringido de cambio. Ningún ID completo se agrega a Git.

## 4. Project name availability

| Proposed project ID | Resultado read-only | Clasificación | Implicación |
|---|---|---|---|
| `aura-intel-preview` | `projects.describe` devolvió permission denied o proyecto inexistente, sin poder distinguir ambos estados | `UNKNOWN DUE TO ACCESS` | No se puede afirmar disponibilidad ni reservar el nombre |
| `aura-intel-staging` | Mismo resultado | `UNKNOWN DUE TO ACCESS` | No se puede afirmar disponibilidad ni reservar el nombre |

Una consulta metadata no demuestra disponibilidad global: project IDs eliminados o pertenecientes a otro owner tampoco son reutilizables. El preflight no intentó `projects.create`, ni siquiera como prueba. No se proponen alternativas porque ninguno fue confirmado `TAKEN`; si R1C-B recibe autorización para reservar y falla, debe volver a aprobación de naming antes de intentar otro ID.

## 5. Organization, folder y permisos

| Control | Resultado | Estado |
|---|---|---|
| Organization | Una organization accesible; display name omitido por ser potencialmente identificador; ID `876******321` | `AVAILABLE_REDACTED` |
| Effective project-create permission | `resourcemanager.projects.create` confirmado | `VERIFIED` |
| Organization/folder read permissions | organization get, folder list y project get confirmados | `VERIFIED` |
| Folders visibles | Cero | `MISSING_TARGET_FOLDER` |
| Proposed parent | No existe `<NONPROD_FOLDER_ID>` para R1B | `BLOCKED_EXTERNAL_DECISION` |
| Production candidate parent | Project ACTIVE; parent no reportado; labels presentes | `READ_ONLY_UNCHANGED` |

Antes de R1C-B debe elegirse una de dos opciones:

1. aprobar organization root como parent de Preview/Staging; o
2. ampliar un change separado para crear y aprobar un folder Non-Production antes de crear proyectos.

R1C-A no crea folders ni elige implícitamente organization root.

## 6. Organization policies

El principal tiene `orgpolicy.policies.list`, pero `orgpolicy.googleapis.com` está deshabilitada en el quota project activo. Habilitarla sería un write externo prohibido, por lo que no se hizo.

Estado efectivo desconocido para:

- service-account key creation/upload restrictions;
- workload identity provider restrictions;
- allowed policy member domains;
- `gcp.resourceLocations`;
- billing-account restrictions;
- inheritance aplicable al parent futuro.

Clasificación: `UNKNOWN DUE TO ACCESS/PRECONDITION`. R1C-B no debe iniciar hasta que un auditor metadata-only pueda leer estas políticas usando un quota project aprobado con la API ya habilitada, o reciba attestation independiente.

## 7. Regions and resources

Las ubicaciones R1B permanecen recomendaciones, no aprobaciones:

| Recurso | Propuesta | Estado |
|---|---|---|
| Functions / Cloud Tasks | `us-central1` | `PENDING_PRIVACY_SECURITY_PLATFORM_APPROVAL` |
| Firestore | `nam5` | `PENDING_POLICY_AND_RESIDENCY_VERIFICATION` |
| Storage | `US` | `PENDING_POLICY_AND_RESIDENCY_VERIFICATION` |

No se consultó disponibilidad de servicios regionales ni se habilitó API alguna.

## 8. Preflight blockers

1. Dos Billing Accounts técnicamente elegibles; ninguna seleccionada/aprobada.
2. Disponibilidad de ambos project IDs no determinable read-only con el acceso actual.
3. No existe folder Non-Production visible y no se aprobó usar organization root.
4. Organization Policies efectivas no legibles sin una precondición externa.
5. Implementer y approver nominales por rol aún no están registrados.
6. Región, budgets, WIF/key posture, Vercel isolation y rollback aún requieren sign-off.

## 9. Conditions to authorize R1C-B

- BA-01 o BA-02 elegida inequívocamente por FinOps/Product en sistema restringido;
- exact parent aprobado;
- Organization Policies read-back/attestation completo y compatible;
- naming reservation method aprobado con abort ante colisión;
- doce decisiones del approval register en estado `APPROVED`;
- change record emitido con fecha/ventana, implementer/approver separados y evidence destination;
- Production excluido de comandos y resources autorizados.

Hasta entonces no existe autorización para provisioning.
