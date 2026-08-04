# Non-Production Indexes and TTL Plan v1

**Slice:** AI-02H1E.5.R2A

**Estado:** diseño; no se creó `firestore.indexes.json`, no se creó índice y no se activó TTL

## 1. Inventario

- No existe manifest de índices versionado.
- `firebase.json` no referencia un archivo de índices.
- Las queries de documento exacto, un solo filtro, un solo `orderBy` y cleanup `expiresAt <= now` + `orderBy(expiresAt)` no justifican un índice compuesto.
- Se identificaron cinco formas multi-campo concretas que deben probarse contra Preview antes de congelar el manifest.
- Sólo idempotency tiene un target TTL versionado, con `TARGET_NOT_APPLIED`.
- Capabilities y telemetry ya persisten `expiresAt` como Firestore Timestamp; counters de rate limit sólo persisten milisegundos numéricos.

## 2. Índices candidatos no especulativos

| ID | Collection group | Fields | Query concreta | Fuente local | Estado |
|---|---|---|---|---|---|
| IDX-01 | `platform_sales_advisors` | `commercialCode ASC`, `advisorStatus ASC` | Resolver advisor activo por código | `src/modules/discovery/services/discoveryLinkService.ts` | `REQUIRED_TO_VERIFY` |
| IDX-02 | `market_import_jobs` | `createdBy ASC`, `status ASC` | Job activo del usuario con `status in` | `src/modules/market-intelligence/services/backendImportService.ts` | `REQUIRED_TO_VERIFY` |
| IDX-03 | `market_import_jobs` | `fingerprint ASC`, `status ASC` | Dedupe de import por fingerprint + status | `src/pages/MarketIntelligencePage.tsx` | `REQUIRED_TO_VERIFY` |
| IDX-04 | `commercial_pipeline_assignments` | `advisorId ASC`, `status ASC` | Assignments activos/contactados por advisor | `functions/src/prospects/replenishAdvisorPipeline.ts`, `discardPipelineProspect.ts` | `REQUIRED_TO_VERIFY` |
| IDX-05 | `market_companies` | `status ASC`, `opportunityScore DESC` | Reservoir `NEW`, threshold y orden score desc | Los mismos dos handlers de pipeline | `REQUIRED_TO_VERIFY` |

`ASC` en campos de igualdad/`in` expresa la forma de manifest; la wave debe ejecutar la query exacta y ajustar sólo si Firestore devuelve una especificación diferente. Ningún índice sugerido por consola se acepta sin volver a mapearlo a source y review.

## 3. Manifest objetivo de índices

R2B crea un único `firestore.indexes.json` con `indexes` limitado a IDX-01…IDX-05 y `fieldOverrides: []`, y añade su referencia a `firebase.json`. La revisión debe demostrar:

- cada entrada tiene un query owner y source line;
- no se indexan payloads, hashes, tokens, emails, report bodies o campos sin query;
- Preview y Staging usan el mismo manifest/digest;
- cualquier query retirada elimina su índice en una change posterior, nunca dentro del mismo rollout de Rules;
- estado remoto `READY` y query smoke PASS antes de Staging.

## 4. Orden de índices

1. Validar JSON/schema localmente.
2. Ejecutar Emulator/unit tests; registrar que Emulator no prueba tiempos de build remoto.
3. Desplegar manifest sólo a Preview con guard y project ID explícito.
4. Leer índices hasta `READY`; detener ante `ERROR` o entrada inesperada.
5. Ejecutar las cinco queries con fixtures sintéticos y cardinalidad acotada.
6. Promover el mismo digest a Staging.
7. Repetir read-back/smoke y capturar evidence.
8. No crear ni borrar índices Production.

Eliminar un índice es una change separada porque puede romper queries vigentes. Rollback inmediato de aplicación usa el artifact previo compatible; un índice adicional seguro puede permanecer hasta una eliminación aprobada.

## 5. Targets TTL

