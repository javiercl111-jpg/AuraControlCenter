# AI-02H — First Governed Shadow Consumer Audit

## 1. Executive Summary

Esta auditoría mantiene como primer consumidor candidato la **finalización confirmada de una sesión Discovery**. La conexión futura solo podría evaluarse en AI-02H2, en `src/modules/discovery/services/dossierBuilderService.ts`, dentro de `saveDiscoverySession()`, inmediatamente después de obtener `dossierId` y `prospectId` de `completeDiscoverySession` y antes de devolver el resultado original.

La llamada futura deberá delegarse mediante una tarea diferida y observada, con política local `SHADOW_ONLY`, fail-closed y deshabilitada por defecto. El dossier ya guardado es durable; la invocación client-side no lo es: será best-effort, podrá perderse por cierre, navegación o suspensión del browser, no ofrecerá entrega garantizada y no podrá contabilizarse como ejecución Shadow confirmada. El adaptador no devolverá datos al flujo Discovery, no recibirá el token de sesión, nombres ni conversación, no persistirá y no expondrá `PipelineResult`.

**Recomendación: GO WITH CONDITIONS para AI-02H1; NO-GO para AI-02H2.** No debe conectarse Discovery hasta resolver estas condiciones:

1. El Boundary actual valida `payload`, pero no lo entrega a `BoundaryExecutionPort`; solo entrega `sessionId` y metadata sanitizada.
2. `evaluateBoundaryPolicy()` calcula `effectiveTimeoutMs`, pero `GovernedExecutionBoundary` no lo aplica.
3. `maxConcurrentExecutions`, `DUPLICATE_REQUEST` y `CONCURRENCY_LIMIT` están declarados en el Boundary, pero no son aplicados por él.
4. No existe una composición productiva del OS ni un adaptador que transforme el DTO mínimo Discovery en `PipelineAggregatedState`.
5. Ya existe una evaluación Shadow de Discovery en `functions/src/discovery/completeDiscoverySession.ts`; no puede asumirse convivencia segura. Debe decidirse su reutilización, sustitución o exclusión mutua mediante un contrato compartido.
6. `tenantId` debe estar disponible y validado canónicamente en `saveDiscoverySession()`; no puede hardcodearse ni inferirse desde UI, email, dominio o un valor global.
7. Una prueba aislada de AI-02H1 debe demostrar que los cinco hechos normalizados bastan para construir `PipelineAggregatedState` y ejecutar realmente el Orchestrator con sus dependencias y policies.
8. Deben aprobarse y pasar las **40 pruebas** propuestas en la sección 20: 30 en AI-02H1 y 10 en AI-02H2.
9. Debe aceptarse expresamente la posible pérdida de la invocación best-effort en navegador.

Esta fase no implementa código, no cambia el flujo productivo y crea únicamente este documento.

## 2. Canonical Repository State

Verificación ejecutada antes de cualquier escritura:

```text
git fetch origin --prune
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git status --short --untracked-files=all
git log -3 --oneline
```

| Verificación | Resultado |
|---|---|
| Ruta | `C:\Projects\AuraControlCenter-AI-02` |
| Rama | `feature/intelligence-os-first-shadow-consumer` |
| HEAD | `eff6254f70a3c91085b89ce7360fcfc495a1a65d` |
| `origin/main` | `eff6254f70a3c91085b89ce7360fcfc495a1a65d` |
| Estado de esta revisión | Solo `?? docs/architecture/aura-intelligence/AI-02H_FIRST_GOVERNED_SHADOW_CONSUMER_AUDIT.md` |
| Últimos commits | `eff6254`, `2be83d7`, `5aa472e` |
| Resultado de la compuerta | Conforme; se autorizó continuar únicamente con la auditoría |

`git diff --check` no produjo salida antes de la corrección. El documento continúa sin seguimiento; por ello los comandos `git diff` ordinarios no muestran su contenido hasta que se añada al índice. Las líneas citadas corresponden al commit canónico anterior y deben revalidarse si cambia la base.

## 3. Governed Boundary Inventory

### 3.1 Punto de entrada y construcción

| Elemento | Evidencia actual |
|---|---|
| Punto de entrada | `GovernedExecutionBoundary.execute(rawRequest)` en `src/modules/intelligence/os/boundary/GovernedExecutionBoundary.ts:47` |
| Constructor | `new GovernedExecutionBoundary(config)` en líneas 39-45 |
| Requeridos | `clockPort`, `executionPort` |
| Opcionales | `featurePolicyPort`, `shadowComparisonPort`, `auditPort` |
| Fail-closed | La ausencia o fallo de `featurePolicyPort` produce `REJECTED`, modo `DISABLED` |
| Independencia | No hay imports de Discovery, Firebase ni React en el módulo Boundary |

### 3.2 Contratos y puertos

`GovernedExecutionRequest` exige:

- `requestId`
- `correlationId`
- `tenant.tenantId`
- `actor.actorId`
- `actor.actorType`
- `source`
- `requestedMode`
- `payload`

Admite opcionalmente `metadata`, `timeoutMs` y `cancellationSignal`.

`GovernedExecutionResponse` devuelve identificadores, modo, estado, tiempos, un resumen sanitizado, un resumen de comparación opcional, warnings y errores públicos. No devuelve el `PipelineResult` completo.

Puertos actuales:

| Puerto | Responsabilidad | Estado para un consumidor real |
|---|---|---|
| `BoundaryClockPort` | Tiempo ISO del Boundary | Reutilizable con implementación local |
| `FeaturePolicyPort` | Política efectiva por tenant y source | Falta implementación real; debe ser fija, in-memory y disabled por defecto |
| `BoundaryExecutionPort` | Traducir a ejecución interna | Falta adaptador OS; contrato insuficiente para transportar `payload` |
| `ShadowComparisonPort` | Comparación opcional en `EVALUATION` | No usar en la primera integración |
| `BoundaryAuditPort` | Auditoría no bloqueante | No usar remoto; falta sink no-op o in-memory seguro |

### 3.3 Modos

| Modo | Comportamiento observado |
|---|---|
| `DISABLED` | Se rechaza |
| `SHADOW_ONLY` | Si la política autoriza, llama a `executionPort.execute()` y devuelve solo resumen público |
| `EVALUATION` | Ejecuta igual que Shadow y, si existe el puerto, compara `req.payload` contra el resultado interno |
| `PRODUCTIVE` | Siempre se rechaza en `evaluateBoundaryPolicy()` antes de ejecutar |

La primera integración solo podrá construir `requestedMode = "SHADOW_ONLY"`. `EVALUATION` y `PRODUCTIVE` deberán resultar imposibles desde el tipo/factory del consumidor y rechazados de nuevo por política.

### 3.4 Responsabilidades delegadas

El Boundary delega:

- decisión de habilitación a `FeaturePolicyPort`;
- trabajo interno a `BoundaryExecutionPort`;
- comparación opcional a `ShadowComparisonPort`;
- auditoría opcional a `BoundaryAuditPort`;
- timeout y cancelación del pipeline a AI-02D;
- deduplicación, admisión, concurrencia in-memory y observación tardía a la guardia AI-02E, siempre que el futuro execution adapter la componga expresamente.

### 3.5 Ejecución, auditoría, captura y comparación

