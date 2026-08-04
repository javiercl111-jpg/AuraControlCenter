# Environment Provisioning Command Catalog v1

**Slice:** AI-02H1E.5.R1B

**Estado:** catálogo de comandos futuros; ninguno fue ejecutado por R1B

## 1. Guard común

Cada sesión futura fija y valida parámetros antes de una operación. Los placeholders no son valores ejecutables.

```powershell
$EnvironmentName = '<preview|staging|production>'
$ProjectId = '<EXPLICIT_PROJECT_ID>'
$ExpectedProjectId = '<APPROVED_PROJECT_ID>'
$Region = 'us-central1'
$FirestoreLocation = 'nam5'
$StorageLocation = 'US'

if ($ProjectId -ne $ExpectedProjectId) { throw 'Project mismatch' }
if ($EnvironmentName -notin @('preview', 'staging', 'production')) { throw 'Unknown environment' }
if ($ProjectId -eq 'default') { throw 'Implicit default target prohibited' }
```

Todo write se ejecuta sólo desde change manifest aprobado, con WIF del environment, command ID, approver y rollback. Ningún comando imprime secret values, tokens, object names, users o contacts.

## 2. Read-only verification

| ID | Future command | Purpose |
|---|---|---|
| RO-PROJECT-01 | `gcloud projects describe $ProjectId --format=json` | Project metadata/labels/lifecycle |
| RO-BILLING-01 | `gcloud billing projects describe $ProjectId --format=json` | Billing linkage metadata |
| RO-API-01 | `gcloud services list --enabled --project=$ProjectId --format=json` | Enabled APIs |
| RO-FIREBASE-01 | `firebase projects:list --json` | Inventory; filter result to exact `$ProjectId` before any follow-up |
| RO-APP-01 | `firebase apps:list WEB --project=$ProjectId --json` | Web App metadata only |
| RO-FIRESTORE-01 | `gcloud firestore databases describe --database='(default)' --project=$ProjectId --format=json` | Database location/protection/recovery |
| RO-TTL-01 | `gcloud firestore fields ttls list --project=$ProjectId --format=json` | TTL status |
| RO-INDEX-01 | `gcloud firestore indexes composite list --project=$ProjectId --format=json` | Composite indexes |
| RO-SA-01 | `gcloud iam service-accounts list --project=$ProjectId --format=json` | Service-account metadata |
| RO-KEY-01 | `gcloud iam service-accounts keys list --iam-account=<SERVICE_ACCOUNT_ID>@$ProjectId.iam.gserviceaccount.com --managed-by=user --project=$ProjectId --format=json` | Prove USER_MANAGED=0 |
| RO-IAM-01 | `gcloud projects get-iam-policy $ProjectId --format=json` | Sanitized project bindings |
| RO-WIF-01 | `gcloud iam workload-identity-pools list --location=global --project=$ProjectId --format=json` | Pool inventory |
| RO-WIF-02 | `gcloud iam workload-identity-pools providers list --workload-identity-pool=<POOL_ID> --location=global --project=$ProjectId --format=json` | Provider/conditions |
| RO-BUCKET-01 | `gcloud storage buckets describe gs://<EXACT_BUCKET_NAME> --project=$ProjectId --format=json` | Location/PAP/UBLA/lifecycle/retention |
| RO-BUCKET-IAM-01 | `gcloud storage buckets get-iam-policy gs://<EXACT_BUCKET_NAME> --project=$ProjectId --format=json` | Sanitized bucket IAM |
| RO-QUEUE-01 | `gcloud tasks queues describe <EXACT_QUEUE_NAME> --location=$Region --project=$ProjectId --format=json` | State/rate/retry/routing |
| RO-SECRET-01 | `gcloud secrets list --project=$ProjectId --format=json` | Secret metadata only |
| RO-SECRET-IAM-01 | `gcloud secrets get-iam-policy <EXACT_SECRET_NAME> --project=$ProjectId --format=json` | Consumer binding; no value |
| RO-LOG-01 | `gcloud logging metrics list --project=$ProjectId --format=json` | Log metric metadata |
| RO-SINK-01 | `gcloud logging sinks list --project=$ProjectId --format=json` | Sink metadata |
| RO-DASH-01 | `gcloud monitoring dashboards list --project=$ProjectId --format=json` | Dashboard metadata |
| RO-ALERT-01 | `gcloud monitoring policies list --project=$ProjectId --format=json` | Alert metadata |
| RO-FUNCTION-01 | `gcloud functions list --v2 --regions=$Region --project=$ProjectId --format=json` | Function runtime/service config |
| RO-RUN-01 | `gcloud run services list --region=$Region --project=$ProjectId --format=json` | Backing service/ingress metadata |
| RO-VERCEL-01 | `vercel project inspect <EXACT_VERCEL_PROJECT_NAME>` | Project/Git/Node metadata; read-only token scope required |

