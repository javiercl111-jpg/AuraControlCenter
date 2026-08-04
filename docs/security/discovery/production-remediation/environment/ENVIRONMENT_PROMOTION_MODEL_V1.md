# Environment Promotion Model v1

**Slice:** AI-02H1E.5.R1A

**Estado:** diseño documental; ninguna acción de CI, Vercel, Firebase o Google Cloud fue ejecutada

## 1. Invariantes

1. La secuencia obligatoria es `branch → PR → Preview → merge → Staging deployment → staging certification → approval → Production deployment → smoke tests → traffic enablement → post-deploy verification`.
2. Staging es el único ambiente desde el que se promueve el mismo artefacto inmutable a Production.
3. Un merge no despliega automáticamente Production.
4. Production no depende del alias `default`; todo comando valida `--project` o un alias explícito aprobado.
5. Deployment y traffic enablement son cambios separados.
6. Preview no recibe secretos, variables, buckets, queues, identities ni endpoints Production.

## 2. Branch y Vercel policy

| Branch/evento | Deployment permitido | Ambiente | Recursos costosos | Datos | Expiración/protección |
|---|---|---|---|---|---|
| Feature branch con PR abierto | Preview automático protegido | PREVIEW | OFF por default | Sintéticos/anonimizados | Eliminar al cerrar PR; acceso interno |
| `audit/*`, `test/*`, pruebas de abuso | Build/test sin deployment cloud por default | LOCAL_DEMO | Prohibidos | Fixtures | Sin deployment; excepción requiere aprobación explícita |
| `main` después de merge | Build inmutable y Staging manual | STAGING | OFF/quotas mínimas | Sintéticos representativos | Deployment protegido y evidence retention |
| Tag/release record aprobado | Promoción manual del artefacto Staging | PRODUCTION | OFF, quotas 0, queue paused | Reales sólo tras enablement separado | Change window y dos roles |
| Branch no reconocida | Ninguno | Ninguno | Prohibidos | Ninguno | Guard falla cerrado |

Vercel Preview usa variables target `preview`, dominio temporal y deployment protection. El frontend Preview sólo puede llamar Functions Preview mediante allowlist de origen y App Check del mismo ambiente. No puede resolver un endpoint productivo aunque una variable falte: el build debe fallar.

Se recomienda un proyecto Vercel separado para Staging. Una alternativa dentro del proyecto existente sólo es aceptable si demuestra separación equivalente de variables, dominios, protección, logs, budget y deployment authority.

## 3. Pipeline controlado

| Paso | Actor | Approver | Evidencia | Gate | Rollback | Stop condition |
|---:|---|---|---|---|---|---|
| 1. Branch | Developer | Repository policy | Commit firmado/identificado y scope | Tests locales | Descartar branch | Secret, PII o config productiva en diff |
| 2. PR | Developer | Code owners | Review, threat/control impact | CI verde | Cerrar PR | Self-approval o checks omitidos |
| 3. Preview | CI Preview WIF | Release Engineering Owner | Target/variables por nombre, deployment URL protegido | R1B Preview guard | Eliminar deployment | Cualquier referencia Production |
| 4. Merge | Merge authority | Code owners | Merge commit inmutable | Required checks | Revert por PR | Branch protection bypass |
| 5. Staging deployment | Release Engineering Owner | Deployment Approver | Artifact digest, SBOM, provenance, explicit project | G1–G3 | Revision Staging previa | Artifact/target mismatch |
| 6. Staging certification | Readiness Auditor + owners | Security Owner | P2–P8, D.9, D.8, Rules/negative tests, smoke evidence | G4–G7 | Switches OFF, queue pause | Falla, PII o side effect fuera de Staging |
| 7. Approval | Deployment Approver | Security/Product según control | Immutable change manifest y rollback rehearsal | G8 | Cancelar window | Evidencia stale o approver conflict |
| 8. Production deployment | CI Production WIF | Deployment Approver | Mismo digest que Staging, read-back de config | G9 | Revision certificada previa | Superficie habilitada o target ambiguo |
| 9. Smoke tests | Release Engineering + Platform/SRE | Incident Commander | Metadata y canarios mínimos aprobados | G9 | Containment + rollback | Error, alert unavailable o write inesperado |
| 10. Traffic enablement | Platform/SRE Owner | Cambio operativo separado | Approval record, kill switches, quotas y alerts | Después de G11 | Switch OFF/quotas 0/queue pause | Ausencia de owner/on-call o budget |
| 11. Post-deploy verification | Readiness Auditor | Independent Readiness Reviewer | Config diff, metrics, logs sanitizados y final record | Gate del cambio operativo | Containment/revision rollback | Drift, P0 o unknown bloqueante |