- La ejecución interna ocurre en `GovernedExecutionBoundary.ts:149`.
- La auditoría solo se intenta después de una ejecución interna completada, en líneas 195-201.
- `tryAuditLog()` usa `void auditPort.logEvent(...)` dentro de `try/catch`; el `catch` protege throws síncronos, pero no observa una futura Promise rechazada.
- `ShadowExecutionGuard` de AI-02E aporta guardia, deduplicación y límites in-memory, además de observación tardía; el timeout/cancelación efectivos del pipeline siguen perteneciendo a AI-02D.
- `ShadowComparator` ya compara estados, cobertura, objetivos, findings, dossier y assessment de forma determinista.
- `InMemoryShadowCaptureAdapter` ya aporta TTL, límites globales/por sesión, eviction y copias defensivas para resultados de comparación.
- El puerto de comparación del Boundary (`compare(legacyResult, shadowResult)`) no coincide con `ShadowComparatorPort.compare(request)`; falta un adaptador y no es necesario para `SHADOW_ONLY`.
- `InMemoryShadowCaptureAdapter` captura `ShadowComparisonResult`, no `GovernedExecutionResponse`; no debe forzarse su uso para el primer consumidor.

Para AI-02H se recomienda capturar, como máximo, un outcome in-memory acotado: `requestId`, `status`, `durationMs` y códigos públicos. Nunca payload, `PipelineResult`, snapshots ni comparación.

### 3.6 Errores públicos

Catálogo actual:

- `BOUNDARY_DISABLED`
- `MODE_NOT_ALLOWED`
- `INVALID_REQUEST`
- `INVALID_TENANT_CONTEXT`
- `INVALID_ACTOR_CONTEXT`
- `SOURCE_NOT_ALLOWED`
- `PAYLOAD_TOO_LARGE`
- `DUPLICATE_REQUEST`
- `CONCURRENCY_LIMIT`
- `TIMEOUT`
- `CANCELLED`
- `EXECUTION_FAILED`
- `OUTPUT_SANITIZATION_FAILED`

`sanitizePublicError()` elimina stack/cause y convierte errores desconocidos en `EXECUTION_FAILED`.

### 3.7 Sanitización

- `metadata` conserva únicamente primitivos de nivel superior.
- Se omiten claves sensibles exactas como `authorization`, `cookie`, `token`, `password`, `secret`, `apikey`, `stack`, `cause`, `prompt`, `reasoning` y `headers`, sin distinguir mayúsculas.
- Strings de metadata se truncan a 1,024 caracteres.
- Objetos/arrays anidados en metadata se omiten.
- El payload se valida contra ciclos, funciones, symbols, profundidad mayor de 20 y claves peligrosas, pero **no se minimiza ni se eliminan secretos por nombre**.
- La minimización del payload es, por tanto, responsabilidad obligatoria del adaptador de consumidor.

### 3.8 Límites conocidos y gaps bloqueantes

| Gap | Evidencia | Impacto |
|---|---|---|
| Payload desconectado | `req.payload` no forma parte de `internalInput` en líneas 144-147 | El OS no puede consumir la evidencia real validada |
| Timeout no aplicado | `effectiveTimeoutMs` se calcula en policy, pero no se usa al ejecutar | `timeoutMs` no garantiza límite |
| Concurrencia Boundary no aplicada | `maxConcurrentExecutions` solo está en el contrato de policy | La policy promete un control que el Boundary no ejecuta |
| Deduplicación Boundary no aplicada | Existen errores públicos, pero no cache/guard en Boundary | Un retry puede ejecutar dos veces salvo composición con `ShadowExecutionGuard` |
| Actor no propagado | Se valida, pero no llega al execution port ni al audit event | Trazabilidad interna incompleta |
| Audit Promise no observada | `void logEvent()` solo captura throw síncrono | Riesgo de unhandled rejection |
| Cancellation parcial | Solo pre-check y passthrough del signal | Depende totalmente de que execution port y etapas honren el signal |
| Sin composition root | No existe uso real del Boundary fuera de tests | Faltan dependencias, políticas y lifecycle |
| Sin mapper de estado | Orchestrator espera estado ya extraído/modelado | El DTO del consumidor no puede ejecutarse de forma significativa |
| Comparator incompatible | Firmas de puertos distintas | Requiere adaptador futuro; fuera de alcance de `SHADOW_ONLY` |
| Dedup Shadow local | Mapas por instancia y limpieza oportunista | No cubre pestañas, workers ni procesos |
| Campos Shadow sin uso | `admissionTimeoutMs`, `failOpen` y `pipelineInput` no gobiernan la implementación actual del guard | No deben asumirse garantías inexistentes |

### 3.9 Piezas reutilizables y piezas faltantes

Reutilizables:

- contratos y validadores del Boundary;
- `evaluateBoundaryPolicy()`;
- sanitización de metadata, errores y resúmenes;
- `AuraIntelligenceOrchestrator`;
- `PipelineExecutionContext`;
- `executeWithGuards()`;
- `ShadowExecutionGuard`;
- generadores deterministas ya existentes en enterprise-model;
- `ShadowComparator` e `InMemoryShadowCaptureAdapter` solo para una fase futura `EVALUATION`.

Faltantes:

- consumidor interno `discovery-completion`;
- mapper DTO Discovery → `PipelineAggregatedState`;
- `BoundaryExecutionPort` que componga Orchestrator + Shadow Guard;
- resolución explícita del contrato para payload, execution key y timeout, sin closures ni metadata;
- policy in-memory fija y disabled por defecto;
- clock, deterministic ID/key factory y scheduler inyectables;
- outcome sink in-memory acotado o no-op;
- composition root de la primera integración;
- prueba de exclusión mutua con el Shadow Discovery ya existente.

## Existing Shadow Execution Conflict

El flujo actual ya contiene una ejecución Shadow del lado servidor en `functions/src/discovery/completeDiscoverySession.ts`. Aparece dentro del mismo cierre que persiste el dossier y ocurre antes de que el callable devuelva `dossierId` y `prospectId` al navegador. El hook cliente propuesto para AI-02H2 ocurriría después de esa respuesta, por lo que ambos caminos podrían evaluar la misma finalización Discovery.

No es seguro asumir que ambos Shadow pueden coexistir:

- el Shadow server y el consumidor browser podrían ejecutar dos veces para el mismo dossier;
- la deduplicación propuesta para AI-02H1 es in-memory y local a un JS realm;
- el browser y el servidor no comparten cache, guard, lifecycle ni estado de admisión;
- una key conceptual igual no crea exclusión por sí sola si no existe un contrato o store compartido;
- cierre, refresh, retry, otra pestaña o reintento del callable pueden producir combinaciones que ninguno de los dos procesos observa completamente.

Por tanto, la exclusión browser/server es imposible con deduplicación exclusivamente local. Antes de AI-02H2 debe aprobarse una decisión formal entre:

1. **reutilizar** el Shadow server existente como único consumidor;
2. **sustituirlo** por el consumidor gobernado, con migración y rollback explícitos; o
3. implantar **exclusión mutua real** mediante un contrato compartido y verificable.

Una confirmación booleana local o de tests no demuestra exclusión en producción. Mientras no exista la decisión y su mecanismo verificable, AI-02H2 permanece NO-GO.

## 4. Consumer Search Method

Se inspeccionó todo `src/` mediante búsquedas visibles sobre:

- Discovery, Executive Intake, sesiones, conversación, assessment, dossier, diagnóstico, recomendaciones, madurez, market intelligence, propuestas, reportes y respuestas;
- operaciones `create`, `exchange`, `submit`, `complete`, `finalize`, `generate`, `buildReport`;
- imports/llamadas de Firebase, Firestore, Functions, Storage, `fetch` y Axios;
- usos concretos de las funciones candidatas;
- pruebas existentes del OS, Boundary, Shadow Guard, Comparator y Capture Adapter.

Comandos representativos ejecutados:

