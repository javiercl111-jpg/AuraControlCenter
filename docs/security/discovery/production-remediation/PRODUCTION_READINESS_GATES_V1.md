# Production Readiness Gates v1

## 1. Gate model

Los gates son acumulativos. Cerrar un gate no autoriza saltar otro ni habilitar tráfico. Cada gate requiere evidencia read-back, owner y approver; la intención o un PR merged no sustituyen estado efectivo.

| Gate | Slices | Estado inicial | Propósito |
|---|---|---|---|
| G0 — Program design | Este slice | READY FOR REVIEW | Aprobar secuencia, ownership y stop conditions |
| G1 — Environment authority | R1A–R1B | BLOCKED | Ambientes/proyectos/targeting inequívocos |
| G2 — Trust root | R2A–R2B | BLOCKED | Authority backend-only y Rules seguras |
| G3 — Workload identity | R3A–R3B | BLOCKED | WIF, SAs y secretos bajo mínimo privilegio |
| G4 — Staging artifact | R4A | BLOCKED | P1–P8 desplegado en Staging con tráfico apagado |
| G5 — Platform controls | R5–R8 | BLOCKED | App Check, lifecycle, Storage, quotas, Tasks y containment efectivos |
| G6 — Observability/cost | R9A–R9B | BLOCKED | Alertas, dashboards, budgets y routing operables |
| G7 — Operational readiness | R10 | BLOCKED | Runbooks, rollback y break-glass probados |
| G8 — Production change approval | Pre-R4B | BLOCKED | Change set inmutable y rollback aprobado |
| G9 — Production safe deployment | R4B | BLOCKED | Backend alineado con todo deshabilitado |
| G10 — Read-only revalidation | R11 | BLOCKED | P9 v2 sin P0 ni unknown bloqueante |
| G11 — Final certification | R12 | BLOCKED | Revisión independiente y riesgo residual registrado |

## 2. G0 — Program design

**Entry:** P9 merged, branch documental desde `origin/main`, worktree limpio.

**Required evidence:** cinco documentos del programa, matriz 35/35, RACI, graph, stop conditions, zero external writes.

**Exit:** Architecture, Security y Operations aceptan el orden y permiten iniciar R1A.

**Stop:** un P0 no tiene owner slice, un slice mezcla cambios incompatibles o el diseño implica compartir Production con no-productivo.

## 3. G1 — Environment authority

**Entry:** G0 cerrado.

**Required evidence:**

- IDs/regions/billing/owners aprobados para dos proyectos nuevos;
- aliases explícitos por ambiente;
- Preview/Staging sin Production data, bucket, queue, secrets o SAs;
- Vercel env/branch protection y Node pin;
- workflows fallan si falta `--project` o el proyecto no coincide.

**Exit:** comandos dry-run/static checks demuestran targeting inequívoco.

**Rollback:** freeze de deploy; revert de manifests sin volver a alias implícito.

**Stop:** proyecto ambiguo, alias-only deploy, Preview con Production config o Staging no aislado.

## 4. G2 — Trust root

**Entry:** G1 cerrado y writers inventariados.

**Required evidence:**

- deployed Rules baseline legible/hash;
- authority writes sólo por Admin SDK interno con principal resolver/audit;
- custom claims no son authority canónica;
- clientes no escriben `platform_global_admins`, `platform_tenants`, counters, idempotency, capabilities o Discovery server-owned;
- Emulator/D.9/D.8/adversarial matrix verdes;
- rollback target deny-write safe.

**Exit:** Staging Rules hash coincide y ningún cliente depende de writes prohibidos.

**Rollback:** rollback application; nunca reabrir authority writes.

**Stop:** Rules remotas unreadable, writer cliente restante, cross-tenant bypass o rollback inseguro.

## 5. G3 — Workload identity

**Entry:** G1 cerrado; R2A define authority workload needs.

**Required evidence:**

- dedicated SAs por trust boundary y ambiente;
- WIF conditions por repository/branch/environment;
- deployer/auditor separados;
- zero USER_MANAGED keys;
- secret access sólo al consumidor;
- positive/negative permission tests;
- plan probado para retirar Editor/Owner personal sin lockout;
- break-glass design aprobado.

**Exit:** Staging workloads operan sin default compute/Editor y sin keys.

**Rollback:** restaurar sólo binding específico del workload anterior; nunca Editor blanket.

**Stop:** key activa, broad WIF, project-wide privilege necesario, last-admin removal o key metadata inaccesible.

## 6. G4 — Staging artifact

**Entry:** G1–G3 cerrados.

**Required evidence:** artifact digest/SBOM/provenance; P2–P8/D.9/D.8/builds verdes; Staging deployment read-back; all switches OFF; costly quotas 0; queue PAUSED; min 0/max 1/concurrency 1 para rollout; no Production data.

**Exit:** backend Staging corresponde exactamente al commit certificado bajo dedicated identities.

**Rollback:** switches OFF, queue pause, previous Staging revision.

