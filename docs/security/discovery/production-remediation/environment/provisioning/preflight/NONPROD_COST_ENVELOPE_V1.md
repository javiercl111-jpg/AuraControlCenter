# Non-Production Cost Envelope v1

**Slice:** AI-02H1E.5.R1C-A

**Estado:** estimación conservadora no contractual; no se consultó spend, prices ni provider usage

## 1. Principios

- Currency: USD por mes.
- Un budget genera señales; no detiene automáticamente consumo.
- El control efectivo combina quotas técnicas, queues pausadas, Functions mínimas, providers OFF y kill switches.
- Los números son ceilings preventivos iniciales, no forecast ni compromiso contractual.
- Billing Account, cost centers y notification routing permanecen pendientes de aprobación.

## 2. Envelope consolidado

| Componente | Gasto estimado inicial | Budget de planificación | Alertas iniciales | Cuota/containment técnico | Límite preventivo asignado |
|---|---:|---:|---|---|---:|
| Preview | USD 0–5 | USD 10 | USD 5 y 10 | Functions min 0/max 1/concurrency 1; queue paused 1/s/1; Gemini/notifications OFF | USD 10 |
| Staging | USD 0–10 | USD 20 | USD 10 y 20 | Mismos mínimos; providers sólo durante pruebas aprobadas; queue paused | USD 20 |
| Production inicial | Incremental USD 0–25 durante remediation hold; baseline existente desconocida | USD 100 | USD 25, 50, 75 y 100 | Sin nueva habilitación; costly quotas 0; queue paused; no nuevo deployment | USD 100 |
| Gemini reserve | USD 0 mientras quota=0; hasta USD 5 tras aprobación | Sub-envelope USD 5 | USD 3 y 5 propuestos | Quota 0 por default; per-request/token bounds; kill switch | USD 5 |
| Vercel reserve | Incremental USD 0–5 | Sub-envelope USD 5 | USD 3 y 5 si el plan/provider lo soporta | Separate Preview/Staging projects; build/deploy policy; no costly audit branches | USD 5 |
| Contingency | USD 0 hasta incidente aprobado | Reserve USD 10 | Review manual al consumir cualquier parte | Sólo mediante Incident Commander + FinOps/Product approval | USD 10 |
| **Total preventivo** | No sumar como forecast | **USD 150 ceiling** | Routing multi-threshold | Containment por superficie | **USD 150** |

Gemini puede facturarse dentro de GCP o por provider separado según la decisión futura. FinOps debe evitar doble contabilización: el sub-envelope de USD 5 es una reserva dentro del ceiling consolidado, no permiso adicional por encima de USD 150.

## 3. Distinción de controles

| Término | Definición en R1C |
|---|---|
| Gasto estimado | Rango de planificación sin uso real ni price quote |
| Budget | Amount configurado para seguimiento/alertas; no hard cap |
| Alerta | Threshold absoluto o porcentual que requiere routing y runbook |
| Cuota técnica | Límite de runtime/provider que contiene consumo o fan-out |
| Límite preventivo | Máximo de gobernanza propuesto; al alcanzarlo se detienen nuevas actividades y se revisa |

## 4. Threshold model

Si la plataforma exige percentages, los amounts absolutos se traducen dentro del budget aprobado:

- Preview USD 10: 50% y 100%.
- Staging USD 20: 50% y 100%.
- Production USD 100: 25%, 50%, 75% y 100%.
- Forecast alert: 75% del budget cuando el proveedor lo soporte.

Los provider alerts para Gemini/Vercel se configuran con sus capacidades efectivas; si no existe hard cap, la compensación es provider quota/switch OFF y revisión diaria durante la ventana.

## 5. Response policy

| Event | Respuesta mínima |
|---|---|
| Primer threshold | FinOps/owner revisa attribution y confirma actividad esperada |
| Segundo/75% | Congelar nuevos tests/deployments; costly surfaces OFF salvo aprobación |
| 100% o anomalía | Incident Commander, queue pause, quotas 0, provider disable/containment y cost investigation |
| USD 150 consolidado proyectado/alcanzado | Detener provisioning/enablement adicional y requerir nuevo Product + FinOps approval |

## 6. Evidence required before configuration

- Billing Account seleccionada y cost-center por environment.
- Budget amounts/thresholds aprobados.
- Notification channel y owner role sin almacenar contactos en Git.
- Provider quota and kill-switch read-back.
- Cost attribution labels.
- Test de routing en non-production.

Este documento no crea budgets, alerts, quotas ni spend caps.