```text
rg -n --glob "*.ts" --glob "*.tsx" "Discovery|ExecutiveIntake|DiscoveryLead|DiscoverySession|ConversationEngine|assessment|dossier|diagnostic|recommendation|maturity|questionnaire|report generation" src

rg -n --glob "*.ts" --glob "*.tsx" "createDiscoveryLead|exchangeDiscoveryToken|submit|complete|finalize|generate|buildReport|generateReport|createAssessment|createDossier" src

rg -n --glob "*.ts" --glob "*.tsx" "firebase|firestore|addDoc|setDoc|updateDoc|writeBatch|runTransaction|httpsCallable|fetch\(|axios" src/modules src/services src/pages
```

También se leyó pasivamente el Shadow Discovery ya existente en `functions/` porque comparte exactamente el evento recomendado y afecta la deduplicación arquitectónica. No se modificó Functions.

## 5. Candidate Inventory

### C1 — Finalización confirmada de Discovery

| Campo | Evaluación |
|---|---|
| Archivo / función | `src/modules/discovery/services/dossierBuilderService.ts`; `saveDiscoverySession()` |
| Entrada actual | link ID, nombres, dossier parcial, conversación, snapshot y session token |
| Salida actual | `{ sessionId: dossierId, prospectId }` |
| Momento | Después de construir el dossier y llamar `completeDiscoverySession` |
| Dependencias | Firebase Functions; builder local |
| Efectos actuales | El callable realiza persistencia, lead attachment, evento, notificación y Shadow server existente |
| Firebase | Sí, a través de callable; el adaptador propuesto no podrá importarlo |
| UI | El caller continúa con PDF y estado de pantalla |
| Frecuencia / volumen | Una vez por finalización, con posibles retries; payload actual alto, payload propuesto menor a 2 KiB |
| Estabilidad | Evento de negocio estable y explícito |
| Acoplamiento | Medio; un único servicio concentra el cierre |
| Riesgo de latencia | Bajo si se difiere sin await; alto si se conecta al callable o se espera |
| Datos suficientes | No demostrado: cinco hechos son la propuesta mínima de privacidad; AI-02H1 debe probar que bastan para el OS |
| Request | Fácil salvo el gap de tenant y la desconexión de payload en Boundary |
| No bloqueo | Viable con `SchedulerPort` in-memory observado |
| Deduplicación | Excelente mediante dossier ID + evento + payload version |
| Rollback | Quitar una llamada/import en el servicio |
| Riesgo de cambio | Medio; está junto a un cierre crítico, token, PDF y Shadow previo |
| Cobertura existente | Buena en OS/Boundary/Shadow y en Functions; no hay test unitario del servicio cliente |

### C2 — Dataset Market Intelligence cargado en cache

| Campo | Evaluación |
|---|---|
| Archivo / función | `src/modules/market-intelligence/services/datasetManager.ts`; `setDataset()` |
| Entrada / salida | estado + compañías; devuelve cache entry con metadata agregada |
| Momento | Después de un fetch/import exitoso, antes de usar el cache |
| Dependencias | `generateMetadata()`, `generateAuraSalesAdvice()` |
| Efectos actuales | Escritura exclusivamente in-memory dentro de este servicio |
| Firebase / UI | No dentro del servicio; callers obtienen datos de Firebase y actualizan UI |
| Frecuencia / volumen | Por carga/refresh de estado; arrays potencialmente grandes |
| Estabilidad / acoplamiento | Estable y bajo acoplamiento, pero pertenece a Market Intelligence |
| Latencia | No debe añadirse trabajo síncrono al loop de compañías |
| Datos suficientes | Buenos agregados, menor evidencia empresarial que Discovery |
| Request / dedup | Metadata minimizada fácil; key por estado, source version y fingerprint |
| Rollback | Simple |
| Riesgo | Bajo-medio; falta tenant/actor y no hay pruebas directas |

### C3 — Generación de reporte ejecutivo

| Campo | Evaluación |
|---|---|
| Archivo / función | `src/services/executiveReportService.ts`; `buildExecutiveReport()` |
| Entrada / salida | tipo de reporte; reporte agregado |
| Momento | Petición manual desde `ReportsPage` |
| Dependencias | Seis servicios de lectura Firestore |
| Efectos actuales | Lecturas paralelas; no escritura en este servicio |
| Firebase / UI | Firebase read; UI espera el reporte y permite imprimir |
| Frecuencia / volumen | Baja; una petición por click |
| Estabilidad / acoplamiento | Flujo simple, pero mezcla dominios globales |
| Latencia | Shadow diferido es viable |
| Datos suficientes | Agregados comerciales/financieros, sin evidencia diagnóstica |
| Request / dedup | Difícil: no recibe tenant, actor ni data revision estable |
| Rollback | Simple |
| Riesgo | Bajo, pero valor arquitectónico moderado y cero tests directos |

### C4 — Sales Advice para compañía seleccionada

| Campo | Evaluación |
|---|---|
| Archivo / función | `src/modules/intelligence/core/services/appAdapter.ts`; `AppAdapter.getSalesAdvice()` |
| Entrada / salida | compañía DENUE; `AuraSalesAdvice` |
| Momento | Cambio de compañía en `AuraSalesAdvisorPanel` |
| Dependencias | LLM provider, memory, context, commercial/assessment/proposal brains |
| Efectos actuales | Añade eventos demo in-memory y realiza evaluación LLM |
| Firebase / UI | Gateway LLM puede usar Functions; la UI depende del resultado o fallback |
| Frecuencia / volumen | Por selección/cambio de compañía |
| Estabilidad / acoplamiento | Alto acoplamiento a Aura Core y Market Intelligence |
| Latencia | Sensible; el flujo ya espera inteligencia |
| Datos suficientes | Buenos, pero incluyen PII y datos comerciales innecesarios |
| Request / dedup | Posible con company ID, pero falta revision y tenant/actor |
| Rollback | Moderado |
| Riesgo | Medio-alto; sin tests directos |

### C5 — Reporte Commercial Advisor calculado durante render

| Campo | Evaluación |
|---|---|
| Archivo / función | `src/modules/market-intelligence/services/commercialAdvisorService.ts`; `generateAdvisorReport()` |
| Entrada / salida | array de compañías + estado; reporte comercial |
| Momento | Render de `CommercialDashboard` |
| Dependencias | Cálculo local puro |
| Efectos actuales | Ninguno dentro del cálculo |
| Firebase / UI | Sin Firebase directo; resultado visible en UI |
| Frecuencia / volumen | Cada render; potencialmente alta y con arrays grandes |
| Estabilidad / acoplamiento | Lógica estable, punto de invocación inestable |
| Latencia | No se puede disparar async desde render de forma segura |
| Datos suficientes | Buenos agregados, pero la entrada incluye PII |
| Request / dedup | Requiere fingerprint costoso y lifecycle React |
| Rollback | Simple si se moviera a un effect, pero eso ampliaría el cambio |
| Riesgo | Alto para primer consumidor; sin tests directos |

## 6. Candidate Scorecard

Escala 1-5. Para P12, 5 significa riesgo de regresión bajo.

| ID | Criterio |
|---|---|
| P1 | Aislamiento |
| P2 | Ausencia de efectos secundarios adicionales |
| P3 | Contexto empresarial |
| P4 | Facilidad de request |
| P5 | Facilidad `SHADOW_ONLY` |
| P6 | No bloqueo |
| P7 | Determinismo |
| P8 | Deduplicación |
| P9 | Observabilidad |
| P10 | Reversibilidad |
| P11 | Cobertura existente |
| P12 | Bajo riesgo de regresión |
| P13 | Valor arquitectónico |
| P14 | Valor comercial futuro |

