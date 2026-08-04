# Non-Production Security Baseline Execution Plan v1

**Slice:** AI-02H1E.5.R2A

**Estado:** plan futuro; R2A no ejecutó ninguna wave

## 1. Preconditions comunes

Antes de cualquier write:

- R2A-DEC-01…06 cerradas con role receipts;
- branch de implementación, Change ID y ventana aprobados;
- `HEAD = origin/main`, worktree limpio y Node/npm certificados;
- aliases/guard implementados y mis-target tests verdes;
- project ID explícito y Production hold verificado;
- artifact/config construido una vez con SHA-256 y SBOM/provenance cuando aplique;
- pre-state/read-back authority disponible;
- rollback target deny-safe y abort owner independiente;
- Preview/Staging sin datos reales y PITR/retention decision cerrada antes de TTL.

## 2. Emulator certification

Ejecutar desde repo limpio con proyectos `demo-*`, loopback y cero credenciales cloud:

1. static test de aliases/targeting guard;
2. nueva suite Rules candidata: no autenticado denied;
3. usuario autenticado ordinario denied en server-owned;
4. `SUPER_ADMIN` forjado denied;
5. direct `platform_tenants` write denied;
6. counters, idempotency y capability mutations denied;
7. campos server-owned denied;
8. cross-tenant denied;
9. inbox self-read positive/other-user negative;
10. Admin SDK path allowed sólo contra emulator exacto;
11. D.9 authority end-to-end y D.8 handler composition;
12. rate limit, idempotency, capability, payload, telemetry y containment suites;
13. public intake abuse certification 22/22;
14. exactly-once/replay preservados;
15. Rules rollback candidate permanece cerrado.

Una suite debe cargar el archivo Rules candidato. El archivo test-only deny-all sigue útil para adapters, pero no certifica el deployment artifact.

## 3. Preview execution wave

| Orden | Acción futura | Verificación | Stop/rollback |
|---:|---|---|---|
| 1 | Aplicar aliases/guards sólo en repo y revalidar | Mapping exacto; Production test denied | Revert guard a versión más restrictiva; freeze writes |
| 2 | Añadir Rules baseline y manifest/index/TTL targets | Hashes, schema, query mapping | No deploy si writer cliente sigue abierto |
| 3 | Ejecutar certificación Emulator completa | Todas las suites verdes | Stop ante cualquier rojo |
| 4 | Capturar Preview Rules/index/TTL pre-state | Read-back normalizado y raw hash restringido | Stop si metadata no legible |
| 5 | Deploy sólo Firestore Rules a `aura-intel-preview` | Ruleset/release hash exacto | Rollback a deny-safe ruleset certificado |
| 6 | Negative tests y Admin SDK positive | Denials exactos; backend controlado funciona | Traffic/data OFF; rollback Rules si mismatch |
| 7 | Crear sólo índices aprobados en una change separada | Cada IDX `READY`, five query smokes PASS | Artifact previo; no borrar índice inline |
| 8 | Activar sólo TTL aprobado en change separada | Field policy ACTIVE; semantic expiry/cardinality/lag | Disable future deletion + containment; recovery plan |
| 9 | Capturar evidence y observar ventana aprobada | Cero unexpected deny/allow; redaction PASS | Stop, no Staging promotion |
| 10 | Cerrar wave | Approval receipt independiente | Stop; no tráfico ni siguiente recurso implícito |

R2B puede limitarse a Rules/guards y dejar IAM, TTL o App Check para sus slices previstos. Esta tabla define orden, no combina writes incompatibles.

## 4. IAM/WIF/secrets Preview wave

En un Change ID distinto:

1. crear SAs sin roles/keys;
2. revisar automática Firebase y default compute;
3. aplicar un binding mínimo por vez;
4. crear pool/provider WIF Preview y conditions exactas;
5. crear secret resources vacíos/metadatos, después versiones mediante canal restringido;
6. aplicar consumer binding por secret;
7. positive/negative permission tests;
8. asignar runtime sin tráfico;
9. read-back/key inventory/evidence;
10. detenerse antes de retirar bindings legacy.

## 5. App Check Preview wave

Después de Rules/cliente certificados:

1. registrar Web App/provider Preview;
2. monitor mode y métricas;
3. client artifact exacto;
4. positive/negative provider tests;
5. enforcement Function por Function;
6. Firestore enforcement;
7. revocar debug Preview y verificar count cero;
8. evidence y stop.

Storage permanece no configurado; no se crea bucket en esta baseline wave.

## 6. Staging replication wave

Entry: Preview evidence aceptada, mismo artifact/config digest, nuevo Change ID y approver.

