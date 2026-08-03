# Public Data Classification v1

**Estado:** propuesta pendiente de aprobación de Producto, Seguridad y Privacidad/Compliance

**Nota:** este documento no interpreta ni inventa obligaciones legales.

## 1. Niveles

| Nivel | Definición operativa |
|---|---|
| Público aprobado | Puede aparecer en respuesta pública después de revisión explícita |
| Interno | Operación no sensible por sí sola; no se publica por defecto |
| Confidencial | Datos de negocio o identificadores cuya divulgación causa impacto |
| Restringido | PII, capability, autoridad o contenido con alto impacto; acceso mínimo y auditado |

`Público aprobado` no significa libre de cuota o retención. Los valores de retención son **PROPOSED**, no aprobados, y se cuentan desde completion, expiración o última actividad según el tipo.

## 2. Matriz

| Dato | Clasificación | Fuente | Propósito | Almacenamiento esperado | Exposición permitida | Retención propuesta | Redacción | Logging permitido | Eliminación | Owner propuesto |
|---|---|---|---|---|---|---|---|---|---|---|
| Email | Restringido / PII | Prospecto | Contacto, dedupe y entrega consentida | Lead/link y prospecto; hash separado para cuota | Nunca crudo en respuesta pública | 180 días tras inactividad; decisión DR-004 | Mostrar parcial; hash HMAC para counters | Solo dominio clasificado o hash rotatable; nunca dirección | Cleanup del flujo y borrado propagado | Producto + Privacidad/Compliance |
| Nombre | Restringido / PII | Prospecto | Personalizar sesión y dossier | Link, sesión, prospecto, notificación mínima | Solo al propio poseedor de capability; advisor display se trata aparte | 180 días; DR-004 | Iniciales o `[REDACTED]` | No, salvo fixture sintético | Cleanup/borrado propagado | Producto |
| Teléfono | Restringido / PII | Prospecto | Follow-up consentido | Link/prospecto | Nunca público | 180 días; DR-004 | Últimos 2 dígitos como máximo | No | Cleanup/borrado propagado | Producto + Privacidad/Compliance |
| Empresa | Confidencial; puede ser PII contextual | Prospecto | Contexto Discovery | Link, sesión, prospecto, reporte | A la propia sesión y usuarios autorizados | 180 días; DR-004 | Alias en evidencia | Solo clasificación/tamaño, no valor | Cleanup/borrado propagado | Producto |
| Puesto | Confidencial / PII contextual | Prospecto | Contexto comercial | Link/prospecto/dossier si es necesario | A la propia sesión y usuarios autorizados | 180 días; DR-004 | Generalizar categoría | No valor crudo | Cleanup/borrado propagado | Producto |
| Ubicación | Confidencial / PII contextual | Prospecto | Contexto regional | Link/prospecto/dossier | Estado/ciudad a la propia sesión; no dirección precisa | 180 días; DR-004 | Reducir granularidad | Solo región agregada | Cleanup/borrado propagado | Producto + Privacidad/Compliance |
| Conversación | Restringido | Prospecto y sistema | Diagnóstico y evidencia | `discovery_sessions` | Propia sesión solo cuando el producto lo requiera; CRM scoped | 90 días; DR-004 | PII/secrets y texto hostil | Métricas agregadas; nunca contenido | Borrado de sesión y derivados | Producto + Intelligence |
| Dossier | Restringido / confidencial de negocio | Backend desde conversación | Diagnóstico y reporte | `discovery_sessions`, prospecto por referencia | Prospecto recibe vista externa; interno solo scoped | 180 días; DR-004 | Separar campos internos/externos | IDs de schema, score bucket; no narrativa | Borrado de sesión/reportes derivados | Producto + Discovery |
| Tokens en claro | Restringido / capability | Backend CSPRNG | Acceso temporal | No persistir; navegador solo en memoria/session storage según diseño aprobado | Solo al caller en emisión; nunca repetir | Minutos/horas según capability; máximo 72 h propuesto | Redactar totalmente | Prohibido | Invalidación/revocación y expiración | Seguridad + Backend |
| Hashes de tokens/counters | Restringido | Backend | Verificación, cuota, dedupe | Link, idempotency/rate-limit store | Nunca público | Capability + 7 días; counters por ventana + 7 días | Mostrar prefijo prohibido; usar correlation separada | Solo existencia/versión, nunca hash | TTL/cleanup verificable | Seguridad + Plataforma/SRE |
| Commercial code | Confidencial compartible; señal antiabuso | Organización/asesor | Atribución de asesor | Reserva canónica y link cuando válido; hash para bloqueo | Input público; no listar. Display derivado pendiente DR-002 | Vigencia del asesor; intentos 30 días agregados | Hash HMAC en telemetría | Hash/bucket, nunca pares código-identidad | Desactivar/reservar; cleanup de intentos | Producto Commercial + Seguridad |
| Advisor attribution | Confidencial | Backend desde código/principal | Ownership comercial | Link/prospecto/events | Display name aprobado puede ser público; IDs/UIDs no | Vida del prospecto + política DR-004 | Display o rol, no UID | IDs seudónimos/correlation, no UID | Reasignación auditable y cleanup | Producto Commercial |
| Prospect ID | Interno/confidencial | Backend | Relación canónica | Leads, sessions, reports, events | MUST NOT público | Vida del prospecto; DR-004 | Receipt opaco no reversible | Solo correlation distinta; evitar ID crudo | Borrado/anonimización propagada | Backend Discovery |
| Tenant ID | Restringido / autoridad | Backend authority resolution | Aislamiento | Recursos server-owned | MUST NOT aceptarse del público ni exponerse | Vida del recurso + evidencia mínima | Alias de ambiente/tenant sintético | Solo scope class/bucket; no input | Según ciclo del tenant y audit | Seguridad + Platform Identity |
| Organization ID | Restringido / autoridad | Backend scope resolution | Aislamiento/ownership | Link, session, prospect, report metadata | MUST NOT aceptarse del público ni exponerse | Vida del recurso + evidencia mínima | Alias/correlation | Solo mismatch agregado | Según ciclo de organización y audit | Seguridad + Platform Identity |
| PDFs | Restringido / confidencial | Backend desde dossier | Entrega de radiografía/briefing | Storage privado + metadata | URL firmada corta al scope autorizado; briefing interno nunca público | 30 días después de generación; DR-004/DR-007 | Plantilla externa elimina campos internos | Bytes bucket, tipo, versión; no path/URL | Borrar objeto y metadata; tombstone mínimo | Reports + Privacidad/Compliance |
| Events | Interno/confidencial | Backend | Auditoría y lifecycle | `platform_events` | No público | 180 días; incident/audit decision pendiente | Sin PII; referencias seudónimas | Tipo, resultado, policy version, correlation | TTL/archival o anonimización | Plataforma/SRE + Seguridad |
| Notifications | Confidencial / PII mínima | Backend | Avisar completion | Cloud Tasks, gateway, inbox | Solo destinatario autorizado | Inbox 30 días; task payload mínimo | Evitar email/teléfono/conversación | Delivery outcome y count, no body/name | Dedupe + cleanup de inbox/task | Notifications + Privacidad/Compliance |
| Logs | Interno; restringido si falla redacción | Backend/plataforma | Diagnóstico, abuso e incidentes | Logging central | Solo roles operativos autorizados | 30 días hot; extensión solo por incidente aprobado | Redacción obligatoria de PII/tokens/URLs/IDs de autoridad | Safe codes, buckets, policy version, correlation | Retention policy y purge verificables | Plataforma/SRE + Seguridad |

