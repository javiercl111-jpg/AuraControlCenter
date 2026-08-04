# Environment Architecture Decision v1

**Programa:** AI-02H1E.5.0 — Production Readiness Remediation Program

**Slice:** AI-02H1E.5.R1A — Environment Decision and Resource Allocation

**Estado:** decisión arquitectónica documentada; aprobaciones y asignaciones externas pendientes

**Dictamen R1A:** **CONDITIONAL — EXTERNAL ENVIRONMENT DECISIONS REQUIRED**

## 1. Alcance y fuentes

Este documento define el modelo objetivo de ambientes antes de cualquier cambio en proyectos, IAM, Rules, TTL, App Check, cuotas o deployments. Es únicamente documental: no crea recursos, no cambia configuración y no concede habilitación de tráfico productivo.

La decisión se deriva exclusivamente de los ocho artefactos canónicos P9 y del programa enlazados desde el índice Discovery. No se repitió P9 ni se consultaron servicios externos. Los nombres no presentes en esas fuentes permanecen `TBD_EXTERNAL_APPROVAL`.

## 2. Decisión única sobre el modelo

Se adopta la **alternativa C: tres proyectos Firebase/Google Cloud separados para Preview, Staging y Production; Local/Demo usa exclusivamente Emulator Suite y fakes locales**.

La decisión minimiza el riesgo de que una rama, prueba o Preview escriba en Production sin crear un proyecto cloud para datos sintéticos locales. Sus invariantes son:

1. Preview, Staging y Production no comparten proyecto, datos, Auth, bucket, queue, secretos, App Check app ni runtime identity.
2. Local/Demo no tiene credenciales cloud ni ruta de red a recursos productivos.
3. Staging es el único origen permitido de una promoción a Production.
4. Todo targeting cloud requiere proyecto explícito; el alias `default` queda prohibido para deployment.
5. Production permanece en `REMEDIATION_HOLD`: no se promueve backend ni se habilita tráfico nuevo hasta cerrar los gates acumulativos.
6. Los IDs de los dos proyectos nuevos, billing accounts y roles nominales se asignan fuera del repositorio y requieren aprobación antes de R1B.

## 3. Evaluación de alternativas

| Alternativa | Aislamiento y datos | IAM/App Check/cuotas | Incidente y rollback | Costo/complejidad | Deployment/observabilidad/certificación | Decisión |
|---|---|---|---|---|---|---|
| A. Un proyecto compartido | Muy bajo; pruebas pueden tocar Production | Políticas y límites se mezclan | Blast radius único; rollback ambiguo | Menor costo aparente, alta complejidad de control | No permite evidencia inequívoca por ambiente | Rechazada |
| B. Non-prod + prod | Production aislado, Preview y Staging aún se contaminan | IAM y cuotas non-prod compiten | Staging no representa una promoción limpia | Costo medio | Certificación puede ser invalidada por Preview | Rechazada |
| C. Preview + Staging + prod | Alto; frontera por ambiente | Policies, identities, App Check y cuotas independientes | Rollback y evidencia por proyecto | Costo y operación moderados | Promoción y certificación reproducibles | **Recomendada** |
| D. Demo + Preview + Staging + prod | Alto, pero el proyecto Demo agrega superficie cloud innecesaria | Requiere un cuarto set de controles | Mayor superficie de incidente | Mayor costo y complejidad | No añade valor frente a emuladores locales | Rechazada |

La alternativa C exige cost centers, budgets, lifecycle y eliminación controlada de recursos temporales. Ese costo es aceptable frente al riesgo P0 de compartir Production con Preview.

## 4. Contrato de ambientes

### 4.1 LOCAL_DEMO

