# Non-Production App Check Baseline v1

**Slice:** AI-02H1E.5.R2A

**Estado:** diseño; no se creó app/provider/debug token ni se activó enforcement

## 1. Inventario actual

| Superficie | Estado | Evidencia/riesgo |
|---|---|---|
| Web client | `PARTIAL` | Usa `ReCaptchaEnterpriseProvider`, pero si falta site key sólo registra warning y continúa |
| Debug client | `UNSAFE` | En modo DEV asigna debug token explícito o `true`; no hay approval/expiry gate |
| Functions declarativas | `PARTIAL` | Varias usan `enforceAppCheck: true`; otras validan `request.app` manualmente |
| Functions sin uniformidad | `UNSAFE` | Existe al menos un callable con `enforceAppCheck: false` y handlers sin opción uniforme |
| Firestore enforcement | `MISSING` | No configurado/verificado en Preview o Staging |
| Storage enforcement | `NOT_APPLICABLE` actual | No hay bucket; debe ser obligatorio antes de Storage |
| Provider/debug remote state | `MISSING` | R1C-B1 no configuró App Check |

App Check es una señal de aplicación, no identidad humana ni autoridad tenant. Nunca reemplaza Auth, Rules, principal resolver, capabilities, rate limit o IAM.

## 2. Apps y provider objetivo

| Environment | Firebase Web App | Provider | Debug policy | Fidelity |
|---|---|---|---|---|
| Preview | `Aura Intelligence Preview Web` | reCAPTCHA Enterprise, key exclusiva Preview | Sólo excepción explícita, registrada y expirable | Equipo interno, datos sintéticos |
| Staging | `Aura Intelligence Staging Web` | reCAPTCHA Enterprise, key exclusiva Staging | Cero debug tokens | Aproxima Production |
| Production | Apps existentes, fuera de scope | No modificar | Cero requerido en gate futuro | `REMEDIATION_HOLD` |

App IDs, site keys y dominios no se inventan ni se guardan en Git. El mapping sanitizado registra display name, environment, provider type y hashes de IDs/config.

## 3. Client baseline

La implementación posterior debe:

1. exigir `VITE_AURA_ENVIRONMENT`, Firebase project ID, app ID y reCAPTCHA Enterprise site key coherentes con el targeting manifest;
2. fallar build o bootstrap protegido si falta/mismatch App Check; no continuar con warning;
3. habilitar token auto-refresh;
4. prohibir `FIREBASE_APPCHECK_DEBUG_TOKEN=true` implícito fuera de Emulator/local;
5. aceptar debug Preview sólo con manifest de excepción que incluya Change ID, owner role, approver role, reason, UTC expiry y revocation evidence;
6. impedir que debug configuration forme parte del artifact Staging;
7. no loggear token, site key completa, app ID completo o headers.

## 4. Functions baseline

Todas las callable/onRequest públicas se inventariarán por export y se clasificarán `PUBLIC_APP`, `AUTHENTICATED_APP`, `INTERNAL_OIDC` o `ADMIN_ONLY`.

- `PUBLIC_APP` y `AUTHENTICATED_APP`: enforcement declarativo `enforceAppCheck: true` más controles de Auth/capability correspondientes.
- Validación manual `request.app` puede ser defense-in-depth, no sustituto de la opción declarativa.
- `INTERNAL_OIDC`/Cloud Tasks: identidad OIDC/audience exacta; App Check no aplica a task delivery.
- `ADMIN_ONLY`: Auth + authority resolver + App Check si se llama desde web.
- Ninguna superficie permanece con `enforceAppCheck: false` por comentario de desarrollo.

El inventario debe incluir create, token exchange, session resolve, evaluation, completion, report generation/download, advisor/admin/prospect actions y notification mark-read. Una export nueva falla CI hasta ser clasificada.

## 5. Enforcement sequence

1. Aprobar Web App, provider, dominios, owner y rollback.
2. Registrar App/provider Preview sin enforcement.
3. Desplegar/configurar cliente Preview y capturar métricas token valid/invalid/missing.
4. Ejecutar positivos con app real y negativos sin token/forged/replayed/debug no aprobado.
5. Activar Functions una superficie de bajo riesgo a la vez; observar.
6. Activar Firestore enforcement sólo tras Rules fail-closed y cliente válido.
7. Mantener Storage `NOT_CONFIGURED`; exigir enforcement antes de crear/usar bucket.
8. Revocar cualquier debug Preview y demostrar count cero antes de promoción.
9. Repetir en Staging con cero debug desde el inicio.
10. Detenerse antes de Production.

## 6. Métricas y alertas

Por ambiente se requieren counts/rates sin tokens ni PII:

- valid, invalid, missing y expired App Check;
- deny por Function/surface y status class;
- client initialization failures;
- debug token count y exception expiry;
- Firestore/Storage rejected requests cuando aplique;
- ratio de deny y cambio contra baseline.

Alertas: debug token Staging > 0, provider/config mismatch, spike de missing/invalid, valid-client failure sostenido y enforcement unexpectedly disabled. Cada alerta enlaza owner role, runbook y routing receipt.

## 7. Pruebas y gates

| Caso | Preview | Staging |
|---|---|---|
| Sin App Check | DENY en superficie enforced | DENY |
| Token malformado/otro app/proyecto | DENY | DENY |
| Auth válido sin App Check | DENY cuando la superficie lo exige | DENY |
| App Check válido sin authority/capability | DENY por capa posterior | DENY |
| App Check + authority/capability válida | ALLOW path exacto | ALLOW |
| Debug no registrado/expirado | DENY | DENY |
| Debug aprobado | Puede ALLOW sólo dentro de excepción Preview | NOT_APPLICABLE; count cero |
| Cloud Tasks OIDC | App Check no requerido; audience/SA exactos | Igual |

Los tests unit/emulator usan seam App Check y no confunden esa simulación con provider remoto. La wave requiere también read-back efectivo del provider/enforcement.

## 8. Rollback

Rollback empieza con containment/traffic OFF y preserva Rules cerradas. Si enforcement rompe clientes válidos, se revierte sólo la última superficie a monitor mode mediante Change ID aprobado, se conserva métricas/alerta y se corrige cliente/provider. Nunca se habilita debug Staging como fallback ni se deshabilitan Auth, Rules, capabilities o rate limits.

## 9. Stop conditions y evidencia

Detener ante provider/app mapping ambiguo, site key compartida cross-env, token/debug expuesto, debug Staging, métricas inaccesibles, valid-client failure, export no clasificada o Production target. Evidencia: app/provider metadata sanitizada, enforcement por surface, debug count/expiry, client artifact digest, test matrix, metrics/alerts, change/approval y rollback receipt; nunca valores o tokens.
