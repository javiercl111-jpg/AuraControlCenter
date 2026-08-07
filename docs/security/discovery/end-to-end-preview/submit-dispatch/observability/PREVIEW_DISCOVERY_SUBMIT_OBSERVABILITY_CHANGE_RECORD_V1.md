# Preview Discovery Submit Observability — Change Record V1

Change ID: `AI-02H2.2E-R3B-PREVIEW-DISCOVERY-SUBMIT-OBSERVABILITY-20260807-01`

## Motivo

El intento anterior observó un click, pero no pudo distinguir si la detención ocurrió antes del submit nativo, del handler React, de validación, de App Check, del servicio o de la red. Este cambio añade sólo la visibilidad necesaria para separar esas fronteras en un futuro intento único y controlado.

## Cambios

- Se añadió un contrato de diagnóstico estructurado, inmutable, sanitizado y local.
- Se exportó el ambiente ya resuelto por el bootstrap certificado; no se añadió inferencia por hostname.
- Se observaron click y submit nativo por separado.
- Se observaron entrada al handler, aceptación/rechazo de validación y disponibilidad de App Check.
- Se añadió un observador opcional al servicio para registrar precondición, dispatch y frontera de red.
- Se preserva y relanza el error original.
- Se añadieron pruebas de integración cliente, cardinalidad, privacidad y fail-closed.
- Se añadió `jsdom` sólo como dependencia de desarrollo para la prueba DOM local.

## Reutilización

La telemetría persistente existente es de servidor. Conectarla al formulario habría añadido red o escritura y violado el requisito de cero cambio funcional. Se reutilizó la forma segura de evento; el sink temporal es consola local y no persiste ni transmite.

## Riesgo y contención

El observador está deshabilitado salvo que el selector certificado sea exactamente `PREVIEW`. La API pública del servicio sólo recibió un argumento opcional. No se añadió retry, fallback, timeout, navegación ni dispatch. La prueba de happy path confirma cardinalidad uno; los casos inválido y precondición confirman cero red cuando corresponde.

## Regresión

Los tests de bootstrap Preview/Production y los guards relevantes aprobaron. Production y Preview construyeron localmente. No hay cambios en market intelligence, configuración certificada Production, Functions, Containment, Authority, IAM, secretos o reglas.

## Acciones no realizadas

No se abrió navegador, no se pulsó el botón, no se ejecutó un submit real, no se invocó el callable real, no se desplegó, no se hizo commit, push ni PR.

## Retiro

Tras el único intento diagnóstico autorizado en un slice posterior y la identificación de causa raíz, retirar los hooks del formulario/servicio y el módulo temporal. Conservar únicamente evidencia sanitizada necesaria para auditoría.
