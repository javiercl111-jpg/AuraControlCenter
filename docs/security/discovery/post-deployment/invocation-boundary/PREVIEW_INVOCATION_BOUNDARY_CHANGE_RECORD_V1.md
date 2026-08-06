# Preview Invocation Boundary Change Record V1

Change ID: `AI-02H1E.8-PREVIEW-INVOCATION-BOUNDARY-20260805-01`

## Cambio autorizado y ejecutado

Se añadió exclusivamente `allUsers` con `roles/run.invoker`, sin condición, a las políticas IAM individuales de:

1. `creatediscoverylead`
2. `exchangediscoverytoken`
3. `resolvediscoverysession`
4. `evaluateconversation`
5. `completediscoverysession`

Proyecto: `aura-intel-preview`. Región: `us-central1`.

No se usó un binding de proyecto, `allAuthenticatedUsers`, un rol amplio, `--allow-unauthenticated` mediante deploy ni la desactivación del Invoker IAM check. La aplicación se realizó después de certificar el manifiesto y la guardia.

## Before / after

| Control | Antes | Después |
|---|---|---|
| Bindings service-scoped esperados | 0/5 | 5/5 |
| Binding por servicio | ninguno | solo `allUsers:roles/run.invoker` |
| Bindings `roles/run.invoker` de proyecto | 0 | 0 |
| Revisiones Cloud Run | cinco `00001` | sin cambio |
| Functions `updateTime` | baseline capturada | sin cambio |
| Runtime identities | exactas | sin cambio |
| Secret resources | exactos | sin cambio |
| App Check en deployment unit | `enforceAppCheck: true` | sin cambio |

## Archivos creados

- `scripts/manifests/preview-invocation-boundary-v1.json`
- `scripts/preview-invocation-boundary-guard.cjs`
- `scripts/tests/preview-invocation-boundary-guard.test.cjs`
- cuatro documentos de evidencia bajo `docs/security/discovery/post-deployment/invocation-boundary/`

## Archivo modificado

- `package.json`: agrega únicamente los comandos de test y guardia del slice.

## Pruebas y validaciones

- 13/13 pruebas de contrato PASS;
- 12/12 negativas requeridas PASS;
- guardia fail-closed PASS;
- JSON del manifiesto y matriz parseables;
- read-back IAM exacto PASS;
- 30 probes autoritativos no mutantes PASS;
- runtime/framework alcanzado PASS;
- App Check/protocolo fail-closed PASS;
- escaneo sanitizado sin PII, JWT, API keys o secretos PASS.

## Incidencias de ejecución

1. El primer cliente `HttpClient` fue bloqueado localmente por transporte: 30 intentos sin request confirmado. Se excluyó de evidencia funcional.
2. El primer uso de payload inline con `curl` en Windows deformó el body y no representó los casos planeados. Solo el preflight 5/5 fue reutilizado.
3. Se repitieron los 25 casos restantes con fixtures temporales no sensibles. El lote definitivo tuvo 0 errores de transporte y los fixtures se eliminaron.

Ninguna incidencia produjo escritura de negocio o cambio cloud adicional.

## Rollback documentado, no ejecutado

Si una revisión posterior lo exige, el rollback consiste en retirar exclusivamente `allUsers` / `roles/run.invoker` de cada uno de los cinco servicios mediante `gcloud run services remove-iam-policy-binding`, con proyecto y región explícitos, seguido de read-back. No se ejecutó rollback en este slice.

## Exclusiones confirmadas

- sin deploy;
- sin nueva revisión;
- sin happy path;
- sin cambio de App Check enforcement;
- sin cambio de secretos o valores secretos leídos;
- sin Firebase Rules;
- sin Vercel;
- sin Storage;
- sin Tasks;
- sin Staging;
- sin Production;
- sin commit;
- sin push;
- sin PR.
