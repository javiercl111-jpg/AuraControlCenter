# Non-Production Security Baseline v1

**Programa:** AI-02H1E.5.0 — Production Readiness Remediation Program

**Slice:** AI-02H1E.5.R2A — Non-Production Security Baseline Design

**Estado:** diseño documental; ninguna configuración fue aplicada

**Dictamen de diseño:** `CONDITIONAL_SECURITY_OWNERSHIP_DECISIONS_REQUIRED`

## 1. Propósito y límites

Esta baseline define el estado mínimo implementable para Preview primero y Staging después. Debe estar aplicado y certificado antes de Functions, Storage, secretos con valores, Cloud Tasks, tráfico o datos reales. Production `aura-control-center-debb3` permanece `UNCHANGED`, en `REMEDIATION_HOLD` y fuera de toda wave.

R2A no modifica Rules, aliases, índices, TTL, IAM, WIF, secretos, App Check, recursos o despliegues. Los comandos incluidos en los documentos vinculados son contratos para una wave posterior aprobada, no autorización de ejecución.

## 2. Fuentes y estado heredado

- R1C-B1 certifica `aura-intel-preview` y `aura-intel-staging`, Firebase y Firestore `(default)` en `nam5`, Standard, delete protection enabled y PITR disabled.
- Cada ambiente tiene 37 APIs habilitadas pendientes de clasificación, una cuenta automática `firebase-adminsdk-fbsvc` pendiente de revisión IAM y ninguna identidad dedicada.
- No existen buckets, Functions ni Cloud Tasks en los dos proyectos.
- P1–P9 y R1A–R1C-B1 están cerrados en `origin/main`.
- Los receipts nominales de implementer/approver siguen pendientes de gobierno.

## 3. Inventario actual

Clasificaciones permitidas: `EXISTS`, `PARTIAL`, `MISSING`, `UNSAFE`, `LEGACY`, `NOT_APPLICABLE`.