| Campo | Decisión |
|---|---|
| Propósito | Desarrollo, demostración y pruebas deterministas sin cloud |
| Usuarios permitidos | Desarrolladores autorizados en estación local; automatización local |
| Datos | Fixtures exclusivamente sintéticos, reiniciables y sin PII |
| Tráfico | Loopback; cero tráfico público |
| Conectividad externa | Negada por defecto; providers mediante fakes/seams |
| Firebase / GCP | Emulator Suite; ningún proyecto real |
| Vercel | No aplica; servidor local |
| Functions / Firestore / Auth / Storage | Emuladores o fakes locales |
| Cloud Tasks | Ledger/fake local; nunca una queue cloud |
| App Check | Seam local; debug sólo local y no persistente |
| Secret Manager | No aplica; valores dummy no sensibles |
| Gemini / notification gateway | Fakes; invocación externa deshabilitada |
| Logs / metrics / alertas | Locales, efímeros, sanitizados; sin routing externo |
| Budgets | No aplica; cualquier consumo cloud es una violación |
| Deployment authority | Developer local |
| Rollback | Descartar estado y reseed de fixtures |
| Retención | Efímera; cleanup al terminar la sesión |
| Owner / approver | Backend Discovery Owner / Platform/SRE Owner |

### 4.2 PREVIEW

| Campo | Decisión |
|---|---|
| Propósito | Validar cada PR y UX con aislamiento completo |
| Usuarios permitidos | Equipo interno y automatización autorizada |
| Datos | Sintéticos o anonimizados; nunca copias directas de Production |
| Tráfico | Interno, limitado y expirante |
| Conectividad externa | Denegada para Gemini/notificaciones costosas por defecto; allowlist sólo por prueba aprobada |
| Firebase / GCP | Proyecto nuevo dedicado; ID pendiente de aprobación |
| Vercel | Deployments Preview con variables target `preview` exclusivamente |
| Functions | Subset o artefacto de prueba con límites mínimos y switches OFF por defecto |
| Firestore / Auth / Storage | Instancias exclusivas de Preview; seed sintético; reset permitido |
| Cloud Tasks | Queue exclusiva, pausada salvo prueba aprobada, sin target productivo |
| App Check | App/provider exclusivos; debug token sólo temporal, con owner y expiry |
| Secret Manager | Namespace y versiones exclusivas Preview |
| Gemini / notification gateway | Fakes por defecto; credenciales productivas prohibidas |
| Logs / metrics / alertas | Proyecto Preview; retención corta aprobada y alertas de costo/abuso |
| Budgets | Techo bajo con alerta temprana y apagado de superficies costosas |
| Deployment authority | CI Preview con WIF y branch policy |
| Rollback | Deployment Preview anterior o eliminación del deployment |
| Retención | Máximo 30 días propuesto; cleanup al cerrar PR, sujeto a Privacy |
| Owner / approver | Release Engineering Owner / Deployment Approver |

### 4.3 STAGING

| Campo | Decisión |
|---|---|
| Propósito | Certificación previa y única fuente de promoción productiva |
| Usuarios permitidos | Testers internos, owners y auditores autorizados |
| Datos | Sintéticos representativos; deidentificados sólo si Privacy lo aprueba |
| Tráfico | Canarios internos; habilitación superficie por superficie |
| Conectividad externa | Endpoints equivalentes con cuentas y cuotas no productivas |
| Firebase / GCP | Proyecto nuevo dedicado; ID pendiente de aprobación |
| Vercel | Proyecto separado recomendado; aislamiento equivalente requiere evidencia y aprobación |
| Functions | Mismo artefacto inmutable que Production; inicialmente OFF, min 0/max 1/concurrency 1 |
| Firestore | Rules equivalentes; TTL e índices primero aquí; recovery probado |
| Auth | Tenant/user pool exclusivo con identidades de prueba |
| Storage | Bucket exclusivo endurecido; objetos sintéticos |
| Cloud Tasks | Queue exclusiva y `PAUSED` por defecto; OIDC no productivo |
| App Check | Provider production-like; sin debug permanente |
| Secret Manager | Secretos exclusivos con consumidores mínimos |
| Gemini / notification gateway | Cuentas/endpoints Staging o fakes con cuotas mínimas |
| Logs / metrics / alertas | Telemetría, dashboards y routing de prueba equivalentes |
| Budgets | Budget propio y provider caps bajos |
| Deployment authority | CI WIF + Deployment Approver |
| Rollback | Artefacto Staging previo, switches OFF y queue pause |
| Retención | 30 días propuesta para datos; evidencia de certificación según política aprobada |
| Owner / approver | Platform/SRE Owner / Deployment Approver |

