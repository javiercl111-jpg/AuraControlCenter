# Public Intake Hardening Roadmap v1

**Estado:** secuencia propuesta; cada slice requiere autorización independiente

**Regla:** no combinar slices para eludir gates. Ante condición de detención, no desplegar ni continuar al siguiente slice.

## Dependencias

```text
Baseline AI-02H1E.4.1
  -> P2 -> P3 -> P4 -> P5 -> P6 -> P7 -> P8 -> P9 -> P10/D.10S
```

P6 puede prepararse junto a diseños previos, pero su cierre depende de los eventos reales P2–P5. P7 depende del modelo de cuotas P2/P5. P8 integra todo. P9 verifica configuración después de P8 verde.

## P2. Atomic Public Rate Limits

- **Objetivo:** aplicar límites atómicos por IP hash, App ID, email hash, commercial code, sesión y global antes de writes/costo.
- **Dependencias:** DR-001, DR-002, DR-005; limits v1 revisados.
- **Archivos previstos:** handlers públicos, servicio nuevo de rate limit, config types, emulador/tests; índices/TTL solo si están autorizados en el slice.
- **Cambios productivos:** counters atómicos, HMAC por propósito, respuesta opaca y prioridad de cuota global/emergency.
- **Pruebas:** CT-02–CT-06; concurrencia/overshoot y cardinalidad.
- **Configuración externa:** secrets HMAC, índices, ventanas/cuotas, App ID source, maxInstances iniciales.
- **Rollback:** flag de enforcement versionado a deny-safe policy; revertir handler + mantener counters hasta expiry.
- **Criterio de cierre:** límites exactos sin overshoot; no PII; métricas de allow/deny; gates existentes verdes.
- **Riesgo:** NAT/falsos positivos y hot shards.
- **Detener si:** no hay contador global atómico, secreto segregado, decisión de UX o pruebas concurrentes reproducibles.

## P3. Idempotency TTL and Cardinality

- **Objetivo:** acotar records activos, certificar TTL/cleanup y fencing de leases.
- **Dependencias:** P2; DR-004; política de retry.
- **Archivos previstos:** idempotency helper/store, create handler, cleanup/TTL config, metrics y tests.
- **Cambios productivos:** admission antes de crear key, TTL por estado, attempt limit, lease owner/fencing y cleanup observable.
- **Pruebas:** CT-16, CT-17 y replays de create.
- **Configuración externa:** TTL/index/job por ambiente, alertas de cardinalidad/backlog.
- **Rollback:** detener nuevas keys con containment; conservar records durante rollback; revertir cleanup antes de restaurar writes.
- **Criterio de cierre:** techo exacto, un takeover, stale worker no escribe y cleanup demostrado con reloj.
- **Riesgo:** cleanup prematuro rompe retries; TTL no instantáneo.
- **Detener si:** retención no aprobada, TTL efectivo no observable o rollback eliminaría evidencia necesaria.

## P4. Capability Lifecycle and Exactly-Once Completion

- **Objetivo:** cerrar lifecycle de one-time/session tokens y completion exactamente una vez con respuesta opaca.
- **Dependencias:** P2/P3; DR-003; contrato público aprobado.
- **Archivos previstos:** exchange/resolve/complete handlers, capability service/schema, completion state machine, callers y tests.
- **Cambios productivos:** expiración/revocación/scope dentro de transacción, completion ID determinista, CAS `ACTIVE -> COMPLETED`, receipt opaco, separación de downstream effects.
- **Pruebas:** CT-09–CT-15; access-integrity y report scope.
- **Configuración externa:** TTL de capability y revocación; ninguna endpoint remota.
- **Rollback:** dual-read temporal solo con formato versionado; switch de token/completion; no revertir estado ya completado.
- **Criterio de cierre:** un solo dossier/prospect attach/event bajo carrera; expired/revoked no muta; IDs internos ausentes.
- **Riesgo:** incompatibilidad con links activos y retry UX.
- **Detener si:** no hay estrategia de migración/versionado o algún side effect queda fuera de dedupe.

## P5. Strict Payload and Cost Bounds

- **Objetivo:** schemas cerrados y presupuestos para payload, IA, PDF, descarga y fan-out.
- **Dependencias:** P4; DR-006–DR-008; límites aprobados.
- **Archivos previstos:** schemas/validators, AI handler/gateway, completion, report handlers/service/PDF, notification task y tests.
- **Cambios productivos:** allowlist y recursive bounds; session/turn budgets; report lease/size; download grants; fan-out 1x1.
- **Pruebas:** CT-07, CT-08, CT-18–CT-21.
- **Configuración externa:** provider budgets, maxInstances/concurrency/timeouts, Storage bounds, task retry/DLQ.
- **Rollback:** switches costosos off; fallback IA; descargas/generación separables; schemas versionados sin aceptar legacy abierto.
- **Criterio de cierre:** exceso falla antes de downstream; costos máximos medibles; no authority injection.
- **Riesgo:** payload legítimo rechazado; generación parcial/artefactos huérfanos.
- **Detener si:** Producto no aprueba límites o fakes no demuestran call count/bytes/effects.

## P6. Structured Abuse Telemetry

