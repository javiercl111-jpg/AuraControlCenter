# Preview Smoke Validation Evidence Index V1

Change ID: `AI-02H1E.7-PREVIEW-SMOKE-VALIDATION-20260805-01`

| Evidencia | Fuente | Resultado |
|---|---|---|
| Gate Git y runtime | comandos locales read-only | PASS |
| Target Firebase/GCP | configuración activa read-only | `aura-intel-preview` |
| Function state | Cloud Functions v2 read-back | 5/5 `ACTIVE` |
| Cloud Run readiness | Cloud Run read-back | 5/5 `READY` |
| Runtime identities | Function/Run metadata | 5/5 exactas |
| Secret versions e IAM | Secret Manager metadata | 3 recursos intactos; bindings exactos |
| Cleanup policy | Artifact Registry metadata | Una policy activa |
| Invoker IAM | Cloud Run IAM policies | 0/5 `roles/run.invoker`; BLOCKING |
| Remote probes | 20 requests no mutantes | 15 HTTP 403; 5 HTTP 401 |
| Platform denial classification | Cloud Logging request logs | Tráfico rechazado antes del runtime |
| Runtime telemetry | conteos Cloud Logging, 24 h | correlation/duration/safeError/metrics: 0 |
| Log sanitation | análisis sin emitir payloads | 0 PII; 0 secretos/tokens |
| Deployment allowlist | Functions y entrypoint | Cinco handlers exactos |
| Storage | Cloud metadata y source scan | Solo dos buckets Google-managed; 0 triggers |
| Tasks | Service state y source scan | API off; 0 triggers |
| PDFs y Notifications | export/source scan | 0 exports |
| Production URL isolation | source desplegable | Dos referencias; FAIL |
| Preview client | carga del dominio Preview | Firebase initialization bloqueada por configuración ausente |

No se conservaron headers, tokens, cuerpos de respuesta, IPs, URLs de servicio o valores secretos en esta evidencia.