| ID | Collection group | Field | Retention/source contract | Expected state | Cleanup/coexistence | Decisión |
|---|---|---|---|---|---|---|
| TTL-01 | `discovery_intake_idempotency` | `expiresAt` | PROCESSING 24 h, COMPLETED 7 d, FAILED_FINAL 24 h; `DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1` | `ACTIVE` Preview, luego Staging | Expiry semántica en cada read; cleanup interno bounded revalida antes de borrar | `READY_FOR_APPROVAL`; target actual no aplicado |
| TTL-02 | `discovery_capabilities_v1` | `expiresAt` | Cada capability contiene Timestamp; REPORT 24 h; EXCHANGE/SESSION requieren retención congelada por tipo antes de activar | `ACTIVE` sólo tras R2A-DEC-04 | La lógica rechaza expiry/revocation antes de TTL; no cleanup desplegado | `BLOCKED_RETENTION_DECISION` |
| TTL-03 | `public_rate_limit_counters_v1` | futuro `expiresAt` | Actual `windowEndsAtMs` es number y no sirve como TTL; grace/cardinality aún no contratado | `NOT_CONFIGURED` | Ningún cleanup actual | `BLOCKED_CODE_CONTRACT`; no activar en R2B |
| TTL-04 | `discovery_abuse_telemetry_v1` | `expiresAt` | 30 días desde `StructuredAbuseTelemetryRecorder` | `ACTIVE` tras Privacy/Operations approval | Events son temporales; aggregates diarios no se borran por este target | `READY_FOR_APPROVAL` |
| TTL-05 | session tokens | `discovery_capabilities_v1.expiresAt` | Tipo `SESSION`; no se crea un collection group duplicado | Hereda TTL-02 | Expiry semántica obligatoria | `COVERED_BY_TTL_02` |
| TTL-06 | cleanup journals | N/A | No existe journal persistido identificado | `NOT_CONFIGURED` | Reabrir si se introduce colección | `NOT_APPLICABLE` |

## 6. Contrato de manifest TTL

Cada target versionado debe incluir:

```text
manifestVersion
environment
collectionGroup
field
fieldType = FIRESTORE_TIMESTAMP
expectedState
retentionContractVersion
sourceContract
semanticExpiry = CODE_ENFORCED
cleanupFallback
activationOrder = PREVIEW_THEN_STAGING
rollbackMitigation
ownerRole
approverRole
```

Los manifests no contienen project numbers, principals, tokens o datos. Project ID llega del targeting manifest y el comando sigue siendo explícito.

## 7. Activación y verificación

Por cada TTL aprobado:

1. congelar contract/manifests y hashes;
2. confirmar que todos los documentos nuevos escriben Timestamp no nulo;
3. confirmar PITR/recovery decision y datos sintéticos;
4. activar sólo Preview;
5. leer field policy hasta estado efectivo activo;
6. sembrar fixtures sintéticos expirados/no expirados;
7. probar que la aplicación niega expirados antes de borrado físico;
8. medir cardinalidad, oldest expiry y deletion lag sin asumir inmediatez;
9. observar al menos la ventana operacional aprobada;
10. promover el mismo manifest a Staging y repetir;
11. detenerse antes de Production.

## 8. Rollback y mitigación TTL

Deshabilitar una field policy detiene borrados futuros, pero no restaura documentos ya eliminados. Por eso el rollback primario es preventivo: containment bloquea nuevas writes, se desactiva cleanup, se verifica backup/PITR aprobado y sólo entonces se cambia TTL. Nunca se extiende `expiresAt` de records existentes para ocultar un fallo.

Stop inmediato ante Timestamp faltante/corrupto, retención no aprobada, caída de path exactamente-una-vez, deletion lag no observable, borrado de fixture vigente, cardinalidad creciente sin alerta o PITR/recovery no resuelto.

## 9. Evidencia

- digest de manifest local;
- mapping IDX → query/source;
- estado `READY` de cada índice;
- output normalizado de las cinco query smokes;
- field policy TTL, estado y timestamp de read-back;
- fixtures/counts/lag sanitizados;
- cleanup dry-run y semantic-expiry results;
- rollback/mitigation receipt;
- owner/approver roles y Change ID.
