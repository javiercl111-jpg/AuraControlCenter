# Preview CRM Prospect Create Evidence Index V1

## Documentos

1. `PREVIEW_CRM_PROSPECT_CREATE_DIAGNOSIS_V1.md` — causa raíz, claims y remediación mínima.
2. `PREVIEW_CRM_PROSPECT_CREATE_MATRIX_V1.json` — flujo, matriz de roles y clasificación estructurada.
3. `PREVIEW_CRM_PROSPECT_CREATE_EVIDENCE_INDEX_V1.md` — índice de fuentes y comprobaciones.
4. `PREVIEW_CRM_PROSPECT_CREATE_CHANGE_RECORD_V1.md` — registro de acciones y límites.

## Fuentes de source

| Fuente | Evidencia |
| --- | --- |
| `src/App.tsx` | Route `/crm` dentro de `ProtectedRoute` |
| `src/pages/CrmPage.tsx` | `handleCreateLead`, payload UI, mensaje seguro y manejo del error |
| `src/services/platformLeadService.ts` | `addDoc` directo a `platform_leads`, payload y timestamps |
| `firestore.rules` | lectura para global admins activos y mutaciones cliente cerradas con `false` |
| `src/components/ProtectedRoute.tsx` | comparación `roleCode`, documento canónico y refresh de token |
| `src/services/platformAdminService.ts` | resolución del global admin por UID y estado activo |
| `src/services/rbacService.ts` | capacidades reales de cada rol y ausencia de enforcement en el create |
| `src/layouts/AppLayout.tsx` | navegación CRM expuesta sin guard de capability para `VIEWER` |

## Evidencia runtime disponible

- Declaración del operador: login exitoso y CRM renderizado.
- Mensaje UI existente: fallo al crear el prospecto.
- Consola existente: advertencia de sincronización de claims seguida por `permission-denied`.
- Cloud Logging Preview: cero eventos Firestore Data Access `permission-denied` visibles en la ventana consultada.
- Read-back de Rules API: IAM 403; no se elevaron permisos.

La ausencia de un evento en Cloud Logging no contradice la denegación cliente. El flujo no contiene callable y el error del SDK corresponde al boundary de Firestore Rules.

## Validaciones

- `HEAD = origin/main` PASS.
- Worktree limpio antes de crear evidencia PASS.
- Firebase/GCP target Preview PASS.
- Exactamente cuatro documentos R6 PASS.
- Matriz JSON válida PASS.
- Scan de valores sensibles y rutas locales absolutas PASS.
- `git diff --check` PASS.
