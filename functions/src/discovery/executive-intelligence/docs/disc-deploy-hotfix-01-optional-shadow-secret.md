# DISC-DEPLOY-HOTFIX-01 — Optional shadow secret binding

## Causa raíz

`completeDiscoverySession` declaraba `secrets: [executiveDiscoveryServiceTokenParam]`. Firebase exigía crear y vincular `EXECUTIVE_DISCOVERY_SERVICE_TOKEN` durante el despliegue aunque `DISCOVERY_SHADOW_EVALUATION=false`, `DISCOVERY_PRIMARY_EVALUATION=false` y el endpoint estuviera vacío.

## Corrección mínima

- `completeDiscoverySession` ya no declara un secret ni invoca `executiveDiscoveryServiceTokenParam.value()`.
- La configuración ya no define `EXECUTIVE_DISCOVERY_SERVICE_TOKEN`.
- El adapter se obtiene mediante una fábrica perezosa después de validar el flag y el endpoint.
- Con shadow desactivado, la fábrica no se invoca y se persiste `SKIPPED_DISABLED`.
- Con shadow activado y endpoint ausente, no se invoca la fábrica ni se realiza una llamada remota; se persiste `ENDPOINT_NOT_CONFIGURED`.
- Con shadow activado y endpoint presente, la compuerta de seguridad devuelve `AUTHENTICATION_REQUIRED`, `authenticationMode=UNCONFIGURED` y `FAILED_AUTHENTICATION`; no crea signer, cliente HTTP o adapter remoto y no rompe el cierre legacy.
- Primary permanece forzado a `false`.

No se agregó token hardcodeado, API key, valor vacío sustituto, variable `VITE_*` ni credencial pública. Los logs y registros shadow sólo contienen códigos y metadatos seguros; nunca incluyen token o header `Authorization`.

## Activación futura

Shadow sólo podrá activarse productivamente mediante un cambio de seguridad separado, revisado y desplegado explícitamente. Ese cambio debe incluir:

1. identidad OIDC/IAM u otro mecanismo aprobado;
2. endpoint configurado;
3. issuer, audience y subject cuando correspondan;
4. grants mínimos para tenant, organización y compañía;
5. binding server-side y despliegue explícito de seguridad;
6. pruebas contractuales y observabilidad segura antes de activar el flag.

`DISCOVERY_PRIMARY_EVALUATION` debe permanecer en `false` hasta una autorización independiente.