## 4. Modelo de aliases objetivo

`.firebaserc` no se modifica en R1A. R1B deberá materializar exactamente estos aliases lógicos:

| Alias | Target | Uso permitido |
|---|---|---|
| `demo` | `demo-*` Emulator only | Comandos locales con `--project=demo-*` |
| `preview` | ID aprobado del proyecto Preview | CI de PR |
| `staging` | ID aprobado del proyecto Staging | Deploy/certificación desde `main` |
| `production` | ID productivo aprobado | Promoción manual desde artefacto Staging |

El alias `default` no es un target válido para deployment. Su presencia legacy no otorga autoridad y debe eliminarse después de que R1B demuestre que ningún script depende de él.

## 5. Guard de targeting

Antes de cualquier comando de write, el workflow deberá validar:

- project ID exacto contra un manifest versionado;
- alias explícito distinto de `default`;
- environment declarado coincide con project, branch y Vercel target;
- actor usa WIF aprobado y no credenciales personales;
- branch/evento está permitido;
- Production exige change record y Deployment Approver;
- Preview/audit/test no puede activar Gemini, notification gateway ni queues costosas;
- artifact digest coincide con el certificado en Staging.

El guard falla cerrado si falta cualquier valor. No se permite fallback a configuración activa de Firebase CLI o gcloud.

Ejemplos futuros de disciplina, no ejecutados por R1A:

```text
firebase deploy --only functions --project=<STAGING_PROJECT_ID>
firebase deploy --only functions --project=<PRODUCTION_PROJECT_ID>
gcloud tasks queues describe <QUEUE> --location=us-central1 --project=<EXPLICIT_PROJECT_ID>
```

## 6. Staging certification

Staging despliega el mismo artifact candidate con:

- switches OFF;
- costly quotas 0;
- queues `PAUSED`;
- `minInstances=0`, max 1 y concurrency 1 durante rollout;
- Rules production-like cerradas;
- App Check production-like;
- TTL e índices efectivos;
- bucket, queues, secretos e identities exclusivos;
- dashboards, alerts y budgets propios;
- smoke tests sintéticos y restore/rollback exercise.

El promotion record contiene commit, digest, source provenance, environment manifest version, config diff, suites, read-back, owner, approver, timestamp, rollback target y exceptions con expiry.

## 7. Production promotion y enablement

Production recibe el mismo digest, nunca un rebuild. El deployment inicial conserva superficies OFF y queue paused. El read-back verifica Functions, runtime identities, Rules hash, App Check, TTL, índices, Storage, Tasks, secrets por nombre, containment y alert routing.

R11 revalida sólo metadata. R12 emite revisión independiente. Incluso después de R12, traffic enablement necesita un cambio operativo separado, gradual y reversible.

## 8. Rollback

Orden obligatorio:

1. switches OFF y emergency quotas 0;
2. pause de queues y bloqueo del notification gateway;
3. traffic/revision rollback al artifact certificado previo;
4. rollback del frontend a un deployment compatible;
5. conservar Rules backend-only y prohibición client-write;
6. restaurar sólo bindings específicos requeridos por el workload previo seguro;
7. preservar logs/audit y abrir incident review.

El deployment Production vigente al corte P9 es el rollback legacy provisional para Functions, no una baseline segura. Su uso requiere containment porque precede P1–P8. El frontend Vercel en el merge P9 es el rollback frontend provisional hasta registrar un artifact compatible.

TTL, deletes y migraciones de datos no tienen rollback automático; requieren backup/restore aprobado antes del write.

## 9. Condiciones de detención

Detener promoción si hay proyecto o alias ambiguo; branch/actor no autorizado; Preview referencia Production; Staging no es equivalente; artifact digest cambia; Rules remotas no son legibles; runtime usa default compute/Editor; queue no está bounded; alert/rollback/break-glass falla; o aparece un P0/unknown bloqueante.
