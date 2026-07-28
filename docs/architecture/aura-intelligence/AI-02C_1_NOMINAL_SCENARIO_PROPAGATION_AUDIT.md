# AI-02C.1 — Nominal Scenario Propagation Audit

## 1. Executive Summary

Esta auditoría es pasiva. No implementa AI-02C.2, no modifica código fuente y no
conecta Discovery, Firebase ni ningún consumidor productivo.

La verificación se realizó en:

| Dato | Valor verificado |
|---|---|
| Rama | `feature/intelligence-os-bootstrapper` |
| `HEAD` | `6da9db6b2c63f70c4cd30c93ff0288876b04e9f3` |
| `origin/main` | `6da9db6b2c63f70c4cd30c93ff0288876b04e9f3` |
| Worktree inicial | Limpio |
| `git diff --check` inicial | Sin errores |

El código tiene dos representaciones incompatibles del escenario:

- `PipelineInitialDomainState.scenario` conserva un
  `PipelineScenarioDescriptor` nominal, versionado y validado contra el
  registry del OS;
- `PipelineAggregatedState` solo conserva `targetScenario?: string`.

No existe actualmente un `BusinessScenario` canónico compartido. Tampoco existe
un adapter que lleve `PipelineScenarioDescriptor` a ejecución. Si en el futuro
se proyectara únicamente `scenarioId` hacia `targetScenario`, se perderían
`objectiveKey`, stages, dependencias y dominios. Coverage volvería a interpretar
el string mediante substrings y produciría resultados incorrectos para
`ORGANIZATION_RESTRUCTURE` y `COMPLIANCE_AUDIT`.

El cambio contractual mínimo recomendado es una composición de tres decisiones:

1. introducir `PipelineExecutionScenario` como contrato propio de Aura
   Intelligence OS, independiente de `os/bootstrap`;
2. transportarlo opcionalmente en el input y en `PipelineAggregatedState`, y
   adaptarlo en el límite OS → Coverage a una selección neutral que contenga
   `scenarioId` y los `includedDomains` exactos;
3. conservar temporalmente `targetScenario?: string` y las heurísticas
   exclusivamente como fallback legacy.

Cuando exista descriptor nominal válido, este debe tener prioridad absoluta. Si
coexiste con un `targetScenario` distinto, la ejecución debe fallar cerrada por
conflicto; no debe elegir silenciosamente uno de los dos.

**Recomendación: GO WITH CONDITIONS para una futura AI-02C.2.** Las condiciones
son propagación end-to-end tanto por Coverage como por Planning, cero
heurísticas cuando existe descriptor, validación fail-closed y mantenimiento
temporal de la firma legacy. AI-02G.2B permanece bloqueado hasta implementar y
aprobar esa propagación.

## 2. Current Scenario Flow

### 2.1 Flujo legacy actual

```text
Productor externo
  → PipelineInput.targetScenario?: string
  → PipelineExecutionContext.initialInput (snapshot)
  → OrchestrationInput.targetScenario?: string
  → PipelineAggregatedState.targetScenario?: string
  → PipelineContextBuilder
      ├─ buildCoverageContext()
      │   → AuraIntelligenceOrchestrator.executeCoverageStage()
      │   → CoverageDecisionEngine.evaluateDecisionReadiness(string)
      │   → heurísticas de substring
      ├─ buildPlanningContext()
      │   → AdaptiveQuestionPlanner.planQuestionsFromGraph()
      │   → CoverageDecisionEngine.evaluateDecisionReadiness(string)
      │   → las mismas heurísticas
      └─ buildReasoningContext()
          → copia el string al assessment sintético si no hay readiness
```

El `targetScenario` se copia sin transformación hasta llegar a Coverage. La
transformación semántica ocurre únicamente dentro de
`CoverageDecisionEngine.getRequiredDomainsForScenario()`, donde un string libre
se convierte en dominios mediante substrings.

### 2.2 Flujo nominal de bootstrap disponible, pero no conectado

```text
PipelineBootstrapInput.targetScenario
  → validación contra PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY
  → PipelineScenarioDescriptor
  → PipelineInitialDomainState.scenario
  ─X→ no existe propagación a PipelineAggregatedState
```

`PipelineInitialDomainState` no es un `PipelineAggregatedState` y no existe
todavía el bootstrapper ni la función de composición entre ambos. El descriptor
nominal solo aparece hoy en contratos, validators y tests de bootstrap.

### 2.3 Puntos de transformación