**Stop:** artifact mismatch, surface enabled, Production resource referenced o test rojo.

## 7. G5 — Platform controls

**Entry:** G4 cerrado.

**Required evidence:**

- App Check provider/enforcement read-back y cero Production debug tokens;
- TTL `expiresAt` ACTIVE y lag/cardinality observable;
- indexes versionados y READY;
- recovery/PITR/delete-protection decision efectiva;
- buckets aislados, non-public, UBLA/PAP/lifecycle/retention aprobados;
- signer least-privilege y signed URL TTL cinco minutos;
- explicit Function limits por superficie;
- queue throughput/retries/recovery bounded y gateway OIDC/replay probado;
- active deny-all containment policy, expiry, audit y rollback.

**Exit:** controles probados en Staging y configuraciones Production preparadas/aprobadas.

**Rollback:** containment OFF/0, queue pause, signer revoke, revision rollback; TTL data recovery depende del backup aprobado.

**Stop:** enforcement unreadable, public bucket, unexpected deletion, index error, fan-out amplification, policy invalid o missing rollback.

## 8. G6 — Observability and cost

**Entry:** G5 signals disponibles.

**Required evidence:** métricas, cuatro dashboards, P0 alert policies, routing receipt, redaction scan, cost/provider budget matrix, owner/threshold/escalation/containment por proveedor.

**Exit:** alertas Staging disparadas/recibidas y presupuesto metadata read-back disponible.

**Rollback:** deshabilitar sólo la policy defectuosa con manual watch; nunca eliminar toda observabilidad.

**Stop:** sensitive log fields, no owner/runbook, routing failure, budget access unavailable o costly provider without containment.

## 9. G7 — Operational readiness

**Entry:** G5–G6 cerrados.

**Required evidence:** trece runbooks, Incident Commander, two-role approvals, table-tops, deployment/Firestore rollback, queue recovery, secret rotation, IAM revocation, loss-of-admin and break-glass activation/expiry.

**Exit:** cada scenario recupera safe state y conserva evidence.

**Rollback:** revoke exercise access; technical controls remain fail-closed.

**Stop:** standing personal privilege, missing contact/escalation, failed recovery or evidence loss.

## 10. G8 — Production change approval

**Entry:** G1–G7 cerrados; Production remains on prior backend.

**Required evidence:** immutable change manifest; Staging/Production config diff; exact artifact digest; all-write command list with explicit project; read-back commands; rollback target; change window; Security concurrence; Deployment approval; manual abort owner.

**Exit:** one bounded R4B change is approved.

**Stop:** any exception unowned/unexpired, approver equals sole implementer, rollback untested or command depends on default alias.

## 11. G9 — Production safe deployment

**Entry:** G8 cerrado.

**Required evidence:** Functions artifact/runtime/region/SA/secrets/options read-back; Rules hash; App Check; TTL/indexes; queue; active deny-all policy; alerts/routing; all switches OFF; queue PAUSED; no unexpected public invoker.

**Exit:** Production backend P1–P8 is aligned but remains disabled.

**Rollback:** immediate switch/queue containment and previous certified revision; safe Rules remain.

**Stop:** any surface enabled, artifact/config mismatch, alert unavailable or metadata unreadable.

## 12. G10 — Read-only P9 revalidation

**Entry:** G9 cerrado.

**Required evidence:** P9 v2 verification/matrix/index; 35 controls accounted; zero P0 open; zero blocking unknown; P1 closed or approved exception with owner/expiry; local certifications/builds green; sanitization and clean worktree.

**Exit:** R11 recommends final review.

**Stop:** write/invocation occurs, secret/PII exposure, project ambiguity, P0, blocking unknown or regression failure.

## 13. G11 — Final readiness certification

**Entry:** G10 cerrado and evidence current.

**Required evidence:** independent reviewer, complete traceability, residual-risk register, approvals, rollback/break-glass exercises and no self-approval conflict.

**Exit:** one allowed readiness decision recorded. Traffic enablement, if recommended, is a separate operational change.

**Stop:** stale evidence, missing owner/rollback, unresolved exception or reviewer conflict.

## 14. Environment traffic gates

| Ambiente | Antes de gate | Tráfico permitido | Habilitación |
|---|---|---|---|
| Local/demo | Siempre | Loopback/sintético | Developer local; no cloud resources |
| Preview | G1 | Equipo interno/automation con datos sintéticos | Branch policy + isolated Preview config |
| Staging | G4 | Canarios internos/sintéticos | Deployment Approver; surfaces enable one-by-one |
| Production | G9 | Cero mientras se revalida | Sólo después de G11 y un cambio operativo separado |

## 15. Exception policy

Un P1 puede cerrarse con excepción sólo si incluye owner, justification, compensating control, scope, start/end, expiry automática, monitoring y review date. Ningún P0 puede exceptuarse dentro de R11/R12. Un unknown sobre P0 se trata como abierto.

