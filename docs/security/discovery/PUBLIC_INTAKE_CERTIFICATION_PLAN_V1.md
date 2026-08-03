# Public Intake Certification Plan v1

**Estado:** plan propuesto; no ejecutado en este slice

**Regla de entorno:** emuladores y dobles locales únicamente; cero endpoints remotos.

## 1. Convenciones de evidencia

Cada prueba produce un bundle local con: commit, policy version, seed/fixture ID sintético, reloj, comandos, stdout/stderr, assertions, métricas capturadas y scan de secretos/PII. El bundle no se versiona si contiene datos sensibles. `PASS` requiere resultado determinista y cero llamadas de red no permitidas.

Slices: P2 rate limits; P3 idempotencia/TTL; P4 capability/exactly-once; P5 schema/costos; P6 telemetría; P7 contención; P8 certificación integrada; P9 configuración.

## 2. Las 22 pruebas de D.10P

| ID | Amenaza | Requisito | Superficie | Entorno | Fixture | Resultado esperado | Evidencia | Slice |
|---|---|---|---|---|---|---|---|---|
| CT-01 | Config failure / bypass | App Check ausente o inválido deniega antes de state/costo | Todas las callables públicas | Functions + Firestore emulator | Requests sin App Check y con token inválido | Error opaco; 0 writes, Gemini, PDF, URLs, tasks | Trace local + diff de colecciones/call counters | P8 |
| CT-02 | Automation with valid App Check / flooding | Contador atómico por IP limita concurrencia | Create y advisor code | Emulators; 50 workers | App Check válido, mismo IP HMAC, keys únicas | Aceptados exactamente hasta techo; resto `RATE_LIMITED`; sin overshoot | Conteo de respuestas + documento counter final | P2 |
| CT-03 | Distributed abuse | Cuota global limita rotación de IP/email/App | Create | Emulators; reloj fijo | 100 IPs, emails y keys sintéticos | Techo global exacto, sin links/records después del límite | Counter global + cardinalidad de writes | P2 |
| CT-04 | Valid App Check automation / compromised app | Cuota por App ID y blocked App ID | Create, AI, report | Emulators + policy fake | Dos App IDs; uno bloqueado | Bloqueado hace 0 trabajo; otro respeta cuota App/global | Eventos redactados + call counters | P2/P7 |
| CT-05 | Email enumeration | Hash por propósito, cuota y respuesta opaca | Create | Emulators | Email nuevo/existente/case variants | Normalización estable; misma respuesta/shape; no email en logs/counters | Snapshot responses + log scan | P2/P6 |
| CT-06 | Commercial-code enumeration | Invalid/missing/inactive indistinguibles y rate-limited | Advisor code/create | Emulators | Códigos sintéticos por estado | Misma respuesta pública y latencia bucket; IDs/UIDs ausentes | Contract snapshot + counter + log scan | P2/P5 |
| CT-07 | Payload amplification | Bytes, profundidad, campos, arrays, strings y unknown keys cerrados | Create, AI, completion, report | Functions emulator | Boundary ±1, nesting, wide objects, Unicode | Boundary válido; exceso rechazado antes de writes/downstream | Property tests + downstream spies | P5 |
| CT-08 | PII/authority injection | Server-owned fields no entran a state/log/prompt | Completion/create | Emulators | Payload con tenant/org/roles/claims/IDs/secrets/canary PII | Rechazo; 0 mutations; canaries ausentes de logs/prompts/events | Firestore diff + prompt/log scan | P5/P6 |
| CT-09 | Token theft / scope | Capability de link A no opera link B | Exchange/resolve/complete/report | Emulators | Dos links y tokens cruzados | Error opaco; 0 reads sensibles/writes/artefactos cruzados | Assertion de scope + collection diff | P4 |
| CT-10 | Token replay | One-time token solo se consume una vez bajo carrera | Exchange | Emulators; 25 workers | Un link pendiente/token válido | Un session token emitido; 24 fallos; hash previo eliminado | Transaction trace + response count | P4 |
| CT-11 | Token replay/expiry | Session capability expirada o revocada falla en toda operación | Resolve, AI, report/download | Emulators + reloj | Expired, missing expiry, revoked | Error opaco/fallback sin downstream ni URL | Matrix assertions + spies | P4/P7 |
| CT-12 | Cross-tenant/session scope | Link/session/prospect/tenant/org deben coincidir | Report generation/download | Emulators | Mismatch individual por dimensión | Fail-closed para cada mismatch; 0 Storage access | Access-integrity assertions + Storage spy | P4/P8 |
| CT-13 | Expired completion | Expiración se valida dentro de la transacción antes de mutar | Completion | Emulators + reloj avanzado | Session válida al inicio y expirada al commit | 0 dossier/lead/event/task; estado no completado | Transaction assertion + collection diff | P4 |
| CT-14 | Session duplication | Completion concurrente es exactamente una vez | Completion | Emulators; 50 workers | Una sesión activa, mismo completion ID | Un dossier/prospect attach/event; un ganador; replays opacos | Cardinalidad por colección + task spy | P4 |
| CT-15 | Replay con payload igual/distinto | Mismo payload retorna receipt; payload distinto conflictúa | Completion | Emulators | Replay idéntico y alterado | Sin efectos nuevos; receipt estable/opaco; conflicto seguro | Response snapshots + zero-diff | P4 |
| CT-16 | Idempotency TTL / retention | TTL/cleanup elimina records elegibles, conserva activos | Create/idempotency | Firestore emulator + job local + reloj | Completed/failed/processing por edad | Solo expirados se eliminan; métricas de cleanup exactas | Before/after export + job metrics | P3 |
| CT-17 | Cardinality / lease recovery | Techo de keys y fencing de lease evitan workers stale | Create/report | Emulators; fault injection | Keys únicas hasta techo; worker pausa tras expiry | Nueva key denegada al techo; un takeover; stale worker no escribe | Counter/cardinality + fencing trace | P3/P5 |
| CT-18 | AI cost amplification | Budget sesión/global/concurrency/switch evita calls | Evaluate | Functions emulator + fake Gemini | 12 calls, replay turn, concurrencia, budget exhausted, switch off | Calls únicas hasta techo; replay gratis; fallback; 0 remote network | Fake provider call ledger + metrics | P5/P7/P8 |
| CT-19 | PDF/Storage amplification | Un artefacto por session/type/version y cuota/lease | Generate/service | Emulators + fake PDF/Storage | Concurrent generates, retry, oversized PDF | Una generación/save; replays leen estado; oversized no se guarda | Generator/save counters + metadata | P5/P7/P8 |
| CT-20 | Download amplification/token theft | Scope, cuota y expiración de signed URL | Document request | Emulators + fake signer | Repeated grants; cross-session; reloj tras expiry | Grants hasta techo; no cross-scope; TTL en rango; URL nunca logueada | Signer ledger + response/log scan | P5/P8 |
| CT-21 | Notification fan-out | Un destinatario/evento, dedupe y switch | Completion/task | Emulators + fake queue/gateway | Completion replay; recipient fallbacks; switch off | Máximo 1 enqueue/inbox; replay deduped; off produce 0 delivery | Queue/gateway ledger + inbox count | P5/P7/P8 |
| CT-22 | Config/retention/observability failure | Policy inválida/expirada/mismatch falla cerrada; telemetría redactada | Todas | Emulators + policies/clock | Missing fields, wrong env, expired policy, rollback; PII/token canaries | Costosas hacen 0 calls; policy version/reason safe presentes; canaries ausentes; rollback verificable | Policy matrix + metrics/log scan + cleanup snapshot | P6/P7/P9 |

