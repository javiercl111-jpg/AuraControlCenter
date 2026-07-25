# Plan de Implementación: AI-02 — Aura Intelligence OS™ (Shadow Mode)

## 1. Resumen Ejecutivo
**Aura Intelligence OS™** (AI-02) es la capa de orquestación responsable de coordinar la ejecución del ecosistema de inteligencia empresarial (módulos AI-01A a AI-01H). 
El diseño rompe con la falsa premisa de un pipeline lineal simple (A $\rightarrow$ B $\rightarrow$ C) y se estructura como una **Facade de Orquestación** apoyada por un **Context Factory** robusto.
La capa OS garantiza el ensamblaje de dependencias (Policies, Providers), agregación de estados parciales para formar mega-contextos de ejecución, resiliencia ante fallos y encapsulación asíncrona mediante el patrón Shadow Mode.
**Cero impacto productivo:** El OS no implementa lógica de dominio, no duplica contratos, no muta la persistencia productiva (Firebase) ni asume valores de negocio sin delegación explícita.

## 2. Modelo de Pipeline Real
La orquestación agrupa la ejecución en etapas complejas de agregación, no lineales:

**A. Estado Base**
El OS parte de entradas en bruto (turnos conversacionales, grafo semántico actual y modelo mental cargado previamente). Requiere un ID de ejecución determinista y un reloj (clock) inyectado.

**B. Aplicación de Evidencia (Extracción + Grafo)**
- **Extracción/Grafo:** No existe un motor aislado de "Graph Builder" orquestable linealmente; en su lugar, `ExtractionApplier` aplica las evidencias y muta inmutablemente tanto el modelo mental como el `KnowledgeGraph`.
- Salida: `ApplierResult` (MentalModel, KnowledgeGraph, TurnExtractionResult).

**C. Evaluación y Planificación**
- **Coverage:** El `CoverageDecisionEngine` procesa el Grafo con un `targetScenario` explícito provisto por las políticas de inyección. Produce un `DecisionReadinessAssessment`.
- **Planning:** El `AdaptiveQuestionPlanner` no consume un assessment aislado, sino el Grafo original, una `PlannerPolicy` y un `QuestionRealizationProvider`.

**D. Razonamiento Ejecutivo**
- **Contexto:** Se requiere un `ExecutiveReasoningContext` (Model, Graph, Coverage, DecisionAssessment, Evidences, Hypotheses) y un `ReasoningExecutionContext` con timestamp seguro.
- **Ejecución:** El `ExecutiveReasoningEngine` (instanciado con su `ReasoningPolicy`) emite un `ExecutiveReasoningReport`.

**E. Dossier & Diagnóstico**
- **Contexto:** Se construye mediante `DiagnosticContextBuilder` a partir del reporte anterior, con un `DossierExecutionContext`.
- **Ejecución:** `ExecutiveDossierBuilder` (instanciado con `DossierPolicy` y `DiagnosticNarrativeProvider`) produce un `ExecutiveDossier`.

**F. Assessment de Transformación**
- **Ejecución:** `EnterpriseTransformationAssessmentBuilder` (instanciado con `AssessmentPolicy`) consume parámetros atómicos (`executionId`, `timestamp`, `dossier`, `reasoning`, `constraints`, `dependencies`) para emitir el veredicto final.

## 3. Matriz Canónica de Contratos

