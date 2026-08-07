# Preview Containment Activation Authority Composition Certification V1

## Resultado

`PREVIEW CONTAINMENT ACTIVATION AUTHORITY COMPOSITION CERTIFIED — READY TO RETRY CONTROLLED POLICY ACTIVATION`

La composición privada y fail-closed quedó certificada exclusivamente para `aura-intel-preview`, ambiente `PREVIEW`, región `us-central1`. No se activó ninguna policy, no se ejecutó un dry-run cloud de activación y no se expuso transporte callable, HTTP ni Firebase Function.

## Gate

- Rama: `feature/intelligence-preview-containment-activation-authority-r2`.
- HEAD y `origin/main`: `f98b83dc97759de1049219f06ed8b2d634a2ed65`.
- Worktree inicial: limpio y aislado.
- Node: `v20.20.2`.
- npm: `10.8.2`.
- Firebase/GCP: `aura-intel-preview`.
- Production: no autorizada.
- Staging: fuera de alcance.

## Implementación certificada

El verifier resuelve los principals por `testMetadata.authorityProfile` en la colección autoritativa, exige cardinalidad exacta uno, valida esquema cerrado, estado `ACTIVE`, ambiente `PREVIEW`, labels certificados y uso aprobado. Después resuelve una única membership por principal, exige el tenant exacto y una sola capability exacta por rol. El tenant también se valida contra esquema cerrado y fixture sintético certificado.

La composición privada ensambla:

- `PreviewContainmentActivationControlPlaneV1` certificado;
- `FirestorePreviewContainmentActivationAuthorityVerifierV1` productivo;
- `FirestorePreviewContainmentActivationStoreV1` con CAS y auditoría;
- clock de servidor;
- fingerprint, validaciones de target, tenant, policy e idempotencia heredadas del control plane.

La composición no está exportada desde `functions/src/index.ts` ni desde `functions/src/previewDiscoveryIndex.ts`. No pertenece al deployment unit y no crea una superficie invocable.

## Read-back autoritativo

El chequeo productivo read-only devolvió:

| Control | Resultado |
|---|---:|
| Actor elegible | 1 |
| Approver elegible | 1 |
| Pares separados válidos | 1 |
| Actor capability | `containment.policy.activate` |
| Approver capability | `containment.policy.approve` |
| Wildcards | 0 |
| Privilegios globales | 0 |
| Writes | 0 |

Actor y approver tienen identidades, principals y memberships distintos; ambos están ligados al mismo tenant Preview. La decisión del verifier fue `ALLOW`.

## Invariantes fail-closed

Se rechazan project incorrecto, ambiente no Preview, actor o approver ausente/inactivo, membership ausente/inactiva/ambigua, tenant incorrecto, identidades no separadas, capability ausente o cruzada, wildcard, campo de privilegio global, principal ambiguo, selector por email y autoridad indicada desde payload.

El runner de certificación solo llama `inspectAuthority()` y `authorityVerifier.verify()`. No llama `controlPlane.execute()`. Antes y después compara seis colecciones de mutación y exige que permanezcan vacías e idénticas.

## Validación

| Validación | Resultado |
|---|---:|
| Composition unit/architecture | 25/25 PASS |
| Composition guard | 18/18 PASS |
| Authority Provisioning | 25/25 PASS |
| Authority Provisioning adapter | 8/8 PASS |
| Tenant Scope | 66/66 PASS |
| Containment emulator total | 52/52 PASS |
| Containment Control Plane dentro del emulador | 16/16 PASS |
| Containment Control Plane guard | 14/14 PASS |
| Authority Provisioning guard | 17/17 PASS |
| TypeScript noEmit | PASS |
| Functions build | PASS |
| Root build | PASS |
| `git diff --check` | PASS |

## Alcance y detención

No se creó lead, no se abrió navegador, no se desplegó, no se modificó Firebase/GCP, no se tocó Vercel, Production ni Staging. No se hizo commit, push ni PR. La activación controlada futura requiere una autorización separada.
