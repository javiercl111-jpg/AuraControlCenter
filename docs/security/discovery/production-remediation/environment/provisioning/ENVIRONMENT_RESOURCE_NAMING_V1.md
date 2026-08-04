# Environment Resource Naming v1

**Programa:** AI-02H1E.5.0 — Production Readiness Remediation Program

**Slice:** AI-02H1E.5.R1B — Environment Resource Provisioning Design

**Estado:** nombres `PROPOSED`; no reservados ni creados

## 1. Convención canónica

La forma general es `aura-<system>-<environment>-<resource>[-<region>][-v<version>]`. Se usan los códigos `preview`, `staging` y `production`; `prod`, `dev`, `test`, nombres sin ambiente y `default` están prohibidos como autoridad de targeting.

Reglas:

- minúsculas ASCII y guiones para project IDs, buckets, queues y service-account IDs;
- ambiente siempre visible;
- región sólo donde exista más de una ubicación operativa;
- versión para contracts, secrets, metrics y policies mutables;
- project IDs dentro de 6–30 caracteres; service-account IDs dentro de 6–30; buckets dentro de 3–63;
- ningún nombre contiene persona, email, tenant, UID, secreto o dato de negocio;
- Production usa siempre la palabra completa `production` salvo el project ID existente;
- todo nombre propuesto requiere comprobación de disponibilidad read-only y aprobación antes de reservarse.

## 2. Proyectos, aliases y Vercel

| Tipo | Preview | Staging | Production | Estado |
|---|---|---|---|---|
| Google Cloud/Firebase project ID | `aura-intel-preview` | `aura-intel-staging` | `aura-control-center-debb3` | `PROPOSED`; Production existente condicionado |
| Display name | `Aura Intelligence Preview` | `Aura Intelligence Staging` | `Aura Intelligence Production` | `PROPOSED` |
| Firebase alias | `preview` | `staging` | `production` | `PROPOSED`; `default` prohibido |
| Vercel project | `aura-control-center-preview` | `aura-control-center-staging` | `aura-control-center` | `PROPOSED`; Production existente condicionado |
| Domain pattern | `preview.<APPROVED_BASE_DOMAIN>` | `staging.<APPROVED_BASE_DOMAIN>` | `<APPROVED_PRODUCTION_DOMAIN>` | `BLOCKED_EXTERNAL`; no se inventa el dominio base |

Los IDs nuevos no están reservados. Si no están disponibles, Platform/SRE propone un sufijo organizacional no sensible, actualiza todos los manifests y obtiene una nueva aprobación; no se permite elegir silenciosamente otro nombre.

## 3. Service accounts e identidades lógicas

Sustituir `<e>` por `prev`, `stg` o `production`. Los IDs Production largos se mantienen dentro del límite de 30 caracteres.

| Frontera | Preview | Staging | Production |
|---|---|---|---|
| Intake runtime | `ai-prev-fn-intake` | `ai-stg-fn-intake` | `ai-production-fn-intake` |
| Capability/session runtime | `ai-prev-fn-session` | `ai-stg-fn-session` | `ai-production-fn-session` |
| AI runtime | `ai-prev-fn-ai` | `ai-stg-fn-ai` | `ai-production-fn-ai` |
| Completion runtime | `ai-prev-fn-complete` | `ai-stg-fn-complete` | `ai-production-fn-complete` |
| Report writer | `ai-prev-fn-report` | `ai-stg-fn-report` | `ai-production-fn-report` |
| Storage signer | `ai-prev-fn-signer` | `ai-stg-fn-signer` | `ai-production-fn-signer` |
| Notification runtime | `ai-prev-fn-notify` | `ai-stg-fn-notify` | `ai-production-fn-notify` |
| Tasks caller | `ai-prev-tasks-caller` | `ai-stg-tasks-caller` | `ai-production-tasks-caller` |
| Telemetry writer | `ai-prev-telemetry` | `ai-stg-telemetry` | `ai-production-telemetry` |
| Deployer | `ai-prev-deployer` | `ai-stg-deployer` | `ai-production-deployer` |
| Monitoring reader | `ai-prev-monitor` | `ai-stg-monitor` | `ai-production-monitor` |
| Incident responder | `ai-prev-incident` | `ai-stg-incident` | `ai-production-incident` |

Break-glass no es una service account persistente. Los nombres lógicos de elevación temporal son `aura-preview-break-glass`, `aura-staging-break-glass` y `aura-production-break-glass` y se materializan mediante el mecanismo de acceso privilegiado aprobado, con expiry y audit.

## 4. Storage, queues y secrets

| Tipo | Preview | Staging | Production |
|---|---|---|---|
| Report bucket | `aura-intel-preview-reports` | `aura-intel-staging-reports` | `aura-intel-production-reports` |
| Report prefix | `reports/v1/<opaque-report-id>` | `reports/v1/<opaque-report-id>` | `reports/v1/<opaque-report-id>` |
| Notification queue | `discovery-notification-preview` | `discovery-notification-staging` | `discovery-notification-production` |
| Recovery ledger | `discovery-notification-recovery-preview` | `discovery-notification-recovery-staging` | `discovery-notification-recovery-production` |

