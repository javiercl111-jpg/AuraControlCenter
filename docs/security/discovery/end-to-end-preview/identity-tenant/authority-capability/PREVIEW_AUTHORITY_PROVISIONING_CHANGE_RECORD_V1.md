# Preview Authority Provisioning Change Record V1

- Change ID: `AI-02H2.2C-PREVIEW-AUTHORITY-PROVISIONING-CAPABILITY-20260806-01`
- Fecha: `2026-08-06`
- Rama: `feature/intelligence-preview-authority-provisioning`
- Base: `origin/main`
- SHA base: `0f2d21559e33ce530707fb7a6bcd6ad5ef10b68a`
- Target futuro: `aura-intel-preview`

## Cambios realizados

1. Se añadió el módulo server-only `serverAuthorityProvisioning` con modelo,
   contratos, safe errors, validadores, puertos y servicio V1.
2. Se implementó provisioning sintético Preview transaccional, determinista e
   idempotente, con evidencia audit sanitizada.
3. Se implementó el resolver productivo UID → principal → membership → tenant
   → capabilities, separado de la composición `TEST_ONLY`.
4. Se añadió un adapter Admin SDK para las colecciones autoritativas existentes
   y el audit log.
5. Se añadió una composición privada sin callable, HTTP ni export desde el
   deployment unit Discovery.
6. Se formalizó una allowlist vacía: ningún privilegio tenant/global es
   necesario para el flujo Discovery certificado.
7. Se formalizó la retención de fixtures Preview y cleanup futuro versionado.
8. Se añadieron 25 pruebas de aplicación, 8 del adapter y 17 casos del guard.
9. Se autorizó explícitamente la nueva superficie server runtime en la prueba
   arquitectónica de exports del paquete.

## Cambios no realizados

- no se creó identidad Firebase Auth;
- no se creó principal, tenant, membership ni alias;
- no se llamó ninguna Function ni se ejecutó Happy Path;
- no se creó transport público ni script con `--apply`;
- no se desplegó;
- no se modificaron Rules, IAM, Secret Manager, App Check ni Vercel;
- no se tocó Staging ni Production;
- no se hizo commit, push ni PR.

## Riesgo residual y próximo control

La ejecución cloud permanece pendiente de autorización separada. El próximo
slice debe certificar un procedimiento operativo privado que use esta
composición, haga dry-run/read-back, limite el target a `aura-intel-preview` y
mantenga los valores de identidad fuera de logs y evidencia. Disable/cleanup
también requiere procedimiento independiente, versionado y auditado.

## Dictamen

**PREVIEW AUTHORITY PROVISIONING CAPABILITY CERTIFIED — READY FOR CONTROLLED CLOUD PROVISIONING**

Production continúa **NOT AUTHORIZED**.