- **Objetivo:** eventos, métricas y alertas accionables sin PII/tokens.
- **Dependencias:** eventos de P2–P5 estabilizados; data classification.
- **Archivos previstos:** telemetry schema/emitter, redaction, dashboards/alerts-as-config si están en repo, tests/scanners.
- **Cambios productivos:** safe reason codes, policy version, quota/budget buckets, outcomes y cardinalidad/backlog.
- **Pruebas:** CT-05/06/08 scans, CT-22; property tests de redacción.
- **Configuración externa:** sinks, retention, alert thresholds y acceso IAM.
- **Rollback:** deshabilitar campos/sink defectuoso sin apagar enforcement; logging mínimo seguro permanece.
- **Criterio de cierre:** alertas 50/75/90/hard stop, correlation útil y cero canaries sensibles.
- **Riesgo:** alta cardinalidad, costos de logging o PII indirecta.
- **Detener si:** scanner detecta PII/token/URL/hash o métricas no distinguen policy/config failure.

## P7. Kill Switches and Emergency Quotas

- **Objetivo:** implementar containment backend versionado, IAM-restricted y reversible.
- **Dependencias:** P2/P5/P6; DR-010–DR-012; policy v1 aprobada.
- **Archivos previstos:** policy schema/store/cache/evaluator, handlers, publish/rollback tooling, audit/tests/runbook.
- **Cambios productivos:** nueve switches, blocked App/code hashes, emergency quota, fail-closed y policy events.
- **Pruebas:** CT-04, CT-11, CT-18–CT-22; propagation/rollback.
- **Configuración externa:** IAM/doble control, storage elegido, cache, version promotion y alerts.
- **Rollback:** publicar nueva version a `rollbackVersion`; verify per instance; mantener costosas off ante fallo.
- **Criterio de cierre:** cambio sin redeploy cuando viable; audit completo; rollback funcional; runbook aprobado.
- **Riesgo:** policy outage apaga servicio o cache stale deja gasto abierto.
- **Detener si:** frontend puede escribir policy, falta segregación IAM o una costosa falla abierta.

## P8. Emulator Abuse Certification

- **Objetivo:** ejecutar historia integrada de abuso con 22/22 pruebas y gates.
- **Dependencias:** P2–P7 completos; deuda test-only corregida en slice autorizado.
- **Archivos previstos:** harness/fixtures fakes, scripts de emulador, evidencia manifest; solo cambios test si defectos productivos requieren volver a su slice.
- **Cambios productivos:** ninguno esperado; defectos remiten al slice dueño.
- **Pruebas:** CT-01–CT-22, D.9 Authority, access-integrity, report scope, log/secret/PII scans.
- **Configuración externa:** versiones fijadas de emuladores; deny network.
- **Rollback:** N/A para producción; descartar evidencia inválida y corregir en slice previo.
- **Criterio de cierre:** dos runs limpios, 22/22, cero endpoints remotos y bundle reproducible.
- **Riesgo:** fakes no representan límites/config efectiva.
- **Detener si:** cualquier test/gate falla, hay red remota o fixture no sintético.

## P9. Production Configuration Verification

- **Objetivo:** certificar configuración efectiva por ambiente sin conceder aún autorización productiva.
- **Dependencias:** P8 verde; DR-004/009/010/011 resueltas.
- **Archivos previstos:** manifests/checkers/read-only evidence docs; cambios config solo en slice explícitamente autorizado.
- **Cambios productivos:** ninguno durante auditoría; remediation separada si hay mismatch.
- **Pruebas:** CT-22 sobre snapshots/config exportada, schema/policy, App Check, TTL, quotas, IAM, secrets, maxInstances, concurrency, timeouts, regions y providers.
- **Configuración externa:** toda la anterior, comparada contra manifest versionado.
- **Rollback:** configuración con version/previous state; fail-closed para costosas ante mismatch.
- **Criterio de cierre:** parity declarada/efectiva, evidence timestamped, owner/approver y rollback probado.
- **Riesgo:** drift después de capturar evidencia.
- **Detener si:** no hay acceso read-only/evidencia, existe debug bypass, drift o valores no aprobados.

## P10. D.10S Resumption

- **Objetivo:** reanudar la auditoría general D.10S usando la baseline y certificaciones cerradas.
- **Dependencias:** P2–P9 cerrados; decisions approved; D.9 verde.
- **Archivos previstos:** documentos/evidencia D.10S; cualquier remediation abre slice nuevo.
- **Cambios productivos:** ninguno dentro de la reanudación de auditoría.
- **Pruebas:** revalidar gates, configuración y riesgos residuales contra commit/config exactos.
- **Configuración externa:** read-only evidence; no deploy.
- **Rollback:** retirar dictamen si cambia commit/config o expira evidencia.
- **Criterio de cierre:** revisión arquitectónica/Producto/Seguridad y dictamen D.10S separado.
- **Riesgo:** confundir baseline aprobada con autorización de producción.
- **Detener si:** cualquier prerequisito dejó de estar verde, evidencia expiró o el scope cambió.

## Gobierno de cambios

Cada slice registra rama/base, archivos, pruebas, configuración, evidencia, riesgos y confirmaciones de no commit/push/PR/deploy cuando así se ordene. Ninguna excepción amplía la autoridad del slice siguiente.
