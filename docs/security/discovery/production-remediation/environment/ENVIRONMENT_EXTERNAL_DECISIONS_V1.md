# Environment External Decisions v1

**Slice:** AI-02H1E.5.R1A

**Estado:** decisiones recomendadas; aprobaciones externas pendientes

Ninguna fila concede permisos ni autoriza la creación o modificación de recursos. `Deadline` se expresa como gate relativo para evitar inventar fechas organizacionales.

| ID | Decisión y opciones | Recomendación | Owner role | Approver role | Deadline | Bloqueo | Impacto | Evidence required | Estado |
|---|---|---|---|---|---|---|---|---|---|
| R1A-DEC-01 | Número de proyectos: A/B/C/D | C: Preview, Staging y Production separados; Local emulado | Platform/SRE Owner | Product Owner + Security Owner | Antes de R1B | Bloquea G1 | Define blast radius y costo | Architecture decision aprobada | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-02 | ID Firebase/GCP Preview: reutilizar o crear | Crear proyecto nuevo con ID global aprobado | Platform/SRE Owner | Product Owner | Antes de R1B | Bloquea targeting Preview | Aislamiento de PRs | Project reservation, owner y labels | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-03 | ID Firebase/GCP Staging: reutilizar o crear | Crear proyecto nuevo dedicado | Platform/SRE Owner | Product Owner | Antes de R1B | Bloquea todos los slices Staging | Certificación y promoción | Project reservation, owner y labels | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-04 | Candidato Production: conservar o reemplazar `aura-control-center-debb3` | Conservar condicionado; reclasificar Legacy si falla ownership/billing/security approval | Platform/SRE Owner | Product Owner + Security Owner | Antes de R1B | Bloquea alias Production y migration path | Riesgo/costo de migración | Ownership, billing, data classification, IAM y inventory attestation | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-05 | Billing: accounts/cost centers por proyecto | Billing aprobado por ambiente, budgets separados y labels obligatorios | FinOps Owner | Product Owner | Antes de provisionar | Bloquea project creation | Control de costo | Billing account reference, budget owner y thresholds | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-06 | Región/residencia: US vs otra | Frontera US; compute `us-central1`; Firestore `nam5`; Storage `US` | Platform/SRE Owner | Privacy/Compliance Approver + Security Owner | Antes de provisionar | Bloquea ubicación irreversible | Latencia, residencia y migración | Residency assessment y service compatibility | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-07 | Vercel Staging: proyecto separado o targets compartidos | Proyecto Vercel separado | Release Engineering Owner | Deployment Approver | Antes de R1B | Bloquea Staging frontend | Variables, protection y provenance | Project/target metadata y protection plan | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-08 | Bucket Production: harden in place o replacement | Nuevo bucket de reportes `US`; bucket actual legacy durante migración | Platform/SRE Owner | Security Owner + Privacy/Compliance Approver | Antes de R6B | Bloquea Storage promotion | Location, ACL, lifecycle y restore | Bucket design, data inventory count-only, retention y rollback plan | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-09 | Queue names y capacidad inicial | Queues exclusivas; paused; 1/s y 1 concurrent como containment propuesto | Notification Platform Owner | Platform/SRE Owner + FinOps Owner | Antes de R7B | Bloquea notification enablement | Fan-out y costo | Queue contract, retry/recovery y alert design | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-10 | Data retention, PITR y delete protection | Aprobar por ambiente antes de TTL/migration; Production restore probado | Platform/SRE Owner | Privacy/Compliance Approver | Antes de R6A/R6B | Bloquea TTL y lifecycle writes | Pérdida/retención excesiva | Data-class retention matrix y restore exercise plan | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-11 | Runtime identity granularity | Identidad por trust boundary y ambiente; WIF; cero keys | Cloud/IAM Administrator | Security Owner | Antes de R3A | Bloquea workload provisioning | Least privilege | Permission-resource matrix y negative-test plan | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-12 | Owners/approvers/on-call nominales | Registrar fuera del repo equipos/turnos para cada rol RACI | Product Owner | Security Owner | Antes de cualquier write | Bloquea aprobación humana | Accountability e incident response | Organizational role assignment record | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-13 | Production deployment authority | CI WIF + Deployment Approver + Security concurrence | Release Engineering Owner | Deployment Approver | Antes de R1B | Bloquea workflow Production | Supply chain y self-approval | WIF/branch/change-control design | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-14 | Rollback target | Frontend/backend vigentes como legacy provisional; reemplazar por artifact certificado en R4A/R4B | Release Engineering Owner | Deployment Approver + Incident Commander | Antes de R4A | Bloquea promotion | Recovery compatibility | Artifact/digest/config inventory y rehearsal plan | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-15 | Migration strategy Production | Preserve Firestore/Auth; reconcile controls; recreate identities/queues/bucket; migrate backend/objects | Platform/SRE Owner | Product Owner + Security Owner + Privacy/Compliance Approver | Antes de R3A/R6B | Bloquea destructive work | Continuidad y datos | Approved migration waves, backup y abort criteria | `REQUIRES_EXTERNAL_APPROVAL` |
| R1A-DEC-16 | Gemini/notification connectivity por ambiente | Fakes en Local/Preview; cuentas separadas Staging/Production con quotas | Backend Discovery Owner | Product Owner + FinOps Owner + Security Owner | Antes de R4A | Bloquea provider tests | Costos y exfiltración | Provider tenancy, residency, quota y kill-switch design | `REQUIRES_EXTERNAL_APPROVAL` |

## Reglas de aprobación

1. Owner y approver nominales se registran en el sistema organizacional, no en Git.
2. Implementer y approver de un write externo deben ser distintos.
3. Ninguna decisión P0 se cierra con excepción.
4. Una aprobación verbal o un valor `TBD` no desbloquea R1B.
5. Cualquier cambio a la recomendación debe registrar razón, riesgo, compensating controls, expiry si aplica y evidencia.

## Condición de salida

R1A queda documentalmente diseñado, pero condicionado. Para cerrar G1, las decisiones R1A-DEC-01 a R1A-DEC-15 deben pasar a `APPROVED` con evidencia; R1A-DEC-16 debe aprobarse antes de cualquier prueba externa de provider.
