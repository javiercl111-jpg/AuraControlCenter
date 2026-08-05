# Preview External Trust Evidence Index V1

## Evidence set

| File | Purpose |
| --- | --- |
| `PREVIEW_EXTERNAL_TRUST_ACTIVATION_V1.md` | Gate, activation outcome, read-back, deviations, and verdict |
| `PREVIEW_EXTERNAL_TRUST_MATRIX_V1.json` | Sanitized machine-readable secret, WIF, App Check, Vercel, governance, key, and infrastructure state |
| `PREVIEW_EXTERNAL_TRUST_CHANGE_RECORD_V1.md` | Authorized resources, actual writes, stop conditions, and rollback |

All paths are repository-relative. The evidence contains no secret value, Gemini key, access token, site key, debug token, personal email, full project number, local absolute path, or PII.

## Read-only evidence sources

- Secret Manager container, version, and resource-IAM metadata;
- project and service-account IAM;
- service-account user-managed key inventory;
- WIF pool, provider, mapping, condition, and deployer policy;
- Firebase Web App and App Check debug-token inventory;
- App Check provider/service read-back;
- enabled API inventory;
- Vercel project and variable-name/scope inventory without values;
- log metrics, alert policies, notification-channel and budget attempts;
- Functions, Cloud Run, Storage, and Cloud Tasks state.

## External writes under the Change ID

- created `preview-github-pool`;
- created `preview-github-provider`;
- added one repository-scoped `roles/iam.workloadIdentityUser` binding to `preview-deployer`.

No secret version, secret IAM, App Check, reCAPTCHA Enterprise, Vercel, alert, budget, key, deploy, Rules, Storage, or Tasks write occurred.

## Limitations

- internal secret upload rejected before execution;
- Gemini secure material absent;
- App Check provider/enforcement read-back denied;
- reCAPTCHA Enterprise API disabled and definitive Preview domain absent;
- Vercel repository link absent and variables shared with Production scope;
- notification channel, owner, and budget access unavailable.

Verdict: **BLOCKED — PREVIEW EXTERNAL TRUST INCOMPLETE**.
