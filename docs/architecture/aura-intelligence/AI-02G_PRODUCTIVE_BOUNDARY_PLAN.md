# AI-02G: Governed Execution Boundary Architecture Plan

## 1. Boundary Principles
1. El Boundary nunca ejecuta lógica de negocio.
2. El Boundary nunca conoce Discovery.
3. El Boundary nunca conoce Firebase.
4. El Boundary nunca transforma decisiones del Orchestrator.
5. El Boundary únicamente valida, gobierna, sanitiza y traduce contratos.
6. El Boundary opera fail-closed.
7. DISABLED es el modo predeterminado.
8. PRODUCTIVE siempre se rechaza en AI-02G.
9. Los errores públicos son agnósticos de HTTP.
10. No se restringirán todavía los exports públicos existentes del OS; ese cierre será una migración posterior controlada.

## 2. Verificación Canónica
- **Rama:** `feature/intelligence-os-productive-boundary`
- **HEAD:** `5aa472e7648ffa7eca178945d43d58a7dac81779`
- **origin/main:** `5aa472e7648ffa7eca178945d43d58a7dac81779`

## 3. Clasificación del Barrel Público
El archivo `src/modules/intelligence/os/index.ts` actualmente expone componentes internos.
**Clasificación Final:** Riesgo de encapsulamiento y superficie pública excesiva, con posibilidad de bypass arquitectónico futuro.
*Nota:* La severidad actual es baja debido a la ausencia comprobada de consumidores externos. La restricción de exports no se ejecutará en AI-02G; queda diferida a un sprint posterior controlado tras disponer del Boundary y migrar consumidores.

## 4. Auditoría de Imports y Consumidores
- **Consumidores externos del OS:** 0 coincidencias reales fuera de `src/modules/intelligence/os/`.
- **Imports internos del OS:** Exclusivamente en archivos de prueba (`.test.ts`) del propio directorio OS y archivos adyacentes (`fixtures.ts`).
- **Imports externos apuntando al OS:** 0 coincidencias demostradas.
- **Consumidores productivos (`Discovery`, `ConversationEngine`, `dossier`):** Se encontraron coincidencias comerciales en `market-intelligence`, pero **ninguna** interactúa con el orquestador o la nueva capa del OS.

## 5. Inventario Preciso del OS
| Archivo | Símbolo Exportado | Responsabilidad | Visibilidad Actual | Recomendación | Dependencias Requeridas |
|---|---|---|---|---|---|
| `AuraIntelligenceOrchestrator.ts` | `AuraIntelligenceOrchestrator` | Orquestación principal | Pública (Barrel) | Interno (Futuro) | `osContext`, `dependencies` |
| `PipelineContextBuilder.ts` | `PipelineContextBuilder` | Construcción de contexto | Pública (Barrel) | Interno (Futuro) | `dependencies`, `state` |
| `PipelineExecutionContext.ts` | `PipelineExecutionContext` | Estado de ejecución en memoria | Pública (Barrel) | Interno (Futuro) | N/A |
| `shadow/ShadowExecutionGuard.ts` | `ShadowExecutionGuard` | Control de recurrencia/deduplicación | Pública (Barrel) | Interno (Futuro) | `clock`, `idGenerator`, `auditSink` |
| `shadow/ShadowComparator.ts` | `ShadowComparator` | Comparación determinista | Pública (Barrel) | Interno (Futuro) | N/A |
| `types.ts` | `PipelineInput`, `PipelineResult`... | Contratos de dominio | Pública (Barrel) | Interno (Futuro) | N/A |

- **Punto de Entrada Actual:** `AuraIntelligenceOrchestrator.execute()`
- **Salidas Internas:** `PipelineResult` (Contiene trazas, métricas completas e información no apta para consumidores externos).
- **Estados Prohibidos:** Instancias activas compartidas por referencia.

## 6. Definición del Nombre
- **Nombre Oficial Aprobado:** `GovernedExecutionBoundary` (refleja la gobernanza y control de admisión sin utilizar términos de producción activa).

