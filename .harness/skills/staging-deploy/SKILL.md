---
name: i-um-staging-deploy
description: Deploy, smoke-test, or roll back the i-um staging API and Expo internal builds. Use only when the user asks for Cloud Run staging deploy, EAS internal build, staging smoke verification, DB migration on staging, or rollback.
---

Use this skill for staging/internal deployment tasks only. Also follow `.harness/rules/phase/deploy.rules.md` for secret/log safety.

Do not use this skill for normal feature implementation, PR creation, or local verification.

# i-um Staging/Internal Deploy

Use this skill only for staging API deploy, DB migration, Expo internal build, rollback, or environment smoke tasks.

Secret values must not be pasted into git, issues, chat, or completion reports.

## Architecture

```text
GitHub develop branch
  -> Cloud Build manual trigger
  -> Docker build from apps/api/Dockerfile
  -> Artifact Registry
  -> Cloud Run: i-um-api-staging
  -> Cloud SQL/PostgreSQL via Secret Manager DATABASE_URL

Expo EAS preview iOS build
  -> EXPO_PUBLIC_API_BASE_URL=https://<cloud-run-url>
  -> mobile diagnostic screen calls /health and /ready
```

## Fixed staging values

```text
GCP project: i-um-488511
GCP region: asia-northeast3
Terraform state bucket: i-um-488511-terraform-state
Secret Manager secret: i-um-staging-database-url
Cloud Build connection: i-um-github
Cloud Build repository link: twotwobread-i-um
Cloud Run service: i-um-api-staging
Artifact Registry repository: i-um-staging
Cloud Build trigger: i-um-api-staging-deploy
Expo iOS bundle identifier: com.twotwobread.ium.staging
Expo Android package: com.twotwobread.ium
EAS project: @nikanikanika/i-um
EAS project id: 4cb10661-9fbf-4f80-8467-663373d9c1b3
```

## Manual prerequisites

### 1. gcloud project

```bash
gcloud auth login
gcloud config set project i-um-488511
gcloud config set run/region asia-northeast3
gcloud config set artifacts/location asia-northeast3
gcloud auth application-default login
gcloud auth application-default set-quota-project i-um-488511
```

### 2. Terraform backend bucket

Already bootstrapped for F-004:

```bash
gcloud storage buckets create gs://i-um-488511-terraform-state \
  --location=asia-northeast3 \
  --uniform-bucket-level-access

gcloud storage buckets update gs://i-um-488511-terraform-state \
  --versioning
```

### 3. DATABASE_URL secret

The Secret Manager secret is pre-created and contains the staging PostgreSQL connection string as version `1`.

If the value needs rotation, do not paste it into git, GitHub issues, or chat. Add a new secret version locally:

```bash
read -rsp "DATABASE_URL: " DATABASE_URL
echo

printf '%s' "$DATABASE_URL" | \
  gcloud secrets versions add i-um-staging-database-url --data-file=-

unset DATABASE_URL
```

Confirm a version exists without printing the secret value:

```bash
gcloud secrets versions list i-um-staging-database-url
```

### 4. Cloud Build GitHub connection

Already bootstrapped for F-004:

```bash
gcloud builds connections list --region=asia-northeast3
```

Expected:

```text
NAME         INSTALLATION_STATE  DISABLED
i-um-github COMPLETE            Enabled
```

Repository link name: `twotwobread-i-um`.

## Terraform apply

```bash
terraform -chdir=infra/terraform/gcp-staging init
terraform -chdir=infra/terraform/gcp-staging fmt -check
terraform -chdir=infra/terraform/gcp-staging validate
terraform -chdir=infra/terraform/gcp-staging plan
terraform -chdir=infra/terraform/gcp-staging apply
```

Get the Cloud Run URL:

```bash
CLOUD_RUN_URL="$(terraform -chdir=infra/terraform/gcp-staging output -raw cloud_run_url)"
printf '%s\n' "$CLOUD_RUN_URL"
```