Secret names exactos:

| Purpose | Preview | Staging | Production |
|---|---|---|---|
| Capability/public-token HMAC | `aura-preview-hmac-v1` | `aura-staging-hmac-v1` | `aura-production-hmac-v1` |
| Idempotency | `aura-preview-idempotency-v1` | `aura-staging-idempotency-v1` | `aura-production-idempotency-v1` |
| IP hash salt | `aura-preview-ip-hash-salt-v1` | `aura-staging-ip-hash-salt-v1` | `aura-production-ip-hash-salt-v1` |
| Gemini | `aura-preview-gemini-v1` | `aura-staging-gemini-v1` | `aura-production-gemini-v1` |
| Notifications | `aura-preview-notifications-v1` | `aura-staging-notifications-v1` | `aura-production-notifications-v1` |
| Signing | `aura-preview-signing-v1` | `aura-staging-signing-v1` | `aura-production-signing-v1` |
| App Check server config | `aura-preview-app-check-v1` | `aura-staging-app-check-v1` | `aura-production-app-check-v1` |

## 5. App Check y Auth

| Recurso | Preview | Staging | Production |
|---|---|---|---|
| Firebase Web App display name | `Aura Intelligence Preview Web` | `Aura Intelligence Staging Web` | Preservar apps existentes; mapear `Aura Nexus Public` tras read-back |
| App Check registration label | `aura-preview-web-v1` | `aura-staging-web-v1` | `aura-production-web-v1` |
| Auth test admin label | `aura-preview-test-admin` | `aura-staging-test-admin` | No aplica; bootstrap productivo requiere runbook separado |
| Authorized domain pattern | `preview.<APPROVED_BASE_DOMAIN>` | `staging.<APPROVED_BASE_DOMAIN>` | `<APPROVED_PRODUCTION_DOMAIN>` |

Los app IDs, provider keys y dominios efectivos no se inventan ni se almacenan aquí.

## 6. Observabilidad y costos

| Tipo | Preview | Staging | Production |
|---|---|---|---|
| Dashboard | `aura-preview-public-intake` | `aura-staging-certification` | `aura-production-public-intake` |
| Budget | `Aura Intelligence Preview Budget` | `Aura Intelligence Staging Budget` | `Aura Intelligence Production Budget` |
| Log sink | `aura-preview-security-audit` | `aura-staging-security-audit` | `aura-production-security-audit` |
| Uptime check | `aura-preview-intake-uptime` | `aura-staging-intake-uptime` | `aura-production-intake-uptime` |
| Notification channel logical name | `aura-preview-ops-routing` | `aura-staging-ops-routing` | `aura-production-p0-routing` |

Log-based metric IDs por ambiente:

- `aura_<environment>_app_check_denied_v1`;
- `aura_<environment>_rate_limit_denied_v1`;
- `aura_<environment>_function_error_v1`;
- `aura_<environment>_queue_backlog_v1`;
- `aura_<environment>_secret_access_v1`;
- `aura_<environment>_iam_change_v1`.

Alert policy display names por ambiente:

- `Aura <Environment> App Check Denials P0`;
- `Aura <Environment> Rate Limit Denials`;
- `Aura <Environment> Functions Errors P0`;
- `Aura <Environment> Queue Backlog P0`;
- `Aura <Environment> Storage Growth`;
- `Aura <Environment> Gemini Cost`;
- `Aura <Environment> Secret Access P0`;
- `Aura <Environment> IAM Change P0`.

## 7. Labels obligatorios

Cada recurso que soporte labels recibe:

```text
app=aura-intelligence
environment=<preview|staging|production>
program=ai-02h1e-5
managed-by=platform
data-class=<synthetic|authorized-real|metadata>
cost-center=<APPROVED_COST_CENTER>
owner-role=<APPROVED_OWNER_CODE>
```

Los valores placeholder bloquean provisioning. No se sustituyen por nombres personales.

## 8. Variables Vercel

Cada proyecto Vercel define estos nombres en su único environment target. Los valores son exclusivos del ambiente y no se documentan:

```text
VITE_AURA_ENVIRONMENT
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_DISCOVERY_FUNCTIONS_REGION
VITE_DISCOVERY_API_ORIGIN
AURA_NOTIFICATION_OIDC_AUDIENCE
AURA_NOTIFICATION_GATEWAY_ENVIRONMENT
AURA_NOTIFICATION_PROVIDER_SECRET_REF
```

`VITE_AURA_ENVIRONMENT` y `VITE_FIREBASE_PROJECT_ID` deben coincidir con el manifest aprobado; el build falla si faltan o si apuntan a otro ambiente. Las variables `VITE_*` sólo contienen configuración web intencionalmente pública. Las variables server-only nunca usan target Preview/Staging/Production compartido.

## 9. Validación de nombres

Antes de provisioning, un check read-only valida longitud, charset, disponibilidad, consistencia con environment manifest y ausencia de colisión. Un mismatch detiene toda la wave; no se permite truncado o fallback automático.
