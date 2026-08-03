# Discovery Public Intake Security

Esta carpeta contiene la baseline AI-02H1E.4.1 para el hardening del intake público Discovery.

**Estado general:** **THREAT-MODEL BASELINE COMPLETE — PENDING PRODUCT AND SECURITY APPROVAL**

**Producción:** no autorizada por estos documentos.

## Orden de lectura

1. [Public Intake Threat Model v1](PUBLIC_INTAKE_THREAT_MODEL_V1.md) — alcance, arquitectura, inventario, amenazas, controles y brechas.
2. [Public Surface Contract v1](PUBLIC_SURFACE_CONTRACT_V1.md) — exposición, credenciales, campos, respuestas, replay e invariantes objetivo.
3. [Public Data Classification v1](PUBLIC_DATA_CLASSIFICATION_V1.md) — clasificación, minimización, retención y decisiones de compliance.
4. [Public Intake Limits v1](PUBLIC_INTAKE_LIMITS_V1.md) — valores iniciales propuestos, mínimos y configuración requerida.
5. [Public Containment Policy v1](PUBLIC_CONTAINMENT_POLICY_V1.md) — kill switches, emergency quotas, IAM, fail behavior y rollback.
6. [Public Intake Certification Plan v1](PUBLIC_INTAKE_CERTIFICATION_PLAN_V1.md) — 22 pruebas de abuso y gates de emulador.
7. [Public Intake Decision Register v1](PUBLIC_INTAKE_DECISION_REGISTER_V1.md) — decisiones abiertas, roles y RACI.
8. [Public Intake Hardening Roadmap v1](PUBLIC_INTAKE_HARDENING_ROADMAP_V1.md) — secuencia P2–P10, dependencias y condiciones de detención.
9. [Atomic Public Rate Limits v1](ATOMIC_PUBLIC_RATE_LIMITS_V1.md) — infraestructura reusable y adapter Firestore implementados por AI-02H1E.4.2.

## Cómo interpretar la baseline

- Los documentos describen contratos y mitigaciones objetivo, no garantías del runtime actual.
- `PROPOSED` y `PRODUCT DECISION REQUIRED` nunca significan aprobado.
- `SECURITY MINIMUM` requiere validación e implementación antes de poder certificarse.
- `PLATFORM CONFIGURATION REQUIRED` exige evidencia del valor efectivo por ambiente.
- App Check es una señal de aplicación, no identidad humana ni autoridad tenant.
- La baseline no implementa ni modifica handlers, Rules, Firebase, providers, telemetría o deploy.

## Gates para avanzar

No iniciar implementación sin aprobar las decisiones necesarias para el slice. No reanudar D.10S hasta cerrar P2–P9, mantener D.9 Authority verde, ejecutar 22/22 pruebas en emuladores, verificar configuración efectiva y demostrar cero PII/tokens en logs.

## Versionado

Cambios de superficie, provider, capability, clasificación, retención, cuota, kill switch, trust boundary o ambiente requieren actualizar el threat model, contrato, pruebas, decision register y roadmap bajo una nueva revisión.