| Candidato | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10 | P11 | P12 | P13 | P14 | Total / 70 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| C1 Discovery completado | 4 | 3 | 5 | 3 | 5 | 4 | 4 | 5 | 3 | 5 | 3 | 3 | 5 | 5 | **57** |
| C2 Dataset cacheado | 4 | 4 | 4 | 4 | 5 | 5 | 3 | 4 | 3 | 5 | 1 | 4 | 4 | 4 | **54** |
| C3 Reporte ejecutivo | 4 | 4 | 3 | 3 | 5 | 5 | 2 | 2 | 3 | 5 | 1 | 4 | 3 | 3 | **47** |
| C4 Sales Advice | 3 | 2 | 4 | 4 | 4 | 3 | 3 | 3 | 2 | 4 | 1 | 3 | 4 | 5 | **45** |
| C5 Commercial Advisor en render | 2 | 5 | 4 | 3 | 3 | 1 | 4 | 2 | 1 | 4 | 1 | 1 | 3 | 4 | **38** |

No hay empate. C1 gana por contexto real, dossier durable ya guardado, identidad determinista del evento, valor de prueba end-to-end y rollback de un único punto. La invocación browser posterior sigue siendo best-effort y no es durable. C2 es un runner-up válido y más aislado, pero prueba un agregado de mercado, no el recorrido diagnóstico del OS, carece de cobertura y exigiría intervenir Market Intelligence.

Incertidumbres que reducen la puntuación de C1:

- tenant real no disponible en el resultado cliente;
- Boundary no propaga payload;
- Shadow Discovery previo en Functions;
- lifetime de una tarea browser in-memory;
- suficiencia no demostrada de los cinco hechos normalizados;
- ausencia de tests del servicio cliente.

## 7. Rejected Candidates

| Flujo descartado | Motivo |
|---|---|
| `DiscoverPage.processTurn()` | Cada mensaje; sensible a latencia; muta conversación, confianza, dossier y UI; contiene texto libre y razonamiento |
| `ConversationOrchestrator.processTurn()` | Condiciona directamente respuesta, avance y completion; frecuencia alta |
| `DiscoverPage.handleComplete()` | Mezcla React, session storage, token, PDF, navegación/estado de UI y retries |
| `createDiscoveryLink()` / `createDiscoveryLead` | Crea leads, maneja PII y tokens; no es un evento diagnóstico |
| `exchangeDiscoveryToken()` / `resolveDiscoverySession()` | Auth-like session material; tokens expresamente prohibidos |
| `generateDiscoveryReport()` / `requestExecutiveDocument()` | Genera PDF, usa Storage/Firestore/Functions y afecta UX |
| `completeDiscoverySession` en Functions | Ya persiste, actualiza leads, emite eventos/notificaciones y ejecuta otra sombra; Functions está fuera de cambio |
| `AppAdapter.generateDashboard()` | Se dispara desde un effect con arrays grandes; LLM, memoria demo y resultado visible |
| imports Market Intelligence | Alta frecuencia, Storage/Firestore, volumen grande y PII de contacto |
| pagos, quotes, comisiones, provisioning | Efectos financieros, transacciones y estados irreversibles |
| render de componentes React | React no es un lugar válido para una invocación async con efectos |

## 8. Recommended Consumer

**Consumidor:** evento de dominio “Discovery session completion confirmed”.

**Por qué este y no el runner-up:**

- representa una finalización lógica por dossier, aunque retries y procesos independientes pueden invocarla más de una vez;
- dispone de evidencia empresarial ya estructurada;
- el dossier ya guardado y su `dossierId` durable permiten construir una key determinista;
- puede conectarse después de la transacción, no durante conversación;
- el resultado productivo ya está calculado;
- la futura llamada se elimina con una sola línea/import;
- valida el camino más valioso del OS sin usar nombres, contacto ni mensajes;
- no requiere tocar página, hook ni componente React.

La integración no significa que Discovery consuma el resultado: Discovery únicamente intentaría emitir una señal in-memory no bloqueante hacia el Boundary y continuaría ignorando por completo el outcome. Ese intento no confirma admisión ni ejecución y puede perderse.

## 9. Recommended Integration Point

| Elemento | Recomendación |
|---|---|
| Archivo | `src/modules/discovery/services/dossierBuilderService.ts` |
| Función | `saveDiscoverySession()` |
| Bloque exacto | Después de `const { dossierId, prospectId } = result.data;` y antes de `return { sessionId: dossierId, prospectId };` (líneas actuales 157-158) |
| Evento | `discovery.session.completed.v1` |
| Datos antes del punto | dossier mínimo, payload legacy completo, IDs de link, token y resultado del callable |
| Efectos antes | Dossier construido; transacción server completada; lead/event/notification y Shadow server existente procesados |
| Efectos después | Retorno al caller; solicitud productiva de PDF; cambios de UI |
| Invocación | `schedule()` síncrono, non-throwing y best-effort, que difiere el trabajo a una tarea in-memory |
| Errores | Convertidos a outcome seguro in-memory; nunca rethrow |
| Timeout | 2,000 ms máximo validado por Boundary; AI-02D aplica timeout/cancelación del pipeline |
| Cancelación | Signal exclusivo del Shadow; nunca reutiliza el del flujo productivo |
| Dedup | Key por `tenantId` canónico + dossier ID + evento + payload version |
| Disabled | Scheduler puede aceptar el evento, Boundary responde `REJECTED/DISABLED`, no se ejecuta OS |
| Falla | Se captura código seguro y se descarta; el return original no cambia |
| Tarda | El caller continúa; AI-02D limita el pipeline y AI-02E observa la finalización tardía |
| Productivo termina antes | La tarea puede continuar solo mientras viva el mismo JS realm; cierre, navegación o suspensión pueden perderla sin retry ni persistencia |

El adaptador no recibirá `sessionToken`, `conversationHistory`, `conversationStateSnapshot`, `companyName`, `contactName` ni el payload legacy completo.

El éxito de `schedule()` solo significa que el intento fue aceptado localmente por el scheduler. No constituye acuse durable, entrega garantizada, admisión del Boundary, inicio del pipeline ni ejecución Shadow confirmada.

## 10. Current Flow Before Integration

1. `DiscoverPage.handleComplete()` obtiene el session token.
2. Llama a `saveDiscoverySession()` con identidad, dossier, conversación, snapshot y token.
3. `buildDossierPayload()` crea drafts, assessment y contexto comercial.
4. `completeDiscoverySession` ejecuta transacción Firestore, mutaciones de lead/evento y notificación.
5. El backend ejecuta su integración Shadow Discovery actual y puede persistir el outcome.
6. El cliente recibe `{ dossierId, prospectId }`.
7. `saveDiscoverySession()` devuelve `{ sessionId, prospectId }`.
8. `DiscoverPage` solicita generación de PDF.
9. La UI cambia a READY/completed.

AI-02H no cambia ninguno de esos pasos.

## 11. Proposed Shadow Flow

1. El callable devuelve éxito y se desestructuran los mismos IDs.
2. AI-02H2 verifica que `tenantId` canónico y validado está disponible en `saveDiscoverySession()`; si no lo está, se detiene sin programar.
3. Se crea un DTO nuevo desde cinco campos ya disponibles, `tenantId` y los IDs; no se reutiliza el payload legacy.
4. El consumidor registra una tarea in-memory best-effort y retorna `void` sin lanzar.
5. `saveDiscoverySession()` devuelve inmediatamente el mismo objeto.
6. En la tarea diferida, el adaptador valida mínimos, normaliza enums y construye la key.
7. La policy local, disabled por defecto, autoriza como máximo `SHADOW_ONLY` para el source exacto.
8. El Boundary valida, gobierna y delega al execution adapter.
9. El execution adapter compone la guardia AI-02E, el mapper de estado y el Orchestrator; AI-02D gobierna timeout/cancelación del pipeline.
10. El outcome se reduce a status/códigos seguros y se conserva en memoria con TTL o se descarta.
11. Ningún dato vuelve a Discovery, PDF, UI, conversación, lead ni persistencia.

