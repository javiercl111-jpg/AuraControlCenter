# Preview CRM Prospect Create Diagnosis V1

## Dictamen

**PREVIEW CRM PROSPECT CREATE ROOT CAUSE IDENTIFIED — READY FOR LEAST-PRIVILEGE REMEDIATION**

Clasificación: **E. CLIENT_AUTHORITY_MODEL_MISMATCH**.

El fallo no es consecuencia específica de `VIEWER` ni de la advertencia de custom claims. La UI ejecuta una escritura directa desde el cliente sobre una colección cuyas mutaciones están cerradas incondicionalmente por Firestore Rules para todos los roles.

## Gate

- Base y `HEAD`: `origin/main` en `a4a149125770d14b53d0b83d11211da69e30a887`.
- Worktree limpio al iniciar.
- Firebase: `aura-intel-preview` mediante el alias `preview` versionado.
- GCP: `aura-intel-preview`.
- Production no autorizada; Staging fuera de alcance.

## Flujo exacto

`/crm` → `CrmPage.handleCreateLead` → `platformLeadService.createLead` → Firebase Web SDK `addDoc` → `platform_leads/{autoId}` → Firestore Security Rules → deny.

1. `src/App.tsx` monta `CrmPage` en la route `/crm` dentro de `ProtectedRoute`.
2. `CrmPage.handleCreateLead` valida los campos UI y llama a `createLead`.
3. `platformLeadService.createLead` construye el payload y ejecuta `addDoc(collection(db, "platform_leads"), payload)`.
4. No se invoca callable, Function, capability resolver ni servicio backend en este flujo.
5. `firestore.rules` permite leer `platform_leads` a un global admin canónico activo, pero la regla catch-all administrativa declara `allow create, update, delete: if false`.
6. El SDK rechaza el commit con `permission-denied`; la UI captura el error y muestra `No se pudo crear el prospecto.`

## Contrato de payload observado

Campos requeridos por el servicio cliente:

- `companyName`;
- `contactName`;
- `email`;
- `phone`;
- `interestedModules`;
- `stage`;
- `notes`;
- `nextFollowUpDate`;
- `convertedClientId`;
- `convertedTenantId`;
- `convertedAt`;
- `createdAt` y `updatedAt` mediante timestamp de servidor.

Campos opcionales: `source`, `leadSourceCode`, `leadSourceLabel`, `leadSourceDetail` y `estimatedValue`.

Las Rules no llegan a validar autenticación, rol, capability, ownership o campos para CREATE porque la condición terminal es literalmente `false`.

## Capa de rechazo

- Firestore Security Rules: **causa directa**.
- Callable authorization: no participa.
- Custom claims: no participan en esta regla.
- Rol en `platform_global_admins`: habilita lectura y login, pero ningún rol habilita la mutación cliente.
- Capability resolver: existe en source, pero `CrmPage` y `platformLeadService` no lo consultan.

Por tanto, el primer punto de ruptura es la incompatibilidad entre el writer cliente legado y la frontera backend-only de Rules.

## Custom claims

`ProtectedRoute` compara `tokenResult.claims.roleCode` contra `adminDoc.role`. Si difieren, registra la advertencia y llama a `getIdToken(true)`.

- Claim comparado: `roleCode`.
- Source of truth del login: `platform_global_admins/{UID}`.
- El refresh sólo obtiene un token nuevo; no escribe claims.
- El provisioning R3/R4 no modificó claims por diseño.
- Firestore Rules usa `request.auth.uid` para resolver el documento canónico y no consulta `request.auth.token.roleCode`.
- Un claim ausente o stale explica la advertencia, pero no el denial del CREATE.
- `platform_global_admins` basta para login y lectura permitida; no basta para writes cerrados con `false`.

Clasificaciones separadas:

- `CUSTOM_CLAIMS_SYNC_WARNING`: presente y no causal.
- `PROSPECT_WRITE_DENIAL_ROOT_CAUSE`: client writer incompatible con Rules backend-only.

## Correlación del intento existente

- Intento: `addDoc` directo a `platform_leads` desde el SDK cliente.
- Error seguro observado: `permission-denied` y mensaje UI sanitizado.
- Cloud Logging no expuso eventos Data Access de la denegación en la ventana consultada.
- El read-back de la release de Rules fue rechazado por IAM 403; no se intentó elevar permisos.
- El Promise del commit fue rechazado y no existe una ruta alternativa de persistencia en el handler; por ello el intento no creó un prospecto remoto.
- No se enumeraron prospectos ni se repitió el create.

## Remediación mínima propuesta

No escalar el rol actual para intentar eludir Rules: ningún rol puede hacerlo.

- `CURRENT_ROLE = VIEWER`.
- `MINIMUM_ROLE_FOR_PROSPECT_CREATE = NONE_UNDER_CURRENT_CLIENT_PATH`.
- `MINIMUM_REQUIRED_ROLE_OR_CAPABILITY = crm.leads.create` mediante una nueva autorización backend granular.
- `ADDITIONAL_PRIVILEGES_GRANTED = NONE` si se añade únicamente esa capability al operador autorizado.

La remediación preferida es sustituir el `addDoc` cliente por un callable auditado que:

1. resuelva el principal canónico por UID;
2. exija una capability granular `crm.leads.create`;
3. valide y limite el payload;
4. escriba con Admin SDK;
5. registre auditoría e idempotencia;
6. mantenga guards Preview-only para la habilitación inicial.

El modelo actual ya contiene `crm.write`, pero es demasiado amplio y no está conectado a este flujo. Entre los roles actuales, `PLATFORM_PARTNER` es el de menor alcance que incluye `crm.write`; aun así concede muchas capacidades funcionales adicionales y tampoco puede escribir por la ruta cliente actual. No se recomienda cambiar a ese rol como solución inmediata.