| Punto | Entrada | Salida | Transformación actual |
|---|---|---|---|
| `PipelineExecutionContext` | `PipelineInput` | `initialInput` | Snapshot y freeze superficial de input |
| `AuraIntelligenceOrchestrator` | `OrchestrationInput` | `PipelineAggregatedState` | Copia `targetScenario` si no recibe `initialState` |
| `PipelineContextBuilder.buildCoverageContext()` | Estado agregado | `{ graph, targetScenario }` | Copia el string y exige que exista |
| `PipelineContextBuilder.buildPlanningContext()` | Estado agregado | `PlanFromGraphOptions` | Copia el string como opcional |
| `CoverageDecisionEngine` | String | `CoverageDomain[]` | Heurísticas por substring |
| `PipelineScenarioDescriptor` | Registry nominal | Estado inicial | Conserva todos los datos sin heurísticas |

Una particularidad relevante es que, cuando `executePipeline()` recibe
`initialState`, el Orchestrator clona ese estado y no fusiona el
`targetScenario` de `OrchestrationInput`. El descriptor de una ejecución
bootstrap debe vivir, por tanto, en el estado agregado y no solo en el input
paralelo.

## 3. Producers

### 3.1 Productores efectivos de `targetScenario`

| Productor | Tipo producido | Estado |
|---|---|---|
| Caller de `PipelineInput` | `targetScenario?: string` | Productor público legacy |
| Caller de `OrchestrationInput` | `targetScenario?: string` | Productor directo del Orchestrator |
| Caller que construye `PipelineAggregatedState` | `targetScenario?: string` | Productor del estado precargado |
| Fixtures y tests OS | Strings como `Test` y `M&A` | Solo test |
| `InternalExecutionInput` del Boundary | Declara `targetScenario?: string` | Capacidad contractual, no poblada por `GovernedExecutionBoundary` actual |

`PipelineExecutionContext`, `AuraIntelligenceOrchestrator` y
`PipelineContextBuilder` son carriers o proyectores, no autoridades semánticas
del escenario.

### 3.2 Productores nominales

| Productor | Tipo producido | Autoridad |
|---|---|---|
| `PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY` | Entradas cerradas y versionadas | Registry nominal actual de Aura Intelligence OS |
| `validatePipelineScenarioDescriptor()` | `PipelineScenarioDescriptor` validado | Validator bootstrap |
| `PipelineInitialDomainState` | Campo requerido `scenario` | Envelope de estado inicial |
| Tests bootstrap | Descriptores basados en el registry | Solo test |

No hay implementación productiva que construya hoy un
`PipelineInitialDomainState`. La presencia del contrato no equivale a un
productor conectado.

### 3.3 Ausencias confirmadas

- No existe un tipo llamado `BusinessScenario` bajo
  `src/modules/intelligence`.
- No existe un productor Discovery conectado.
- No existe un productor Firebase.
- No existe una transformación productiva
  `PipelineScenarioDescriptor → PipelineAggregatedState`.

## 4. Consumers

| Consumidor | Uso de `targetScenario` | Consecuencia |
|---|---|---|
| `PipelineExecutionContext` | Lo conserva en `initialInput` | Trazabilidad e inmutabilidad del input |
| `AuraIntelligenceOrchestrator` | Inicializa el estado cuando no hay `initialState` | Propagación legacy |
| `PipelineContextBuilder.buildCoverageContext()` | Lo exige y lo devuelve | Gate de Coverage |
| `AuraIntelligenceOrchestrator.executeCoverageStage()` | Lo pasa al port de Coverage | Activa resolución heurística |
| `CoverageDecisionEngine` | Resuelve dominios y lo copia al assessment | Consumidor semántico principal |
| `PipelineContextBuilder.buildPlanningContext()` | Lo pasa como opción | Segunda ruta hacia Coverage |
| `AdaptiveQuestionPlanner.planQuestionsFromGraph()` | Reejecuta `CoverageDecisionEngine` si existe | Segundo consumidor heurístico |
| `PipelineContextBuilder.buildReasoningContext()` | Lo usa en un assessment sintético | Trazabilidad, no resolución de dominios |
| `DecisionReadinessAssessment` | Conserva `targetScenario: string` | Output legacy |
| `KnowledgeObjectiveEngine` | Forma `coverageDecisionRef` desde el assessment | Trazabilidad indirecta |
| Shadow contracts | Transportan `PipelineInput` | Compatibilidad indirecta |