Name availability is a read-only precondition performed by the owning platform. A global list is never treated as authority without exact organization scope and sanitized evidence.

## 3. Provisioning writes — projects, billing and APIs

| ID | Future command | Precondition |
|---|---|---|
| PRV-PROJECT-01 | `gcloud projects create $ProjectId --name='<APPROVED_DISPLAY_NAME>' --folder='<APPROVED_FOLDER_ID>'` | Project name/organization/folder approved |
| PRV-BILLING-01 | `gcloud billing projects link $ProjectId --billing-account='<APPROVED_BILLING_ACCOUNT_ID>'` | FinOps + Product approval |
| PRV-LABELS-01 | `gcloud projects update $ProjectId --update-labels=app=aura-intelligence,environment=$EnvironmentName,program=ai-02h1e-5,managed-by=platform,data-class=<APPROVED_DATA_CLASS>,cost-center=<APPROVED_COST_CENTER>,owner-role=<APPROVED_OWNER_CODE>` | Exact project read-back |
| PRV-API-01 | `gcloud services enable <APPROVED_API_LIST> --project=$ProjectId` | Ordered API wave approved |
| PRV-FIREBASE-01 | `firebase projects:addfirebase $ProjectId --non-interactive` | Firebase Admin approval; project/billing/APIs verified |
| PRV-WEBAPP-01 | `firebase apps:create WEB '<APPROVED_APP_DISPLAY_NAME>' --project=$ProjectId --json` | App naming/domain decision approved |

Alias mapping is a reviewed repository change, not a cloud mutation. If performed with Firebase CLI, `firebase use --add $ProjectId` is an explicitly supervised interactive exception and must produce the approved alias; CI may not execute it. The resulting `.firebaserc` is reviewed separately in the targeting slice.

## 4. Provisioning writes — identities and WIF

```powershell
gcloud iam service-accounts create <EXACT_SERVICE_ACCOUNT_ID> `
  --display-name='<APPROVED_DISPLAY_NAME>' `
  --description='<APPROVED_PURPOSE>' `
  --project=$ProjectId

gcloud projects add-iam-policy-binding $ProjectId `
  --member='serviceAccount:<EXACT_SERVICE_ACCOUNT_ID>@<EXPLICIT_PROJECT_ID>.iam.gserviceaccount.com' `
  --role='<APPROVED_PROJECT_ROLE>' `
  --condition='<APPROVED_IAM_CONDITION>'

gcloud secrets add-iam-policy-binding <EXACT_SECRET_NAME> `
  --member='serviceAccount:<EXACT_CONSUMER_SA>@<EXPLICIT_PROJECT_ID>.iam.gserviceaccount.com' `
  --role='roles/secretmanager.secretAccessor' `
  --project=$ProjectId

gcloud storage buckets add-iam-policy-binding gs://<EXACT_BUCKET_NAME> `
  --member='serviceAccount:<EXACT_CONSUMER_SA>@<EXPLICIT_PROJECT_ID>.iam.gserviceaccount.com' `
  --role='<APPROVED_BUCKET_ROLE>' `
  --project=$ProjectId
```

Queue/service/service-account bindings use the exact resource and never project-wide substitutes:

```powershell
gcloud tasks queues add-iam-policy-binding <EXACT_QUEUE_NAME> `
  --location=$Region `
  --member='serviceAccount:<EXACT_COMPLETION_SA>@<EXPLICIT_PROJECT_ID>.iam.gserviceaccount.com' `
  --role='roles/cloudtasks.enqueuer' `
  --project=$ProjectId

