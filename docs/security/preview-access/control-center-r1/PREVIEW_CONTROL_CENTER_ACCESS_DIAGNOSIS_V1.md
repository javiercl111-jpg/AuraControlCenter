# Preview Control Center Access Diagnosis V1

## Scope and outcome

This is a read-only diagnosis for the Preview target `aura-intel-preview`. No login, credential handling, provisioning, authority mutation, deployment, commit, push, or Production/Staging operation was performed.

Classification: `J. ROOT_CAUSE_NOT_DETERMINED`

Verdict: `C. BLOCKED — CONTROL CENTER ACCESS ROOT CAUSE NOT SAFELY IDENTIFIED`

The source-side authorization requirement is identified exactly. The subject-specific break point is not identified because the session-scoped `$PreviewUid` was not visible to the isolated command process. Listing users, selecting by recency, or using another locator was intentionally not attempted.

## Gate

- Required branch: `audit/intelligence-preview-control-center-access-r1`
- `HEAD`: `37658dbeaf94b880f869e8f0d260151ea237b64d`
- `origin/main`: `37658dbeaf94b880f869e8f0d260151ea237b64d`
- Worktree status: clean
- Firebase target: `aura-intel-preview`
- Gate result: PASS

## Real Control Center admission chain

1. `src/App.tsx:34` exposes `/login`; `src/App.tsx:46` wraps the administrative application in `ProtectedRoute`.
2. `src/pages/LoginPage.tsx:26` handles submit and `src/pages/LoginPage.tsx:33` calls `signInWithEmailAndPassword`.
3. `src/pages/LoginPage.tsx:46` passes the authenticated subject UID to `isGlobalAdmin`.
4. `src/services/platformAdminService.ts:16` reads `platform_global_admins/{authUid}` first.
5. `src/services/platformAdminService.ts:73` permits access only when a principal is found and active; the sales-advisor case additionally requires a usable advisor binding.
6. `firestore.rules:11-26` defines canonical client authority: the UID-addressed document must exist, `isActive == true`, and `role` must be in the explicit administrative allowlist.
7. `firestore.rules:31-32` allows the subject to read only its own canonical authority document.
8. `src/components/ProtectedRoute.tsx:23-46` repeats the same database-backed check on auth-state changes. `src/components/ProtectedRoute.tsx:62` redirects denied subjects to `/login`.

There is no `AuthContext` in this client path. Firebase `onAuthStateChanged` is used directly. Custom claims are not an authority source: `ProtectedRoute` only compares a token role with the database role and may refresh the token after database authorization succeeds.

## Exact authority required for Control Center access

Required canonical record:

- Collection: `platform_global_admins`
- Document key: authenticated Firebase UID
- Required state: `isActive == true`
- Required role: one of `PLATFORM_OWNER`, `PLATFORM_PARTNER`, `SUPER_ADMIN`, `FOUNDER`, `SALES_DIRECTOR`, `CONSULTANT`, `SALES_ADVISOR`, `VIEWER`, `ADMIN`, or `SUPPORT`
- Additional obligation for `SALES_ADVISOR`: an advisor record must exist and must not be `INACTIVE` or `SUSPENDED`

Control Center admission does not require a tenant membership, tenant record, tenant capability, global wildcard, or a particular custom claim. It does not require `SUPER_ADMIN` specifically.

## Separate tenant-authority chain

The repository also contains a server-only Preview synthetic authority resolver. It is not invoked by `/login` or `ProtectedRoute`.

- `functions/src/infrastructure/firestore/authorityProvisioning/FirestoreAuthorityProvisioningAdapter.ts:17-19` maps principals, tenants, and memberships to `platform_global_admins`, `platform_tenants`, and `tenant_memberships`.
- `functions/src/infrastructure/firestore/authorityProvisioning/FirestoreAuthorityProvisioningAdapter.ts:39-67` looks up the principal by Auth UID, memberships by `principalId`, and tenant by `tenantId`.
- `src/modules/intelligence/serverAuthorityProvisioning/AuthorityProvisioningService.ts:272-317` requires an active Preview principal, exactly one active Preview membership, an active Preview tenant, matching environment/tenant constraints, and returns membership capabilities.
- `src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningTypes.ts:33-62` defines the closed Preview schema.

This synthetic resolver cannot substitute for Control Center admission because its principal schema does not itself satisfy the client/rules requirement for `isActive` plus an allowlisted administrative `role`.

## Subject read-back

| Link | Result |
|---|---|
| Firebase Auth user | NOT EVALUATED — locator unavailable to isolated process |
| Auth disabled state | UNKNOWN |
| Provider count/type | UNKNOWN |
| Platform principal | UNKNOWN |
| Principal state/environment/type | UNKNOWN |
| Membership count and ACTIVE count | UNKNOWN |
| Tenant binding/state/environment | UNKNOWN |
| Roles/capabilities | UNKNOWN |

No subject identifier, personal data, token, secret, credential, or API key was recorded.

## Required versus actual

| Control point | Required | Actual |
|---|---|---|
| Firebase Auth user | Exists and enabled | UNKNOWN |
| Canonical principal | `platform_global_admins/{authUid}` exists | UNKNOWN |
| Principal state | `isActive == true` | UNKNOWN |
| Administrative role | Explicit allowlisted role | UNKNOWN |
| Advisor obligation | Required only for `SALES_ADVISOR` | UNKNOWN |
| Membership/tenant | Not required for Control Center admission | NOT APPLICABLE TO LOGIN |

The first subject-specific break point cannot be selected without the UID-scoped read-back.

## Browser correlation

The public Preview `/login` page rendered the expected Control Center form, the submit button was enabled, and no page warning/error was observed before authentication. This is inconsistent with an evident pre-authentication client bootstrap failure.

For a valid Firebase identity lacking readable canonical authority, the UID document read is rejected by Firestore rules and the submit handler reaches its Firebase error branch. The expected Aura-visible result is a Firebase permission-denied error. If the canonical authority document is readable but a secondary advisor obligation fails, `isGlobalAdmin` returns false, the client signs out, and the dedicated no-permission message is shown. Browser-extension messages such as `chrome-extension://invalid`, `IOContext not set`, or extension listener failures are unrelated noise.

## Proposed Preview-only remediation

No remediation is authorized or applied. After a successful UID-scoped read-back, choose the minimum applicable action:

- If Auth is missing or disabled, stop for explicit identity remediation approval.
- If the canonical principal is missing or invalid, use an audited Admin SDK path to create or repair only `platform_global_admins/{authUid}` with explicit active state and the least privileged allowlisted role needed for Control Center duties.
- Do not add tenant membership or capability merely to satisfy Control Center login; the source does not require them.
- If tenant-scoped Discovery authority is separately required, use the existing private Preview provisioning composition and its idempotent, fail-closed transaction rather than a parallel mechanism.

Any approved change must remain Preview-only, UID-canonical, explicit, idempotent, auditable, fail-closed, and free of wildcard/global privilege not required by the source contract.

## Safe continuation

Expose the existing session value to the command process without printing it, for example by setting an environment variable in the process that launches the audit. Then rerun the Auth and Firestore read-back using that value only as a locator and emit only a truncated SHA-256 locator.
