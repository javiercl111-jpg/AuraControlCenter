# Preview Control Center Access Evidence Index V1

## Evidence register

| ID | Source | Observation |
|---|---|---|
| E-01 | Git and Firebase CLI gate | Required branch active; `HEAD == origin/main`; clean status; target `aura-intel-preview`. |
| E-02 | `src/App.tsx:34,46` | `/login` is public and the administrative route tree is wrapped by `ProtectedRoute`. |
| E-03 | `src/pages/LoginPage.tsx:26-55` | Submit authenticates with Firebase, then calls `isGlobalAdmin` with the subject UID; denied authority signs out. |
| E-04 | `src/services/platformAdminService.ts:10-94` | Canonical lookup is UID-first in `platform_global_admins`; active administrative principals are admitted, with an extra advisor-state check for `SALES_ADVISOR`. |
| E-05 | `firestore.rules:11-32` | Canonical client authority requires the UID-addressed document, `isActive == true`, and an allowlisted role. Only the subject's own canonical document is readable. |
| E-06 | `src/components/ProtectedRoute.tsx:12-62` | Auth state is checked directly; the same database authority gate controls route access; denied state redirects to `/login`. |
| E-07 | `functions/src/infrastructure/firestore/authorityProvisioning/FirestoreAuthorityProvisioningAdapter.ts:17-67` | The separate server resolver persists principals, memberships, and tenants in the named collections and queries membership by `principalId`. |
| E-08 | `src/modules/intelligence/serverAuthorityProvisioning/AuthorityProvisioningService.ts:272-317` | The server-only Preview resolver requires active principal, exactly one active membership, active tenant, and Preview environment consistency. |
| E-09 | `src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningTypes.ts:33-62` | Closed Preview principal/tenant/membership schemas and capability source. |
| E-10 | Public `/login` browser inspection | Expected form rendered; submit enabled; no warning/error observed; no credential entered and no login attempted. |
| E-11 | Sanitized variable availability check | `$PreviewUid` and an environment equivalent were unavailable to the isolated command process. No raw identifier was emitted. |

## Evidence boundary

No Firebase Auth user, principal, membership, or tenant document was read because the only authorized locator could not be accessed by the command process. No alternative locator was used. Therefore the actual authority chain remains unknown and no root-cause classification narrower than `J` is supported.

## Artifact index

1. `PREVIEW_CONTROL_CENTER_ACCESS_DIAGNOSIS_V1.md`
2. `PREVIEW_CONTROL_CENTER_ACCESS_MATRIX_V1.json`
3. `PREVIEW_CONTROL_CENTER_ACCESS_EVIDENCE_INDEX_V1.md`
4. `PREVIEW_CONTROL_CENTER_ACCESS_CHANGE_RECORD_V1.md`
