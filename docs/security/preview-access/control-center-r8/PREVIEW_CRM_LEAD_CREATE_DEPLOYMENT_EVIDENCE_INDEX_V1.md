# PREVIEW CRM Lead Create Deployment Evidence Index V1

| ID | Evidencia sanitizada | Resultado |
|---|---|---|
| R8-E01 | Gate de path, branch, base, status y Node | PASS |
| R8-E02 | Firebase/GCP active project | Ambos `aura-intel-preview` |
| R8-E03 | Inventario source R7 en main | Callable, export, frontend, enforcement, idempotencia, audit y guard presentes |
| R8-E04 | Auditoría de authority | Grant canónico Firestore es el source of truth; claims/roles no sustituyen capability |
| R8-E05 | Locator externo | Loaded y longitud mayor que cero; valor no registrado |
| R8-E06 | Baseline authority read-only | Principal activo, `VIEWER`, capability `ABSENT` |
| R8-E07 | Dry-run real de capability | `WOULD_CREATE`, adicionales `0`, writes `0` |
| R8-E08 | Read-back posterior al dry-run | Grant continúa `MISSING`; `VIEWER` preservado |
| R8-E09 | Inventario Functions v2 | Cinco existentes `ACTIVE`; `createCrmLead` no desplegada |
| R8-E10 | Inventario IAM sanitizado | Identidad dedicada ausente; roles mínimos equivalentes identificados |
| R8-E11 | Firebase CLI deploy help | Filtro codebase/function soportado |
| R8-E12 | Guard compilado de deploy selectivo | PASS; un solo target Preview |
| R8-E13 | Vercel read-back sanitizado | Proyecto Preview `READY`, main coincide con commit base y merge #125 |
| R8-E14 | R7 backend/frontend | 35/35 PASS |
| R8-E15 | Provisioner y deployment guard R8 | 27/27 PASS |
| R8-E16 | Rules guards | 19/19 PASS |
| R8-E17 | Deployment unit y runtime contracts | 40/40 PASS |
| R8-E18 | TypeScript noEmit y Functions build | PASS |
| R8-E19 | Scope/hygiene | Sin `functions/lib`, junctions, credentials ni archivos temporales |
| R8-E20 | Evidencia | Cuatro documentos exactos, JSON válido y `git diff --check` PASS |

No se conservaron respuestas crudas de proveedores, identificadores personales, locators completos, valores de credenciales ni deployment IDs.
