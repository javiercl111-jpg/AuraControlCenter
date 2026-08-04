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
10. [Idempotency Retention v1](IDEMPOTENCY_RETENTION_V1.md) — TTL, cardinalidad y recuperación certificable de AI-02H1E.4.3.
11. [Capability Lifecycle v1](CAPABILITY_LIFECYCLE_V1.md) — EXCHANGE/SESSION/REPORT, revocación y completion exactamente una vez de AI-02H1E.4.4.

12. [Strict Payload and Cost Bounds v1](STRICT_PAYLOAD_AND_COST_BOUNDS_V1.md) — esquemas públicos fail-closed, proyección de persistencia y presupuestos atómicos de AI, conversación, reporte y descarga de AI-02H1E.4.5.

13. [Structured Abuse Telemetry v1](STRUCTURED_ABUSE_TELEMETRY_V1.md) — eventos estructurados sin PII, correlación determinista y métricas atómicas de AI-02H1E.4.6.

14. [Kill Switches and Emergency Quotas v1](KILL_SWITCHES_AND_EMERGENCY_QUOTAS_V1.md) — contención backend versionada, bloqueos selectivos, cuotas P2, auditoría y rollback de AI-02H1E.4.7.

## Cómo interpretar la baseline

- Los documentos describen contratos y mitigaciones objetivo, no garantías del runtime actual.
- `PROPOSED` y `PRODUCT DECISION REQUIRED` nunca significan aprobado.
- `SECURITY MINIMUM` requiere validación e implementación antes de poder certificarse.
- `PLATFORM CONFIGURATION REQUIRED` exige evidencia del valor efectivo por ambiente.
- App Check es una señal de aplicación, no identidad humana ni autoridad tenant.
- La baseline no implementa ni modifica handlers, Rules, Firebase, providers, telemetría o deploy.

## Gates para avanzar

No iniciar implementación sin aprobar las decisiones necesarias para el slice. No reanudar D.10S hasta cerrar P2–P9, mantener D.9 Authority verde, ejecutar 22/22 pruebas en emuladores, verificar configuración efectiva y demostrar cero PII/tokens en logs.

## Public Intake Emulator Abuse Certification

[Public Intake Emulator Abuse Certification v1](PUBLIC_INTAKE_EMULATOR_ABUSE_CERTIFICATION_V1.md) documenta el harness cerrado, la matriz CT-01 a CT-22, el seam App Check, la evidencia P2-P7 y las regresiones de AI-02H1E.4.8.

## Versionado

Cambios de superficie, provider, capability, clasificación, retención, cuota, kill switch, trust boundary o ambiente requieren actualizar el threat model, contrato, pruebas, decision register y roadmap bajo una nueva revisión.

## Production Readiness Remediation Program

- [Production Readiness Remediation Program v1](production-remediation/PRODUCTION_READINESS_REMEDIATION_PROGRAM_V1.md) — dominios, slices y estrategias de ambientes, trust root, IAM, deployment, lifecycle, observabilidad y runbooks.
- [Production Readiness Remediation Matrix v1](production-remediation/PRODUCTION_READINESS_REMEDIATION_MATRIX_V1.json) — especificación ejecutable de 19 slices y trazabilidad 35/35 de controles P9.
- [Production Readiness Execution Sequence v1](production-remediation/PRODUCTION_READINESS_EXECUTION_SEQUENCE_V1.md) — grafo, waves, ruta crítica, comandos futuros y stop conditions.
- [Production Readiness RACI v1](production-remediation/PRODUCTION_READINESS_RACI_V1.md) — roles organizacionales, accountability, approvals y escalación.
- [Production Readiness Gates v1](production-remediation/PRODUCTION_READINESS_GATES_V1.md) — gates acumulativos desde diseño hasta certificación final.

### R1A — Environment Decision and Resource Allocation

- [Environment Architecture Decision v1](production-remediation/environment/ENVIRONMENT_ARCHITECTURE_DECISION_V1.md) — modelo de cuatro ambientes, alternativa de proyectos, candidato productivo, regiones, datos e identidades.
- [Environment Resource Allocation Matrix v1](production-remediation/environment/ENVIRONMENT_RESOURCE_ALLOCATION_MATRIX_V1.json) — asignación completa de recursos, estado y ownership por ambiente.
- [Environment Promotion Model v1](production-remediation/environment/ENVIRONMENT_PROMOTION_MODEL_V1.md) — branches, Preview, Staging, promoción, targeting y rollback.
- [Environment External Decisions v1](production-remediation/environment/ENVIRONMENT_EXTERNAL_DECISIONS_V1.md) — aprobaciones externas que bloquean provisioning y R1B.
- [Environment Migration Strategy v1](production-remediation/environment/ENVIRONMENT_MIGRATION_STRATEGY_V1.md) — preserve, migrate, recreate, deprecate y delete-later sin ejecutar cambios.
