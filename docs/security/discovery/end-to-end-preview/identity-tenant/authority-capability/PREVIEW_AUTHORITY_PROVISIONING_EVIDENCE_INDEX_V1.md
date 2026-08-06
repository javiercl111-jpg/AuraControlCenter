# Preview Authority Provisioning Evidence Index V1

Change ID: `AI-02H2.2C-PREVIEW-AUTHORITY-PROVISIONING-CAPABILITY-20260806-01`

## Evidencia de implementación

| Evidencia | Ubicación | Control |
|---|---|---|
| Modelo, request/response y retención | `src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningTypes.ts` | schemas versionados; PREVIEW; allowlist cerrada |
| Safe errors | `src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningErrors.ts` | errores no sensibles y fail-closed |
| Puertos | `src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningPorts.ts` | repositorios, clock, IDs, fingerprint, transaction |
| Validadores | `src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningValidators.ts` | campos cerrados y rechazo de entornos/referencias |
| Servicio y resolver | `src/modules/intelligence/serverAuthorityProvisioning/AuthorityProvisioningService.ts` | idempotencia, atomicidad, resolución y cross-tenant |
| Factory/export server | `src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningFactories.ts` y `src/modules/intelligence/server.ts` | consumo server-only autorizado |
| Adapter Admin SDK | `functions/src/infrastructure/firestore/authorityProvisioning/FirestoreAuthorityProvisioningAdapter.ts` | colecciones exactas y transacción |
| Composición privada | `functions/src/composition/authorityProvisioning/previewAuthorityProvisioningComposition.ts` | SHA-256; sin transport público |
| Entry point público | `functions/src/previewDiscoveryIndex.ts` | ausencia de export Authority |
| Guard | `scripts/preview-authority-provisioning-guard.cjs` | inventario fail-closed |

## Evidencia de pruebas

| Comando | Resultado |
|---|---|
| `npm run test:preview-authority-provisioning` | 25/25 PASS |
| `npm run test:preview-authority-provisioning-guard` | 17/17 PASS |
| `npm run guard:preview-authority-provisioning` | PASS |
| `npm run test:preview-authority-provisioning-adapter` | 8/8 PASS |
| `npm run test:intelligence-os:architecture` | 17/17 PASS |
| `npx vitest run src/modules/intelligence/serverAuthorityApplicationService src/modules/intelligence/serverTenantScopeResolution` | 395/395 PASS |
| `npm run test:authority-dark-handler-composition` | 81/81 PASS |
| `npm run test:firestore-authority-end-to-end-emulator` | 40/40 PASS; local emulator |
| `npm run test:preview-runtime-contracts` | 18/18 PASS |
| `npm run test:preview-deployment-unit` | 22/22 PASS |
| `npm run test:firestore-authority-adapter` | 30/30 PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build --prefix functions` | PASS |
| `npm run build` | PASS |

## Evidencia negativa

- cero Firebase Auth identities creadas;
- cero principal, tenant, membership o alias creado;
- cero invocaciones Functions y cero Happy Path;
- cero deploys y cero modificaciones cloud;
- composición ausente del deployment unit público;
- cero email/claims como autoridad;
- cero capabilities administrativas;
- Production `NOT AUTHORIZED`; Staging fuera de alcance.

No se registran secretos, tokens, credenciales, correos, UID reales ni rutas
absolutas.
