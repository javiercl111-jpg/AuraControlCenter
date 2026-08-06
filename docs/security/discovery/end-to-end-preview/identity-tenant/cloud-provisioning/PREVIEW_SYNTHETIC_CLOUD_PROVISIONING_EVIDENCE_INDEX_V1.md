# Preview Synthetic Cloud Provisioning Evidence Index V1

Change ID: `AI-02H2.2D-PREVIEW-SYNTHETIC-CLOUD-PROVISIONING-20260806-01`

## Evidencia de ejecución

| Control | Evidencia sanitizada |
|---|---|
| Gate | rama exacta; HEAD/origin iguales; worktree inicial limpio |
| Auth before | `CONFIGURATION_NOT_FOUND`; 0 users |
| Auth after | Email/Password enabled; anonymous false; external providers 0; 4 dominios Preview |
| Identidad | locator `ai02h2...y-01`; provider password; active; verified; claims 0 |
| Credential | Secret Manager; 1 versión enabled; payload no leído en evidencia |
| Authority first | `PROVISIONED` / `CREATED` |
| Authority retry | `REUSED` / `REPLAYED` |
| Principal | `princi...a2f6` |
| Tenant | `tenant...c400` |
| Membership | `member...06e3` |
| Capabilities | `[]` |
| Resolver | active; Preview; único; sin cross-tenant/global privilege |
| Auth check | PASS; artefactos de autenticación descartados y no registrados |
| Audit | 1 record; fingerprint `sha256:47f72bbf86...8ae9b303` |
| Post-baseline | 1 identity, 1 principal, 1 tenant, 1 membership, 1 audit, 0 aliases |
| Discovery traffic | 0 links, sessions, capabilities y completions |

## Evidencia de implementación

| Archivo | Propósito |
|---|---|
| `scripts/preview-synthetic-authority-provisioning.cjs` | runner audit/apply fail-closed; output sanitizado |
| `scripts/tests/preview-synthetic-authority-provisioning.test.cjs` | target, Change ID, dominios y locators |
| `functions/src/composition/authorityProvisioning/previewAuthorityProvisioningComposition.ts` | composición privada certificada |
| `functions/src/infrastructure/firestore/authorityProvisioning/FirestoreAuthorityProvisioningAdapter.ts` | transacción y repositories certificados |
| `src/modules/intelligence/serverAuthorityProvisioning/AuthorityProvisioningService.ts` | provisioning, idempotencia y resolver |
| `functions/src/previewDiscoveryIndex.ts` | ausencia de export Authority |

## Pruebas

| Comando | Resultado |
|---|---|
| `npm run test:preview-synthetic-authority-runner` | 8/8 PASS |
| `npm run test:preview-authority-provisioning` | 25/25 PASS |
| `npm run test:preview-authority-provisioning-guard` | 17/17 PASS |
| `npm run guard:preview-authority-provisioning` | PASS |
| `npm run test:preview-authority-provisioning-adapter` | 8/8 PASS |
| Authority Application Service + tenant scope | 395/395 PASS |
| `npm run test:authority-dark-handler-composition` | 81/81 PASS |
| `npm run test:firestore-authority-end-to-end-emulator` | 40/40 PASS |
| `npm run test:preview-runtime-contracts` | 18/18 PASS |
| `npm run test:preview-deployment-unit` | 22/22 PASS |
| `npm run test:firestore-authority-adapter` | 30/30 PASS |
| TypeScript noEmit | PASS |
| Functions build | PASS |
| Root build | PASS |

## Evidencia negativa

- cero Functions Discovery llamadas;
- cero Happy Path;
- cero tokens Discovery;
- cero aliases;
- cero capabilities administrativas;
- cero custom claims;
- cero deploys;
- cero cambios Staging/Production;
- Production `NOT AUTHORIZED`.

Este índice no contiene credenciales, valores secretos, emails completos, UID
completos, IDs de documentos completos, API keys, tokens, PII, URLs firmadas ni
rutas locales absolutas.