## Staging DB migration

F-003 added PostgreSQL migrations and `/ready`. Apply migrations before checking `/ready`.

For Cloud SQL, either run migrations from an environment that can use the configured `DATABASE_URL`, or start Cloud SQL Auth Proxy locally and set `DATABASE_URL` to the local proxy URL for the migration command. Do not paste the URL value into chat or logs.

```bash
DATABASE_URL='<local-or-runtime-postgresql-url>' pnpm db:migrate
DATABASE_URL='<local-or-runtime-postgresql-url>' pnpm db:status
```

## Deploy API to Cloud Run

After F-004 is merged to `develop`, run the manual Cloud Build trigger:

```bash
gcloud builds triggers run i-um-api-staging-deploy \
  --region=asia-northeast3 \
  --branch=develop
```

Before F-004 is merged, the trigger cannot read `cloudbuild.api.yaml` from `develop`. Use a direct Cloud Build submit from the feature worktree for pre-merge verification:

```bash
gcloud builds submit . \
  --project=i-um-488511 \
  --region=asia-northeast3 \
  --config=cloudbuild.api.yaml \
  --service-account=projects/i-um-488511/serviceAccounts/i-um-api-staging-build@i-um-488511.iam.gserviceaccount.com \
  --substitutions=SHORT_SHA=$(git rev-parse --short HEAD),_REGION=asia-northeast3,_SERVICE_NAME=i-um-api-staging,_ARTIFACT_REPOSITORY=i-um-staging,_IMAGE_NAME=api
```

Get the deployed URL if Terraform output is not available:

```bash
CLOUD_RUN_URL="$(gcloud run services describe i-um-api-staging \
  --region=asia-northeast3 \
  --format='value(status.url)')"
```

Smoke test:

```bash
curl -i "$CLOUD_RUN_URL/health"
curl -i "$CLOUD_RUN_URL/ready"
```

Expected `/health`:

```json
{"status":"ok"}
```

Expected `/ready` after migration:

```json
{"checks":{"database":{"status":"ok"},"metadata":{"schema":"initialized","status":"ok"}},"status":"ok"}
```

## Expo iOS internal build

F-004 validates iOS first. Android internal build is optional/later when an Android tester or device is available.

From the mobile app directory:

```bash
cd apps/mobile
```

If this Expo project has not been linked to EAS yet:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

Configure the public staging API URL for the EAS `preview` environment. The value is not a secret, but it should point to the Cloud Run staging URL.

```bash
npx eas-cli@latest env:create \
  --environment preview \
  --name EXPO_PUBLIC_API_BASE_URL \
  --value "$CLOUD_RUN_URL" \
  --visibility plaintext
```

Build an iOS internal build with EAS managed credentials:

```bash
npx eas-cli@latest build --profile preview --platform ios
```

Use interactive mode for the first iOS build because EAS must create or select Apple credentials and may need to register the iPhone UDID for internal distribution. Non-interactive mode fails until suitable credentials already exist.

If Apple Developer Program activation is still pending, this step may fail until Apple enables certificate/profile management for the account.

Install the build from the EAS build link on an iPhone. Open the app and verify:

- `API 연결 성공`
- `DB 연결 성공`
- `status: ok`
- `schema: initialized`

## Rollback / rebuild

For a simple staging rollback, redeploy a known good image tag from Artifact Registry:

```bash
gcloud run deploy i-um-api-staging \
  --region=asia-northeast3 \
  --image=asia-northeast3-docker.pkg.dev/i-um-488511/i-um-staging/api:<known-good-sha>
```

For mobile, rebuild the previous known good commit with the same EAS preview environment value.

## Verification record

When completing F-004, record:

- GitHub Actions CI result
- Terraform plan/apply result
- Cloud Build run link/result
- Cloud Run URL
- `/health` and `/ready` curl results
- EAS iOS build link/result
- iPhone device smoke proof
- Optional Android build link/result if Android is also built