### 4.4 PRODUCTION

| Campo | Decisión |
|---|---|
| Propósito | Operación autorizada del servicio con datos reales |
| Usuarios permitidos | Usuarios finales y operadores bajo contratos aprobados |
| Datos | Reales autorizados y clasificados; acceso humano excepcional y auditado |
| Tráfico | Sin nueva habilitación durante remediación; gradual sólo tras gates finales y cambio separado |
| Conectividad externa | Allowlist de providers/gateway con límites, autenticación y kill switches |
| Firebase / GCP | `aura-control-center-debb3` como candidato condicionado; proyecto explícito, nunca `default` |
| Vercel | `aura-control-center` Production desde `main`, con protección y provenance |
| Functions | Artefacto certificado, WIF de deploy y SAs dedicadas; initially OFF en promoción |
| Firestore | `(default)` en `nam5`; Rules cerradas, TTL activo, índices versionados y recovery aprobado |
| Auth | Recurso existente a inventariar sin leer usuarios; no se comparte fuera de Production |
| Storage | Nuevo bucket de reportes recomendado; bucket actual se trata como legacy durante migración |
| Cloud Tasks | Queue Production exclusiva, pausada o con mínimos hasta gates |
| App Check | Enforcement verificado y cero debug tokens |
| Secret Manager | Secretos exclusivos por consumidor y versión; ninguna llave permanente |
| Gemini / notification gateway | Cuentas, quotas, audience y budgets productivos exclusivos |
| Logs / metrics / alertas | P0 dashboards, alert routing y audit retention antes de tráfico |
| Budgets | GCP y provider budgets con owner, thresholds y containment |
| Deployment authority | CI WIF + Deployment Approver + Security concurrence |
| Rollback | Backend certificado previo, switches OFF, quotas 0 y queue pause |
| Retención | Política Production por clase; TTL, backups y recovery aprobados por Privacy |
| Owner / approver | Platform/SRE Owner / Deployment Approver |

## 5. Inventario y asignación de proyectos conocidos

P9 sólo aporta nombres verificables suficientes para dos proyectos Google Cloud/Firebase. Los otros proyectos accesibles no se nombran en las fuentes permitidas y no se inventan.

| Project ID | Nombre/evidencia | Billing | Datos y servicios conocidos | IAM | Riesgo de reutilización | Clasificación / decisión | Owner requerido |
|---|---|---|---|---|---|---|---|
| `aura-control-center-debb3` | Production candidate de P9 | Billing vinculado; budgets no legibles | Firestore Native `nam5`; 49 docs de idempotencia; 9 Functions scoped activas pero stale; dos Web Apps; bucket existente; Auth inventory desconocido | Default compute para 8/9 Functions, `Editor`, acceso amplio a secretos y Owner personal | Alto hasta cerrar P0/P1; contiene recursos/datos reales | `CANDIDATE_PRODUCTION`; conservar condicionado y congelar promociones. Si falla ownership/billing/IAM/data approval, reclasificar `LEGACY` y migrar | Platform/SRE + Product + Security |
| `aura-hcm` | Proyecto activo en configuración gcloud durante P9; no fue target auditado | Desconocido | No inventariado por las fuentes canónicas | Desconocido | Extremo: selección accidental y compatibilidad no demostrada | `DO_NOT_USE` para Aura Intelligence hasta inventario y aprobación separados | Cloud/IAM Administrator |

No existe evidencia canónica para clasificar un proyecto existente como Preview o Staging. Ambos son `NEW_REQUIRED`. Los siete proyectos Vercel accesibles mencionados por P9 no tienen inventario nominal completo en estas fuentes; sólo `aura-control-center` y el gateway `aura-maintenance-os` se conservan como activos conocidos, sujetos a R1B/R7B.

## 6. Decisión sobre el candidato productivo

### 6.1 Recomendación

Mantener `aura-control-center-debb3` como **candidato** a Production evita una migración inmediata de Firestore/Auth y conserva el deployment actual como rollback técnico. La asignación no es definitiva hasta que Product Owner, Security Owner y Platform/SRE aprueben ownership, billing, clasificación de datos, IAM y estrategia de Storage.

