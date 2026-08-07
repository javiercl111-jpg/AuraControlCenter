# Preview Containment Authority Composition Change Record V1

## Change

- Change ID: `AI-02H2.2E-R1C-R2-PREVIEW-CONTAINMENT-AUTHORITY-COMPOSITION-20260806-01`.
- Slice: `AI-02H2.2E-R1C-R2`.
- Fecha: `2026-08-06`.
- Target único: `aura-intel-preview`.

## Cambios realizados

1. Se agregó un verifier Firestore productivo y fail-closed para las autoridades sintéticas Preview de activación y aprobación.
2. Se agregó una composición privada que ensambla verifier, control plane certificado, store Firestore y clock.
3. Se agregaron 25 pruebas de contrato, rechazo y aislamiento arquitectónico.
4. Se agregó un guard de composición con 18 pruebas negativas/positivas.
5. Se agregó un runner de certificación exclusivamente read-only con invariantes antes/después.
6. Se agregaron scripts npm para test, guard y auditoría read-only.
7. Se creó el paquete documental de certificación.

## Controles preservados

- No se modificó el control plane funcional certificado.
- No se modificó el store Firestore existente.
- No se modificaron entrypoints públicos ni el deployment unit.
- No se añadió callable, HTTP handler ni Firebase Function.
- No se activó policy y no se ejecutó activation dry-run cloud.
- No se modificó infraestructura ni configuración cloud.
- No se tocó Production ni Staging.

## Validación y read-back

Todas las suites obligatorias pasaron. El chequeo productivo read-only confirmó un actor elegible, un approver elegible y un único par separado válido. Las seis colecciones sensibles permanecieron vacías e idénticas antes/después; writes igual a cero.

## Estado de entrega

- Dictamen: `PREVIEW CONTAINMENT ACTIVATION AUTHORITY COMPOSITION CERTIFIED — READY TO RETRY CONTROLLED POLICY ACTIVATION`.
- Commit: no realizado.
- Push: no realizado.
- PR: no creada.
- Deploy: no ejecutado.
- Próxima acción: revisión humana y autorización separada antes de cualquier policy activation.
