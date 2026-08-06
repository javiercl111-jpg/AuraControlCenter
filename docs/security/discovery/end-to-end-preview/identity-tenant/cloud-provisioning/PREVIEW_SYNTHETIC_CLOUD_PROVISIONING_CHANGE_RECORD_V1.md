# Preview Synthetic Cloud Provisioning Change Record V1

- Change ID: `AI-02H2.2D-PREVIEW-SYNTHETIC-CLOUD-PROVISIONING-20260806-01`
- Fecha: `2026-08-06`
- Rama: `ops/intelligence-preview-controlled-synthetic-provisioning`
- Base: `origin/main`
- SHA base: `6deb6f5970ec06038034335c6eb4fe7a2ca3d4ec`
- Target: `aura-intel-preview`

## Cambios cloud autorizados y realizados

1. Firebase Authentication fue inicializado en Preview.
2. Se habilitó únicamente Email/Password con password obligatorio.
3. Anonymous y providers externos permanecieron deshabilitados.
4. Se fijaron cuatro dominios autorizados, exclusivamente localhost/Preview.
5. Se creó una identidad Auth sintética, activa, verificada y sin custom claims.
6. Se creó una credencial aleatoria rotatable con una versión enabled en Secret
   Manager; su valor nunca fue impreso ni persistido en el repositorio.
7. Mediante la composición/adapter certificados se creó exactamente un
   principal, tenant, membership y audit Authority.
8. Se ejecutó un retry idéntico y fue replayed sin duplicados.
9. El resolver y una autenticación controlada confirmaron readiness.

## Cambios locales

1. Se añadió un runner versionado con modos audit/apply y guards exactos de
   project, environment y Change ID.
2. El runner genera únicamente evidencia sanitizada.
3. Se añadió la materialización reproducible de la dependencia privada antes de
   ejecutar la composición compilada.
4. Se añadieron 8 tests del runner para targets, dominios y sanitización.
5. Se crearon los cuatro documentos de evidencia de este slice.

## Incidentes controlados

- Primer apply: Auth quedó configurado; el runner se detuvo antes de crear
  identidad por un falso positivo local al clasificar el dominio Preview.
- Segundo apply: identidad y credencial quedaron creadas; el runner se detuvo
  antes de Firestore porque la dependencia privada local no estaba instalada.
- Tercer apply: reutilizó los recursos existentes y completó Authority. El retry
  interno fue `REPLAYED`.

Los dos estados parciales se inspeccionaron antes de continuar. No se borraron,
deshabilitaron ni duplicaron recursos.

## Cambios no realizados

- no se llamó ninguna Function Discovery;
- no se creó lead, sesión, completion ni capability Discovery;
- no se amplió la allowlist;
- no se modificó App Check Enforcement;
- no se desplegó Functions ni Vercel;
- no se modificó Staging ni Production;
- no se hizo commit, push ni PR.

## Riesgos y límites

- El Happy Path aún no se ejecutó; queda autorizado solo mediante un slice
  separado.
- La credencial se rota y elimina únicamente mediante procedimiento versionado.
- `npm ci` reportó 17 findings del lockfile (1 low, 11 moderate, 4 high, 1
  critical). No se ejecutó remediation automática en este slice.

## Dictamen

**PREVIEW SYNTHETIC IDENTITY AND TENANT PROVISIONED — READY FOR CONTROLLED END-TO-END HAPPY PATH**

Production continúa **NOT AUTHORIZED**.