### 6.2 Disposición por recurso

| Disposición | Recursos |
|---|---|
| Preserve | Firestore data, Auth users/config una vez inventariados, logs/audit con retención, dominios y deployment frontend estable |
| Reconcile | Firestore Rules, TTL, índices, PITR/delete protection, App Check, Functions provenance/config, IAM, secretos, budgets y alertas |
| Recreate | Runtime/deployer identities, WIF, queues bounded y bucket dedicado de reportes |
| Migrate | Objetos de reportes al bucket nuevo; Functions al artefacto certificado; secretos a consumers dedicados |
| Deprecate | Alias Firebase `default`, default compute como runtime general y deployment scripts implícitos |
| Delete later | Bucket/queues/secrets/versions legacy sólo después de migration verification, retention y rollback window |

El estado operativo recomendado es `REMEDIATION_HOLD`: preservar el estado actual, no promover nuevos backends, no ejecutar pruebas de carga y no ampliar tráfico. R1A no cambia el estado remoto.

## 7. Región canónica

Se adopta una frontera de residencia **United States** y una región canónica de compute **`us-central1`**:

- Functions y Cloud Tasks: `us-central1`.
- Firestore Production: conservar `nam5`, ubicación multi-región existente e inmutable; nuevos proyectos deben evaluar `nam5` para equivalencia y recovery.
- Storage nuevo: `US` multi-region o una ubicación compatible con la política aprobada; se recomienda `US` para coherencia con `nam5`. El bucket actual `US-EAST1` no se reutiliza para nuevos reportes.
- Logging/metrics: recursos globales con sinks y buckets dentro de la frontera US aprobada.
- Notification gateway: endpoint/audience por ambiente; región `us-central1` cuando la plataforma lo permita.
- Gemini: endpoint regional `us-central1` cuando el modelo/servicio lo soporte; si no, el owner documenta la excepción de residencia antes de habilitarlo.

La recomendación equilibra los recursos existentes, la latencia y el costo de migración. Cualquier requerimiento de residencia fuera de US detiene la asignación y exige una nueva decisión.

## 8. Storage por ambiente

| Ambiente | Bucket / report path | PAP / UBLA | Lifecycle y retención | Signed URLs / signer | Cleanup y migración |
|---|---|---|---|---|---|
| Local/Demo | Fake/emulator; `reports/v1/<opaque-report-id>` | No aplica | Efímero | Fake signer | Reset local |
| Preview | Nuevo bucket exclusivo; `reports/v1/<opaque-report-id>` | Enforced / enabled | Cleanup al cierre de PR; máximo propuesto 30 días | Deshabilitadas por defecto; signer Preview dedicado | Delete automatizado con guard de ambiente |
| Staging | Nuevo bucket exclusivo; `reports/v1/<opaque-report-id>` | Enforced / enabled | 30 días propuesto; soft delete/recovery aprobado | TTL cinco minutos; signer Staging por prefix | Prueba de lifecycle y restore |
| Production | Nuevo bucket de reportes; `reports/v1/<opaque-report-id>` | Enforced / enabled | Por clasificación y aprobación Privacy | TTL cinco minutos; signer Production por prefix | Migración verificada; bucket actual legacy/read-only antes de retiro |

Los object paths no contienen email, UID, tenant name ni otro dato derivado de usuario. El mapping autorizado permanece en metadata server-owned.

## 9. Cloud Tasks por ambiente

| Ambiente | Queue | Región | Rate/concurrency | Retry | Caller/audience | Estado inicial | Recovery/telemetry |
|---|---|---|---|---|---|---|---|
| Local/Demo | Fake ledger | Local | 1/1 | Determinista | Fake | Disabled | Fixture reset |
| Preview | `discovery-notification-preview` | `us-central1` | 1/s, 1 concurrent propuesto | Máximo 3 | SA/audience Preview | `PAUSED` | Replay idempotente + log sanitizado |
| Staging | `discovery-notification-staging` | `us-central1` | 1/s, 1 concurrent propuesto | Máximo 3 | SA/audience Staging | `PAUSED` | Recovery ledger o DLQ equivalente + alert |
| Production | `emitDiscoveryCompletedNotification` o nombre versionado aprobado | `us-central1` | Mínimo aprobado antes de R7B; nunca defaults P9 | Máximo 3 | SA/audience Production | `PAUSED` | Recovery ledger/DLQ equivalente, backlog alert y runbook |