gcloud run services add-iam-policy-binding <EXACT_NOTIFICATION_SERVICE> `
  --region=$Region `
  --member='serviceAccount:<EXACT_TASKS_CALLER_SA>@<EXPLICIT_PROJECT_ID>.iam.gserviceaccount.com' `
  --role='roles/run.invoker' `
  --project=$ProjectId

gcloud iam service-accounts add-iam-policy-binding <EXACT_RUNTIME_SA>@<EXPLICIT_PROJECT_ID>.iam.gserviceaccount.com `
  --member='serviceAccount:<EXACT_DEPLOYER_SA>@<EXPLICIT_PROJECT_ID>.iam.gserviceaccount.com' `
  --role='roles/iam.serviceAccountUser' `
  --project=$ProjectId
```

WIF:

```powershell
gcloud iam workload-identity-pools create <EXACT_POOL_ID> `
  --location=global `
  --display-name='<APPROVED_POOL_DISPLAY_NAME>' `
  --project=$ProjectId

gcloud iam workload-identity-pools providers create-oidc <EXACT_PROVIDER_ID> `
  --workload-identity-pool=<EXACT_POOL_ID> `
  --location=global `
  --issuer-uri='https://token.actions.githubusercontent.com' `
  --allowed-audiences='<EXACT_APPROVED_AUDIENCE>' `
  --attribute-mapping='<APPROVED_ATTRIBUTE_MAPPING>' `
  --attribute-condition='<APPROVED_REPOSITORY_BRANCH_ENVIRONMENT_CONDITION>' `
  --project=$ProjectId

gcloud iam service-accounts add-iam-policy-binding <EXACT_DEPLOYER_SA>@<EXPLICIT_PROJECT_ID>.iam.gserviceaccount.com `
  --member='principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL_ID>/attribute.repository/<APPROVED_GITHUB_ORG>/AuraControlCenter' `
  --role='roles/iam.workloadIdentityUser' `
  --project=$ProjectId
```

## 5. Provisioning writes — data plane

```powershell
gcloud firestore databases create `
  --database='(default)' `
  --location=$FirestoreLocation `
  --type=firestore-native `
  --project=$ProjectId

gcloud storage buckets create gs://<EXACT_BUCKET_NAME> `
  --location=$StorageLocation `
  --uniform-bucket-level-access `
  --public-access-prevention `
  --project=$ProjectId

gcloud storage buckets update gs://<EXACT_BUCKET_NAME> `
  --lifecycle-file=<APPROVED_LIFECYCLE_MANIFEST> `
  --cors-file=<APPROVED_CORS_MANIFEST> `
  --project=$ProjectId
```

Rules, indexes and TTL are not provisioned by R1B. Their future commands remain in their dedicated slices and always use `--project=$ProjectId`.

Auth provider and email-template initialization has no accepted generic CLI command in this design. It remains `BLOCKED_COMMAND_SELECTION` until Firebase Administrator approves a versioned API/console change procedure with metadata read-back. No users are created by project provisioning.

## 6. Provisioning writes — queues and secrets

Queue creation occurs before granting enqueuer permission and while no producer exists; it is paused immediately and verified before any binding:

```powershell
gcloud tasks queues create <EXACT_QUEUE_NAME> `
  --location=$Region `
  --max-dispatches-per-second=1 `
  --max-concurrent-dispatches=1 `
  --max-attempts=3 `
  --min-backoff=30s `
  --max-backoff=300s `
  --max-doublings=2 `
  --project=$ProjectId

gcloud tasks queues pause <EXACT_QUEUE_NAME> `
  --location=$Region `
  --project=$ProjectId
```

Secret resources are created empty:

```powershell
gcloud secrets create <EXACT_SECRET_NAME> `
  --replication-policy=automatic `
  --labels=app=aura-intelligence,environment=$EnvironmentName,purpose=<APPROVED_PURPOSE>,owner-role=<APPROVED_OWNER_CODE> `
  --project=$ProjectId
```

