# Environment Provisioning Approval Packet v1

**Slice:** AI-02H1E.5.R1B

**Decision requested:** approve the controlled future provisioning design for isolated Preview and Staging resources; Production remains preparation/read-only only

**Current verdict:** **CONDITIONAL — PROVISIONING APPROVALS REQUIRED**

## 1. Executive request

Approvers are asked to decide whether the proposed names, projects, locations, billing boundaries, identities, data policies, commands, evidence and rollback controls are sufficient to authorize a later, bounded provisioning change. Approval of this packet does not itself create resources, allow deployment or enable Production traffic.

## 2. Decisions requiring sign-off

| Decision set | IDs | Recommendation | Required sign-off |
|---|---|---|---|
| Architecture/projects | R1A-DEC-01–03 | Model C; reserve `aura-intel-preview` and `aura-intel-staging` | Platform/SRE, Product, Security |
| Production candidate | R1A-DEC-04 | Retain `aura-control-center-debb3` conditionally or reclassify Legacy | Platform/SRE, Product, Security |
| Billing/location | R1A-DEC-05–06 | Separate cost centers; US/`us-central1`/`nam5`/`US` | FinOps, Product, Privacy, Security |
| Vercel/Storage/Tasks | R1A-DEC-07–09 | Separate non-prod projects/bucket/queues; paused and bounded | Release, Deployment, Platform, FinOps, Privacy |
| Data/identities | R1A-DEC-10–12 | Retention/recovery approved; SA per boundary; organizational owners | Privacy, Cloud/IAM, Security, Product |
| Production authority/rollback/migration | R1A-DEC-13–15 | WIF + approvals; tested rollback; preserve/reconcile/recreate/migrate | Release, Deployment, Incident, Product, Security, Privacy |
| Providers | R1A-DEC-16 | Fakes non-prod by default; isolated Staging/Production accounts | Backend, Product, FinOps, Security |

Every decision remains open until the organizational system records the approver role, decision, timestamp and evidence reference.

## 3. Resource and cost summary

- Two new Firebase/Google Cloud projects.
- Two new Vercel projects proposed for strict non-prod separation.
- Per cloud environment: Firestore/Auth, report bucket, paused queue, 12 workload/operational identities, seven empty secret resources, App Check app/provider, metrics/dashboard/alerts, log sink and budget.
- Production: no new resource in this wave; only metadata verification and approved preparation manifest.
- Cost drivers: project baselines, logs/monitoring, Storage, Functions/Run, Firestore, App Check provider, Vercel, Gemini and notification provider.
- Controls: environment budgets, 50/75/90/100% thresholds, forecast alert, provider quotas, Functions minima, queue 1/s/1 concurrent and switches OFF.

Budget values, account IDs and contact channels are supplied through restricted approval evidence, not Git.

## 4. IAM approval summary

- dedicated identity per trust boundary and environment;
- WIF repository/ref/environment conditions and 900-second token target;
- zero USER_MANAGED keys;
- project-level roles only where resource-level scope is unavailable;
- per-secret, per-bucket, per-queue, per-service and per-SA bindings;
- no default compute, Owner, Editor, standing personal privilege or cross-environment impersonation;
- break-glass is time-bound privileged access, not a persistent SA.

Cloud/IAM Administrator proposes effective bindings; Security Owner approves; Deployment Approver gates deploy identities.

## 5. Command/change summary

The command catalog separates:

1. read-only verification;
2. project/billing/API writes;
3. identities/WIF/IAM writes;
4. data-plane/queue/secret writes;
5. observability/budget/Vercel operations;
6. rollback;
7. evidence capture.

All commands are parameterized, project/environment explicit and fail closed. App Check/Auth procedures remain blocked until an exact supported API/console workflow is approved; no fictitious command is accepted.

## 6. Risk acceptance

| Risk | Control | Approver |
|---|---|---|
| Global project/bucket name unavailable | Read-only availability + new decision; no silent suffix | Platform/SRE + Product |
| Wrong org/folder/billing | Pre/write/read-back checks and abandon path | Product + FinOps |
| Inherited broad IAM | Stop before roles/workloads; security review | Security |
| Region/data policy mismatch | Location approval before irreversible resource | Privacy + Security |
| Key/secret exposure | Key denial, no-value evidence and scoped accessor | Security |
| Queue/provider cost amplification | Paused queue, 1/s/1, quotas/switches/budgets | Platform + FinOps |
| Vercel env leak | Separate projects, name-only env evidence, protection | Release + Deployment |
| Production mis-target | Exact guard, WIF environment, no Production writes in wave | Deployment + Security |
| Rollback cannot restore data | Backup/restore approval before TTL/migration | Privacy + Incident |

An approver may reject or request changes. P0, project ambiguity, missing rollback and unknown effective IAM cannot be accepted as exceptions.

## 7. Rollback commitment

Provisioning proceeds one bounded step at a time. Failure freezes dependent steps and returns to an empty/disabled safe state: abandoned project, billing unlinked when approved, WIF disabled, binding revoked, queue paused, secret version disabled, non-prod Vercel project unlinked. Rollback never relaxes Rules or changes Production.

## 8. Evidence commitment

Required evidence includes project/billing/API/Firebase metadata, SA/key counts, IAM/WIF, Firestore location, bucket policy, queue state, secret metadata, App Check apps, Vercel targeting, budgets, dashboards, alerts, isolation and rollback exercises. Restricted raw evidence is hashed; repository summaries are sanitized.

## 9. Sign-off checklist

| Role | Approval scope | Required before |
|---|---|---|
| Product Owner | Project count/IDs, costs, owner assignments | Any project create |
| Security Owner | Environment model, IAM/WIF, secrets, App Check, residual risk | Any IAM/security write |
| Platform/SRE Owner | Projects, regions, resources, operational ownership | Provisioning change |
| Cloud/IAM Administrator | Binding feasibility and key policy | Identity/WIF wave |
| Firebase Administrator | Firebase/Firestore/Auth/App Check procedure | Firebase enablement |
| FinOps Owner | Billing, budgets, thresholds and provider caps | Billing link |
| Privacy/Compliance Approver | Residency, data, lifecycle, retention, recovery | Data resource create/use |
| Release Engineering Owner | Vercel/Git/Node/artifact targeting | Non-prod Vercel config |
| Deployment Approver | Change manifest, actor separation and abort owner | Each write wave |
| Incident Commander | Rollback, routing and break-glass exercises | Staging use |

## 10. Approval outcomes

- `APPROVED_FOR_CONTROLLED_PROVISIONING`: all required fields/roles/evidence references complete; authorizes drafting a separate execution change only.
- `CHANGES_REQUIRED`: packet returns to R1B design.
- `REJECTED`: no resource write; record reason and preserve current state.

Current outcome is `CHANGES_REQUIRED_EXTERNAL_SIGN_OFF`; provisioning remains blocked.