1. guard valida alias `staging`, project `aura-intel-staging`, main/ref y WIF Staging;
2. capturar pre-state;
3. desplegar el mismo Rules hash;
4. ejecutar negatives/Admin positive y read-back;
5. crear los mismos índices aprobados y esperar `READY`;
6. activar sólo TTL previamente aprobado y observado en Preview;
7. configurar identidades/WIF/secrets Staging separadas;
8. configurar App Check Staging con cero debug;
9. ejecutar suite completa y capturar evidence;
10. detenerse antes de cualquier Production command.

Staging no recompila artifacts ni recibe identities/secrets Preview.

## 7. Deployment baseline futura

Promoción:

```text
local/demo -> Preview -> Staging -> STOP
```

Cada deploy registra commit, artifact digest, config digests, Change ID, actor/approver roles, comando explícito, project, UTC, pre/post state, smoke tests y rollback result. Las superficies permanecen sin tráfico hasta su gate específico.

## 8. Rollback por componente

| Componente | Trigger | Acción segura | Prohibido |
|---|---|---|---|
| Rules | Unexpected allow/deny, hash mismatch | Containment; release deny-safe certificado; re-test | Restaurar Rules actuales permisivas |
| Aliases/guard | Mapping/guard defectuoso | Freeze; restaurar guard más restrictivo | `default` o bypass |
| Indexes | Build error/query failure | Mantener índice seguro; volver artifact compatible; eliminar después | Borrar índice usado durante incidente |
| TTL | Borrado/lag/contract mismatch | Bloquear writes; disable policy/cleanup; recovery aprobada | Prometer restauración sin backup/PITR |
| IAM | Positive/negative failure | Revocar binding exacto; workload OFF | Owner/Editor blanket o key |
| WIF | Claim/audience bypass | Disable provider; revoke binding; verify exchange denied | Credencial permanente fallback |
| Secrets | Access/rotation failure | Disable version/consumer; restore previous valid same-env version | Exponer valor/evidence |
| App Check | Valid-client outage | Traffic OFF; revert last surface to monitored state con approval | Debug Staging, Rules abiertas |
| Deployment | Digest/config mismatch | Switches OFF; previous certified revision | Rebuild ad hoc |

Rollback nunca modifica Production ni reabre authority writes.

## 9. Evidence plan

| Evidence ID | Contenido sanitizado | Closure |
|---|---|---|
| R2-EVD-RULES | candidate hash, ruleset/release ID hash, read-back | Hash match; negative/positive suite PASS |
| R2-EVD-ALIAS | alias/project mapping and guard digest | No default; all mis-target tests denied |
| R2-EVD-GUARD | normalized pass/fail, branch/env/digest/change role codes | Guard executed before write |
| R2-EVD-INDEX | manifest digest, IDX state and query mapping | All approved `READY`; no extras |
| R2-EVD-TTL | field policy/state, retention contract, counts/lag | Active only approved targets; semantic expiry PASS |
| R2-EVD-SA | expected IDs, disabled state, USER_MANAGED count | Zero keys/unexpected runtime use |
| R2-EVD-IAM | role/scope/condition hashes | Minimum bindings; negatives PASS |
| R2-EVD-WIF | pool/provider/mapping/condition/audience hashes | Exact repo/ref/env; token 900 s |
| R2-EVD-SECRET | names, replication, version state/count, consumer role | No values; exact accessor |
| R2-EVD-APPCHECK | app/provider/enforcement/debug count | Staging debug zero; surfaces exact |
| R2-EVD-EMU | suite versions, counts and exit status | Complete certification PASS |
| R2-EVD-DEPLOY | command ID, project, artifact/config digest, timestamps | Exact target and read-back |
| R2-EVD-ROLLBACK | trigger, before/after state hashes, elapsed, approvers | Safe closed state restored |

Raw evidence queda en sistema restringido; Git sólo conserva hashes, counts, logical IDs y role codes. Escaneo debe dar cero tokens, secret values, signed URLs, emails, personal principals, UIDs, payloads, object names o rutas locales absolutas.

## 10. Global stop conditions

- Production reference en target/comando;
- project/alias/branch/environment/digest mismatch;
- dirty worktree o artifact reconstruido;
- approver ausente/igual al implementer;
- remote pre-state/read-back inaccesible;
- Rules writer cliente o cross-tenant bypass;
- key, broad IAM/WIF o secret leak;
- debug Staging;
- PITR/retention no decidido para TTL;
- suite roja, redaction failure o rollback no probado.

Ante stop, no se continúa con el siguiente componente o ambiente.
