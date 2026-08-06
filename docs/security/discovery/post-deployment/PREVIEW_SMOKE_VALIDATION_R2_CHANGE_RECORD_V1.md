# Preview Functional Smoke Validation Retry Change Record V1

Change ID: `AI-02H1E.7-R2-PREVIEW-SMOKE-VALIDATION-20260805-01`

## Cambio documental

Se crearon exclusivamente cuatro artefactos de evidencia para certificar el retry server-side. No se modificó código funcional ni configuración.

## Operaciones read-only

- gate Git, Firebase y GCP;
- Functions/Cloud Run/IAM/config read-back;
- Firebase Web App, debug-token count y reCAPTCHA metadata;
- agregaciones Firestore `count` antes/después;
- conteos de objetos en buckets administrados;
- logging sanitizado de cinco servicios;
- Vercel project/deployment/environment-variable names-only;
- inspección local de contratos y referencias de dominio.

## Tráfico ejecutado

Se enviaron 35 requests sintéticas no mutantes:

- 5 OPTIONS;
- 5 GET inválidos;
- 5 POST sin JSON/longitud;
- 5 POST con content-type incorrecto;
- 5 JSON sin envelope callable;
- 5 body vacío;
- 5 envelope válido sin App Check.

No se enviaron credenciales, App Check tokens, identidades reales ni datos de negocio. No hubo happy path.

## Pruebas locales

Trece suites/runners existentes pasaron 273/273. Los emuladores usaron project IDs `demo-*` y no accedieron a Preview cloud.

El runner shadow requirió un build local. El build regeneró `functions/lib`; como el gate inicial demostraba que el worktree estaba limpio, se restauraron los archivos rastreados y se eliminaron únicamente outputs no rastreados dentro de esa ruta. Los artefactos son recuperables mediante el build y no forman parte del cambio final.

## Resultado de no mutación

- Firestore: 13 conteos en cero antes y después;
- Storage administrado: 5/3 objetos antes y después;
- Tasks: deshabilitado antes y después;
- Functions/Run: mismas cinco revisiones y estados;
- IAM: sin cambios;
- App Check: sin cambios;
- Vercel: sin cambios.

## Hallazgos pendientes

1. Proyecto/dominio Vercel Preview aislado y READY, pero con cero variables Firebase/App Check en sus targets internos.
2. Contrato source usa `VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY`; la solicitud también consulta `VITE_RECAPTCHA_SITE_KEY`. Ninguna está publicada.
3. Dos referencias al dominio Production permanecen en `createDiscoveryLead`; no fueron alcanzadas.
4. App Check control-plane enforcement conserva el estado heredado OFF no verificable por API con la identidad restringida; callable `enforceAppCheck` sí está activo.
5. HTTP 411 para POST sin longitud es una variación segura anterior a Functions Framework.

Los hallazgos 1–3 son `BLOCKING_CLIENT_HAPPY_PATH`, no bloquean el dictamen server-side.

## Exclusiones confirmadas

- sin modificación de código;
- sin IAM;
- sin Secret Manager;
- sin Rules;
- sin App Check write o enforcement change;
- sin Vercel write;
- sin deploy;
- sin happy path;
- sin Staging;
- sin Production;
- sin commit;
- sin push;
- sin PR.
