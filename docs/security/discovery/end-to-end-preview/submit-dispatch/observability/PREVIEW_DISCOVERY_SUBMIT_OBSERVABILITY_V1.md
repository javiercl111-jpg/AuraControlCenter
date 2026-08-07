# Preview Discovery Submit Observability V1

Change ID: `AI-02H2.2E-R3B-PREVIEW-DISCOVERY-SUBMIT-OBSERVABILITY-20260807-01`

## Dictamen

PREVIEW SUBMIT OBSERVABILITY CERTIFIED — READY FOR ONE CONTROLLED DIAGNOSTIC SUBMIT

## Alcance certificado

La instrumentación reconstruye la última frontera alcanzada en el submit público de Discovery:

`CLICK → NATIVE SUBMIT → REACT HANDLER → VALIDATION → CLIENT PRECONDITION / APP CHECK → SERVICE DISPATCH → NETWORK DISPATCH`

Este cambio no ejecutó un submit controlado, no invocó el callable real, no desplegó artefactos y no modificó Production, Staging, Containment, Authority, IAM, Secret Manager ni Rules.

## Decisión de diseño

La búsqueda de reutilización encontró telemetría estructurada en el servidor, pero no un emisor cliente compatible que pudiera usarse sin añadir persistencia o tráfico de red. Se reutilizó su forma segura —código, resultado, tiempo, duración y código de error acotado— en un observador local con salida a consola. No hay transporte, almacenamiento, cola, retry ni segunda llamada de servicio.

El observador se habilita exclusivamente cuando el selector certificado de runtime es exactamente `PREVIEW`. Cualquier valor ausente, desconocido, Production o Staging deshabilita la salida. No se usa hostname para decidir la activación.

## Contrato de evento

Campos permitidos:

- `schemaVersion`
- `sequence`
- `stage`
- `outcome`
- `timestamp`
- `safeErrorCode`, cuando aplica
- `durationMs`, cuando aplica

No se acepta ni se propaga payload, respuesta de formulario, texto libre, PII, credenciales, secretos o identificadores sensibles. Los códigos de error que no cumplen el alfabeto acotado se sustituyen por `UNCLASSIFIED_CLIENT_FAILURE`.

## Fronteras observables

| Frontera | Evidencia diagnóstica |
| --- | --- |
| Click sin submit nativo | `DISCOVERY_SUBMIT_CLICK_OBSERVED` sin evento nativo posterior |
| Submit nativo sin handler React | `DISCOVERY_NATIVE_SUBMIT_OBSERVED` sin entrada del handler |
| Rechazo de validación | `DISCOVERY_VALIDATION_REJECTED` |
| Precondición aceptada | `DISCOVERY_APP_CHECK_READY` y `DISCOVERY_CLIENT_PRECONDITION_ACCEPTED` |
| Bloqueo App Check/cliente | `DISCOVERY_APP_CHECK_REJECTED` o `DISCOVERY_CLIENT_PRECONDITION_REJECTED` seguido de fallo pre-network |
| Inicio del servicio | `DISCOVERY_SERVICE_DISPATCH_STARTED` |
| Fallo antes de red | `DISCOVERY_SERVICE_DISPATCH_FAILED_PRE_NETWORK` |
| Dispatch de red | `DISCOVERY_NETWORK_DISPATCH_OBSERVED` con resultado seguro |

## Invariantes funcionales

La instrumentación no altera validación HTML o React, `preventDefault`, propagación, estado disabled/loading, payload, inicialización App Check, nombre o configuración del callable, reintentos, timeout, navegación, semántica de error ni cardinalidad. El error original se vuelve a lanzar sin envoltura ni conversión a éxito.

## Validación ejecutada

- Suite específica: 3 archivos, 16 pruebas, todas aprobadas.
- Configuración cliente Preview/Production: 4 archivos, 47 pruebas, todas aprobadas.
- Guard de enablement Preview: 23 pruebas aprobadas.
- Guard de frontera de invocación: 13 pruebas aprobadas.
- Guard de parámetros Preview: 15 pruebas aprobadas.
- TypeScript project-build con `noEmit`: aprobado.
- Build raíz Production local: aprobado; 2,134 módulos transformados.
- Build raíz Preview local: aprobado; 2,134 módulos transformados.
- Build Functions: no ejecutado; el inventario del diff no afecta `functions/` ni paquetes compartidos con Functions.
- `git diff --check`: aprobado.

El build Preview contiene los 12 códigos diagnósticos esperados. El audit del bundle encontró cero marcadores sintéticos de prueba y cero patrones de clave privada o secreto. El diff no introduce hosts ni configuración Firebase de Production. El árbol de market intelligence y la configuración certificada de Firebase Production permanecen sin cambios.

## Límite de esta certificación

La certificación autoriza únicamente la revisión del cambio y, en un slice posterior separado, un único submit diagnóstico controlado en Preview. Este slice se detuvo antes de cualquier interacción de navegador o invocación real.

## Retiro temporal

Después de que el único intento controlado identifique la última frontera alcanzada y se cierre la causa raíz, deben retirarse el observador, sus hooks de UI/servicio y el script específico. La evidencia histórica puede conservarse sin datos de ejecución sensibles.