`PipelineScenarioDescriptor` solo es consumido actualmente por validators y
tests de bootstrap. Coverage, Planning y Reasoning no lo conocen.

## 5. Information Loss

Una proyección `scenario.scenarioId → targetScenario` preservaría solo una
etiqueta. Perdería:

| Dato nominal | Disponible en descriptor | Disponible en estado agregado actual |
|---|---:|---:|
| `scenarioId` | Sí | Solo como string no tipado |
| `scenarioVersion` | Sí | No |
| `objectiveKey` | Sí | No |
| `requestedStages` | Sí | No |
| `allowedStages` | Sí | No |
| `requiredStages` | Sí | No |
| `stageDependencies` | Sí | No |
| `includedDomains` | Sí | No |
| `excludedDomains` | Sí | No |
| `source` | Sí | No |
| `explicitSelection` | Sí | No |

La información no puede reconstruirse legítimamente desde el string:

- el engine no conoce el registry ni la versión;
- múltiples strings pueden activar la misma heurística;
- un mismo string puede activar una rama equivocada por el orden de substrings;
- el fallback crea dominios aunque el escenario sea desconocido;
- `objectiveKey` no equivale a `objectiveIds`;
- los stages no pueden derivarse de los dominios.

La decisión documentada anteriormente de conservar el descriptor solo en
`PipelineInitialDomainState` y proyectar `scenarioId` no es suficiente para
compatibilidad semántica. Esta auditoría identifica el contrato de ejecución que
falta.

## 6. Coverage Heuristic Analysis

### 6.1 Orden exacto

`CoverageDecisionEngine.getRequiredDomainsForScenario()` aplica este orden:

1. `payroll` o `nomina`
   → `payroll`, `organization`, `compliance`;
2. `comp`, `restructure` o `salary`
   → `compensation`, `organization`, `payroll`, `benefits`;
3. `org`, `structure` o `headcount`
   → `organization`, `workforce_analytics`, `talent_performance`;
4. `compliance` o `audit`
   → `compliance`, `payroll`, `time_attendance`;
5. fallback
   → `organization`, `payroll`.

El primer match termina la resolución.

### 6.2 Colisiones

- `ORGANIZATION_RESTRUCTURE` contiene `restructure`; activa la rama 2 antes de
  que `org` o `structure` puedan activar la rama 3.
- `COMPLIANCE_AUDIT` contiene `comp` dentro de `compliance`; activa la rama 2
  antes de llegar a la rama 4.
- Cualquier valor futuro que contenga `comp` —por ejemplo `company`,
  `competency`, `complexity` o `comprehensive`— puede clasificarse como
  compensation.
- Cualquier escenario futuro con `restructure` queda forzado a compensation,
  aunque su registry declare otros dominios.
- Un escenario desconocido nunca se rechaza: recibe el fallback de organization
  y payroll.
- Los IDs, versiones, objective y exclusiones no participan en la decisión.

### 6.3 Tests existentes que dependen del string

Existen **10 tests que ejercen directamente o indirectamente la resolución
heurística**:

- siete llamadas directas en
  `enterprise-model/coverage/tests/CoverageDecisionEngine.test.ts`;
- tres casos en
  `enterprise-model/planning/tests/AdaptiveQuestionPlanner.test.ts`.

Limitaciones de esos tests:

- el caso de `organization_restructure` solo comprueba que el assessment repite
  el string y que `isReady` es falso; no comprueba dominios;
- no existe un caso de `compliance_audit` en el test del engine;
- los tests de payroll y compensation no verifican la ausencia de dominios no
  requeridos;
- ningún test demuestra que el descriptor nominal evita las heurísticas.

También existen tests que fijan el contrato string sin ejecutar heurísticas:

- `PipelineContextBuilder.test.ts` usa `M&A`;
- `PipelineExecutionContext.test.ts` comprueba que un scenario ausente no se
  inventa;
- `AuraIntelligenceOrchestrator.test.ts` usa `Test` con un engine mock;
- tests bootstrap comprueban por separado la integridad del descriptor.

## 7. Affected Scenarios

| Scenario nominal | `includedDomains` del registry | Rama heurística actual | Resultado | Estado |
|---|---|---|---|---|
| `PAYROLL_AUDIT` | `payroll`, `organization`, `compliance` | `payroll` | Igual al registry | Correcto por coincidencia |
| `COMPENSATION_RESTRUCTURE` | `compensation`, `organization`, `payroll`, `benefits` | `comp` / `restructure` | Igual al registry | Correcto por coincidencia |
| `ORGANIZATION_RESTRUCTURE` | `organization`, `workforce_analytics`, `talent_performance` | `restructure` | compensation, organization, payroll, benefits | Incorrecto |
| `COMPLIANCE_AUDIT` | `compliance`, `payroll`, `time_attendance` | `comp` dentro de `compliance` | compensation, organization, payroll, benefits | Incorrecto |

