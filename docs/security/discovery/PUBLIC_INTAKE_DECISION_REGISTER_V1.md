# Public Intake Decision Register v1

**Estado:** decisiones abiertas; no hay responsables personales designados

**Regla:** los owners/approvers son roles organizacionales. Las fechas se expresan como gates hasta que governance asigne fechas calendario.

## 1. Registro

| ID | Decisión | Opciones | Recomendación baseline | Owner | Aprobador | Fecha objetivo | Bloquea | Impacto si se difiere |
|---|---|---|---|---|---|---|---|---|
| DR-001 | Exposición pública intencional por superficie | Mantener; autenticar; retirar; separar flujo | Mantener solo create/code/capability/session/AI/completion/reporte externo con controles; internos no públicos | Producto Discovery | Producto + Seguridad | Antes de iniciar P2 | Contrato final/P2 | No se puede dimensionar cuota ni aceptar riesgo |
| DR-002 | Comportamiento de commercial code inválido | Error detallado; opaco; challenge/manual | Respuesta opaca uniforme; display name válido solo si Producto confirma necesidad | Producto Commercial | Producto + Seguridad/Privacidad | Antes de cerrar P2 | Anti-enumeración | Enumeración de asesores o fricción comercial |
| DR-003 | Respuesta pública opaca | IDs internos; receipt opaco; sin receipt | Receipt aleatorio opaco; jamás `prospectId`/`resolutionStatus` | Producto Discovery | Seguridad | Antes de P4 | Completion contract | Correlación interna y leakage de estado |
| DR-004 | Retención por tipo/ambiente | 30/90/180 días; configurable; legal hold | Adoptar mínimos propuestos por clase y configurar por ambiente, sujeto a compliance | Privacidad/Compliance | Privacidad/Compliance + Producto | Antes de P3 y P9 | TTL/cleanup/config | Crecimiento, costo y obligaciones no resueltas |
| DR-005 | Cuotas de intake/globales | Valores baseline; más estrictos; más flexibles | Pilotear valores baseline en emulador/load model y aprobar con alertas/hard stop | Producto Growth/Discovery | Producto + Seguridad + Plataforma/SRE | Antes de cerrar P2 | Rate limits | Abuso o falsos positivos/impacto conversión |
| DR-006 | Presupuesto de IA | Por sesión; global; monetario; disable | Combinar 12 llamadas/sesión, cuota global y hard budget diario con fallback | Producto Intelligence | Producto + Seguridad + FinOps/Intelligence | Antes de P5 | IA pública | Gasto no acotado o UX degradada |
| DR-007 | Límites PDF/descarga | Tamaño/veces/TTL variables | 1 artefacto/version, 5 MiB externo, 5 grants/15 min, URL 10 min | Producto Reports | Producto + Seguridad + Plataforma/SRE | Antes de P5 | Report hardening | CPU/Storage/egress no acotados |
| DR-008 | Notification fan-out | 0, 1 o múltiples targets/canales | 1 evento, 1 destinatario, 1 inbox; canales extra requieren evento separado aprobado | Producto Notifications | Producto + Seguridad | Antes de P5 | Fan-out | Spam, duplicados y reputación |
| DR-009 | App Check providers | Web provider(s), enforcement, debug/dev | Provider por ambiente, enforcement estricto y debug tokens prohibidos fuera de dev | Plataforma/SRE | Seguridad | Antes de P9 | Config certification | Attestation bypass o bloqueo legítimo |
| DR-010 | Ambientes y promoción | Dev/stage/prod; proyectos compartidos/separados | Proyectos/policies separados; promoción versionada con evidencia de stage | Plataforma/SRE | Seguridad + Platform leadership role | Antes de P7/P9 | Policy/config | Config cross-environment y rollback inseguro |
| DR-011 | Ownership de kill switches | Backend; SRE; Seguridad; Producto | SRE opera, Seguridad accountable; doble control para reapertura/raise quotas | Seguridad | Security leadership role + Platform leadership role | Antes de P7 | Containment | Respuesta lenta o cambios sin autoridad |
| DR-012 | Incident response | Runbook general; específico Discovery; automático | Runbook Discovery con severity, switches, preservation, communications y recovery | Seguridad/Incident Response | Security leadership role | Antes de cerrar P7 | P8/P9 | Contención y recuperación no repetibles |

## 2. Criterio de resolución

Una decisión solo pasa a `APPROVED` cuando registra opción seleccionada, racional, roles owner/approver, fecha, versión de policy/contrato afectada y evidencia o experimento. Silencio, implementación existente o default de plataforma no cuentan como aprobación.

## 3. RACI de hardening

`R` ejecuta, `A` responde por el resultado, `C` es consultado, `I` es informado. Un rol puede acumular `R/A` cuando governance lo apruebe; aquí se evita asignar personas.

| Actividad | Producto | Seguridad | Backend Discovery | Backend Intelligence/Reports/Notifications | Plataforma/SRE | Privacidad/Compliance | FinOps | Incident Response |
|---|---|---|---|---|---|---|---|---|
| Aprobar superficies/UX opaca | A/R | C | C | I | I | C | I | I |
| Definir threat model y mínimos | C | A/R | C | C | C | C | I | C |
| Implementar rate limits/capabilities/schemas | C | C | A/R | C | C | I | I | I |
| Implementar budgets IA/PDF/notificaciones | A | C | C | R | C | I | C/R | I |
| Configurar maxInstances, concurrency, TTL, App Check | I | C | C | C | A/R | C | C | I |
| Aprobar clasificación/retención | C | C | I | I | C | A/R | I | C |
| Diseñar telemetría/alertas | C | A | C | C | R | C | C | C |
| Operar kill switch/rollback | I | A | C | C | R | I | I | C |
| Certificación P8 | I | A | R | R | R | C | I | C |
| Verificación P9 | I | A | C | C | R | C | C | I |
| Responder incidente | I | A/C | C | C | R | C | I | A/R |
| Autorizar reanudación D.10S | A | A | C | C | C | C | C | I |

## 4. Dependencias entre decisiones

- DR-001–003 fijan el contrato público y preceden P2/P4.
- DR-004 fija TTL/cleanup P3 y la verificación P9.
- DR-005–008 fijan límites productivos de P2/P5.
- DR-009–010 fijan ambientes y configuración P9.
- DR-011–012 fijan contención, rollback e incident gates P7/P8.

## 5. Riesgos abiertos para revisión arquitectónica

- El flujo principal conserva evidencia de una resolución de asesor cliente histórica además de la callable; debe decidirse la ruta canónica en P2/P5.
- Completion mezcla commit, resolución de prospecto, enqueue y shadow orchestration; exactly-once requiere separar outcome de downstream retries.
- Report request puede generar/regenerar, firmar URL y auditar en una sola operación; el budget/lease debe cubrir el costo real.
- La clasificación y retención de conversación/dossier/PDF requieren decisión de compliance antes de activar cleanup productivo.
