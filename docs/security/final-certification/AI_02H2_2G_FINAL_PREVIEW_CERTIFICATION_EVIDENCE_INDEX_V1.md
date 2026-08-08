# AI-02H2.2G Final Preview Certification Evidence Index V1

Date: 2026-08-08  
Target: `aura-intel-preview`

## Authority

| Evidence | Source | Certified conclusion |
|---|---|---|
| FC-E01 | `docs/security/discovery/end-to-end-preview/identity-tenant/authority-capability/PREVIEW_AUTHORITY_PROVISIONING_CAPABILITY_V1.md` | Preview authority provisioning contract uses canonical locators and grants no global administrator role |
| FC-E02 | `docs/security/discovery/end-to-end-preview/containment/authority/composition/PREVIEW_CONTAINMENT_AUTHORITY_COMPOSITION_CERTIFICATION_V1.md` | Exact principal, membership, tenant and capability resolution; actor/approver separation; fail-closed composition |
| FC-E03 | `docs/security/discovery/end-to-end-preview/containment/control-plane/PREVIEW_CONTAINMENT_CONTROL_PLANE_CERTIFICATION_V1.md` | Authority verifier `ALLOW` required; immutable activation, audit and separation-of-duties contract certified |

## Containment and policy renewal

| Evidence | Source | Certified conclusion |
|---|---|---|
| FC-E04 | `docs/security/discovery/end-to-end-preview/containment/activation-r2/PREVIEW_CONTAINMENT_POLICY_ACTIVATION_R2_V1.md` | Controlled containment activation contract and bounded Preview quotas certified |
| FC-E05 | `docs/security/discovery/end-to-end-preview/containment/activation-renewal/PREVIEW_CONTAINMENT_POLICY_RENEWAL_READINESS_V1.md` | Expired policy diagnosis, immutable v2 plan and dry-run readiness documented |
| FC-E06 | `docs/security/discovery/end-to-end-preview/containment/activation-renewal/PREVIEW_CONTAINMENT_POLICY_RENEWAL_MATRIX_V1.json` | Renewal proposal, authority, separation, dry-run and zero-write matrix |
| FC-E07 | `docs/security/discovery/end-to-end-preview/final-discovery-validation/PREVIEW_FINAL_DISCOVERY_VALIDATION_V1.md` | Post-apply read-back resolved `preview-containment-v2`, active pointer present, policy active and containment allowed |

## Discovery and replay

| Evidence | Source | Certified conclusion |
|---|---|---|
| FC-E08 | `docs/security/discovery/end-to-end-preview/final-discovery-validation/PREVIEW_FINAL_DISCOVERY_VALIDATION_MATRIX_V1.json` | App Check/Auth valid; intake and completion success; authoritative deltas +1/+1/+1; duplicates 0 |
| FC-E09 | `docs/security/discovery/end-to-end-preview/final-discovery-validation/PREVIEW_FINAL_DISCOVERY_VALIDATION_EVIDENCE_INDEX_V1.md` | Sanitized browser, callable, telemetry, persistence, side-effect and environment evidence |
| FC-E10 | `docs/security/discovery/end-to-end-preview/replay-exactly-once/PREVIEW_REPLAY_EXACTLY_ONCE_CERTIFICATION_V1.md` | Remote resolution replay had zero mutation; isolated suites certified completion exactly-once; `GAP-2F-01` retained |
| FC-E11 | `docs/security/discovery/end-to-end-preview/replay-exactly-once/PREVIEW_REPLAY_EXACTLY_ONCE_MATRIX_V1.json` | Replay resource matrix remained unchanged and validation suites passed |
| FC-E12 | `docs/security/discovery/end-to-end-preview/replay-exactly-once/PREVIEW_REPLAY_EXACTLY_ONCE_EVIDENCE_INDEX_V1.md` | Remote request cardinality, zero deltas, side-effect checks and conditional gap enumerated |

## Control Center, CRM and least privilege

| Evidence | Source | Certified conclusion |
|---|---|---|
| FC-E13 | `docs/security/preview-access/control-center-r3/PREVIEW_GLOBAL_ADMIN_PROVISIONING_CERTIFICATION_V1.md` | Minimum login-compatible role is `VIEWER`; stronger roles were not selected |
| FC-E14 | `docs/security/preview-access/control-center-r7/PREVIEW_CRM_LEAD_CREATE_BACKEND_CERTIFICATION_V1.md` | CRM create moved from denied direct client writes to authenticated, App Check protected, capability-gated backend transaction |
| FC-E15 | `docs/security/preview-access/control-center-r8a/PREVIEW_CRM_LEAD_CREATE_REMOTE_ACTIVATION_V1.md` | Exact capability present; role remained `VIEWER`; Function active; Cloud Run ready; unexpected capabilities 0 |
| FC-E16 | `docs/security/preview-access/control-center-r9/PREVIEW_CRM_SYNTHETIC_PROSPECT_CREATE_CERTIFICATION_V1.md` | Authenticated Control Center session and one controlled CRM create certified; access restored |
| FC-E17 | `docs/security/preview-access/control-center-r9/PREVIEW_CRM_SYNTHETIC_PROSPECT_CREATE_MATRIX_V1.json` | Authorization allow, created outcome, count 2→3, duplicates 0, client Firestore writes deny |
| FC-E18 | `docs/security/preview-access/control-center-r9/PREVIEW_CRM_SYNTHETIC_PROSPECT_CREATE_CHANGE_RECORD_V1.md` | Role, capability, runtime and client-write boundaries remained unchanged after creation |

## Final gap register

| Gap | Severity | Blocking | Disposition |
|---|---|---:|---|
| `GAP-2F-01` — no live remote `completion.replayed`; remote replay covered completed-session resolution and isolated suites covered completion replay | Non-blocking control-evidence gap | No | Retained transparently; requires a separately authorized safe replay harness to close |

No additional test, browser operation, remote read/write, deployment or provisioning was performed for this assembly. This index contains no identity value, personal data, credential, secret value or local absolute path.
