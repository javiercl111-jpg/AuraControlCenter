# Non-Production Provisioning Approval Register v1

**Slice:** AI-02H1E.5.R1C-A

**Estado general:** `BLOCKED`; ningún sign-off se infiere de permisos técnicos o de este documento

| ID | Decisión | Estado | Evidencia actual | Owner role | Approver role | Bloqueo | Requisito para R1C-B |
|---|---|---|---|---|---|---|---|
| APR-01 | Crear proyecto Preview | `BLOCKED_EVIDENCE` | Nombre `UNKNOWN DUE TO ACCESS`; organization disponible; parent sin decidir | Platform/SRE Owner | Product Owner | Project ID/parent no verificables | Naming/parent approval y stop-on-collision |
| APR-02 | Crear proyecto Staging | `BLOCKED_EVIDENCE` | Nombre `UNKNOWN DUE TO ACCESS`; organization disponible; parent sin decidir | Platform/SRE Owner | Product Owner | Project ID/parent no verificables | Naming/parent approval y stop-on-collision |
| APR-03 | Vincular ambos proyectos a Billing Account aprobada | `BLOCKED_SELECTION` | BA-01 y BA-02 OPEN; ambas permiten association create/delete | FinOps Owner | Product Owner | No existe selección única aprobada | Restricted record con una Billing Account exacta y cost centers |
| APR-04 | Aprobar `us-central1` / `nam5` / `US` | `BLOCKED_POLICY_READBACK` | Propuesta R1B; Organization Policies no legibles | Platform/SRE Owner | Privacy/Compliance Approver + Security Owner | Residency/resource-location policy desconocida | Residency sign-off + effective policy evidence |
| APR-05 | Aprobar budgets y alertas iniciales | `PENDING_APPROVAL` | Cost envelope propuesto; gasto real no consultado | FinOps Owner | Product Owner | Amounts/routing sin sign-off | Aprobar USD 5/10 Preview, 10/20 Staging, 25/50/75/100 Production y ceiling consolidado |
| APR-06 | Aprobar WIF y cero llaves permanentes | `BLOCKED_POLICY_READBACK` | Diseño R1B; key-creation/upload constraints desconocidas | Cloud/IAM Administrator | Security Owner | Organization key/WIF policy desconocida | Effective policy evidence + WIF conditions/900s approval |
| APR-07 | Aprobar service accounts dedicadas | `PENDING_APPROVAL` | Trece identity families diseñadas; ninguna creada | Cloud/IAM Administrator | Security Owner | Permission-resource matrix sin sign-off | Identity list, bindings, impersonators y zero-key attestation approved |
| APR-08 | Aprobar queues inicialmente pausadas | `PENDING_APPROVAL` | Diseño: `PAUSED`, 1/s, concurrency 1, retries 3 | Notification Platform Owner | Platform/SRE Owner + FinOps Owner | Endpoint/audience/recovery owners pendientes | Queue contract, OIDC audience, recovery ledger y alert approved |
| APR-09 | Aprobar proyectos Vercel separados | `PENDING_APPROVAL` | Nombres R1B propuestos; no se consultó Vercel remoto | Release Engineering Owner | Deployment Approver | Cost/domain/protection/Git mapping pendientes | Preview/Staging project, Node 20, variables y protection sign-off |
| APR-10 | Mantener Production en `REMEDIATION_HOLD` | `MANDATED_CONTINUE` | User instruction + project ACTIVE/read-only; ningún write realizado | Platform/SRE Owner | Deployment Approver + Security Owner | No desbloquea Production | Production project absent from R1C-B allowed commands/resources |
| APR-11 | Aprobar rollback y abandono | `PENDING_APPROVAL` | R1B rollback catalog y preflight blockers | Incident Commander | Security Owner + Product Owner | Cooling period/delete authority/evidence destination pendientes | Phase rollback rehearsal/owners y abandon-vs-delete policy approved |
| APR-12 | Designar implementer y approver por roles organizacionales | `BLOCKED_ASSIGNMENT` | Roles definidos; asignaciones nominales no están en Git | Product Owner | Security Owner | No hay actor/approver para ventana de cambio | Restricted organizational assignment; implementer ≠ approver |

## Approval rules

1. `MANDATED_CONTINUE` preserva un bloqueo; no equivale a aprobación operativa.
2. Un permiso efectivo no constituye sign-off.
3. Implementer y approver deben ser distintos y registrarse fuera del repositorio.
4. APR-01 a APR-12 deben estar cerradas antes de emitir, no sólo completar, el Change ID R1C-B.
5. Cualquier cambio de project ID, parent, Billing Account, region o resource set exige nueva revisión del packet.

## Closure evidence

Cada aprobación futura registra: decision ID, selected option, owner role, approver role, timestamp, restricted evidence reference, expiry/review date cuando aplique, conditions y signature/audit record. Git puede almacenar únicamente estado y hash de referencia sanitizados.