## 3. Gates obligatorios

| Gate | Criterio |
|---|---|
| D.9 Authority | Suite certificada continúa verde en el mismo commit candidato |
| Discovery access-integrity | Suite verde después de corregir la deuda test-only autorizada |
| Report scope | Scope link/session/prospect/tenant/org y tipos público/interno verdes |
| Logs | Cero PII, tokens, hashes, URLs firmadas o authority IDs en scans |
| Entorno | Firebase emulators/fakes únicamente; denylist de red prueba cero endpoints remotos |
| Fixtures | Solo identidades, emails, teléfonos, códigos e IDs sintéticos reservados |
| Worktree | Limpio al capturar evidencia; commit candidato conocido |
| Config | Policy/schema/ambiente/TTL/cuotas/providers verificados en P9 |
| Reproducibilidad | Dos ejecuciones limpias producen mismos resultados funcionales |

## 4. Deuda conocida congelada

`functions/src/discovery/tests/runDiscoveryAccessIntegrityTests.ts` contiene una expectativa de predeploy obsoleta: exige una forma concreta de `firebase.json` que ya no representa el gate actual. Debe corregirse exclusivamente en un slice **test-only autorizado**, sin mezclar cambios productivos ni relajar la exigencia de build. Hasta entonces, un fallo aislado de esa expectativa se reporta como deuda conocida, nunca se oculta ni se interpreta como suite verde.

## 5. Harness requerido para P8

- Functions, Firestore, Auth y Storage emulators fijados por versión.
- Fake App Check verifier con estados válidos/ausentes/inválidos y App IDs sintéticos.
- Fake Gemini, PDF generator, Storage signer, Cloud Tasks y notification gateway con ledgers.
- Reloj inyectable para TTL, expiración, ventanas, leases y rollback.
- Workers concurrentes deterministas y fault injection antes/después de commits.
- Export/diff de colecciones, objects y task ledger por test.
- Deny-by-default de red; una conexión no allowlisted hace fallar el run.
- Scanner de PII/secrets sobre logs, evidencia y snapshots.

## 6. Cierre de certificación

P8 solo cierra con 22/22 PASS y todos los gates verdes. P9 agrega evidencia de configuración efectiva sin ejecutar tráfico público ni endpoints remotos desde el harness. Cualquier excepción requiere risk acceptance explícita, owner/approver por rol, expiración y plan de remediación; no concede autorización de producción por sí misma.
