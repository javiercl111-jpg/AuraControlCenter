# Preview Client Enablement V1

## Dictamen

**PREVIEW CLIENT ENABLEMENT CERTIFIED — READY FOR CONTROLLED END-TO-END HAPPY PATH**

Production permanece en `REMEDIATION_HOLD` y no está autorizada.

## Identificación

- Programa: `AI-02H2 Preview Client Enablement`
- Slice: `AI-02H2.1`
- Change ID: `AI-02H2.1-PREVIEW-CLIENT-ENABLEMENT-20260805-01`
- Rama: `fix/intelligence-preview-client-enablement`
- Base certificada: `25de1536ccfef8a7fd28a0c66433795bde3321bb`
- Firebase target: `aura-intel-preview`
- Vercel project: `aura-control-center-preview`
- Dominio: `preview-controlcenter.auranexus.io`

## Gate

El gate pasó antes de realizar cambios: rama exacta, `HEAD = origin/main`, worktree inicialmente limpio, Node `v20.20.2`, npm `10.8.2`, alias Firebase `preview`, proyecto GCP `aura-intel-preview`, sesión Vercel autenticada, proyecto Vercel exacto y dominio Preview registrado.

## Contrato cliente

El cliente exige exactamente estas siete variables:

1. `VITE_AURA_RUNTIME_ENVIRONMENT`
2. `VITE_FIREBASE_API_KEY`
3. `VITE_FIREBASE_AUTH_DOMAIN`
4. `VITE_FIREBASE_PROJECT_ID`
5. `VITE_FIREBASE_MESSAGING_SENDER_ID`
6. `VITE_FIREBASE_APP_ID`
7. `VITE_RECAPTCHA_SITE_KEY`

Los valores no se registran. El contrato exige `PREVIEW`, el proyecto y auth domain de Preview, identificadores Firebase coherentes, región Functions `us-central1`, dominio exacto y App Check debug desactivado. Se retiró la dependencia de `VITE_FIREBASE_STORAGE_BUCKET` del arranque del cliente.

## Aislamiento de navegación

El cliente ya no consume el origen de `discoveryUrl` retornado por `createDiscoveryLead`. Construye una ruta relativa a partir de `linkId` y `oneTimeToken`, ambos validados y codificados. Esto neutraliza las dos URLs Production generadas por el backend desplegado sin modificar ni volver a desplegar Functions. La página principal y el harness de desarrollo usan el mismo boundary relativo.

La búsqueda de fuente cliente y la inspección del bundle confirman:

- cero IDs Firebase Production;
- cero URLs `controlcenter.auranexus.io` Production;
- cero URLs `intelligence.auranexus.io`;
- cero URLs directas `a.run.app`;
- cero fallbacks silenciosos;
- cero configuración App Check debug de Aura.

## Vercel

El proyecto `aura-control-center-preview` está conectado al repositorio `AuraControlCenter`, usa rama interna Production `main`, framework Vite, raíz `.`, build `npm run build`, salida `dist` y Node `24.x`.

Las siete variables se crearon como project-scoped y sensibles en los targets internos `preview` y `production`. Se confirmaron siete registros, ambos scopes por registro, cero branch overrides y cero Shared Variables. El proyecto `aura-control-center` no fue consultado ni modificado.

Se ejecutó un deploy `--prod --force` exclusivamente sobre `aura-control-center-preview`. El target interno `production` terminó `READY` y quedó asociado a `preview-controlcenter.auranexus.io`. No se produjo ningún deployment sobre Production real.

## Read-back cliente

La carga no mutante del dominio Preview confirmó:

- superficie de login visible;
- documento cargado sin errores de configuración visibles;
- cero errores o warnings de consola;
- activos reCAPTCHA Enterprise presentes;
- cero solicitudes observadas hacia dominios Production;
- cero solicitudes directas hacia `a.run.app`;
- bundle activo coincidente con el build certificado;
- callable SDK preparado en `us-central1`.

No se creó lead, no se emitió una credencial de sesión válida y no se completó ninguna sesión.

## Validaciones

- `npm ci`: PASS.
- Client configuration: `16/16` PASS.
- Client enablement guard: `23/23` PASS.
- Preview trust completion: `20/20` PASS.
- Runtime contracts: `18/18` PASS.
- Preview deployment unit: `22/22` PASS.
- Invocation boundary: `13/13` PASS.
- Guard de fuente: PASS.
- Guard completo con read-back: PASS.
- TypeScript `noEmit`: PASS.
- Root build: PASS.
- Auditoría de bundle: PASS.
- `git diff --check`: PASS.

## Riesgos y limitaciones

- `npm ci` reporta nueve vulnerabilidades heredadas: dos moderadas, seis altas y una crítica. No se aplicó `npm audit fix` por estar fuera del alcance.
- El bundle principal supera el umbral recomendado de tamaño y Vite reporta imports dinámicos no efectivos. No bloquea el aislamiento, pero requiere un slice de rendimiento/dependencias.
- Vercel compila con Node `24.x`, mientras el gate local usa Node `20.20.2`. Ambos builds pasaron; la divergencia debe resolverse en un cambio separado.
- El SDK de Firebase contiene internamente el símbolo de soporte debug, pero Aura no define variable, valor ni proveedor debug y Vercel no contiene una variable debug.
- App Check enforcement no se modificó y permanece fuera de alcance.
- El happy path end-to-end permanece pendiente para el siguiente slice controlado.

## Detención

No hubo deploy de Functions, cambios IAM, cambios Secret Manager, cambios de Rules, activación de App Check enforcement, cambios Staging, cambios Production, commit, push ni PR.