La futura implementación debe demostrar que la tarea se registra sin ejecutar trabajo pesado antes del return productivo. El registro local no es prueba de que la tarea se ejecute.

## 12. Consumer Adapter Contract

**Nombre recomendado:** consumidor interno `discovery-completion`.

La implementación futura queda encapsulada bajo `src/modules/intelligence/os/consumers/discovery-completion/`; AI-02H1 no crea imports desde Discovery.

### Input conceptual

| Campo | Tipo conceptual | Origen |
|---|---|---|
| `dossierId` | opaque string | respuesta confirmada del callable |
| `tenantId` | opaque string validada | contexto canónico ya disponible en `saveDiscoverySession()` |
| `industryCategory` | enum/string normalizada | `dossierState.industry` |
| `employeeBand` | enum | derivado de `employees` |
| `schedulingMode` | enum | derivado de `schedulingMethod` |
| `payrollIncidentSignal` | boolean | `payrollIncidents` |
| `priorityCategory` | enum | derivado de `priority` |
| `payloadVersion` | literal `1` | adapter |
| `cancellationController` | dependencia interna | adapter; no caller productivo |

### Output

`schedule()` retorna `void`. El consumidor no recibe Promise, resultado, comparación ni error.

### Dependencias inyectadas

- `GovernedExecutionBoundary`;
- deterministic key builder;
- task scheduler;
- dedicated abort/timeout controller factory;
- bounded outcome sink o no-op;
- clock;
- policy/composition factory.

No depende de Firebase, React, Router, Storage, Auth, App Check, session storage, environment variables ni Vercel.

### Side effects permitidos

- una tarea in-memory;
- un timer acotado;
- dedup/cache in-memory;
- outcome mínimo in-memory con TTL.

Todos los demás side effects están prohibidos.

### Errores

- input incompleto: no invoca Boundary, registra solo un código seguro in-memory;
- policy disabled: descarta la respuesta `REJECTED`;
- error sync al programar: absorbido;
- error async: observado y absorbido;
- timeout/cancelación: outcome seguro, sin rethrow;
- fallo del sink: absorbido sin `console`.

### Ownership y lifecycle

- Owner: `src/modules/intelligence/os/consumers/discovery-completion/`.
- Instancia única por JS realm para conservar dedup y límites.
- No se crea una instancia por evento.
- La pérdida de memoria por refresh, cambio de pestaña o fin de proceso es aceptada explícitamente.

### Prueba de no interferencia

Un test de caracterización fijará el return y las llamadas productivas de `saveDiscoverySession()` antes de añadir la única llamada Shadow. El mismo test, con policy disabled, success, failure y timeout, debe producir exactamente el mismo return y las mismas llamadas a Firebase Functions.

## 13. Minimal Governed Request

### 13.1 Campos del request

| Campo | Fuente / valor propuesto | Obligatorio | Sanitización / límite | Sensibilidad | Persistir | Registrar | Rechazo |
|---|---|---:|---|---|---|---|---|
| `requestId` | key determinista de sección 16 | Sí | charset seguro; 180 chars máximo | ID interno | No; solo dedup in-memory | Solo digest/key in-memory | vacío, largo o formato inválido |
| `correlationId` | `discovery:<dossierId>` | Sí | trim; 180 chars | ID interno | No | In-memory | dossier ID inválido |
| `tenant` | `{ tenantId: <tenantId> }` | Sí | valor canónico validado; trim, charset y longitud | Contexto de aislamiento | No | Solo digest/key in-memory | ausente, inferido o inválido |
| `actor` | `{ actorId: "discovery-completion-service", actorType: "SYSTEM" }` | Sí | literales exactos; sin roles | Baja | No | Sí, in-memory | cualquier override |
| `source` | `discovery.session.completed.v1` | Sí | literal exacto | Baja | No | Sí, in-memory | source distinto |
| `requestedMode` | `SHADOW_ONLY` | Sí | literal no configurable por input | Baja | No | Sí, in-memory | cualquier otro modo |
| `payload` | DTO de 5 hechos normalizados | Sí | plain object; menor a 2 KiB; allowlist | Media | Nunca | Nunca completo | campo extra, texto libre o tamaño excedido |
| `metadata` | version/source/scenario/locale seguros | No | máximo 6 claves, primitivos, strings ≤ 200 | Baja | No | Allowlist in-memory | clave desconocida/sensible |
| `timeoutMs` | `2000` | Sí para este adapter | literal o límite policy ≤ 2,000 | Baja | No | Sí, in-memory | ≤0 o >2,000 |
| `cancellationSignal` | `AbortController` exclusivo de Shadow | Sí internamente | nunca serializar | Baja | Nunca | Nunca | signal productivo compartido |

### 13.2 Payload mínimo

| Campo | Valor permitido | Tratamiento |
|---|---|---|
| `schemaVersion` | `"1"` | Literal |
| `eventType` | `"DISCOVERY_SESSION_COMPLETED"` | Literal |
| `industryCategory` | taxonomía normalizada | No nombre de empresa |
| `employeeBand` | `UNKNOWN`, `1_9`, `10_50`, `51_250`, `251_PLUS` | Nunca exact count si no es necesario |
| `schedulingMode` | enum normalizada | No texto libre |
| `payrollIncidentSignal` | boolean | Sin narrativa |
| `priorityCategory` | enum normalizada | No texto libre |

El `dossierId` vive en IDs de control, no se duplica dentro del payload. `prospectId` y `linkId` no son necesarios.

Los cinco hechos normalizados son una **propuesta mínima de privacidad**, no evidencia de suficiencia funcional. Antes de conectar Discovery, AI-02H1 debe incluir una prueba aislada que demuestre conjuntamente:

1. construcción válida de `PipelineAggregatedState`;
2. disponibilidad de todas las dependencies y policies requeridas;
3. ejecución real del `AuraIntelligenceOrchestrator`;
4. producción de un resultado Shadow válido; y
5. ausencia de datos adicionales requeridos para completar esa ejecución.

Si la prueba falla, no se autoriza leer más datos directamente desde Discovery. La ampliación del contrato, del estado o de sus fuentes exige una decisión arquitectónica explícita, revisión de privacidad y nueva aprobación de alcance.

### 13.3 Metadata mínima

- `sourceId = "discovery.session.completed.v1"`
- `scenario = "FIRST_GOVERNED_SHADOW"`
- `tenantId = <tenantId>` obtenido del mismo contexto canónico validado
- `appVersion = "ai-02h-request-v1"`
- `locale = "es-MX"` solo si se añade a la allowlist segura

`tenantId` no puede inferirse desde UI, email, dominio, hostname, storage, environment o valor global. Si `saveDiscoverySession()` no dispone de ese contexto canónico sin ampliar indebidamente su contrato, AI-02H2 permanece NO-GO.

## 14. Feature Policy Design

Se recomienda una policy fija e in-memory creada por factory explícita. Producción y tests son configuraciones distintas:

### Default production configuration

