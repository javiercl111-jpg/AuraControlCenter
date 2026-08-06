# Preview Synthetic Identity and Tenant Evidence Index V1

## Control

- Change ID: `AI-02H2.2A-PREVIEW-SYNTHETIC-IDENTITY-TENANT-20260806-01`
- Target: `aura-intel-preview` / `us-central1`
- Dictamen: `CONTROLLED PREPARATION REQUIRED — IDENTITY OR TENANT MUST BE CREATED`
- Production: **NOT AUTHORIZED**

## Evidencia

| ID | Evidencia | Fuente | Resultado sanitizado |
|---|---|---|---|
| IT-E01 | Rama, SHA y limpieza | Git read-only | gate local PASS |
| IT-E02 | Alias Firebase | `.firebaserc` | `preview` apunta al target autorizado |
| IT-E03 | Proyecto GCP | gcloud config read-back | target autorizado |
| IT-E04 | Functions | gcloud Functions metadata | 5 `ACTIVE`; 0 no activas |
| IT-E05 | Cloud Run | gcloud Run metadata | 5 `READY` |
| IT-E06 | Cliente Preview | Vercel deployment inspect | proyecto y alias autorizados `READY` |
| IT-E07 | Firebase Auth | Admin Auth list read-only | `CONFIGURATION_NOT_FOUND`; 0 candidatos seleccionables |
| IT-E08 | Principals | proyección `platform_global_admins` | 0 registros |
| IT-E09 | Tenants | proyección `platform_tenants` | 0 registros |
| IT-E10 | Memberships | proyección `tenant_memberships` | 0 registros |
| IT-E11 | Aliases | proyección `tenant_aliases` | 0 registros |
| IT-E12 | Principal Discovery | `functions/src/discovery/runtimeContracts/resolveDiscoveryPrincipalV1.ts` | UID-addressed `platform_global_admins` requerido para Auth opcional |
| IT-E13 | Autoridad cliente | `firestore.rules` | email, claims y payload cliente no otorgan autoridad |
| IT-E14 | Colecciones canónicas | `functions/src/infrastructure/firestore/authorityPersistence/firestoreAuthorityCollections.ts` | tenants y memberships backend-owned |
| IT-E15 | Relación canónica | `src/modules/intelligence/serverAuthorityPersistence/types.ts` | membership liga `principalId` y `tenantId` |
| IT-E16 | Roles mínimos | `src/modules/intelligence/serverComposition/types.ts` | vocabulario contiene `TENANT_MEMBER` |
| IT-E17 | Runtime Authority | `functions/src/composition/authorityDarkHandlerComposition/README.md` | no existe resolver/handler productivo |
| IT-E18 | Política Preview | `docs/security/discovery/production-remediation/environment/ENVIRONMENT_ARCHITECTURE_DECISION_V1.md` | cleanup/expiry diseñado; aprobación pendiente |

## Sanitización aplicada

- No se imprimieron correos, UID, tenant IDs ni document IDs completos.
- No se leyeron valores de secretos, passwords, tokens, API keys ni claims completos.
- Firestore se consultó mediante proyecciones de campos autoritativos no sensibles.
- El inventario vacío no contiene locators que registrar.
- No se incluyen rutas locales absolutas ni salidas crudas.

## Límites

La evidencia prueba ausencia de una combinación certificable y viabilidad contractual de una preparación futura. No prueba un login, una relación live, App Check autenticado ni la ejecución de los cinco handlers. Esas acciones permanecen prohibidas en este slice.
