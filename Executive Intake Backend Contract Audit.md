# Executive Intake Backend Contract Audit™

## Resumen Ejecutivo

La auditoría de los contratos backend del Aura Control Center (Sprint L1) ha revelado que la arquitectura actual de **Discovery** no soporta los requerimientos completos del nuevo **Executive Intake Intelligence™**. Faltan *endpoints* esenciales, existen discrepancias en los esquemas de datos (especialmente en consentimientos y perfiles corporativos) y carece de idempotencia robusta. 

## Functions Auditadas

Se realizó una auditoría directa al código fuente de las siguientes Functions:

- `createDiscoveryLead`
- `exchangeDiscoveryToken`
- `resolveDiscoverySession`
- `completeDiscoverySession`
- `generateDiscoveryReport`
- `requestExecutiveDocument`

**Faltantes:**
- `resolveAdvisorByCode` (No existe en el backend actual).
- `updatePublicDiscoverySession` (No existe en el backend actual).

---

## Contratos Reales

### 1. `createDiscoveryLead`
- **Nombre:** `createDiscoveryLead`
- **Export:** Sí, callable.
- **App Check:** Requerido (Lanza `APP_CHECK_REQUIRED`).
- **Idempotencia:** No. Crear múltiples veces con el mismo payload genera links y tokens duplicados.
- **Request:** `{ companyName, contactName, email, phone, role, location, commercialCode, consent, acquisitionSource }`
- **Response:** `{ linkId, oneTimeToken, trustScoreDecision, expiresAt }`
- **Colecciones modificadas:** `market_discovery_links`
- **Clasificación:** BACKEND_CHANGE_REQUIRED (faltan campos obligatorios).

### 2. `exchangeDiscoveryToken`
- **Nombre:** `exchangeDiscoveryToken`
- **Export:** Sí, callable.
- **App Check:** Requerido.
- **Request:** `{ linkId, oneTimeToken }`
- **Response:** `{ sessionAccessToken, linkId, trustScoreDecision, companyName, contactName }`
- **Clasificación:** READY

### 3. `resolveDiscoverySession`
- **Nombre:** `resolveDiscoverySession`
- **Export:** Sí, callable.
- **App Check:** Requerido.
- **Request:** `{ linkId, sessionToken }`
- **Response:** `{ id, companyName, contactName, status, trustScoreDecision }`
- **Clasificación:** READY

### 4. `completeDiscoverySession`
- **Nombre:** `completeDiscoverySession`
- **Export:** Sí, callable.
- **App Check:** Requerido.
- **Request:** `{ linkId, sessionToken, dossierPayload }`
- **Response:** `{ dossierId, trustDecision, prospectId, resolutionStatus }`
- **Clasificación:** BACKEND_CHANGE_REQUIRED (se necesita adaptar soporte para Corporate/OrganizationProfile).

### 5. `generateDiscoveryReport`
- **Nombre:** `generateDiscoveryReport`
- **Export:** Sí, callable.
- **App Check:** Validado implícitamente por autenticación (`request.auth`).
- **Request:** `{ sessionId, prospectId, isInternalOnly }`
- **Response:** `{ success, reportId, message }`
- **Clasificación:** READY

### 6. `requestExecutiveDocument`
- **Nombre:** `requestExecutiveDocument`
- **Export:** Sí, callable.
- **App Check:** Requerido.
- **Request:** `{ reportId, sessionToken, forceRegenerate }`
- **Response:** `{ status, reportId, reportType, documentVersion, downloadUrl, expiresAt, generatedAt }` (o status de generación).
- **Clasificación:** READY

---

## Errores Seguros Detectados

Los siguientes errores estándar se detectaron en las functions:
- `APP_CHECK_REQUIRED` (Vía `failed-precondition`)
- `RATE_LIMITED` (Vía `resource-exhausted`)
- Errores de validación como `invalid-argument` para payloads incorrectos.
- `DOCUMENT_REVOKED`
- *No se detectó el código literal `INVALID_INPUT`, `INVALID_ADVISOR_CONTEXT` ni `TEMPORARILY_UNAVAILABLE` de forma estructurada; se utilizan los strings estándar de HttpsError.*

---

## Campos Faltantes

En `createDiscoveryLead`, el backend soporta actualmente `role`, `location` y un único booleano `consent`. No soporta los siguientes campos del nuevo modelo:
- `jobTitle` (actualmente usa `role`)
- `state`
- `city`
- `employeeRange`
- `origin` (en el request, el backend lo infiere internamente)
- Múltiples consentimientos granulares.

---

## App Check

Totalmente integrado y funcional. Todas las functions principales de Discovery verifican `request.app == undefined` y lanzan la excepción adecuada si falta.

---

## Consentimientos

El backend **no soporta** múltiples consentimientos (`privacyConsent`, `diagnosticDeliveryConsent`, `followUpConsent`, `marketingConsent`, `policyVersion`). Solamente valida un booleano global llamado `consent`.

---

## Discovery URL

Las Functions **NO** devuelven la `discoveryUrl`. En su lugar, devuelven el `oneTimeToken` y el `linkId`. Es responsabilidad del frontend componer la URL (ej. hacia `controlcenter.auranexus.io`). El backend sí maneja la expiración del token (actualmente 72 horas por configuración) y el `exchangeDiscoveryToken` valida adecuadamente el uso único del mismo.

---

## oneTimeToken

Se genera correctamente (mediante criptografía en `discoverySecurityService`) y se almacena únicamente en formato hash (`tokenHash`) en Firestore para mayor seguridad. No se devuelve en endpoints subsecuentes.

---

## Trust Score

El **Trust Score** se calcula de forma segura en el backend (`computeTrustScore`). Devuelve únicamente la variable de decisión (`trustScoreDecision`) al frontend en los responses, manteniendo expuestos solamente los estados de flujo ("ALLOW_FULL", "ALLOW_BASIC", etc.). El puntaje numérico y las razones quedan 100% Backend Only.

---

## Corporate

**No existe** actualmente una abstracción robusta de `OrganizationProfile` ni detección corporativa explícita (Corporate Detection / Resolution) expuesta o almacenada en el payload inicial. `createDiscoveryLead` maneja la empresa mediante un simple string `companyName`. 

---

## Competitor

**Sí existe**. Se evalúa en backend al calcular el Trust Score mediante una lista negra de dominios en la configuración (`competitorDomains`). Si un dominio es de la competencia, se marca internamente (`competitiveFlag`) y el flujo se degrada automáticamente a `ALLOW_BASIC`. **No se expone al frontend** en ningún momento que fue detectado como competencia.

---

## RBAC y Ownership

Implementado correctamente en los documentos generados y reportes (ej. `requestExecutiveDocument`), validando que quien solicita el reporte es el propio prospecto mediante token de sesión, o un Global Admin/Advisor que posee `targetProspectId`.

---

## Idempotencia

**Falla en el intake inicial.** Múltiples solicitudes de *submit* generan múltiples prospectos, tokens y links si se realizan dentro de los límites del rate limit (5 por email).

---

## Conclusión

C) CONTROL_CENTER_BACKEND_CHANGE_REQUIRED