| Campo | Valor |
|---|---|
| `enabled` | `false` |
| `killSwitch` | `true` |
| `allowedModes` | `["SHADOW_ONLY"]` |
| `allowedSources` | `["discovery.session.completed.v1"]` |
| `maxPayloadBytes` | `2048` |
| `maxTimeoutMs` | `2000` |
| `maxConcurrentExecutions` | `1` |
| `shadowOnlyEnforced` | `true` |
| Ejecución | Ninguna; toda solicitud se rechaza antes del execution adapter |

### Test configuration

| Campo | Valor |
|---|---|
| `enabled` | `true` |
| `killSwitch` | `false` |
| `allowedModes` | `["SHADOW_ONLY"]` |
| `allowedSources` | Solo `["discovery.session.completed.v1"]` |
| Uso | Exclusivamente pruebas automatizadas de AI-02H1/AI-02H2 |

El build productivo no debe tener un camino dinámico para seleccionar la configuración de test. `PRODUCTIVE` se rechaza siempre por tipos/factory, policy y Boundary; no existe override. `EVALUATION` queda fuera de alcance.

No se usarán:

- Firebase;
- Remote Config;
- Functions params;
- environment variables;
- Vercel config;
- flags productivos existentes;
- `EVALUATION`.

La configuración de producción permanece cerrada independientemente del estado del Shadow server. Para AI-02H2 no basta una confirmación local: se necesita la decisión formal descrita en “Existing Shadow Execution Conflict”.

## 15. Non-Blocking Execution Strategy

Técnica concreta: **tarea in-memory observada mediante `SchedulerPort` inyectable**.

Contrato conceptual:

```ts
interface SchedulerPort {
  schedule(task: () => Promise<void>): void;
}
```

1. El consumidor productivo invoca el scheduler sin `await`.
2. El scheduler difiere construcción e inicio; el trabajo pesado no ocurre antes del return.
3. Cada Promise creada queda observada con handlers de success, rejection y cleanup.
4. La implementación de pruebas registra la Promise observada para poder esperarla y comprobarla determinísticamente.
5. El rejection handler produce como máximo un outcome seguro in-memory, nunca hace rethrow y nunca usa `console`.
6. El cleanup tampoco puede lanzar; fallos del sink se absorben mediante un observer defensivo.
7. No se permiten Promises permanentemente pendientes.
8. Late completion y late rejection quedan observados y no cambian el flujo Discovery.

`SchedulerPort.schedule()` expresa aceptación local del intento, no garantía de ejecución. La aplicación puede cerrarse, navegar o suspender el realm antes del inicio o la terminación.

Prohibido:

- `await boundary.execute(...)` en el flujo Discovery;
- Promise sin observer;
- `new Promise(() => {})`;
- catch vacío;
- `console`;
- rethrow;
- usar el outcome en un `if`, return, UI, PDF o persistencia;
- compartir cancellation signal con la llamada productiva;
- trabajo de mapping pesado antes de diferir;
- cola durable/remota.

### Responsabilidades de resiliencia

| Componente | Responsabilidad real |
|---|---|
| Boundary | Valida el timeout máximo permitido por policy; no vuelve durable la llamada |
| `executionAdapter.ts` | Conecta el `BoundaryExecutionPort` con mapper, guardia y Orchestrator |
| AI-02D | Aplica timeout y cancelación del pipeline |
| AI-02E | Aplica la guardia in-memory y observa resultados tardíos |
| `deduplication.ts` | Deduplicación local y acotada; no distribuida |
| Scheduler | Observa la Promise y absorbe errores sin interferir con Discovery |

Browser y server no comparten estado. Ninguna combinación de Boundary, AI-02D, AI-02E, scheduler, timeout, cancelación, deduplicación o late-result handling convierte la invocación client-side en durable ni garantiza su entrega.

## 16. Deduplication Strategy

### Fórmula

```text
aura-os-shadow|v1|<tenantId>|<dossierId>|discovery.session.completed.v1|payload-v1
```

La string canónica será el `executionKey` y podrá actuar como `requestId` si cumple el límite. No usa tiempo ni aleatoriedad.

### Reglas

| Aspecto | Diseño |
|---|---|
| Ámbito | Instancia única del adapter/guard por JS realm |
| TTL | 10 minutos |
| Retry dentro del TTL | Rechazado como duplicado, incluso si el primer outcome fue failure/timeout |
| Retry después del TTL | Elegible; misma key, nueva admisión |
| Mismo evento | Misma key |
| Otro tenant | Key distinta |
| Otra sesión | Key distinta |
| Nueva versión de payload | Key distinta y revisión explícita |
| Pestañas | No deduplica entre pestañas |
| Procesos/workers | No deduplica entre procesos |
| Refresh | Se pierde cache y puede reejecutar |
| Límite | Cache acotado; eviction determinista |

No se usarán `Date.now`, `Math.random` ni `randomUUID` para la key. El clock inyectado puede usarse exclusivamente para TTL, no para identidad.

La limitación cross-tab/process es aceptable solo mientras la policy permanezca disabled por defecto y la ejecución sea descartable. Tampoco cubre servidor/browser. No debe presentarse como exactly-once, entrega garantizada ni ejecución confirmada.

## 17. Data Minimization and Privacy

| Clase | Datos | Tratamiento |
|---|---|---|
| Permitidos | industry category, employee band, scheduling enum, payroll incident boolean, priority enum, schema/event versions | En payload; no persistir ni log completo |
| Permitidos con sanitización | dossier ID como correlation/dedup, locale, tenant/source literals | Trim, length, charset y allowlist |
| Prohibidos | nombres, email, teléfono, role, ubicación precisa, session/one-time tokens, cookies, headers, claims, prompts, razonamiento, mensajes, snapshots, IP, user agent | No deben entrar al adapter |
| Prohibidos | objetos/referencias Firebase, React refs/state, funciones, instancias de clase, AbortController serializado | Rechazo o exclusión |
| Innecesarios | company name, contact name, prospect ID, link ID, conversation history, full dossier drafts, sales opening line, PDF/report ID, attachments/files | No copiar |

### Clasificación específica

- **Empresa:** el nombre es prohibido; industria normalizada es permitida.
- **Respuestas:** solo cinco hechos normalizados; respuestas libres prohibidas.
- **Mensajes completos:** prohibidos.
- **IDs:** solo dossier ID para control in-memory; lead/link IDs innecesarios.
- **Metadata:** literals allowlisted.
- **Tokens:** prohibición absoluta.
- **Archivos/adjuntos:** prohibición absoluta.

El sanitizer del Boundary no sustituye esta allowlist, porque el payload no elimina secretos por nombre.

## 18. Side-Effect Prohibition Matrix

| Efecto | Estado requerido |
|---|---|
| Firestore write | 0 |
| Firestore read nuevo | 0 |
| Storage | 0 |
| Functions/callable nuevo | 0 |
| Email/notificación | 0 |
| PDF | 0 |
| Lead mutation | 0 |
| Conversation mutation | 0 |
| Session mutation | 0 |
| Auth/App Check | 0 |
| Navigation | 0 |
| UI state/render | 0 |
| Productive response change | 0 |
| Remote telemetry/logging | 0 |
| Productive feature flag | 0 |
| Environment/config change | 0 |
| Durable queue | 0 |

Los efectos actuales de `completeDiscoverySession` y PDF permanecen preexistentes y deben ser idénticos en los tests de regresión. El nuevo adapter no puede importar ni invocar esas dependencias.

## 19. Threat Model