Los dos escenarios correctos no prueban que el algoritmo sea correcto; solo
coinciden accidentalmente con el orden actual.

## 8. Contract Alternatives

### 8.1 Evaluación

| Alternativa | Corrección semántica | Alcance | Breaking changes | Compatibilidad | Tests requeridos | Riesgo | Deuda | Rollback |
|---|---|---|---|---|---|---|---|---|
| A. `scenarioDescriptor?` en `PipelineAggregatedState` | Completa si preserva el descriptor | OS state, input, clone y builders | No si es opcional | Alta | Contrato, propagación, prioridad y conflicto | Importar el tipo bootstrap desde OS crearía acoplamiento de capa | Media si reutiliza el tipo bootstrap directamente | Retirar campo opcional |
| B. `resolvedCoverageDomains?` en el estado | Corrige Coverage, pero no propaga objective, stages ni versión | Estado y Coverage | No si es opcional | Alta | Dominios, precedencia y drift | Dos fuentes de verdad si no se deriva siempre del descriptor | Alta | Retirar campo y volver al string |
| C. `ScenarioResolutionPort` | Completa si resuelve por ID y versión | Nuevo port, composición y registry provider | No si es opcional | Alta | Port, provider, fallos y determinismo | Indirección runtime innecesaria cuando el descriptor ya contiene dominios | Media/alta | Desconectar port |
| D. Coverage acepta `PipelineScenarioDescriptor` | Completa | Coverage API y todos sus callers | Evitable con overload | Media/alta | Engine y callers | Dependency inversa Enterprise Model → bootstrap/OS | Alta | Conservar overload string |
| E. Adapter nominal antes de Coverage | Completa y mantiene límites | OS builder/orchestrator y contrato neutral de Coverage | No con ruta dual | Alta | Adapter, engine, planning y end-to-end | Debe aplicarse también al planner para no reintroducir heurísticas | Baja | Volver a ruta legacy |
| F. Mantener solo `targetScenario` | Nula para el problema nominal | Ninguno | Ninguno | Máxima con legado | Caracterización únicamente | Mantiene colisiones y fallback no gobernado | Crítica | Ya es el estado actual |

### 8.2 Conclusiones por alternativa

**A** es adecuada únicamente si el campo no usa directamente
`PipelineScenarioDescriptor`. El agregado debe depender de un tipo propio del
OS; bootstrap puede producir una extensión o refinamiento de ese tipo.

**B** es insuficiente como contrato principal. Puede ser una vista derivada
efímera, pero no estado persistente ni segunda autoridad.

**C** es útil si en el futuro los productores envían solo `{scenarioId,
scenarioVersion}`. No es el mínimo para AI-02C.1 porque el descriptor existente
ya trae los dominios resueltos.

**D** no debe implementarse importando tipos de bootstrap en Enterprise Model.
Coverage debe aceptar un contrato estrecho propio, no el descriptor completo.

**E** es el límite correcto: el OS conoce el escenario de ejecución y adapta
solo lo que Coverage necesita.

**F** se conserva temporalmente como compatibilidad, no como ruta preferida.

## 9. Scorecard

Escala: 1 = deficiente, 5 = excelente. Ponderación: corrección 30%, ownership y
dirección de dependencias 20%, backward compatibility 15%, alcance 15%,
testabilidad 10% y rollback 10%.

| Alternativa | Corrección | Ownership | Compatibilidad | Alcance | Tests | Rollback | Total ponderado |
|---|---:|---:|---:|---:|---:|---:|---:|
| A. Descriptor bootstrap directo | 5 | 2 | 5 | 4 | 5 | 5 | 4.25 |
| B. Dominios resueltos solamente | 3 | 4 | 5 | 5 | 5 | 5 | 4.20 |
| C. Resolution port | 5 | 5 | 5 | 2 | 4 | 4 | 4.35 |
| D. Coverage importa descriptor | 5 | 1 | 4 | 3 | 5 | 4 | 3.65 |
| E. Adapter OS → Coverage | 5 | 5 | 5 | 3 | 5 | 5 | **4.70** |
| F. String solamente | 1 | 5 | 5 | 5 | 3 | 5 | 3.60 |

