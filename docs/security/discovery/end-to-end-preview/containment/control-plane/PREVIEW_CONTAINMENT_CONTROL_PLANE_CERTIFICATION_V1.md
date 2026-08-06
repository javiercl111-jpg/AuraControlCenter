# Preview Containment Activation Control Plane Certification V1

Change ID: `AI-02H2.2E-R1A-PREVIEW-CONTAINMENT-CONTROL-PLANE-20260806-01`

## Dictamen

**PREVIEW CONTAINMENT ACTIVATION CONTROL PLANE CERTIFIED**

**READY FOR CONTROLLED POLICY ACTIVATION**

La certificación cubre exclusivamente el mecanismo interno que podrá crear y activar una política de containment de Preview en un slice posterior. Durante este slice no se creó ninguna política, no se escribió ningún active pointer y no se realizó ninguna escritura cloud.

## Alcance certificado

El target está cerrado a:

- environment: `PREVIEW`;
- project: `aura-intel-preview`;
- region: `us-central1`;
- tenant: locator esperado inyectado por la composición autorizada.

Production se rechaza. Staging se rechaza. Wildcards y ambientes desconocidos se rechazan. El mecanismo no está conectado a una Function pública, callable ni endpoint HTTP.

## ActivationRequestV1

El contrato exige, sin valores por defecto:

- `schemaVersion`;
- `requestId`;
- `correlationId`;
- `actor`;
- `approver`;
- `reason`;
- `environment`;
- `projectId`;
- `region`;
- `tenantId`;
- `expectedCurrentVersion`;
- `proposedVersion`;
- `idempotencyKey`;
- `dryRun`;
- `apply`.

El conjunto de campos es exacto. Campos desconocidos, timestamps del solicitante, actor y approver iguales, o combinaciones ambiguas de `dryRun` y `apply` fallan de forma cerrada.

## Autoridad y separación de funciones

La ejecución requiere un `PreviewContainmentActivationAuthorityVerifierV1` suministrado por una composición interna autorizada. La única respuesta que permite continuar es `ALLOW`; cualquier otra respuesta detiene la operación. Actor y approver deben ser distintos y deben coincidir con los roles declarados por la propuesta.

No se añadió una composición cloud ni una superficie de invocación en este slice. Esa ausencia evita una activación accidental antes del cambio controlado posterior.

## Fingerprint determinista

El fingerprint usa SHA-256 con separación de dominio y serialización canónica del contenido semántico de la propuesta. Ordena claves y listas set-like antes de calcularlo.

No incorpora request ID, correlation ID, idempotency key, reloj, timestamps ni credenciales. El mismo contenido produce el mismo fingerprint; un cambio en switches, cuotas, alcance, TTL, rollback o metadatos semánticos produce un fingerprint diferente.

## Compare-and-set e idempotencia

La transacción Firestore lee antes de escribir:

1. active pointer de Preview;
2. versión propuesta;
3. audit determinista asociado a la idempotency key;
4. política activa actual, cuando existe.

La aplicación solo continúa si `expectedCurrentVersion` coincide exactamente con el pointer observado. La actualización exige que `rollbackVersion` sea la versión esperada. Un pointer sin política, una versión preexistente, una clave reutilizada con contenido distinto, un retry inconsistente o una carrera CAS se rechazan.

Una aplicación válida crea de forma atómica la versión inmutable, el pointer y el audit. Un retry idéntico devuelve `REPLAY` y conserva un único audit.

## Timestamps server-owned

El request y la propuesta no aceptan timestamps. `createdAt`, `updatedAt`, `expiresAt`, `updatedAt` del pointer y `serverTimestamp` del audit se materializan únicamente desde el reloj confiable de la composición del servidor. El TTL es semántico y está acotado.

## Dry-run

`dryRun=true` y `apply=false` ejecuta las mismas validaciones de contrato, target, tenant, authority, fingerprint, estado, CAS, rollback e inmutabilidad. Devuelve `DRY_RUN_VALIDATED` sin crear política, pointer ni audit.

## Guard fail-closed

El guard valida el target exacto e inspecciona el árbol fuente. Rechaza:

- Production, Staging, wildcard, ambiente desconocido, proyecto o región incorrectos;
- callables, handlers HTTP o exports desde entrypoints de deployment;
- imports de Storage, Tasks, reportes o notificaciones;
- colecciones directas o constantes de colección fuera de las tres colecciones de containment;
- ausencia del binding de tenant o del rechazo de autoridad.

## Validación ejecutada

- Gate obligatorio: PASS.
- TypeScript `noEmit` de Functions: PASS.
- Tests históricos de containment: 36/36 PASS.
- Tests nuevos del control plane en emulador: 16/16 PASS.
- Suite combinada de containment: 52/52 PASS.
- Tests del guard: 14/14 PASS.
- Guard contra el árbol real: PASS.
- Functions build: PASS.
- Root build: PASS.
- `git diff --check`: PASS.

## Límites de esta certificación

- No certifica el contenido de una política concreta.
- No autoriza ejecutar `apply`.
- No crea una superficie pública de administración.
- La composición futura deberá proporcionar el tenant esperado, authority verifier y reloj confiable.
- La futura activación deberá ejecutar primero dry-run, registrar aprobación y volver a verificar el read-back dentro de su propio slice autorizado.

## Confirmaciones de no acción

- Policies cloud creadas: 0.
- Active pointers modificados: 0.
- Audit records cloud creados: 0.
- Deployments ejecutados: 0.
- Happy Path ejecutado: 0.
- Cambios en IAM, Secret Manager, Firebase, Production o Staging: 0.
- Commits, push y PR: 0.