| Amenaza | Control requerido | Riesgo residual |
|---|---|---|
| Escalación a `PRODUCTIVE` | literal `SHADOW_ONLY` + policy allowlist + rechazo Boundary | Bajo |
| Habilitación accidental | policy disabled + kill switch + factory fail-closed | Bajo |
| Source spoofing | source literal exacto | Bajo |
| Fuga de token/PII | DTO nuevo, allowlist y static import/data tests | Bajo |
| Payload legacy reutilizado | prohibición y exact-shape assertion | Bajo |
| Doble ejecución por retry | deterministic key + Shadow Guard TTL | Medio |
| Doble ejecución con Shadow server | decisión formal y contrato compartido de reutilización, sustitución o exclusión | Alto hasta resolver |
| Cross-tab/process duplicate | limitación documentada; no claim exactly-once | Medio |
| Promise rechazada | observers no vacíos + unhandled rejection test | Bajo |
| Timeout no efectivo | hardening Boundary + Shadow Guard obligatorio | Alto hasta resolver |
| Late result muta estado | outcome aislado y late-result observer | Bajo |
| Cancelación productiva afecta Shadow | dedicated signal | Bajo |
| Shadow afecta return | scheduler observado y no await | Bajo |
| Captura crece sin límite | max records + TTL + deterministic eviction | Bajo |
| Persistencia accidental | no imports Firebase/Storage/Functions y static tests | Bajo |
| Resultado expuesto a UI | output `void`; no public getter productivo | Bajo |
| Payload no llega al OS | cambio explícito del puerto y forwarding test | Alto hasta resolver |
| Audit async rejection | observer explícito o audit no-op | Medio hasta resolver |
| Mapper inventa hechos | mapping exacto, enums y traceability tests | Medio |
| Browser termina | pérdida aceptada, sin retry/persistencia | Medio |

## 20. Test Strategy

Se mantienen **exactamente 40 pruebas obligatorias**, separadas por fase.

### AI-02H1 — 30 pruebas sin Discovery

1. H1-01: default production configuration devuelve `REJECTED/DISABLED` y no invoca el execution adapter.
2. H1-02: test configuration solo habilita `SHADOW_ONLY` para `discovery.session.completed.v1`.
3. H1-03: `PRODUCTIVE` es imposible en la factory y siempre rechazado por policy/Boundary.
4. H1-04: `EVALUATION` queda rechazado.
5. H1-05: cualquier source no allowlisted queda rechazado.
6. H1-06: el mapper acepta exactamente los cinco hechos normalizados y las versiones literales.
7. H1-07: el mapper rechaza campos extra, texto libre, tokens, PII y payload sobredimensionado.
8. H1-08: dossier o `tenantId` ausente/inválido impide construir el request.
9. H1-09: el payload mínimo construye un `PipelineAggregatedState` válido sin importar Discovery.
10. H1-10: todas las dependencies y policies requeridas por el pipeline están disponibles en el composition root.
11. H1-11: el Orchestrator se ejecuta realmente con el estado mínimo y produce un resultado Shadow válido.
12. H1-12: la prueba de suficiencia falla si el pipeline requiere cualquier dato adicional no declarado.
13. H1-13: el execution adapter recibe el payload validado por una vía explícita y defensiva, sin closure oculta ni metadata.
14. H1-14: el Boundary rechaza un timeout que supera el máximo de policy.
15. H1-15: AI-02D aplica el timeout efectivo del pipeline.
16. H1-16: AI-02D propaga y observa la cancelación del pipeline.
17. H1-17: AI-02E admite el callback una sola vez y aplica el límite in-memory configurado.
18. H1-18: una late completion queda observada y no actualiza ningún consumidor.
19. H1-19: una late rejection no produce `unhandledRejection`.
20. H1-20: toda Promise creada por `SchedulerPort` queda observada y registrada por el scheduler de prueba.
21. H1-21: rechazo síncrono o async del task se absorbe sin rethrow.
22. H1-22: el scheduler no crea Promises permanentemente pendientes y sus tests terminan determinísticamente.
23. H1-23: scheduler, handlers y sink no usan `console`.
24. H1-24: dos solicitudes con la misma key ejecutan una sola vez dentro del TTL local.
25. H1-25: TTL, límite y eviction de deduplicación son deterministas.
26. H1-26: cambiar `tenantId`, `dossierId` o versión cambia la key canónica.
27. H1-27: dos instancias no comparten deduplicación, documentando el límite cross-realm/process/server.
28. H1-28: composition, adapter y scheduler no importan Discovery, Firebase, Storage, Functions, React, Router ni persistencia.
29. H1-29: `PipelineResult`, comparación y payload completo no se exponen; solo existe outcome seguro in-memory o descarte.
30. H1-30: el composition root usa default production configuration apagada y no ofrece camino `PRODUCTIVE`.

AI-02H1 debe pasar sus 30 pruebas sin modificar ni importar `src/modules/discovery`.

### AI-02H2 — 10 pruebas de no interferencia del flujo real

1. H2-01: `saveDiscoverySession()` recibe y valida un `tenantId` canónico antes de programar.
2. H2-02: sin `tenantId` canónico no se programa nada y la integración permanece NO-GO.
3. H2-03: el hook no infiere tenant desde UI, email, dominio, hostname, storage ni global.
4. H2-04: con policy disabled, `saveDiscoverySession()` conserva exactamente el mismo return.
5. H2-05: success, rejection, timeout, cancelación y late completion Shadow conservan el mismo return.
6. H2-06: las llamadas y side effects productivos preexistentes son exactamente los mismos en todos los casos.
7. H2-07: la invocación es best-effort, no awaited, y su registro no se contabiliza como ejecución confirmada.
8. H2-08: el DTO entrega solo `tenantId`, `dossierId` y los cinco hechos permitidos; excluye tokens, nombres, mensajes y payload legacy.
9. H2-09: existe como máximo un punto productivo en `saveDiscoverySession()` y quitar un import/llamada restaura el flujo.
10. H2-10: la configuración permanece apagada y un test de arquitectura exige la decisión aprobada de reutilización, sustitución o exclusión mutua del Shadow server.

AI-02H2 solo puede ejecutar sus 10 pruebas después de aprobar AI-02H1 y las cinco condiciones bloqueantes de la sección 26. Además deberán quedar verdes las suites OS/enterprise-model, el test de caracterización Discovery, TypeScript y el build, sin deploy desde esta fase.

## 21. Proposed File Changes

Lista mínima para fases futuras; **ningún archivo de código se modifica ahora**.

### AI-02H1 — Shadow Consumer Composition Foundation

Directorio único: `src/modules/intelligence/os/consumers/discovery-completion/`.

Alcance: composition root interno, adapter de `BoundaryExecutionPort`, policy fija/in-memory, scheduler inyectable y observado, deduplicación in-memory, payload mapper puro, pruebas de ejecución/no side effects y `PRODUCTIVE` imposible. No existe modificación ni import de Discovery.

| Ruta exacta | Responsabilidad |
|---|---|
| `types.ts` | DTOs internos, literales `SHADOW_ONLY` y contratos sin dependencia Discovery |
| `policy.ts` | Default production configuration y test configuration fijas/in-memory |
| `payloadMapper.ts` | Mapper puro y prueba de suficiencia hacia `PipelineAggregatedState` |
| `executionAdapter.ts` | Implementación de `BoundaryExecutionPort` que conecta guardia y Orchestrator |
| `scheduler.ts` | `SchedulerPort`, implementación observada e instrumentos deterministas de test |
| `deduplication.ts` | Key canónica, TTL, límite y eviction in-memory |
| `composition.ts` | Composition root interno con dependencies/policies AI-02D/AI-02E |
| `index.ts` | Barrel interno mínimo; no export productivo hacia Discovery |
| `tests/` | Las 30 pruebas AI-02H1 |

