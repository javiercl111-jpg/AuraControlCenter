# Preview Global Admin Provisioning Evidence Index V1

## Evidencia creada

1. `PREVIEW_GLOBAL_ADMIN_PROVISIONING_CERTIFICATION_V1.md` — dictamen, alcance, rol mínimo, contrato, idempotencia, auditoría y validación.
2. `PREVIEW_GLOBAL_ADMIN_PROVISIONING_MATRIX_V1.json` — matriz estructurada de roles, controles, resultados y estado de ejecución.
3. `PREVIEW_GLOBAL_ADMIN_PROVISIONING_EVIDENCE_INDEX_V1.md` — índice de fuentes y evidencia.
4. `PREVIEW_GLOBAL_ADMIN_PROVISIONING_CHANGE_RECORD_V1.md` — registro exacto de cambios y límites operativos.

## Fuentes de autoridad

| Fuente | Evidencia |
| --- | --- |
| `firestore.rules` | Resolver canónico por UID, `isActive == true`, allowlist productivo y denegación de mutaciones desde cliente |
| `src/services/rbacService.ts` | Comparación de capacidades para `VIEWER`, `SUPPORT`, `ADMIN` y `SUPER_ADMIN` |
| `src/types/platformAdmin.ts` | Tipo productivo de rol y campos del perfil administrativo |
| `scripts/preview-global-admin-provisioning.cjs` | Contrato V1, target guard, idempotencia, write model, auditoría, dry-run y CLI controlada |
| `scripts/tests/preview-global-admin-provisioning.test.cjs` | Suite R3 de 20 casos |
| `scripts/tests/preview-firestore-rules-guard.test.cjs` | Guard existente del contrato de reglas Preview |
| `package.json` | Entradas nominales de test y dry-run |

## Comandos de validación ejecutados

- `npm run test:preview-global-admin-provisioning` — PASS, 20/20.
- `npm run test:preview-rules-guard` — PASS, 15/15.
- `node --check scripts/preview-global-admin-provisioning.cjs` — PASS.
- `npx tsc -p tsconfig.app.json --noEmit --pretty false` — PASS.
- `npm run build` — PASS, 2,134 módulos transformados.
- Validación de parseo de la matriz JSON — PASS.
- Conteo del directorio R3 — PASS, exactamente cuatro documentos.
- Scan de valores sensibles y rutas locales absolutas — PASS.
- `git diff --check` — PASS.

## Límites de la evidencia

No se ejecutó un dry-run contra Firebase ni un apply. No hubo login, deploy, commit, push o PR. No se consultó ni modificó Production o Staging. El Auth read-back heredado continúa fuera del alcance de esta certificación por la restricción IAM ya documentada en R2; el mecanismo R3 opera con un UID explícito y no enumera usuarios.
