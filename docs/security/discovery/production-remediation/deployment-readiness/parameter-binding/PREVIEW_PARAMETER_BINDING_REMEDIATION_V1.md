# Preview Firebase Parameter Binding Remediation V1

Change ID: `AI-02H1E.5.R3E-PREVIEW-PARAMETER-BINDING-20260805-01`

## Dictamen

**PREVIEW PARAMETER BINDING REMEDIATED — READY TO RETRY CONTROLLED DEPLOYMENT**

El deployment sigue sin ejecutarse. Production permanece en `REMEDIATION_HOLD` y no está autorizada.

## Gate

- Rama: `fix/intelligence-preview-parameter-binding`.
- HEAD y `origin/main`: `459e4d0acf4a3bd0fd11df87631cbfe12b42d18d`.
- Worktree inicialmente limpio.
- Firebase alias y proyecto GCP activos: `aura-intel-preview`.
- Node: `v20.20.2`.
- npm: `10.8.2`.

## Causa raíz

`firebase-functions` publica los defaults de los cuatro parámetros en el manifest, pero Firebase CLI 15.25.1 decide si un parámetro está resuelto comprobando la presencia de su clave en dotenv antes de aplicar el flujo interactivo. En modo no interactivo, una clave ausente provoca aborto aun cuando el manifest contiene un default.

El parser local del CLI admite `EXECUTIVE_DISCOVERY_ENDPOINT=` como clave presente con cadena vacía. Por tanto, la Preferencia A es válida y no fue necesario modificar `discoveryEvaluationConfig.ts`.

## Configuración certificada

El único archivo project-specific autorizado es `functions/.env.aura-intel-preview`:

```dotenv
AURA_RUNTIME_ENVIRONMENT=PREVIEW
DISCOVERY_SHADOW_EVALUATION=false
DISCOVERY_PRIMARY_EVALUATION=false
EXECUTIVE_DISCOVERY_TIMEOUT_MS=10000
EXECUTIVE_DISCOVERY_ENDPOINT=
```

Todos los valores son no sensibles. No existe endpoint remoto autorizado en este slice. Shadow y primary permanecen desactivados.

## Comportamiento fail-closed

- El endpoint vacío se interpreta como no configurado.
- Con shadow desactivado, la ejecución retorna `SKIPPED_DISABLED` antes de construir el adapter.
- No se construye cliente HTTP, no se invoca endpoint y no se solicita token.
- Primary continúa forzado a `false` por el resolver.
- Si shadow se activara sin endpoint, el contrato conserva `ENDPOINT_NOT_CONFIGURED`.
- Completion legacy no fue modificada.

## Manifest y resolución no interactiva

El manifest local `v1alpha1` contiene exactamente los cinco handlers allowlisted, los cuatro parámetros no secretos y los tres SecretParams certificados. El resolvedor local real de Firebase CLI fue ejecutado en modo no interactivo y sin APIs cloud:

- cuatro parámetros resueltos;
- cero prompts pendientes;
- endpoint remoto vacío;
- codebase `preview-discovery`;
- tres secret resources exactos;
- cero valores secretos leídos;
- `deploymentExecuted=false`.

## Validaciones

| Control | Resultado |
|---|---:|
| Parameter guard | 15/15 PASS |
| Distribution | 7/7 PASS |
| Deployment unit | 22/22 PASS |
| Runtime contracts | 18/18 PASS |
| Preview trust completion | 20/20 PASS |
| Rules emulator | 14/14 PASS |
| Targeting guard | 15/15 PASS |
| Shadow integration fail-closed | 15/15 PASS |
| Functions build | PASS |
| TypeScript noEmit | PASS |
| Preview guard | PASS |
| Dry-run | PASS |
| Root build | PASS |
| Firebase manifest analysis | PASS |
| Firebase non-interactive parameter resolution | PASS |
| `git diff --check` | PASS |

## Read-back cloud

- Functions: 0.
- Cloud Run services: 0.
- Tres secretos existentes.
- Una versión habilitada por secreto.
- Un accessor resource-level exacto por secreto.
- Project-level Secret Manager accessor bindings: 0.
- Valores secretos leídos: 0.
- Cambios cloud de este slice: 0.
- Staging y Production: sin cambios.

## Deuda separada

Node 20 y la línea instalada de `firebase-functions` 6.x permanecen como deuda de actualización independiente. No se amplió el alcance R3E para actualizarlos.

## Límites

No se ejecutó `firebase deploy`; no se modificaron Secrets, IAM, Rules, Vercel, Staging ni Production; no se crearon Functions o servicios Cloud Run; no se hizo commit, push o PR.