AI-02H1 no modifica `src/modules/discovery`, Functions, Firebase, UI, páginas, hooks, Vercel, configuración, `package.json` ni lockfiles.

El Boundary actual no transporta el payload al `BoundaryExecutionPort`. AI-02H1 no puede ocultar ese gap mediante closure, metadata ni global. Si la prueba de contrato demuestra que se necesita modificar `src/modules/intelligence/os/boundary/ports.ts`, `GovernedExecutionBoundary.ts` o sus barrels, la implementación debe detenerse y presentar una decisión arquitectónica y un alcance nuevo; esos archivos **no forman parte** de la lista mínima aprobable.

Cualquier barrel fuera de `discovery-completion/index.ts` que resulte necesario deberá documentarse con ruta, export exacto, razón y prueba antes de solicitar autorización. Esta auditoría no ejecuta esa modificación.

### AI-02H2 — Discovery Completion Hook

Alcance: como máximo un punto productivo en `saveDiscoverySession()`, configuración apagada por defecto, invocación best-effort, mismos returns, mismos side effects productivos y decisión/exclusión formal respecto del Shadow server. AI-02H2 queda bloqueado hasta aprobar AI-02H1.

| Ruta máxima | Responsabilidad |
|---|---|
| `src/modules/discovery/services/dossierBuilderService.ts` | Único punto productivo: intento best-effort después del dossier guardado |
| `src/modules/discovery/services/tests/dossierBuilderService.test.ts` | Las 10 pruebas de tenant y no interferencia; no añade otro punto productivo |

AI-02H2 no modifica Functions ni el Shadow server desde este alcance. Si la decisión formal exige reutilizar, sustituir o coordinar el servidor, deberá abrirse un alcance separado. El rollback del hook cliente consiste en quitar su único import y llamada.

## 22. Rollback Strategy

AI-02H1 no toca Discovery ni tiene activación productiva. Su rollback consiste en eliminar `src/modules/intelligence/os/consumers/discovery-completion/` y cualquier barrel externo que hubiera sido aprobado explícitamente. La configuración default ya impide ejecución.

AI-02H2 se revierte quitando el único import y la única llamada del hook en `saveDiscoverySession()`. Después deben ejecutarse caracterización Discovery, regresión OS/enterprise-model y build.

No se permiten migraciones, datos persistidos, documentos remotos, colas, flags ni artefactos que deban revertirse.

## 23. Acceptance Criteria

### AI-02H1

- [ ] Composition root interno completo sin importar ni modificar Discovery.
- [ ] Default production configuration: `enabled=false`, `killSwitch=true`, solo `SHADOW_ONLY`, cero ejecución.
- [ ] Test configuration accesible solo desde pruebas automatizadas.
- [ ] `PRODUCTIVE` siempre imposible/rechazado.
- [ ] `SchedulerPort` observado, determinista y sin Promises pendientes.
- [ ] Boundary, AI-02D, AI-02E, adapter y dedup cumplen sus responsabilidades separadas.
- [ ] Prueba aislada demuestra suficiencia del payload y una ejecución real válida del Orchestrator.
- [ ] Cero Firebase/Storage/Functions/React/persistencia/telemetría remota.
- [ ] Las 30 pruebas H1, regresión OS/enterprise-model, TypeScript y build pasan.
- [ ] Cualquier necesidad de modificar Boundary/barrels detiene el alcance y vuelve a revisión.

### AI-02H2

- [ ] AI-02H1 fue aprobado.
- [ ] C1 sigue siendo el candidato aprobado sobre la base actualizada.
- [ ] `tenantId` canónico está disponible y validado en `saveDiscoverySession()`.
- [ ] Existe como máximo un punto productivo en `saveDiscoverySession()`.
- [ ] Return y side effects productivos son idénticos.
- [ ] Invocación best-effort, no bloqueante y observada; no se contabiliza como ejecución confirmada.
- [ ] Cero tokens, PII, mensajes, prompts, razonamiento o payload legacy.
- [ ] Existe decisión formal y mecanismo verificable respecto del Shadow server.
- [ ] Se acepta explícitamente la posible pérdida por cierre, navegación o suspensión.
- [ ] Las 10 pruebas H2 y toda la regresión pasan.
- [ ] Rollback comprobado eliminando un único import/llamada.

## 24. Residual Risks

1. El browser puede terminar antes de ejecutar/completar la tarea.
2. La deduplicación in-memory no cubre tabs, workers, SSR, procesos ni la ejecución server.
3. El flujo cliente puede no disponer hoy de `tenantId` canónico; no existe fallback permitido.
4. El mapper de cinco hechos puede producir un pipeline parcial o inválido; hasta demostrar suficiencia, bloquea AI-02H2.
5. La composición completa del OS puede aumentar CPU/memoria aunque no bloquee el return.
6. El Shadow server existente puede duplicar costo/evaluación y no comparte exclusión con el browser.
7. El timeout Boundary actual no es efectivo hasta hardening.
8. El audit async actual puede provocar rejection no observada.
9. Los tests estáticos actuales del Boundary incluyen una aserción placeholder para independencia; debe convertirse en inspección real.
10. No hay entrega ni observabilidad durable por diseño; la invocación y sus resultados pueden desaparecer.
11. Habilitar más adelante sin un mecanismo productivo de rollout requerirá una autorización y diseño separados.

## 25. Open Questions

1. ¿Qué contexto canónico entrega `tenantId` validado a `saveDiscoverySession()` sin inferencias ni globals?
2. ¿El actor técnico `discovery-completion-service/SYSTEM` satisface auditoría o se requiere otro actor no personal?
3. ¿Se reutiliza, sustituye o coordina mediante exclusión mutua verificable `DISCOVERY_SHADOW_EVALUATION`?
4. ¿Se autoriza hardening previo del contrato Boundary para propagar payload y timeout?
5. ¿Qué policies concretas del enterprise-model compondrán el primer pipeline?
6. ¿Qué resultado y cobertura mínimos constituyen una ejecución Shadow válida en la prueba de suficiencia?
7. ¿Se aceptan 2,000 ms de timeout, TTL de dedup de 10 minutos y outcome TTL de 5 minutos?
8. ¿Se acepta que la invocación browser completa pueda perderse al cerrar, navegar, refrescar o suspender?
9. ¿La activación posterior será un cambio compilado revisado, dado que no se permiten env vars ni flags remotos?
10. Si el contrato actual de `BoundaryExecutionPort` resulta insuficiente, ¿qué decisión arquitectónica y alcance separados se aprobarán?

## 26. GO / GO WITH CONDITIONS / NO-GO Recommendation

**AI-02H1 — GO WITH CONDITIONS.** Puede proponerse únicamente la foundation aislada de la sección 21, sin Discovery, con configuración productiva apagada, `PRODUCTIVE` imposible, 30 pruebas aprobadas y revisión arquitectónica si el contrato Boundary exige archivos adicionales.

**AI-02H2 — NO-GO** hasta cumplir simultáneamente:

1. aprobar el composition root de AI-02H1;
2. demostrar la suficiencia del payload con una ejecución aislada real;
3. resolver `tenantId` técnico canónico y validado;
4. decidir formalmente el conflicto con el Shadow server —reutilización, sustitución o exclusión mutua verificable—; y
5. aprobar expresamente la posible pérdida best-effort de la invocación en navegador.

Después deberán aprobarse las 10 pruebas H2, mantener la configuración productiva apagada y revisar el diff antes de cualquier commit, push, PR o deploy.

La auditoría se detiene aquí. No se autoriza implementación, activación ni despliegue.