| Control | Estado | Evidencia local | Decisión de baseline |
|---|---|---|---|
| Firestore Rules | `UNSAFE` | `firestore.rules` permite `read, write` autenticado en `platform_global_admins`, `platform_tenants` y otras colecciones administrativas | Sustituir en R2B por Rules deny-by-default; authority y estado server-owned nunca son client-writable |
| Rules de Emulator | `PARTIAL` | `functions/tests/emulator/firestore.emulator.rules` niega todo y prueba Admin SDK, pero no certifica el archivo objetivo del repositorio | Añadir una suite que cargue exactamente las Rules candidatas y pruebe paths cliente positivos/negativos |
| Colecciones server-owned | `EXISTS` | Contratos Firestore versionados para authority, counters, idempotency, capabilities, telemetry, containment y budgets | Inventario cerrado por allowlist; cualquier colección no listada hereda deny-all |
| Dependencias de escritura cliente | `UNSAFE` | Existen servicios cliente que actualizan sesiones, tenants, market data y otros documentos administrativos | R2B debe migrar o bloquear cada writer antes de desplegar Rules; ninguna excepción implícita |
| Firebase aliases | `UNSAFE` | `.firebaserc` sólo contiene `default` → Production | Aliases exactos `preview`, `staging`, `production`; `default` no tiene autoridad de deploy |
| Targeting guards | `MISSING` | Scripts de deploy no validan branch, actor, digest, Change ID o hold | Guard local/CI fail-closed antes de cualquier write |
| Deploy de Functions | `UNSAFE` | `functions/package.json` usa `firebase deploy --only functions` sin `--project` | Reemplazar en slice posterior por comando con manifest y proyecto explícitos |
| Manifest de índices | `MISSING` | No existe `firestore.indexes.json`; hay queries multi-campo productivas | Crear manifest versionado derivado únicamente de queries localizadas |
| TTL idempotency | `PARTIAL` | Existe target `DISCOVERY_INTAKE_IDEMPOTENCY_TTL_V1.json` con estado `TARGET_NOT_APPLIED` | Promover a manifest multi-ambiente y verificar estado efectivo; expiración semántica sigue en código |
| TTL capabilities | `MISSING` | `discovery_capabilities_v1.expiresAt` es Timestamp, pero no hay manifest remoto/versionado | Activar sólo tras congelar retención por tipo y certificar semantic expiry |
| TTL rate limits | `LEGACY` | Counter guarda `windowEndsAtMs` numérico, no Timestamp compatible con Firestore TTL | No activar; añadir contrato `expiresAt` Timestamp en un slice de código separado |
| TTL telemetry | `PARTIAL` | Eventos tienen `expiresAt` Timestamp y retención local de 30 días, sin manifest | Diseñar target `discovery_abuse_telemetry_v1.expiresAt`; aggregates quedan fuera |
| Cleanup journals | `NOT_APPLICABLE` | No se identificó journal persistido para cleanup | Reabrir sólo si una wave introduce uno con contrato de retención |
| Service accounts | `PARTIAL` | R1B define nombres/roles; remotamente sólo existe la cuenta Firebase automática | Crear identidades dedicadas sin keys en una wave IAM posterior |
| IAM mínimo | `PARTIAL` | Existe diseño por capa; effective bindings no están implementados ni certificados | Binding exacto por proyecto/recurso/SA/secret; prohibidos Owner/Editor/default compute runtime |
| WIF | `PARTIAL` | Pool/provider/conditions propuestos; no existen recursos | Identidades separadas por ambiente, repository/ref/environment exactos y token de 900 s |
| Secrets | `PARTIAL` | Código referencia `IDEMPOTENCY_SECRET`, `IP_HASH_SALT`, `GEMINI_API_KEY`; R1B propone siete nombres por ambiente | Secret exacto por ambiente y consumer; cero valores o IAM global en evidencia |
| App Check cliente | `UNSAFE` | Inicialización ausente sólo advierte; DEV admite debug automático | Fallar build/arranque protegido si falta configuración; debug Preview sólo con aprobación/expiry; Staging cero debug |
| App Check Functions | `PARTIAL` | Hay `enforceAppCheck: true`, validación manual, una función con `false` y handlers sin enforcement uniforme | Inventariar todas las superficies y congelar allowlist; todo callable público debe exigir App Check |
| App Check Firestore/Storage | `MISSING` | Sin estado efectivo configurado; Storage aún no existe | Firestore después de métricas/cliente; Storage antes de crear o usar bucket |
| Rollback | `PARTIAL` | Hay procedimientos documentales, no ejercicios R2A | Cada componente vuelve a estado cerrado; nunca restaura Rules permisivas ni usa Production |

## 4. Invariantes obligatorios

1. El cliente no crea, actualiza ni elimina authority, tenants, counters, idempotency, capabilities, completions, containment, telemetry, report metadata ni campos server-owned.
2. La autoridad se deriva sólo de documentos server-owned escritos por Admin SDK bajo IAM dedicado; custom claims y payloads cliente no son autoridad canónica.
3. Un path cliente permitido es explícito, field-allowlisted, tenant-bound y cubierto por pruebas positivas y negativas. No existe catch-all autenticado.
4. Admin SDK conserva capacidad por IAM, no mediante una cláusula Rules permisiva.
5. Todo write cloud lleva environment, project ID, alias, branch/ref, actor role, artifact digest, Change ID y aprobación coincidentes.
6. `default`, proyecto ambiguo, digest no certificado, actor desconocido o Production hold causan fallo antes del primer comando de escritura.
7. Preview usa sólo datos sintéticos. Staging usa datos sintéticos o representativos aprobados después de recovery y privacy gates.
8. La promoción usa el mismo artifact/config digest; no se recompila entre Preview y Staging.
9. Rollback conserva Rules fail-closed y no revierte estados autoritativos ya comprometidos.

