# Production Readiness RACI v1

## 1. Roles

No se asignan personas en el repositorio. Las identidades nominales, contactos y rotaciones on-call viven en el sistema organizacional aprobado.

| Código | Rol | Responsabilidad |
|---|---|---|
| PO | Product Owner | Aprueba capacidad, experiencia, costo y creación de ambientes |
| SO | Security Owner | Acepta trust boundaries, mínimos, IAM, App Check, Rules y riesgo residual |
| PSRE | Platform/SRE Owner | Diseña/opera proyectos, runtime, Storage, Firestore, queues y monitoring |
| IAM | Cloud/IAM Administrator | Ejecuta IAM/WIF/service-account/secret bindings bajo aprobación |
| FBA | Firebase Administrator | Ejecuta Projects, Rules, App Check, TTL e indexes bajo aprobación |
| RE | Release Engineering Owner | Produce artefactos, provenance, workflows y despliegues |
| DA | Deployment Approver | Autoriza cada cambio Staging/Production y verifica gates |
| BAO | Backend Authority Owner | Migra authority writes y principal resolution |
| BDO | Backend Discovery Owner | Mantiene handlers, lifecycle, idempotency, capability y signed URLs |
| NPO | Notification Platform Owner | Opera Cloud Tasks, gateway, replay y backlog |
| SOO | Security Operations Owner | Métricas, alertas, routing, investigación y evidence preservation |
| FO | FinOps Owner | Budgets, thresholds, provider cost y capacity decisions |
| IC | Incident Commander | Runbooks, escalación, containment, rollback y break-glass exercises |
| PCA | Privacy/Compliance Approver | Retención, lifecycle, recovery, PII y evidence preservation |
| RA | Readiness Auditor | Ejecuta R11 metadata-only y produce evidencia sanitizada |
| IRR | Independent Readiness Reviewer | Evalúa R12 sin aprobar su propio trabajo de implementación |

## 2. RACI por slice

| Slice | R | A | C | I |
|---|---|---|---|---|
| R1A Environment decisions | PSRE | PO | SO, IAM, FBA, RE, FO, PCA | DA, IC |
| R1B Targeting/promotion guardrails | RE | DA | PSRE, SO, FBA | PO, RA |
| R2A Trust root migration | BAO | SO | BDO, IAM, FBA | DA, RA |
| R2B Rules closure | FBA | SO | BAO, BDO, PSRE | DA, RA, PO |
| R3A Workload identities/WIF | IAM | SO | PSRE, RE, FBA | DA, RA |
| R3B Privilege/secret cutover | IAM | SO | PSRE, RE, IC | DA, RA, PO |
| R4A Staging backend alignment | RE | DA | PSRE, SO, BAO, BDO, FBA | PO, IC, RA |
| R5 App Check | FBA | SO | RE, BDO, PSRE, SOO | DA, RA |
| R6A TTL/indexes/recovery | FBA | PSRE | BDO, SO, PCA, SOO | DA, RA |
| R6B Storage/signed URLs | PSRE | SO | BDO, IAM, PCA | DA, RA |
| R7A Functions quotas | PSRE | FO | PO, SO, BDO, RE | DA, SOO, RA |
| R7B Tasks/gateway | NPO | PSRE | SO, IAM, SOO, FO | DA, IC, RA |
| R8 Kill switches/policy | PSRE | SO | BDO, BAO, SOO, IC | DA, PO, RA |
| R9A Observability/P0 alerts | SOO | IC | PSRE, SO, NPO, BDO | DA, PO, RA |
| R9B Budgets/provider cost | FO | PO | SO, PSRE, SOO, NPO | DA, IC, RA |
| R10 Runbooks/rollback/break-glass | IC | SO | PSRE, IAM, FBA, NPO, SOO, PCA | DA, PO, RA |
| R4B Production promotion | RE | DA | SO, PSRE, FBA, IAM, IC, PO | RA, IRR |
| R11 P9 read-only revalidation | RA | SO | PSRE, FBA, IAM, RE, SOO, FO | DA, PO, IRR |
| R12 Final readiness certification | IRR | DA | SO, PO, IC, PCA | Todos los owners de implementación |

`R` ejecuta; `A` decide/acepta el resultado; `C` revisa antes del cierre; `I` recibe evidencia. Un rol puede estar ocupado por equipos diferentes por ambiente, pero nunca se infiere una persona.

## 3. Approval rules

1. Implementer y approver de un write externo deben ser roles organizacionalmente separados.
2. R2B, R3A/R3B, R5, R6, R7, R8, R9 y R4B requieren Security Owner concurrence aunque otro rol sea `A`.
3. Todo deployment requiere Deployment Approver; Production además requiere cierre del gate previo y aprobación del change window.
4. Todo cambio de presupuesto/capacidad requiere FinOps Owner y Product Owner.
5. Retención, TTL, PITR, Storage lifecycle y migración de datos requieren Privacy/Compliance Approver.
6. Break-glass requiere Incident Commander + Security Owner, expiry automática, audit y revalidación posterior.
7. El Independent Readiness Reviewer no puede ser el único implementer ni approver de R1–R11.
8. Una aprobación verbal o un rol sin identidad/turno registrado fuera del repositorio no habilita writes.

## 4. Decision ownership

| Decisión | Propuesta por | Aprobada por | Evidencia |
|---|---|---|---|
| Nuevos proyectos Preview/Staging | PSRE | PO | Environment decision record |
| Staging Vercel isolation | RE | DA | Targeting/protection read-back |
| Trust-root semantics | BAO | SO | Authority contract + tests |
| Rules exactas | FBA | SO | Emulator matrix + deployed hash |
| Runtime SA granularity | IAM | SO | Permission-resource matrix |
| Runtime quotas | PSRE | FO + PO | Limit/cost decision record |
| App Check provider/enforcement | FBA | SO | Provider/enforcement matrix |
| TTL/retention/recovery | FBA/PSRE | PCA + PSRE | Retention/recovery decision |
| Bucket strategy | PSRE | SO + PCA | Storage migration/hardening plan |
| Notification limits/gateway | NPO | PSRE | Queue/gateway contract |
| Emergency policy | PSRE | SO | Immutable policy + approval record |
| Alert routing | SOO | IC | Routing test receipt |
| Production deploy | RE | DA | Closed-gate checklist + change record |
| Final readiness decision | IRR | DA | Final certification record |

## 5. Escalation

- **P0/security or trust-root:** SO + IC immediately; dependent slices stop.
- **Availability/recovery:** PSRE + IC; keep containment active.
- **Cost/quota:** FO + PO + IC; expensive surfaces OFF until decision.
- **PII/retention:** PCA + SO; preserve evidence and stop deletion/migration.
- **Deployment drift:** RE + DA; freeze promotion and return to last certified artifact.
- **Unknown access:** owning administrator grants metadata-only auditor access or supplies independent attestation; never infer closure.