| Componente | Archivo Real | Export Real | Tipo o Clase | Constructor Requerido | Método Invocado | Entrada Real | Salida Real | Dependencias Inyectadas | Contexto Requerido | Sync/Async | Posibles Excepciones | Efectos Secundarios | Adaptación Requerida | Responsable de la Adaptación |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Extracción & Grafo | `extraction/services/ExtractionApplier.ts` | `ExtractionApplier` | Clase | No | `applyExtraction` | `MentalModel`, `Graph`, `TurnExtractionResult` | `ApplierResult` | Ninguna | N/A | Sync | Extracción inválida | Mutación inmutable de grafo | Extracción de grafo y modelo del ApplierResult | Orquestador |
| Cobertura | `coverage/services/CoverageDecisionEngine.ts` | `CoverageDecisionEngine` | Clase (estática) | No | `evaluateDecisionReadiness` | `KnowledgeGraph`, `targetScenario` | `DecisionReadinessAssessment` | Ninguna | N/A | Sync | Grafo nulo | Ninguno | Resolver `targetScenario` explícito | ContextBuilder |
| Planning | `planning/services/AdaptiveQuestionPlanner.ts` | `AdaptiveQuestionPlanner` | Clase | No | `planFromGraph` | `PlanFromGraphOptions` | `AdaptiveQuestionPlanResult` | `policy`, `realizationProvider` | N/A | Sync | Dependencias no resueltas | Ninguno | Provisión de providers y policy en options | ContextBuilder |
| Razonamiento | `reasoning/services/ExecutiveReasoningEngine.ts` | `ExecutiveReasoningEngine` | Clase | `ReasoningPolicy` | `execute` | `ExecutiveReasoningContext`, `ReasoningExecutionContext` | `ExecutiveReasoningReport` | `ReasoningPolicy` en constructor | State múltiple unificado | Sync | Contexto inválido | Ninguno | Agregación de 10 atributos de estado | ContextBuilder |
| Dossier | `dossier/services/ExecutiveDossierBuilder.ts` | `ExecutiveDossierBuilder` | Clase | `DossierExecutionContext`, `DossierPolicy`, `DiagnosticNarrativeProvider` | `build` | `report: unknown` (ReasoningReport) | `ExecutiveDossier` | `Policy`, `Provider`, `Context` en constructor | `DossierExecutionContext` | Sync | Fallo de parseo | Ninguno | Instanciación pesada previa | ContextBuilder |
| Assessment | `assessment/services/EnterpriseTransformationAssessmentBuilder.ts` | `EnterpriseTransformationAssessmentBuilder` | Clase | `AssessmentPolicy` | `build` | `executionId`, `timestamp`, `dossier`, `reasoning`, `constraints`, `dependencies` | `EnterpriseTransformationAssessment` | `AssessmentPolicy` en constructor | Atributos atómicos | Sync | Fallos de validación interna | Ninguno | Desestructurar reportes; arrays vacíos para constraints de ser necesario | Orquestador / ContextBuilder |

## 4. Diseño del Aura Intelligence OS
El OS se divide en tres responsabilidades estandarizadas:

**A. Composition Layer:**
Responsable de inyectar implementaciones concretas, políticas, `Providers` externos, un reloj determinista (`Clock`) y un generador de UUIDs desde el host (ej. capa de aplicación Node).
**B. Context Construction Layer:**
Un módulo de constructores (ej. `PipelineContextBuilder`) que agrega los estados individuales de las etapas A-B-C para estructurar dinámicamente los megacontextos que exigen el Razonamiento y Dossier.
**C. Orchestration Facade:**
El `AuraIntelligenceOrchestrator` es una máquina de estados pura. Ejecuta los módulos en estricto orden cronológico. Normaliza fallos, preserva invariantes, aborta en caso de excepciones sin tragarlas silenciosamente y emite el `PipelineResult`. Cero dependencias con Firebase o generación de narrativas intrínsecas.

## 5. Diseño de Shadow Mode

**A. Shadow Execution:**
- **Invocación:** Integración futura explícita mediante bloque `try/catch` aislado con Timeouts absolutos (ej. `Promise.race`).
- **Control:** Prevención de reentradas por concurrencia usando locks de sesión. Límite de concurrencia y Circuit Breakers futuros.
- **Seguridad:** Cero I/O. Completamente `readonly` respecto al estado de Firebase. Cero impacto visible en la latencia o UI de usuario.
**B. Shadow Capture:**
Interfaz abstracta genérica de captura/sink (`IShadowCaptureSink`). Se delega a Firebase explícitamente y se exigen reglas de redacción para omitir PII (Personally Identifiable Information) antes de persistir la traza.
**C. Shadow Comparison:**
Módulo abstracto que compara el output determinista del OS con la ejecución de Discovery clásica, clasificando divergencias en Evidencia, Cobertura, Objetivo y Assessment.
**D. Productive Boundary:**
Un adaptador de borde (Boundary) protegerá la invocación productiva real mediante un patrón *fire-and-observe* controlado. 