## 5. Baseline objetivo por dominio

| Dominio | Especificación | Gate de implementación |
|---|---|---|
| Rules | `NONPROD_FIRESTORE_RULES_BASELINE_V1.md` | Emulator candidato verde; writers cliente inventariados/migrados |
| Aliases/targeting | `NONPROD_TARGETING_AND_ALIAS_GUARDS_V1.md` | Guard local + CI verde con pruebas de mis-target |
| Indexes/TTL | `NONPROD_INDEXES_AND_TTL_PLAN_V1.md` | Manifest validado; PITR/retención decididos antes de TTL |
| IAM/WIF/secrets | `NONPROD_IAM_WIF_AND_SECRETS_BASELINE_V1.md` | Owners, approvers, repository y custom-role decisions cerrados |
| App Check | `NONPROD_APP_CHECK_BASELINE_V1.md` | Apps/provider aprobados, métricas disponibles y debug gate cerrado |
| Ejecución/rollback/evidence | `NONPROD_SECURITY_BASELINE_EXECUTION_PLAN_V1.md` | Change ID, artifact digest, rollback target y ventana aprobados |
| Estado estructurado | `NONPROD_SECURITY_BASELINE_MATRIX_V1.json` | JSON validado y sin estado bloqueante desconocido |

## 6. Orden de implementación

1. Cerrar ownership y aprobaciones externas.
2. Implementar aliases y targeting guard localmente sin ejecutar deploy.
3. Añadir Rules candidatas, manifest de índices y manifests TTL en un PR de implementación.
4. Certificar Emulator y static guards desde commit limpio.
5. Ejecutar una única wave Preview con Rules primero; read-back y pruebas negativas.
6. Implementar identidades/WIF/secrets en waves separadas y sin tráfico.
7. Promover el mismo artifact a Staging; certificar Rules, índices, TTL aprobado y App Check.
8. Detenerse antes de Production.

## 7. Decisiones externas pendientes

| ID | Decisión | Owner role | Approver role | Impacto |
|---|---|---|---|---|
| R2A-DEC-01 | Asignación nominal de Security Owner, Release Implementer y Deployment Approver | Program Owner | Security + Operations | Bloquea writes Preview |
| R2A-DEC-02 | Repository owner exacto y GitHub environments para WIF | Release Engineering Owner | Security Owner | Bloquea WIF |
| R2A-DEC-03 | Custom roles vs roles estándar para runtimes Firestore | IAM Owner | Security Owner | Bloquea bindings |
| R2A-DEC-04 | Recovery/PITR y retención por capability/telemetry | Data Owner | Privacy + Incident Commander | Bloquea TTL |
| R2A-DEC-05 | Web Apps, reCAPTCHA Enterprise keys y debug policy Preview | Firebase Administrator | Security Owner | Bloquea App Check |
| R2A-DEC-06 | Legacy client writers que se migran o se retiran | Application Owner | Security Owner | Bloquea Rules deployment |

## 8. Riesgos y stop conditions

- Detener si una UI vigente necesita mutar `platform_global_admins`, `platform_tenants` o cualquier colección server-owned.
- Detener si el ruleset remoto previo no puede leerse o el rollback target no es deny-safe.
- Detener si un índice no se mapea a una query concreta.
- Detener TTL ante PITR/recovery no decidido, timestamp incompatible o riesgo de borrar evidencia.
- Detener IAM ante key permanente, wildcard, principal cross-environment, self-approval o pérdida del último acceso recuperable.
- Detener App Check si faltan métricas, existe debug Staging o el cliente válido no obtiene token.
- Detener cualquier comando cuyo target pueda ser Production.

## 9. Resultado R2A

El diseño es implementable y reversible, pero la primera wave Preview permanece condicionada a R2A-DEC-01 a R2A-DEC-06. Este paquete no concede autoridad de despliegue ni cambia el estado de ningún ambiente.
