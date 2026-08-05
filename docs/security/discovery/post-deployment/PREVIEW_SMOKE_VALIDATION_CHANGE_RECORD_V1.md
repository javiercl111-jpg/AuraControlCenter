# Preview Smoke Validation Change Record V1

Change ID: `AI-02H1E.7-PREVIEW-SMOKE-VALIDATION-20260805-01`

## Naturaleza del cambio

Este slice es una auditoría post-deployment. El único cambio local es documentación de evidencia. No se modificó código o infraestructura.

## Actividad ejecutada

1. Se verificó el gate exacto de rama, base, limpieza, target y Node.
2. Se leyó el estado de cinco Functions y cinco servicios Cloud Run.
3. Se verificaron runtime identities, Secret Manager e IAM sin leer secretos.
4. Se verificó la cleanup policy de Artifact Registry.
5. Se inventariaron superficies Storage y Tasks.
6. Se enviaron 20 probes no mutantes a las cinco callables.
7. Se verificó IAM invoker y se clasificó el rechazo como Cloud Run IAM.
8. Se analizaron logs de forma sanitaria y sin conservar payloads.
9. Se inspeccionaron exports y referencias de aislamiento del código desplegable.
10. Se comprobó la disponibilidad del cliente Preview para App Check.

## Hallazgos

### SMOKE-001 — Cloud Run invoker ausente

- Severidad: blocking.
- Afecta cinco de cinco servicios.
- Binding `roles/run.invoker`: cero.
- Impacto: ningún request callable alcanza Functions Framework, App Check o handler.
- Cambio realizado: ninguno.

### SMOKE-002 — URL Production en intake Preview

- Severidad: blocking para aislamiento.
- Referencias: dos ramas de respuesta de `createDiscoveryLead`.
- Impacto: una respuesta Preview válida dirigiría al dominio Production.
- Cambio realizado: ninguno.

### SMOKE-003 — Cliente Preview no inicializa Firebase

- Severidad: alta para smoke end-to-end.
- Impacto: no existe flujo cliente publicado utilizable para obtener attestation y ejecutar el recorrido gobernado.
- Cambio realizado: ninguno.

### SMOKE-004 — Telemetría runtime no certificable

- Severidad: consecuencia de SMOKE-001.
- Impacto: cero eventos live de correlation, duration, safe error o measurements observables en 24 horas.
- Cambio realizado: ninguno.

## Estado final

- Functions: 5 `ACTIVE`; 0 `FAILED`.
- Cloud Run: 5 `READY`; 0 invocables públicamente.
- Secretos e IAM: intactos.
- Artifact cleanup: activa.
- Deploy adicional: no.
- Cambios cloud: no.
- Staging y Production: sin cambios.
- Dictamen: `BLOCKED — PREVIEW VALIDATION FAILED`.

## Próximo slice requerido

Remediación separada y aprobada de invoker IAM, aislamiento de URL Preview y configuración del cliente Preview; después, repetir el smoke con fixture gobernado y lifecycle de datos de prueba.

No se creó commit, push o PR.