## 6. Puertos de Dependencias
Deben inyectarse mediante puertos explícitos.
- **Requeridos para AI-02A (Puertos mínimos):** Generador de ID, `Clock`, Contratos base.
- **Requeridos para AI-02B:** `PlannerPolicy`, `QuestionRealizationProvider`, `ReasoningPolicy`, `DossierPolicy`, `DiagnosticNarrativeProvider`, `AssessmentPolicy`.
- **Requeridos para Shadow Mode:** `TimeoutPolicy`, `CancellationSignal`, `LoggerSink`, `IShadowCaptureSink`.
- **Prohibidas en esta fase:** Dependencias directas a Firebase Admin, Discovery persistente.

## 7. Cero Valores Inventados
Regla estricta del OS:
- Ningún parámetro (`targetScenario`, `constraints`, `dependencies`) puede asumirse, inventarse silenciosamente o codificarse "en duro". 
- Ningún timestamp será generado con `Date.now()`, debe usar el Clock inyectado.
Si una entrada requerida no existe, el Orquestador debe generar un error normalizado, marcar el estado como incompleto u omitir justificadamente la etapa.

## 8. Archivos Propuestos
Estructura recomendada (sujeta a verificación durante implementación):

`src/modules/intelligence/os/`
- `types.ts` (Contratos públicos, estados parciales, PipelineResult). **AI-02A**
- `ports.ts` (Interfaces para Providers, Policies inyectables, Clock). **AI-02A**
- `PipelineExecutionContext.ts` (Estado y agregación). **AI-02A**
- `PipelineContextBuilder.ts` (Constructor de megacontextos). **AI-02B**
- `AuraIntelligenceOrchestrator.ts` (Orchestration Facade). **AI-02C**
- `errors.ts` (Errores normalizados). **AI-02A**
- `index.ts` (Exports canónicos). **AI-02A**

`src/modules/intelligence/os/shadow/` (Integración Futura)
- `types.ts` (Métricas y métricas de divergencia). **AI-02E**
- `ShadowComparator.ts` (Comparación de objetos y árboles). **AI-02F**
- `ShadowExecutionGuard.ts` (Timeouts, reentradas, boundary). **AI-02E**
- `index.ts`

## 9. Diseño Específico de AI-02A
**AI-02A debe restringirse estrictamente a:**
- Definición en `types.ts` y `ports.ts` de contratos públicos mínimos.
- Definición de `PipelineExecutionContext` y `errors.ts`.
- Tipos de resultados por etapa, IDs de ejecución y adaptadores inyectables.
- Pruebas unitarias de las utilidades (cero motores productivos instanciados).
**Restricción Estricta:** AI-02A NO puede importar o instanciar los motores reales de `enterprise-model/`, NO puede acoplarse a Discovery, NO define valores hardcodeados de targetScenario y NO crea telemetría.

## 10. Estrategia de Pruebas (Por Sprint)
- **AI-02A:** Pruebas a los validadores del OS, generadores deterministas (ID, Clock), y estados válidos/inválidos del contexto base. Cero Firebase.
- **AI-02B:** Pruebas unitarias al `PipelineContextBuilder` asegurando la correcta adaptación y desestructuración hacia contextos de Reasoning y Dossier sin invocar las políticas concretas, simulando Providers con mocks.
- **AI-02C/D (Orchestrator & Resilience):** Orden real de ejecución en Mocks. Manejo de excepciones de constructores y de métodos. Inmutabilidad (cero efectos colaterales). Fallos intencionales (timeouts inyectados o errores de parseo). Idempotencia lógica.
- **Shadow Mode Futuro:** Tests que verifiquen la prevención de reentrada, timeouts estrictos y captura abstracta sin modificar estado productivo real.
- **Regresión Continua:** Las 200 pruebas de `enterprise-model` deben mantenerse en estado PASS permanentemente en cada commit.

