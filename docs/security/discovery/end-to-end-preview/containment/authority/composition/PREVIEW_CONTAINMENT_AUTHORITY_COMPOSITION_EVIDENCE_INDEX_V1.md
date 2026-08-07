# Preview Containment Authority Composition Evidence Index V1

## Identificación

- Slice: `AI-02H2.2E-R1C-R2`.
- Change ID: `AI-02H2.2E-R1C-R2-PREVIEW-CONTAINMENT-AUTHORITY-COMPOSITION-20260806-01`.
- Target: `aura-intel-preview` / `PREVIEW` / `us-central1`.
- Base certificada: `f98b83dc97759de1049219f06ed8b2d634a2ed65`.

## Evidencia de código

| Evidencia | Propósito |
|---|---|
| `functions/src/infrastructure/firestore/discoveryContainment/FirestorePreviewContainmentActivationAuthorityVerifierV1.ts` | Resolver autoritativo, esquema cerrado, cardinalidad, tenant, capability y separación. |
| `functions/src/composition/previewContainmentActivation/PreviewContainmentActivationCompositionV1.ts` | Composición privada del verifier, control plane, store y clock. |
| `functions/tests/previewContainmentAuthorityComposition.test.ts` | 25 casos positivos, negativos y arquitectónicos. |
| `scripts/preview-containment-authority-composition-guard.cjs` | Guard estático de target, privacidad y modo read-only. |
| `scripts/preview-containment-authority-composition-check.cjs` | Read-back productivo sin activación ni escrituras. |

## Evidencia cloud sanitizada

| Recurso | Locator sanitizado | Estado |
|---|---|---|
| Actor identity | `sha256:15ed1deca90f` | ACTIVE / PREVIEW |
| Actor principal | `sha256:fac856cdd956` | capability exacta |
| Actor membership | `sha256:59c2d69034eb` | tenant exacto |
| Approver identity | `sha256:ba028eff7130` | ACTIVE / PREVIEW |
| Approver principal | `sha256:1c0f531b60a1` | capability exacta |
| Approver membership | `sha256:29feb57d5516` | tenant exacto |
| Tenant | `sha256:25af9bcb00c4` | ACTIVE / PREVIEW / SYNTHETIC_TEST |

Los locators son hashes truncados unidireccionales. No se registran UIDs, document IDs, emails, credenciales ni tokens completos.

## Evidencia de ejecución

- Read-only composition check: `ALLOW`, actor 1, approver 1, par separado 1.
- Colecciones comparadas antes/después: 6.
- Writes detectados: 0.
- Policies, pointers, containment audits, leads, sessions y completions: 0.
- Tests: 25/25, 18/18, 25/25, 8/8, 66/66, 52/52, 14/14 y 17/17 PASS.
- TypeScript noEmit, Functions build, root build y diff check: PASS.

## Exclusiones verificadas

- Cero policy activation.
- Cero activation dry-run cloud.
- Cero callable/HTTP/Firebase Function.
- Cero export en entrypoints o deployment unit.
- Cero deploy, commit, push o PR.
- Production y Staging sin cambios.