La recomendación no es E aislada. Es:

```text
A con tipo OS independiente
  + E como adapter obligatorio de la ruta nominal
  + F únicamente como fallback temporal
```

## 10. Recommended Contract

### 10.1 Ubicación y forma

`PipelineExecutionScenario` debe vivir en Aura Intelligence OS, no en
Enterprise Model, Coverage, Discovery ni Firebase. Conceptualmente:

```ts
interface PipelineExecutionScenario {
  readonly scenarioId: PipelineScenarioId;
  readonly scenarioVersion: string;
  readonly objectiveKey: PipelineScenarioObjectiveKey;
  readonly requestedStages: readonly PipelineStageId[];
  readonly allowedStages: readonly PipelineStageId[];
  readonly requiredStages: readonly PipelineStageId[];
  readonly stageDependencies: Readonly<
    Record<PipelineStageId, readonly PipelineStageId[]>
  >;
  readonly includedDomains: readonly CoverageDomain[];
  readonly excludedDomains: readonly CoverageDomain[];
}
```

`allowedStages` debe conservarse además del mínimo solicitado porque ya forma
parte del descriptor validado y limita la ejecución permitida.

`source` y `explicitSelection` son propiedades de admisión/bootstrap. Pueden
permanecer en `PipelineScenarioDescriptor`, que conceptualmente debe ser una
extensión o refinamiento de `PipelineExecutionScenario`:

```text
PipelineScenarioDescriptor
  = PipelineExecutionScenario
  + source
  + explicitSelection: true
```

No debe reutilizarse directamente `PipelineScenarioDescriptor` como tipo del
estado agregado. Hacerlo obligaría al estado de ejecución general a depender de
un contrato específico de bootstrap.

### 10.2 Residencia durante ejecución

El descriptor debe vivir como:

```text
PipelineInput.executionScenario?
OrchestrationInput.executionScenario?
PipelineAggregatedState.executionScenario?
```

El lugar autoritativo durante la ejecución es
`PipelineAggregatedState.executionScenario`. El input es el mecanismo de
admisión; el estado es el carrier entre stages. El clone del Orchestrator y el
snapshot de `PipelineExecutionContext` deben conservarlo de forma inmutable.

`targetScenario?: string` permanece temporalmente junto al nuevo campo.

### 10.3 Contrato neutral para Coverage

Coverage no necesita stages, objective ni registry. Debe recibir un contrato
estrecho propiedad de Coverage, por ejemplo:

```ts
interface CoverageScenarioSelection {
  readonly scenarioId: string;
  readonly requiredDomains: readonly CoverageDomain[];
}
```

El adapter en el OS transforma:

```text
PipelineExecutionScenario.scenarioId
  → CoverageScenarioSelection.scenarioId

PipelineExecutionScenario.includedDomains
  → CoverageScenarioSelection.requiredDomains
```

`excludedDomains` se valida en el OS, pero no se interpreta como dominios
requeridos. Coverage no debe inferir dominios faltantes ni consultar el
registry.

### 10.4 Reglas de prioridad

| Descriptor nominal | String legacy | Resultado |
|---|---|---|
| Válido | Ausente | Usar descriptor sin heurísticas |
| Válido | Igual a `scenarioId` | Usar descriptor sin heurísticas |
| Válido | Distinto | Rechazar por conflicto |
| Ausente | Presente | Usar ruta heurística legacy temporal |
| Ausente | Ausente | Mantener error de estado requerido |
| Inválido | Cualquiera | Rechazar; no degradar a legacy |

“Descriptor tiene prioridad” no significa ignorar contradicciones. Un conflicto
entre dos representaciones debe ser observable y fail-closed.

### 10.5 Resolución de dominios

Cuando existe descriptor nominal:

1. validar ID y versión contra el registry del OS;
2. validar que `includedDomains` y `excludedDomains` coincidan con la entrada
   nominal aprobada;
3. validar arrays no vacíos cuando corresponda, sin duplicados y sin
   intersección;
4. pasar exactamente `includedDomains` a Coverage;
5. evaluar únicamente esos dominios y en ese orden;
6. usar `scenarioId` solo para trazabilidad, IDs y output;
7. no ejecutar substrings;
8. no ejecutar fallback.

Cuando solo existe string legacy, el comportamiento actual permanece durante la
migración.

## 11. Ownership