Initial population is a separately approved Secret Custodian action. Template only:

```powershell
gcloud secrets versions add <EXACT_SECRET_NAME> `
  --data-file=<SECURE_EPHEMERAL_INPUT> `
  --project=$ProjectId
```

The operator disables shell history/transcript under the approved secure procedure; evidence captures only version number/state/date and never the value or input location.

## 7. Provisioning writes — observability and budgets

```powershell
gcloud logging metrics create <EXACT_LOG_METRIC_ID> `
  --description='<APPROVED_DESCRIPTION>' `
  --log-filter='<APPROVED_SANITIZED_FILTER>' `
  --project=$ProjectId

gcloud logging sinks create <EXACT_LOG_SINK_NAME> <APPROVED_SINK_DESTINATION> `
  --log-filter='<APPROVED_AUDIT_FILTER>' `
  --project=$ProjectId

gcloud monitoring dashboards create `
  --config-from-file=<APPROVED_DASHBOARD_MANIFEST> `
  --project=$ProjectId

gcloud monitoring policies create `
  --policy-from-file=<APPROVED_ALERT_POLICY_MANIFEST> `
  --project=$ProjectId

gcloud billing budgets create `
  --billing-account='<APPROVED_BILLING_ACCOUNT_ID>' `
  --display-name='<EXACT_BUDGET_DISPLAY_NAME>' `
  --budget-from-file=<APPROVED_BUDGET_MANIFEST>
```

Notification channel creation is blocked until the organizational routing target is approved outside Git. Evidence never contains contact addresses.

## 8. App Check and Vercel operations

App Check provider registration/enforcement remains `BLOCKED_COMMAND_SELECTION`: Firebase Administrator must select the supported Firebase App Check API or console workflow, record the exact request shape/version, use the exact `$ProjectId`, and attach a metadata-only read-back. No undocumented CLI command is invented.

Future Vercel non-prod project operations:

```powershell
vercel project add <EXACT_VERCEL_PROJECT_NAME>
vercel link --project=<EXACT_VERCEL_PROJECT_NAME>
vercel project inspect <EXACT_VERCEL_PROJECT_NAME>
```

Git integration, protection, domains, Node and environment variables require explicit project/team scope and approved API/CLI version. Secret values are populated through the approved provider procedure and never appear in commands/evidence. Production project mutation is prohibited in this provisioning wave.

## 9. Rollback catalog

| ID | Future command/action | Preconditions |
|---|---|---|
| RB-QUEUE-01 | `gcloud tasks queues pause <EXACT_QUEUE_NAME> --location=$Region --project=$ProjectId` | Immediate containment; exact queue verified |
| RB-IAM-01 | Matching `remove-iam-policy-binding` at the same project/resource/SA/secret/bucket/queue scope | New binding ID and prior policy captured |
| RB-WIF-01 | `gcloud iam workload-identity-pools providers update-oidc <PROVIDER_ID> --workload-identity-pool=<POOL_ID> --location=global --disabled --project=$ProjectId` | Freeze CI before revoke |
| RB-SECRET-01 | `gcloud secrets versions disable <VERSION> --secret=<EXACT_SECRET_NAME> --project=$ProjectId` | Previous same-environment version verified |
| RB-BILLING-01 | `gcloud billing projects unlink $ProjectId` | Project empty/abandoned; FinOps approval |
| RB-PROJECT-01 | Label project `state=abandoned`; future delete requires separate destructive change | No data, rollback window complete |
| RB-BUCKET-01 | Remove new binding/CORS/lifecycle; delete only an empty verified bucket in separate change | Exact bucket, zero objects, Privacy approval |
| RB-VERCEL-01 | Unlink/remove wrong non-prod project after proving no Production domain/variables | Release Engineering + Deployment approval |

No rollback relaxes Rules, reopens Production, assigns Editor/Owner, creates a key or redirects a queue across environments.

## 10. Evidence capture

Read-only commands use JSON output and an approved evidence wrapper that hashes/redacts before attachment. Raw output containing organization/billing/contact identifiers remains in the restricted evidence system, not Git. Git receives normalized statuses, counts, resource names already approved, hashes and command IDs.