## 7. Modos y Transiciones
La barrera implementa una máquina de estados controlada (Feature Policy):
- **DISABLED:** El boundary rechaza cualquier solicitud de inmediato (Fail-closed). **MODO PREDETERMINADO.**
- **SHADOW_ONLY:** Acepta, aísla, ejecuta y audita, devolviendo un éxito simulado sin resultados productivos reales ni mutación de estado externo.
- **EVALUATION:** Ejecuta en modo sombra y retorna un reporte comparativo (`comparisonSummary`) para análisis A/B.
- **PRODUCTIVE:** Operación total. (**Obligatoriamente bloqueado / inalcanzable en AI-02G**).

**Transiciones:**
- Solicita: Configuración del consumidor / sistema.
- Autoriza: `FeaturePolicyPort`.
- Transición inválida: Cualquier intento de ejecutar en PRODUCTIVE en AI-02G será rechazado inmediatamente.

## 8. Contratos
**GovernedExecutionRequest**
- `requestId`: string (requerido)
- `correlationId`: string (requerido)
- `tenant`: BoundaryTenantContext (tenantId: string)
- `actor`: BoundaryActorContext (actorId: string, actorType: string, roles?: string[])
- `source`: string (requerido)
- `requestedMode`: BoundaryExecutionMode (DISABLED, SHADOW_ONLY, EVALUATION, PRODUCTIVE)
- `payload`: unknown (requerido)
- `metadata`?: Readonly<Record<string, unknown>>
- `timeoutMs`?: number
- `cancellationSignal`?: AbortSignal

**GovernedExecutionResponse**
- `requestId`: string
- `correlationId`: string
- `mode`: BoundaryExecutionMode
- `status`: BoundaryStatus (REJECTED, ACCEPTED, COMPLETED, PARTIAL, FAILED, CANCELLED, TIMED_OUT)
- `startedAt`: string
- `completedAt`: string
- `durationMs`: number
- `resultSummary`?: Record<string, unknown>
- `comparisonSummary`?: Record<string, unknown>
- `warnings`: BoundaryPublicWarning[]
- `errors`: BoundaryPublicError[]

## 9. Errores Públicos Agnósticos de Transporte
Catálogo oficial agnóstico de HTTP (traducción a códigos HTTP diferida a adaptadores externos futuros):
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

## 10. Matriz de Dependencias
| Componente | Puede depender de | No puede depender de | Entrada / Salida | Side Effects Permitidos | Modos Permitidos |
|---|---|---|---|---|---|
| **GovernedExecutionBoundary** | OrchestratorPort, ShadowGuard, Validator, Sanitizer, FeaturePolicyPort, ClockPort, AuditPort | Consumidores futuros, Firebase, UI, Persistencia directa | GovernedExecutionRequest -> GovernedExecutionResponse | Auditar (sink no bloqueante) | DISABLED, SHADOW_ONLY, EVALUATION |
| **Sanitizers / Validators** | Funciones puras | Módulos productivos, OS state | Raw data -> Sanitized data | Ninguno (Puro) | Todos |
| **Orchestrator** | Builders, Engines, Guards | GovernedExecutionBoundary (Dependencia circular) | PipelineInput -> PipelineResult | Ninguno | SHADOW_ONLY, EVALUATION |

## 11. Modelo de Amenazas
19 amenazas identificadas e integradas en las políticas de validación, fail-closed, sanitización y rechazo explícito de `PRODUCTIVE`.

## 12. Plan de Pruebas
Más de 27 pruebas unitarias proyectadas abarcando validación, modos, fail-closed, sanitización, determinismo y aislamiento de dependencias.

## 13. Implementation Sequence
1. `boundary/types.ts`
2. `boundary/ports.ts`
3. `boundary/errors.ts`
4. `boundary/policies.ts`
5. `boundary/validators.ts`
6. `boundary/sanitizers.ts`
7. `boundary/GovernedExecutionBoundary.ts`
8. `boundary/index.ts`
9. Pruebas unitarias completas bajo `boundary/tests/`.
10. Exportación de `boundary` en `src/modules/intelligence/os/index.ts`.
