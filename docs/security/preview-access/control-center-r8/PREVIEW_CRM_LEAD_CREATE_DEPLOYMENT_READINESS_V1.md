# PREVIEW CRM Lead Create Deployment Readiness V1

## Dictamen

**PREVIEW CRM LEAD CREATE DEPLOYMENT READY — WAITING FOR CONTROLLED REMOTE CHANGE AUTHORIZATION**

## Gate y targets

- Rama R8 y base `origin/main` confirmadas en el mismo commit corto `39309c1`.
- Worktree inicialmente limpio; Node `v20.20.2`.
- Firebase/GCP: `aura-intel-preview`.
- Vercel: `aura-control-center-preview`.
- Production: `NOT TARGETED`.
- Staging: `NOT TARGETED`.

## Inventario R7 en main

Main contiene el callable `createCrmLead`, su export en el entrypoint Preview, validación server-side, App Check, enforcement exacto de `crm.leads.create`, transacción Admin SDK, idempotencia, auditoría, migración frontend y Rules guard.

El frontend servido por Vercel está `READY`, proviene de `main` en el mismo commit corto `39309c1` e incluye el merge #125. No requiere redeploy.

La Function `createCrmLead` todavía no existe en Preview. Las cinco Functions Discovery existentes continúan `ACTIVE`.

## Authority source of truth

El source of truth consultado por `createCrmLead` es el par canónico:

1. `platform_global_admins/{canonical actor}`: exige principal activo y rol válido.
2. `platform_global_admin_capability_grants/{canonical actor}`: exige schema `PlatformGlobalAdminCapabilityGrantV1`, environment `PREVIEW`, estado activo y exactamente `crm.leads.create`.

Custom claims, email, estado UI y role mapping no autorizan el callable.

Baseline read-only certificado:

- `CURRENT_ROLE = VIEWER`.
- `CURRENT_CAPABILITIES = []` para el contrato R7.
- `REQUIRED_CAPABILITY = crm.leads.create`.
- Grant document: `MISSING`.

## Provisioner R8

Se agregó un runner Preview-only, UID-targeted, idempotente, auditable y fail-closed. Usa el locator desde archivo externo, nunca email, y solo admite:

- target `aura-intel-preview`;
- environment `PREVIEW`;
- role antes/después `VIEWER`;
- capability exacta `crm.leads.create`;
- grant exacto de una sola capability;
- apply futuro únicamente con Change ID exacto.

Dry-run real:

| Campo | Resultado |
|---|---|
| target | `aura-intel-preview` |
| role before / after | `VIEWER / VIEWER` |
| capability before | `ABSENT` |
| capability after | `crm.leads.create` |
| additional capabilities | `0` |
| action | `WOULD_CREATE` |
| writes | `0` |

El read-back posterior confirmó que el grant continúa ausente.

## Deployment backend selectivo

- Function: `createCrmLead`.
- Codebase: `preview-discovery`.
- Target exacto: `functions:preview-discovery:createCrmLead`.
- App Check: obligatorio.
- Runtime environment guard: Preview.
- Export productivo: presente.

La identidad runtime dedicada aún no existe. Es una dependencia planificada dentro del cambio remoto backend, no un motivo para desplegar otro handler. Antes del deploy deberán crearse únicamente esa identidad Preview y los bindings mínimos observados en runtimes equivalentes: Datastore User y Log Writer. El actor de deploy deberá demostrar `actAs` sobre esa identidad. Después se ejecutará exclusivamente el target anterior, sin `--force`.

## Plan exacto de cambios remotos

### REMOTE CHANGE 1 — capability provisioning

- Target: un grant canónico en `aura-intel-preview`.
- Delta esperado: `ABSENT → crm.leads.create`; `VIEWER → VIEWER`; capabilities adicionales `0`; dos writes atómicos (grant y audit).
- Read-back: rol `VIEWER`, grant exacto presente y ninguna capability inesperada.
- Rollback: cambio separado y explícitamente autorizado que retire solo el grant exacto y deje auditoría; read-back `ABSENT`.
- Blast radius: una identidad y una operación CRM.

### REMOTE CHANGE 2 — selective Function deployment

- Target: solo `createCrmLead` dentro del codebase Preview.
- Precondición remota: identidad runtime dedicada creada con Datastore User y Log Writer, más autorización `actAs` del deployer.
- Delta esperado: una nueva Function gen2; ningún redeploy intencional de los cinco handlers existentes.
- Read-back: Function `ACTIVE`, entrypoint correcto, identidad runtime correcta, revisión healthy y cero revisiones fallidas.
- Rollback: eliminar únicamente la nueva Function y retirar bindings/identidad dedicada cuando ya no tenga consumidores.
- Blast radius: un endpoint callable Preview y sus tres colecciones server-side previstas.

### REMOTE CHANGE 3 — Vercel Preview frontend deployment

- Estado: `NOT REQUIRED`.
- Razón: deployment `READY` ya coincide con `origin/main` y contiene R7.
- Delta esperado: `0`.
- Read-back: conservar proyecto Preview `READY` y el bundle callable vigente.
- Rollback: no aplica porque no se ejecutará deploy.
- Blast radius: ninguno.

## Gates ejecutados

| Gate | Resultado |
|---|---:|
| R7 backend | 30/30 PASS |
| R7 frontend | 5/5 PASS |
| Provisioner R8 | 22/22 PASS |
| Selective deployment guard R8 | 5/5 PASS |
| CRM Rules guard | 4/4 PASS |
| Preview deployment unit | 22/22 PASS |
| Preview runtime contracts | 18/18 PASS |
| Preview Rules target guard | 15/15 PASS |
| Total tests | 121 PASS / 0 FAIL |
| TypeScript noEmit | PASS |
| Functions build | PASS |
| Compiled selective deployment guard | PASS |
| `git diff --check` | PASS |

## Detención

No se ejecutó apply, deploy Firebase, deploy Vercel, creación de prospecto, cambio de rol, commit, push ni PR. R9 continúa bloqueado hasta completar y leer de vuelta Remote Change 1 y Remote Change 2.
