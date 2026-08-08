# PREVIEW CRM Lead Create Remote Activation Evidence Index V1

| ID | Sanitized evidence | Result |
|---|---|---|
| R8A-E01 | Repository handoff gate | Exact branch/base; only inherited R8 changes |
| R8A-E02 | Firebase/GCP active target | Both `aura-intel-preview` |
| R8A-E03 | External locator gate | Loaded and non-empty; value not recorded |
| R8A-E04 | Fresh capability dry-run | `WOULD_CREATE`, writes `0` |
| R8A-E05 | Single capability apply | `CREATED`, role preserved, no additional capability |
| R8A-E06 | Capability read-back | `VIEWER`, exact grant present, contract valid |
| R8A-E07 | Runtime identity discovery | Dedicated identity initially missing |
| R8A-E08 | Runtime identity creation/read-back | Created and enabled for use |
| R8A-E09 | Runtime key inventory | User-managed keys `0` |
| R8A-E10 | Datastore User apply/read-back | `PRESENT`; no unexpected role |
| R8A-E11 | Logs Writer apply/read-back | `PRESENT`; exactly two project roles total |
| R8A-E12 | Final IAM read-back | Required roles present; privileged unexpected roles `0` |
| R8A-E13 | R7 backend and frontend suites | 35/35 PASS |
| R8A-E14 | Capability and deployment guard suites | 27/27 PASS |
| R8A-E15 | Rules guards | 19/19 PASS |
| R8A-E16 | Deployment unit and runtime contracts | 40/40 PASS |
| R8A-E17 | TypeScript, Functions build, compiled guard | PASS |
| R8A-E18 | Selective Firebase deployment | One invocation; exact Function target; success |
| R8A-E19 | Function read-back | `ACTIVE`; expected entrypoint, region, runtime identity |
| R8A-E20 | Cloud Run read-back | Service ready; latest revision ready; failed `0` |
| R8A-E21 | App Check contract | `enforceAppCheck: true` in deployed callable options |
| R8A-E22 | Frontend HTTP/bundle read-back | HTTP 200; served bundle contains callable path |
| R8A-E23 | Client boundary source/tests | Callable create; no direct Firestore add for create |
| R8A-E24 | Final authority read-back | `VIEWER`; capability present; unexpected `0` |
| R8A-E25 | Functional mutation boundary | Callable not invoked; prospects created `0` |
| R8A-E26 | Evidence and diff validation | Four exact documents, valid JSON, `git diff --check` PASS |

No raw provider responses, personal identifiers, full locators, tokens, credentials, service account addresses, key material, local absolute paths, or full deployment identifiers are retained.