## 11. Plan de Sprints

| Sprint | Objetivo y Alcance | Archivos Clave | Archivos Prohibidos | Pruebas | DoD / Criterios |
|---|---|---|---|---|---|
| **AI-02A** | OS Contracts, Ports & Execution State (Estructura base, zero logic domain). | `types.ts`, `ports.ts`, `errors.ts`, `PipelineExecutionContext.ts` | Cualquier orquestador o integration de Discovery, ShadowMode | Unitarias a las utilidades OS | Tipos limpios, sin Firebase, PR aprobado sin dependencias cruzadas. |
| **AI-02B** | Context Builders & Dependency Composition (Map de 10 atributos de estado a contextos de engines). | `PipelineContextBuilder.ts` | Orquestador completo | Validar desestructuración y providers inyectados | 100% inputs construidos válidamente a partir de estado simulado. |
| **AI-02C** | Orchestration Facade (Secuenciación de los motores de dominio de A a H). | `AuraIntelligenceOrchestrator.ts` | ShadowMode, Conversation | Run secuencial E2E con mocks | Orden de ejecución garantizado, excepciones atrapadas pero no enmascaradas globalmente. |
| **AI-02D** | Resilience, Cancellation & Partial Results (Abortion, Timeouts internos). | `AuraIntelligenceOrchestrator.ts`, utilities de resiliencia | Productivo | Propagación controlada de errores y etapas omitidas | Resiliencia pura (ej. si Graph falla, el pipeline aborta graciosamente). |
| **AI-02E** | Shadow Contracts & Execution Guard (Bloqueadores, concurrencia, zero side-effects). | `shadow/types.ts`, `shadow/ShadowExecutionGuard.ts` | Productivo | Evitar race conditions en mocks | Ejecución aislada que trunca ante timeout externo y restringe duplicados. |
| **AI-02F** | Shadow Comparator & Capture Adapter (Lógica de diffs abstractos). | `shadow/ShadowComparator.ts` | Conexión productiva | Diffs deterministas entre output Shadow y Legacy | Módulo capaza de emitir `ShadowComparisonReport`. |
| **AI-02G** | Productive Boundary Adapter (Fire and observe pattern wrapper). | Integración abstracta | Conversation productivo mutante | Mocks de sink | Wrapper seguro que traga errores hacia un logger de forma segura. |
| **AI-02H** | Controlled Shadow Integration (Enlace real en el pipeline Legacy de manera controlada y auditada). | `ConversationOrchestrator.ts` (modificación menor segura) | Lógica de la UI | Integración real asíncrona | El Shadow Orchestrator es invocado pasivamente sin bloquear UI. |
| **AI-02I** | Comparative Validation & Exit Criteria (Período de recolección y análisis de Shadow). | Reportes | Cambios Core | N/A | Logística observacional, recolección de métricas. |

*Nota: PRs por separado para cada sprint. Prohibición estricta de merge sin revisión y regresión verde. Despliegue permitido solo pasivamente desde AI-02H.*

## 12. Criterios de Salida de Shadow Mode
Métricas sugeridas antes de autorizar la adopción productiva:
- Tasa de Ejecución Exitosa y Tasa de Resultados Parciales por falla.
- Latencia total (< umbral por definir) y Latencia por etapa (cuellos de botella).
- Divergencia de Evidencia y Divergencia de Cobertura (cuánta discrepancia vs Legacy).
- Divergencia de Diagnóstico y Determinismo.
- Impacto productivo reportado: debe ser estrictamente cero.

## 13. Recomendación Final
**Decisión:** GO WITH CONDITIONS

La arquitectura anterior (lineal) ha sido desechada. Se autoriza la ejecución del Sprint AI-02A bajo las siguientes condiciones estrictas:
1. El diseño obedece estrictamente el patrón `Facade` + `Context Builder`.
2. Restricción absoluta del Sprint AI-02A únicamente a puertos, tipos, y contexto base. Cero integración.
3. Se protegen todos los valores de dominio sin inyectar generadores silenciosos.
4. Mantenimiento del aislamiento productivo y regresión 200/200.
