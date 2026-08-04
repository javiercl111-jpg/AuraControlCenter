# Non-Production Targeting and Alias Guards v1

**Slice:** AI-02H1E.5.R2A

**Estado:** diseño; `.firebaserc`, scripts y workflows permanecen intactos

## 1. Riesgo actual

`.firebaserc` contiene únicamente `default` → `aura-control-center-debb3`, y `functions/package.json` expone un deploy sin `--project`. Esta combinación es `UNSAFE`: un comando implícito puede apuntar a Production. Ninguna wave puede usar estos paths hasta que un slice de implementación instale y pruebe los guards.

## 2. Mapping objetivo

El target conceptual de `.firebaserc` es:

```json
{
  "projects": {
    "preview": "aura-intel-preview",
    "staging": "aura-intel-staging",
    "production": "aura-control-center-debb3"
  },
  "targets": {},
  "etags": {}
}
```

No existe alias `default`. Un alias ayuda a legibilidad, pero no es autoridad suficiente: todo write también lleva `--project=<EXACT_PROJECT_ID>` y pasa el guard.

## 3. Manifest de targeting

Cada ejecución recibe un manifest inmutable y versionado:

| Campo | Regla |
|---|---|
| `schemaVersion` | Versión allowlisted del guard |
| `environment` | `preview` o `staging`; `production` se rechaza mientras exista hold |
| `alias` | Coincidencia exacta con environment |
| `projectId` | Preview `aura-intel-preview`; Staging `aura-intel-staging` |
| `gitRef` / `commit` | Ref autorizada y commit certificado, sin dirty worktree |
| `actorRole` | Código de rol aprobado; nunca email o identidad personal en Git |
| `artifactDigest` | SHA-256 del artifact/config construido una vez |
| `changeId` | ID aprobado, no placeholder |
| `approvalReceipt` | Hash/referencia restringida, approver distinto del implementer |
| `productionHold` | Debe ser `true`; cualquier intento Production falla |
| `expiresAt` | Ventana UTC no expirada |

## 4. Matriz branch/ref–environment

| Fuente | Preview | Staging | Production |
|---|---|---|---|
| PR/ref allowlisted + GitHub environment `preview` | Permitido tras aprobación Preview | Deny | Deny |
| `refs/heads/main` + GitHub environment `staging` | Read-only o deny según manifest | Permitido tras evidencia Preview y aprobación Staging | Deny |
| Release tag + environment `production` | Deny | Deny | Deny mientras `REMEDIATION_HOLD` esté activo |
| Audit/test/docs branch | Emulator/local únicamente | Deny | Deny |
| Ref desconocida, detached no certificado o worktree dirty | Deny | Deny | Deny |

La branch exacta de implementación debe registrarse en el Change Record; R2A no la inventa ni la autoriza.

## 5. Algoritmo fail-closed

Antes de invocar Firebase/gcloud, el guard:

1. carga el manifest desde un path repository-relative allowlisted;
2. valida schema, expiración y ausencia de placeholders;
3. obtiene branch/ref y commit; exige worktree limpio;
4. resuelve alias local y compara alias ↔ projectId ↔ environment;
5. exige project ID explícito y rechaza `default`, cadena vacía o proyecto no allowlisted;
6. verifica actor role, WIF subject/claims, Change ID y aprobación independiente;
7. recalcula digest del artifact/config y compara en tiempo constante;
8. confirma que Production hold sigue activo;
9. emite un resumen sanitizado y sólo entonces construye el comando exacto.

El guard no ejecuta fallback, no pregunta interactivamente por otro proyecto y no acepta una variable de entorno como única autoridad.

## 6. Condiciones de fallo antes de write

- alias `default`, ausente, duplicado o ambiguo;
- `projectId` diferente al mapping exacto;
- branch/ref no allowlisted para el environment;
- actor sin WIF/rol aprobado o actor igual al único approver;
- environment del artifact/config distinto al target;
- digest ausente, no SHA-256 o distinto;
- Change ID/approval vacío, no aprobado o expirado;
- worktree dirty o commit diferente al certificado;
- cualquier referencia a `aura-control-center-debb3` durante R2B/non-production;
- Production hold ausente, falso o ilegible.

## 7. Comandos objetivo

Sólo después del guard se permiten formas explícitas como:

```text
firebase deploy --only firestore:rules --project=aura-intel-preview
firebase deploy --only firestore:indexes --project=aura-intel-preview
gcloud firestore fields ttls list --project=aura-intel-preview
```

Staging sustituye únicamente el project ID tras una nueva aprobación. `firebase use`, `firebase deploy` sin proyecto, scripts package sin argumentos y comandos que dependan del alias activo están prohibidos.

## 8. Artifact build once

- Build local/CI una sola vez desde commit certificado.
- Bundle, Rules, indexes, TTL manifests y guard manifest reciben hashes separados y un aggregate digest.
- Preview recibe ese digest.
- Staging recibe exactamente el mismo digest; sólo cambia configuración externa aprobada y project target.
- Una reconstrucción exige reiniciar certificación y aprobación.

## 9. Pruebas del guard

| Test | Esperado |
|---|---|
| Preview manifest correcto | PASS sin ejecutar write en test |
| Preview alias con project Staging | DENY |
| Alias `default` | DENY |
| Project Production desde cualquier branch | DENY |
| Main intenta Preview sin manifest | DENY |
| PR intenta Staging | DENY |
| Actor claim/repository/ref/environment alterado | DENY |
| Digest alterado | DENY |
| Change ID o approval expirado | DENY |
| Worktree dirty | DENY |
| Production hold ilegible | DENY |

Las pruebas usan stubs y proyectos `demo-*`; nunca invocan un API externo.

## 10. Rollback

Rollback de alias/guard significa congelar writes, restaurar la última versión de guard más restrictiva y volver a validar mappings. Nunca se restaura `default`, un deploy implícito o una excepción Production. Si el guard bloquea un rollout válido, el rollout se pausa; no se omite el guard.
