# Preview Parameter Binding Change Record V1

Change ID: `AI-02H1E.5.R3E-PREVIEW-PARAMETER-BINDING-20260805-01`

## Estado heredado

Un intento controlado anterior fue abortado por Firebase CLI antes de crear recursos porque faltaban valores explícitos para cuatro parámetros no secretos. El aborto dejó 0 Functions y 0 servicios Cloud Run. Los secretos, sus versiones e IAM permanecieron intactos. `firebaseextensions.googleapis.com` había quedado habilitada por ese intento anterior. Staging y Production permanecieron intactos.

## Cambios locales R3E

1. Se añadieron al archivo dotenv exclusivo de Preview los dos flags en `false`, timeout `10000` y endpoint vacío.
2. Se añadió un contrato fail-closed para validar el archivo exacto y rechazar parámetros faltantes, duplicados, flags activos, timeout inválido, endpoints remotos y configuración fuera de Preview.
3. El deployment guard ahora incorpora el contrato y reporta bindings sanitizados.
4. Se añadieron 15 pruebas del parameter guard.
5. Se añadió un comando npm reproducible para la nueva suite.
6. Se generó y analizó el manifest local; el artefacto temporal fue eliminado.

No se modificó `discoveryEvaluationConfig.ts`, la lógica funcional de Discovery, secretos, IAM, Rules, Firebase, Vercel o infraestructura.

## Resultado

- Los cuatro parámetros están resueltos para Firebase CLI no interactivo.
- Endpoint remoto no autorizado y vacío.
- Shadow y primary desactivados.
- Cinco exports y codebase `preview-discovery` preservados.
- Tres bindings secretos exactos preservados.
- 0 Functions y 0 Cloud Run después del slice.
- Deployment ejecutado: no.
- Cloud mutations: 0.
- Staging y Production: sin cambios.

## Deuda fuera de alcance

La actualización de Node 20 y `firebase-functions` 6.x se mantiene como trabajo separado y no condiciona la corrección de binding certificada en este slice.

## Commit sugerido

`fix(functions): bind preview non-secret parameters`

No se creó commit, push ni PR.