## 3. Reglas de minimización

- La UI pública MUST enviar únicamente campos del schema de la operación.
- El backend MUST separar documento público, documento canónico y evento de auditoría; no copiar payloads completos.
- Hash simple no anonimiza email, teléfono o código de baja entropía. Para counters se requiere HMAC con secreto rotatable y separación por propósito.
- Los prompts a IA MUST excluir tokens, authority IDs, datos no necesarios y campos internos del dossier.
- PDF externo MUST construirse desde un view model allowlisted, nunca desde serialización directa del dossier.
- Notificaciones MUST contener el mínimo necesario y un solo destinatario resuelto por backend.

## 4. Logging y fixtures

Las pruebas MUST usar emails, nombres, IDs y códigos sintéticos reservados para emulador. Scans de evidencia MUST fallar ante tokens hexadecimales completos, URLs firmadas, emails no-fixture, teléfonos, payloads conversacionales o rutas de Storage. Correlation IDs MUST ser aleatorios y no derivarse de PII.

## 5. Eliminación y evidencia

Cada clase con retención MUST tener: selector de expiración, job/TTL documentado, métrica de backlog, prueba con reloj controlado, evidencia de objeto y metadata eliminados, y procedimiento de reintento. Un campo `expiresAt` sin policy activa y evidencia de cleanup no cuenta como retención verificada.

## 6. Decisiones de compliance pendientes

- Base y duración de retención por finalidad, ambiente y tipo de sujeto.
- Requisitos de borrado, exportación, legal hold e incident preservation.
- Regiones de almacenamiento/procesamiento y proveedores aprobados.
- Contenido mínimo de consentimientos y policy version.
- Acceso operativo, auditoría y segregación de funciones.
- Tratamiento de conversación/IA, PDFs y notificaciones como derivados.

Estas decisiones corresponden a DR-004 y no bloquean la definición técnica de minimización, pero sí bloquean aprobación y configuración de producción.