| Elemento | Owner recomendado | No debe pertenecer a |
|---|---|---|
| Registry nominal, IDs y versiones | Aura Intelligence OS Scenario Governance | Coverage, Discovery, Firebase |
| `PipelineExecutionScenario` | Aura Intelligence OS contracts | Bootstrap como owner exclusivo |
| Admisión y selección explícita | Bootstrap/Boundary bajo reglas del OS | Coverage |
| Resolución nominal a `CoverageDomain[]` | Registry del OS; adapter OS proyecta la selección | Heurísticas de Coverage |
| Vocabulario `CoverageDomain` | Enterprise Model Coverage | Discovery |
| Evaluación de métricas para dominios ya resueltos | Coverage engine | Bootstrap |
| Stage dependencies y allowed/required stages | Aura Intelligence OS orchestration governance | Coverage |
| `objectiveKey` nominal | Aura Intelligence OS scenario registry | Discovery |
| Backward compatibility de `targetScenario` | Aura Intelligence OS Architecture Governance | Productores individuales |
| Retiro de heurísticas | Aura Intelligence OS + Enterprise Model governance | Discovery |

El registry puede permanecer físicamente bajo `os/bootstrap` durante la primera
fase para minimizar el diff, porque sigue estando dentro de Aura Intelligence
OS. No obstante, el contrato general de ejecución no debe importarlo desde allí.
Una relocalización posterior del registry a un módulo `os/scenarios` sería una
mejora de ownership, no una precondición para la propagación mínima.

Discovery puede solicitar un scenario aprobado mediante un boundary futuro,
pero no crear IDs, redefinir dominios, cambiar stages ni controlar versiones.

## 12. Backward Compatibility

### 12.1 Estrategia

La primera versión debe ser aditiva:

- `executionScenario?` es opcional;
- `targetScenario?` se conserva;
- las firmas legacy siguen aceptando string;
- el nuevo contrato de Coverage se agrega mediante overload o parámetro
  discriminado, sin retirar inmediatamente la firma actual;
- `DecisionReadinessAssessment.targetScenario` sigue devolviendo string para no
  romper Planning, Reasoning ni traceability;
- los productores actuales no necesitan migrar en el mismo commit.

### 12.2 Cambios no breaking

- añadir el campo opcional al input y al estado;
- añadir una forma nominal opcional al port de Coverage;
- clonar y congelar el nuevo descriptor;
- preferir descriptor cuando existe;
- mantener exactamente las heurísticas para llamadas string-only;
- añadir validación de conflicto solo cuando se envían ambas representaciones.

### 12.3 Cambios breaking

- hacer obligatorio `executionScenario` antes de migrar productores;
- retirar `targetScenario` o la firma string;
- cambiar el fallback legacy durante la fase de coexistencia;
- cambiar `DecisionReadinessAssessment.targetScenario` por un objeto;
- hacer que Enterprise Model importe tipos desde `os/bootstrap`;
- reinterpretar `objectiveKey` como `objectiveIds`;
- aceptar un descriptor inválido y degradarlo silenciosamente a string;
- cambiar dominios nominales sin una nueva `scenarioVersion`.

### 12.4 Compatibilidad semántica

La compatibilidad no exige preservar resultados incorrectos en la ruta nominal.
Para `ORGANIZATION_RESTRUCTURE` y `COMPLIANCE_AUDIT`, la divergencia frente a la
heurística actual es la corrección buscada. La ruta string-only sí debe
permanecer estable hasta su retiro explícito.

## 13. Migration Plan

### 13.1 Fase 1 — Contrato nominal opcional y dual-read

- introducir `PipelineExecutionScenario` en el OS;
- añadirlo opcionalmente al input y al estado agregado;
- conservar `targetScenario`;
- añadir `CoverageScenarioSelection`;
- hacer que `PipelineContextBuilder` adapte el descriptor;
- hacer que el Orchestrator y `AdaptiveQuestionPlanner` propaguen los dominios
  resueltos;
- descriptor válido tiene prioridad;
- conflicto entre descriptor y string falla cerrado;
- string-only mantiene heurísticas;
- agregar tests de caracterización antes de cambiar comportamiento.

Esta fase es adecuada según el código real, con una condición: no basta con
cambiar `executeCoverageStage()`. `AdaptiveQuestionPlanner.planQuestionsFromGraph()`
también invoca `CoverageDecisionEngine` y debe recibir la selección nominal.

### 13.2 Fase 2 — Migración de productores