Los valores propuestos son containment inicial, no capacidad final. Product, Platform/SRE y FinOps aprueban cualquier aumento.

## 10. Identidades runtime y deployment

Cada ambiente cloud tiene identidades distintas para: intake, capability/session, AI, completion, report writer, download signer, notification runtime, Tasks caller, telemetry writer, deployer WIF y auditor read-only. Secret access se concede al consumidor concreto, no a una identidad general.

- No se reutiliza default compute.
- No existen llaves permanentes.
- Deployer y auditor están separados.
- Break-glass es un rol temporal, no una service account compartida; exige Security Owner + Incident Commander, expiry y audit.
- Preview y Staging no pueden impersonar identidades Production.

## 11. Secretos

El namespace lógico es `aura-<environment>-<purpose>` y cada versión tiene owner, consumer, fecha de rotación, estado y rollback. Se separan obligatoriamente:

1. capability/public-token HMAC;
2. idempotency secret;
3. IP hash salt;
4. Gemini credential;
5. notification gateway/provider;
6. Storage signing configuration;
7. App Check-related server configuration.

Preview, Staging y Production no comparten secreto, versión ni IAM binding. Los nombres finales se aprueban en R3A/R3B; este documento no crea valores.

## 12. Política de datos

| Ambiente | Import/export | Seed/reset | Retención/cleanup | Backup/recovery | Acceso humano |
|---|---|---|---|---|---|
| Local/Demo | Sólo fixtures | Libre y determinista | Al finalizar | No aplica | Local autorizado |
| Preview | Sintético o anonimizado aprobado; jamás dump Production | Por PR; reset automatizado | Expiry y cleanup al cerrar PR | No contiene datos críticos | Equipo interno mínimo |
| Staging | Sintético representativo; deidentificado sólo con aprobación | Versionado; reset bajo gate | 30 días propuesto | Restore exercise obligatorio | Owners/auditores mínimos |
| Production | Export sólo para backup/recovery autorizado | Seed productivo prohibido | Por clase, TTL/lifecycle aprobados | Backup, PITR/delete protection y restore probados | Excepcional, time-bound y auditado |

Las copias directas de Production a Preview están prohibidas. Un dataset deidentificado requiere método, owner, evidencia de irreversibilidad y aprobación Privacy.

## 13. Gates de cierre R1A

| Gate | Criterio | Estado documental |
|---|---|---|
| R1A-G1 | Modelo C y cuatro ambientes definidos | `DESIGNED` |
| R1A-G2 | IDs Preview/Staging y billing aprobados | `BLOCKED_EXTERNAL` |
| R1A-G3 | `aura-control-center-debb3` aprobado o reclasificado Legacy | `BLOCKED_EXTERNAL` |
| R1A-G4 | Región/residencia aprobadas | `BLOCKED_EXTERNAL` |
| R1A-G5 | Bucket y queue strategy aprobadas | `BLOCKED_EXTERNAL` |
| R1A-G6 | Data policy, owners y approvers registrados por rol | `BLOCKED_EXTERNAL` |
| R1A-G7 | Rollback target y migration strategy aprobados | `BLOCKED_EXTERNAL` |

R1B sólo puede ejecutar cambios de targeting cuando R1A-G2 a R1A-G7 tengan evidencia externa aprobada. El siguiente trabajo permitido mientras tanto es revisión arquitectónica/operativa de estos documentos.

## 14. Condiciones de detención

Detener si se propone compartir Production con Preview/Staging; si un proyecto, alias, branch, actor o billing boundary es ambiguo; si una región contradice residencia; si se requiere PII productiva para certificar; si falta rollback; si una identidad requiere Editor/Owner permanente; o si una aprobación externa se sustituye por una suposición documental.