- bootstrap produce `PipelineExecutionScenario` desde su descriptor validado;
- los composition roots nominales dejan de construir strings;
- Boundary y Shadow solo se amplían cuando exista una fuente nominal autorizada;
- mantener consumidores legacy sin cambios;
- ejecutar pruebas de equivalencia para `PAYROLL_AUDIT` y
  `COMPENSATION_RESTRUCTURE`;
- documentar divergencia esperada y aprobada para
  `ORGANIZATION_RESTRUCTURE` y `COMPLIANCE_AUDIT`;
- medir cuántas ejecuciones siguen usando string-only.

No debe migrarse Discovery dentro de esta fase.

### 13.3 Fase 3 — Retiro controlado

- impedir nuevos productores string-only;
- mantener heurísticas únicamente en un adapter legacy identificado;
- retirar heurísticas cuando no existan callers legacy compatibles;
- retirar `targetScenario` del input en una versión mayor del contrato;
- conservar `targetScenario` en outputs mientras lo necesite trazabilidad, o
  versionar también ese output;
- mover el registry a `os/scenarios` si se aprueba la limpieza de ownership.

### 13.4 Archivos futuros mínimos

Una futura implementación end-to-end requeriría revisar exactamente:

**Contratos y ejecución OS**

- `src/modules/intelligence/os/types.ts`
- `src/modules/intelligence/os/contextTypes.ts`
- `src/modules/intelligence/os/PipelineExecutionContext.ts`
- `src/modules/intelligence/os/PipelineContextBuilder.ts`
- `src/modules/intelligence/os/AuraIntelligenceOrchestrator.ts`
- `src/modules/intelligence/os/dependencyComposition.ts`
- `src/modules/intelligence/os/bootstrap/types.ts`

**Límite Coverage/Planning**

- `src/modules/intelligence/enterprise-model/coverage/domain/types.ts`
- `src/modules/intelligence/enterprise-model/coverage/services/CoverageDecisionEngine.ts`
- `src/modules/intelligence/enterprise-model/planning/services/AdaptiveQuestionPlanner.ts`

**Tests existentes a ampliar**

- `src/modules/intelligence/os/tests/PipelineExecutionContext.test.ts`
- `src/modules/intelligence/os/tests/PipelineContextBuilder.test.ts`
- `src/modules/intelligence/os/tests/AuraIntelligenceOrchestrator.test.ts`
- `src/modules/intelligence/os/bootstrap/tests/types.test.ts`
- `src/modules/intelligence/os/bootstrap/tests/validators.test.ts`
- `src/modules/intelligence/enterprise-model/coverage/tests/CoverageDecisionEngine.test.ts`
- `src/modules/intelligence/enterprise-model/planning/tests/AdaptiveQuestionPlanner.test.ts`

No se requiere crear un port runtime, un registry dentro de Coverage, un módulo
Discovery ni un adapter Firebase para la solución mínima.

## 14. Tests

Se proponen **23 tests exactos**:

| # | Prueba |
|---:|---|
| 1 | `PAYROLL_AUDIT` propaga exactamente sus `includedDomains` |
| 2 | `PAYROLL_AUDIT` conserva exactamente sus `excludedDomains` |
| 3 | `COMPENSATION_RESTRUCTURE` propaga exactamente sus `includedDomains` |
| 4 | `COMPENSATION_RESTRUCTURE` conserva exactamente sus `excludedDomains` |
| 5 | `ORGANIZATION_RESTRUCTURE` propaga exactamente sus `includedDomains` |
| 6 | `ORGANIZATION_RESTRUCTURE` conserva exactamente sus `excludedDomains` |
| 7 | `COMPLIANCE_AUDIT` propaga exactamente sus `includedDomains` |
| 8 | `COMPLIANCE_AUDIT` conserva exactamente sus `excludedDomains` |
| 9 | El round-trip conserva version, objective, requested/allowed/required stages y dependencies |
| 10 | `PipelineExecutionContext` y el clone del estado no permiten mutar el descriptor |
| 11 | Descriptor nominal tiene prioridad frente a un string legacy coincidente |
| 12 | Planning propaga la misma selección nominal que Coverage directo |
| 13 | Con descriptor nominal, Coverage no ejecuta ninguna resolución heurística |
| 14 | Una llamada legacy `payroll_audit` mantiene los dominios actuales |
| 15 | Un string legacy desconocido mantiene temporalmente el fallback actual |
| 16 | Ausencia simultánea de descriptor y string mantiene el error requerido |
| 17 | Descriptor y string contradictorios fallan cerrados |
| 18 | `scenarioId` nominal desconocido es rechazado |
| 19 | `scenarioVersion` no permitida es rechazada |
| 20 | Descriptor con `includedDomains` vacío o duplicado es rechazado |
| 21 | Intersección entre included y excluded domains es rechazada |
| 22 | Los módulos modificados no importan Discovery |
| 23 | Los módulos modificados no importan Firebase |

Además de estas pruebas nuevas, deben conservarse los diez casos existentes que
ejercen strings. Durante la fase dual:

- los tests legacy caracterizan la compatibilidad;
- los tests nominales demuestran la ausencia de heurísticas;
- los dos escenarios hoy mal clasificados deben afirmar los dominios nominales,
  no equivalencia con el resultado legacy.

No se propone usar mocks del registry dentro de Coverage. Los tests del adapter
OS deben usar descriptores válidos del registry; los tests unitarios de Coverage
deben usar `CoverageScenarioSelection` explícita.

## 15. Risks

| Riesgo | Impacto | Mitigación contractual |
|---|---|---|
| Propagar descriptor solo por Coverage directo | Planning vuelve a ejecutar heurísticas | Extender también `PlanFromGraphOptions` |
| Dos fuentes de verdad | String y descriptor divergen | Validación de conflicto fail-closed |
| Dependency inversa | Enterprise Model importa bootstrap | Contrato neutral propiedad de Coverage |
| Mutación del descriptor | Dominios cambian entre stages | Clone/freeze profundo |
| Degradación silenciosa | Descriptor inválido cae a legacy | Invalid nominal nunca hace fallback |
| Drift registry/descriptor | Versiones iguales con dominios distintos | Validación exacta y bump de versión |
| Retiro prematuro | Callers legacy dejan de funcionar | Dual-read y telemetría antes de retirar |
| Preservar accidentalmente bugs | Tests de equivalencia fijan dominios erróneos | Equivalencia solo para escenarios coincidentes |
| Registry dentro de Coverage | Acoplamiento de capas | Resolver nominalmente en OS |
| Scope creep | Se conecta Discovery o Firebase | Tests arquitectónicos y exclusión explícita |
| Output ambiguo | Assessment solo conserva string | Mantener string como etiqueta y descriptor en estado |
| `resolvedCoverageDomains` persistido | Segunda autoridad derivada | Mantenerlo como vista efímera del adapter |

## 16. Open Questions

1. ¿`PipelineScenarioId` y sus objective keys se moverán desde
   `os/bootstrap/types.ts` a un módulo OS general en la fase 1 o en la fase 3?
2. ¿La coexistencia con valores contradictorios debe producir un nuevo error OS
   específico o reutilizar `MISSING_REQUIRED_STATE`/validación de contrato?
3. ¿El output `DecisionReadinessAssessment` necesita una
   `scenarioVersion` opcional para trazabilidad antes de retirar el legado?
4. ¿La ruta legacy debe emitir warning o audit event para medir su retiro?
5. ¿`includedDomains` representa definitivamente “required domains” para
   Coverage, o se necesita una distinción futura entre required y advisory?
6. ¿La versión del scenario se gobierna independientemente de
   `OS_CONTRACT_VERSION`?
7. ¿La relocalización física del registry se incluye en AI-02C.2 o se difiere
   para reducir el diff?

Ninguna pregunta abierta autoriza inferencias desde Discovery ni un fallback
nominal basado en texto.

## 17. GO / GO WITH CONDITIONS / NO-GO

**GO WITH CONDITIONS para diseñar e implementar AI-02C.2.**

Condiciones:

1. `PipelineExecutionScenario` pertenece al OS y no depende de bootstrap.
2. El estado agregado conserva el descriptor durante toda la ejecución.
3. Coverage recibe los `includedDomains` exactos mediante un contrato neutral.
4. La ruta Planning recibe la misma selección nominal.
5. Con descriptor no se ejecutan heurísticas ni fallback.
6. Un descriptor inválido o contradictorio falla cerrado.
7. La ruta string-only permanece temporalmente compatible.
8. Los 23 tests propuestos se implementan y pasan.
9. No se conecta Discovery ni Firebase.
10. No se reanuda AI-02G.2B hasta aprobar la propagación nominal.

**NO-GO** para implementar ahora el bootstrapper sobre la proyección
`scenarioId → targetScenario` existente.

Esta auditoría no modifica código, no crea contratos ejecutables, no realiza
commit, push, PR ni deployment.
