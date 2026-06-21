# Feature Slice: F-004 Staging/internal deploy setup

## Metadata

- GitHub Issue: #4
- Status: Staging
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-21
- Updated: 2026-06-21

## Ouroboros Source

```text
Not used. Reason: user requested a direct spec draft. Deployment provider, account, and platform decisions were clarified in conversation and are recorded below. User approved implementation start after the remaining open questions were resolved.
```

## Deployment Decisions

- API hosting provider: GCP Cloud Run
- API deploy shape: one Go HTTP API container, not function-per-endpoint
- Source deploy pipeline: Cloud Build GitHub repository trigger
- Cloud Build connection: `i-um-github` in `asia-northeast3`
- Cloud Build repository link: `twotwobread-i-um`
- Container registry: GCP Artifact Registry
- DB provider: Neon Postgres
- IaC: Terraform for GCP staging resources
- Secret handling: the Secret Manager secret is bootstrapped out-of-band; Terraform references it and manages IAM access so secret values do not enter Terraform state
- GCP Secret Manager database secret: `i-um-staging-database-url`, version `1` enabled
- Terraform remote state bucket: `i-um-488511-terraform-state`
- Public URL: Cloud Run default HTTPS URL for staging; custom domain is out of scope
- Deploy trigger default: manually invoked Cloud Build trigger for initial staging; automatic `develop` deploy can be enabled later if explicitly approved
- Mobile build: Expo EAS preview/internal build uses staging Cloud Run URL as `EXPO_PUBLIC_API_BASE_URL`
- Initial internal build target: iOS first
- iOS bundle identifier: `com.twotwobread.ium.staging`
- iOS signing credentials: EAS managed credentials after Apple Developer Program activation
- Android build: optional/later when an Android tester/device is available
- Android package id: `com.twotwobread.ium`

## Goal

API 서버를 GCP Cloud Run staging 환경에 배포하고, Expo preview/internal build가 staging API를 바라보도록 구성해 내부 테스터가 앱에서 live API 연결 상태를 확인할 수 있게 한다.

이 기능은 제품 도메인 기능을 추가하기 전, App build + API deploy + environment configuration + verification workflow가 반복 가능하게 동작함을 증명한다.

## Problem

- 현재 앱과 API는 로컬 실행 중심으로 검증되며, 내부 테스터가 설치 가능한 빌드와 외부에서 접근 가능한 staging API가 없다.
- `EXPO_PUBLIC_API_BASE_URL`, `PORT`, `DATABASE_URL` 같은 런타임 설정이 staging/internal 기준으로 정리되어 있지 않으면 로컬 전용 설정이 앱 코드나 배포 설정에 섞일 수 있다.
- PR/MR마다 `pnpm verify`와 generated drift check가 자동으로 실행되지 않으면 배포 전 contract/server/mobile 불일치를 놓칠 수 있다.
- 이후 여행/일정/정산 feature slice를 사용자에게 보여주려면 최소한의 staging API와 internal build 검증 경로가 필요하다.

## User Flow

1. 개발자가 GitHub PR/MR을 열거나 `develop`에 변경을 합친다.
2. CI가 `pnpm install`, `pnpm generate` drift check, API test/build, mobile typecheck를 실행한다.
3. 개발자가 Cloud Build trigger를 수동 실행한다.
4. Cloud Build가 Docker image를 빌드하고 Artifact Registry에 push한다.
5. Cloud Build가 image를 Cloud Run service에 배포한다.
6. Cloud Run이 public HTTPS staging URL에서 API를 제공한다.
7. 개발자가 Expo preview/internal build를 staging API base URL로 생성한다.
8. 내부 테스터가 internal build를 설치하고 앱을 연다.
9. 앱의 진단 화면이 generated API client를 통해 staging API를 호출한다.
10. 앱이 `API 연결 성공`을 표시한다.
11. F-003 DB readiness가 포함된 경우 앱은 `DB 연결 성공`도 표시한다.
12. 배포 URL, build 링크, 검증 결과가 feature 완료 보고에 기록된다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 새 제품 화면은 만들지 않고, 기존 진단 화면이 internal build에서 staging API를 호출하도록 환경 설정을 연결한다.
- [ ] API Contract: 새 endpoint는 추가하지 않는다. 기존 `GET /health`와, F-003이 병합된 경우 `GET /ready`를 staging smoke target으로 사용한다.
- [ ] API Server: Cloud Run 런타임에 필요한 `PORT`, `DATABASE_URL` 등 env 기반 설정과 Docker 배포 artifact를 준비한다.
- [ ] DB: 새 schema는 만들지 않는다. F-003이 포함된 경우 Neon Postgres 연결과 migration 적용 절차를 배포 문서/검증에 포함한다.
- [ ] IaC: Terraform으로 GCP staging resource를 생성/관리한다.
- [ ] Cloud Build: GitHub repo 연동 trigger와 API build/deploy pipeline을 구성한다.
- [ ] Mobile Build: Expo EAS preview/internal build profile과 staging API base URL 주입 방식을 구성한다.
- [ ] CI: GitHub Actions에서 repository verification을 실행한다.
- [ ] Deployment Docs: GCP/Neon/EAS 수동 bootstrap, Terraform apply, Cloud Build deploy, EAS internal build, smoke verification 절차를 문서화한다.
- [ ] Tests: CI 자동 검증과 staging/internal 수동 smoke test를 수행한다.
- [ ] Deployment: Cloud Run staging URL과 at least one Expo internal build에서 live API 연결을 확인한다.

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- production 배포 파이프라인
- App Store / Google Play Store 제출 및 심사
- custom domain, CDN, WAF, 고급 observability 구성
- zero-downtime deploy, blue/green deploy, canary deploy
- DB backup/restore, PITR, alerting 같은 운영 고도화
- 제품 도메인 API, DB table, mobile screen 추가
- 인증/권한/사용자 계정 구현
- push notification, crash analytics, performance analytics
- secret 값 자체를 repository 또는 Terraform state에 저장하는 것
- GKE/Kubernetes 배포 구성
- Lambda/function-per-endpoint 구조로 API를 분해하는 것

## Manual Prerequisites / Required Information

구현 전 또는 구현 중 수동으로 준비해야 하는 정보와 작업이다. Secret 값은 chat, issue, git에 붙여넣지 않는다.

### GCP

필요 정보:

- GCP project id: `i-um-488511`
- Billing 활성화 여부
- Staging region: `asia-northeast3`
- Terraform state bucket 이름: `i-um-488511-terraform-state`
- Cloud Run service name, recommended: `i-um-api-staging`
- Artifact Registry repository name, recommended: `i-um-staging`
- Cloud Run public unauthenticated access 허용 여부: staging mobile app 호출을 위해 허용 필요

수동 작업:

1. GCP project를 생성하거나 기존 project를 선택한다. Done: `i-um-488511`.
2. Billing을 활성화한다.
3. 로컬 또는 CI operator 계정에서 `gcloud auth login`과 `gcloud auth application-default login`을 수행한다.
4. Terraform remote state용 GCS bucket을 1회 bootstrap한다. Done: `i-um-488511-terraform-state`.
5. Cloud Build와 GitHub repo 연결을 승인한다. Done: `i-um-github` / `twotwobread-i-um`.

### GitHub / Cloud Build

필요 정보:

- GitHub owner: `twotwobread`
- GitHub repo: `i-um`
- Deploy source branch: `develop`
- Initial deploy trigger mode: manual Cloud Build trigger
- Cloud Build connection name: `i-um-github`
- Cloud Build connection region: `asia-northeast3`
- Cloud Build repository link name: `twotwobread-i-um`

수동 작업:

1. GCP Console에서 Cloud Build GitHub App 연결을 승인한다. Done.
2. `twotwobread/i-um` repository 접근을 허용한다. Done.
3. 연결된 repository/connection identifier를 Terraform 변수 또는 문서에 기록한다. Done: connection `i-um-github`, repository link `twotwobread-i-um`.

### Neon Postgres

필요 정보:

- Neon account/project
- Neon region, recommended: Cloud Run region과 가까운 region
- Staging database name, recommended: `ium_staging`
- Staging DB role/user
- Pooled connection string or direct connection string

수동 작업:

1. Neon project와 staging database를 생성한다.
2. Cloud Run serverless 환경에 맞게 pooled connection string 사용을 우선 검토한다.
3. connection string에 SSL 요구 설정이 필요한지 확인한다. 예: `sslmode=require`
4. `DATABASE_URL` 값을 GCP Secret Manager secret version으로 추가한다.

### Expo / EAS

필요 정보:

- Expo account/org
- EAS project 연결 가능 여부
- Internal build target platform: iOS first
- iOS bundle identifier: `com.twotwobread.ium.staging`
- iOS signing credentials: EAS managed credentials after Apple Developer Program activation
- Apple Developer Program: user has joined; activation may still take time
- Android package id: `com.twotwobread.ium`
- Android build: optional/later when an Android tester/device is available

수동 작업:

1. `eas login` 또는 EAS dashboard로 Expo 계정을 준비한다.
2. EAS project를 생성/연결한다.
3. `EXPO_PUBLIC_API_BASE_URL`을 EAS preview/internal build 환경에 설정한다.
4. iOS signing credential은 EAS managed credentials로 자동 생성/관리한다.
5. iOS internal build를 생성하고 설치 가능한 링크 또는 artifact를 확보한다.
6. Android internal build는 Android tester/device가 생겼을 때 선택적으로 생성한다.

## UX / UI Requirements

### Screens

- `apps/mobile/app/index.tsx`: 기존 API 진단 화면을 internal build smoke target으로 사용한다.

### States

- Loading: 기존 loading 상태를 유지한다.
- Empty: 별도 empty state는 필요 없다.
- Error: staging API 호출 실패 시 기존 error/retry 상태를 표시한다.
- Success: staging API 호출 성공 시 `API 연결 성공`을 표시한다. F-003이 포함된 경우 DB readiness 성공도 표시한다.

### Copy / Labels

F-004에서 새 사용자 노출 문구를 추가하지 않는다. 기존 진단 화면 문구를 사용한다.

- Success: `API 연결 성공`
- DB success if F-003 is included: `DB 연결 성공`
- Error: 기존 `API 연결 실패` 또는 F-003 이후 `API 또는 DB 연결 실패`
- Retry: `다시 시도`

## API Contract

No new API changes.

### Endpoints

Staging smoke target:

```text
GET /health
```

If F-003 is included before or during this feature, readiness smoke target also includes:

```text
GET /ready
```

### Request

No request body.

### Response

`GET /health` keeps the existing response:

```json
{
  "status": "ok"
}
```

`GET /ready` follows F-003 if available.

### Errors

No new error schema is introduced. Existing common error response is used.

## DB Changes

No DB schema changes.

### Tables

N/A

### Constraints / Indexes

N/A

### Migration Notes

- F-004 does not add migrations.
- If F-003 is merged, staging deployment must document how migrations are applied to Neon before readiness verification.
- If F-003 is not merged, F-004 verification is limited to API liveness `/health` and must not claim DB readiness.

## Business Rules

- Internal build must call the Cloud Run staging API URL, not a developer laptop or hard-coded localhost.
- API base URL must be injected through EAS build/environment configuration.
- No secrets are committed to git.
- Secret values must not be managed directly in Terraform resources if doing so would store them in Terraform state.
- Terraform manages GCP resource definitions; manual bootstrap steps must be documented.
- CI must fail if generated OpenAPI artifacts drift from the source contract.
- CI must fail if API tests/build or mobile typecheck fail.
- Cloud Run API must bind to the platform-provided `PORT`.
- Cloud Run staging API must expose a public HTTPS URL for mobile internal builds.
- Cloud Run must run the existing Go HTTP API as one container service.
- API endpoints must not be split into Lambda-style functions for this feature.
- Cloud Run max instances and DB pool settings should be conservative for staging to avoid Neon connection exhaustion.
- Deployment documentation must list required secrets/env variables and where they are configured.
- A feature is not complete until at least one internal build has been manually verified against staging API.
- DB readiness can only be included if F-003 DB/migration foundation is present in the implementation branch.

## Acceptance Criteria

- [x] `docs/features/0004-staging-internal-deploy-setup.md`에 feature spec + implementation plan이 작성되어 있다.
- [x] Spec is reviewed and approved before implementation starts.
- [x] Required manual prerequisites and remaining Open Questions are resolved or split into follow-up issues.
- [ ] GitHub Actions CI runs repository verification on PR/MR and `develop` push.
- [x] CI includes install, generation/drift check, API test/build, and mobile typecheck.
- [x] Terraform configuration exists for GCP staging resources.
- [x] Terraform creates or manages Artifact Registry, Cloud Run service, Cloud Build trigger, service accounts/IAM, and Secret Manager secret access.
- [x] Terraform state backend bootstrap is documented.
- [x] Cloud Build GitHub repository connection manual setup is documented.
- [ ] Cloud Build trigger builds the API Docker image and pushes it to Artifact Registry.
- [ ] Cloud Build trigger deploys the image to Cloud Run.
- [x] Cloud Run service uses env-based `PORT` and Secret Manager-backed `DATABASE_URL` if DB is included.
- [x] Required staging API env variables are documented with example names but no secret values.
- [x] Cloud Run staging API is reachable over HTTPS.
- [x] `GET /health` on Cloud Run returns `200` and `{ "status": "ok" }`.
- [x] If F-003 is included, Neon staging DB migration is applied and `GET /ready` returns readiness success.
- [x] Expo EAS preview/internal build profile exists.
- [x] Internal build receives the Cloud Run staging API base URL through build/env configuration.
- [x] App code does not hard-code staging or localhost API URLs.
- [ ] At least one iOS internal build is produced for the selected primary target platform.
- [ ] iOS internal build is installed/opened and the diagnostic screen shows live staging API success.
- [x] Deployment and rollback/smoke-check steps are documented.
- [ ] Verification results include CI run, Cloud Build run, Cloud Run URL smoke result, and iOS internal build proof.

## Implementation Plan

1. Resolve remaining prerequisites
   - 작업: GCP project/region, Terraform state bucket name, Cloud Build GitHub connection, Neon project, EAS target platform/package identifiers를 확정한다.
   - Verify: Open Questions가 비어 있거나 후속 issue로 분리되어 spec status를 `Ready`로 바꿀 수 있다.

2. Add CI verification workflow
   - 작업: GitHub Actions workflow를 추가해 Node/pnpm/Go를 설정하고 root verification을 실행한다.
   - Verify: PR/MR 또는 workflow dispatch에서 `pnpm install`, `pnpm generate` drift check, API test/build, mobile typecheck가 통과한다.

3. Add API Docker artifact
   - 작업: Cloud Run에서 실행할 `apps/api` Dockerfile을 추가한다.
   - Verify: local 또는 Cloud Build에서 image build가 성공하고 container가 `PORT` env로 `/health`를 반환한다.

4. Add Terraform staging infrastructure
   - 작업: `infra/terraform/gcp-staging`에 provider, variables, backend, Artifact Registry, Cloud Run, Secret Manager IAM access, service accounts/IAM, Cloud Build trigger를 정의한다.
   - Verify: `terraform fmt`, `terraform validate`, `terraform plan`이 성공한다.

5. Bootstrap manual GCP/Neon dependencies
   - 작업: Terraform backend bucket, Cloud Build GitHub repo connection, Neon staging database, `DATABASE_URL` secret version을 수동으로 준비한다.
   - Verify: Terraform full apply가 secret reference와 repo trigger를 포함해 성공한다.

6. Add Cloud Build API deploy pipeline
   - 작업: `cloudbuild.api.yaml`을 추가해 Docker image build, Artifact Registry push, Cloud Run deploy, `/health` smoke step을 수행한다.
   - Verify: Cloud Build trigger manual run이 성공하고 Cloud Run revision이 갱신된다.

7. Wire staging DB and migration flow if F-003 is included
   - 작업: Neon DB migration 적용 명령, readiness smoke 절차를 문서화하거나 deploy step에 포함한다.
   - Verify: staging에서 migration 후 `/ready`가 성공한다. F-003이 없으면 이 단계는 명시적으로 skipped로 기록한다.

8. Configure Expo EAS preview/internal build
   - 작업: `eas.json`과 필요한 app config를 추가하고, preview/internal profile이 Cloud Run staging API base URL을 주입하도록 구성한다.
   - Verify: `eas build --profile <profile> --platform <target>` 또는 합의된 build command가 internal build artifact/link를 생성한다.

9. Add deployment runbook
   - 작업: GCP bootstrap, Terraform apply, Neon secret setup, Cloud Build deploy, migration, EAS build, smoke test, rollback/rebuild 절차를 README 또는 `docs/delivery` 문서에 기록한다.
   - Verify: 문서의 명령 순서만 따라 staging API와 internal build smoke check를 재현할 수 있다.

10. Run staging/internal verification
    - 작업: CI, Terraform plan/apply, Cloud Build deploy, Cloud Run smoke, internal build install/open, diagnostic screen 확인을 수행한다.
    - Verify: 완료 보고 또는 feature 문서에 command/result, staging URL, build proof, 제한사항을 기록한다.

## Verification Plan

### Automated

구현 후 실제 command는 Terraform/Cloud Build/EAS 세부 결정에 맞게 확정한다.

```text
pnpm install --frozen-lockfile
pnpm generate
git diff --exit-code -- apps/api/internal/openapi packages/api-contract/gen/ts
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile typecheck
pnpm verify
terraform -chdir=infra/terraform/gcp-staging fmt -check
terraform -chdir=infra/terraform/gcp-staging validate
terraform -chdir=infra/terraform/gcp-staging plan
```

CI workflow:

```text
gh workflow run <ci-workflow> 또는 PR/MR check 결과 확인
```

Cloud Build deploy:

```text
gcloud builds triggers run <trigger-name> --branch=develop
```

Cloud Run smoke:

```text
curl -i https://<cloud-run-staging-url>/health
curl -i https://<cloud-run-staging-url>/ready   # only if F-003 is included
```

Expo internal build:

```text
npx eas-cli@latest build --profile <preview-or-internal-profile> --platform <target-platform>
```

### Verification Results

- `pnpm install --frozen-lockfile`: pass
- `pnpm verify`: pass
- `docker build -f apps/api/Dockerfile -t i-um-api:f004 apps/api`: pass
- `docker run ... i-um-api:f004` + `curl http://127.0.0.1:18084/health`: pass, returned `{ "status": "ok" }`
- `python3 -m json.tool apps/mobile/app.json`: pass
- `python3 -m json.tool apps/mobile/eas.json`: pass
- `ruby -e "require 'yaml'; YAML.load_file(...)"` for `cloudbuild.api.yaml` and `.github/workflows/ci.yml`: pass
- `git diff --check`: pass
- `gcloud secrets versions list i-um-staging-database-url --project=i-um-488511`: pass, version `1` enabled
- `gcloud builds connections list --region=asia-northeast3 --project=i-um-488511`: pass, `i-um-github` complete/enabled
- `gcloud builds repositories describe twotwobread-i-um --connection=i-um-github --region=asia-northeast3 --project=i-um-488511`: pass
- `~/.local/bin/terraform version`: pass, Terraform v1.6.6 installed from HashiCorp release binary after Homebrew install was blocked by outdated macOS Command Line Tools
- `terraform -chdir=infra/terraform/gcp-staging init`: pass using `GOOGLE_OAUTH_ACCESS_TOKEN` from active gcloud account because local ADC pointed at an unrelated service account
- `terraform -chdir=infra/terraform/gcp-staging fmt -check`: pass
- `terraform -chdir=infra/terraform/gcp-staging validate`: pass
- `terraform -chdir=infra/terraform/gcp-staging plan`: pass, initially 18 resources to add
- `terraform -chdir=infra/terraform/gcp-staging apply -auto-approve`: pass after one retry for a transient Cloud Run internal error
- `gcloud builds submit ... --config=cloudbuild.api.yaml`: pass, initial build `48d7b399-13c1-4e15-ae0c-5f4a9e6cae06`, pushed `asia-northeast3-docker.pkg.dev/i-um-488511/i-um-staging/api:39049d4` and deployed Cloud Run
- `pnpm db:migrate` with pooled Neon URL: failed with prepared statement conflict; runbook updated to use direct Neon URL for migrations
- `pnpm db:migrate` with direct Neon URL derived from secret by removing `-pooler`: pass, applied `00001_create_app_metadata.sql`
- `pnpm db:status` with direct Neon URL: pass, migration version 1 applied
- `curl -i https://i-um-api-staging-uqpinpphlq-du.a.run.app/health`: pass, returned `200` and `{ "status": "ok" }`
- Initial post-idle `/ready` check briefly returned `503`; local direct `storage.CheckReady` succeeded, indicating Neon cold/timeout sensitivity. API readiness timeout was increased to 5s and pgx pool max connections were capped at 4 for staging safety.
- `pnpm verify` after storage timeout/pool change: pass
- `gcloud builds submit ... --config=cloudbuild.api.yaml`: pass, final build `ad80b60c-6f63-4378-9e6b-5fdade20a8ff`, pushed `asia-northeast3-docker.pkg.dev/i-um-488511/i-um-staging/api:39049d4-local2` and deployed Cloud Run
- `curl -fsS https://i-um-api-staging-uqpinpphlq-du.a.run.app/health`: pass, returned `{ "status": "ok" }`
- `curl -fsS https://i-um-api-staging-uqpinpphlq-du.a.run.app/ready`: pass, returned readiness body with `schema: initialized`
- `terraform -chdir=infra/terraform/gcp-staging plan -detailed-exitcode`: pass after ignoring Cloud Run deploy client metadata, no changes
- `npx eas-cli@latest --version`: pass, `eas-cli/20.3.0`
- `npx eas-cli@latest whoami`: pass after user login, account `nikanikanika`
- `npx eas-cli@latest init --non-interactive --force`: pass, created/linked EAS project `@nikanikanika/i-um`, project id `4cb10661-9fbf-4f80-8467-663373d9c1b3`
- `npx eas-cli@latest env:create preview --name EXPO_PUBLIC_API_BASE_URL ...`: pass, created preview environment variable for Cloud Run URL
- Optional Android proof before target switch: `npx eas-cli@latest build --profile preview --platform android --non-interactive --wait`: pass, EAS build `1b48f2f4-823e-4a55-bb46-78524ae9bbea` finished
- Optional Android proof before target switch: `npx eas-cli@latest build:view 1b48f2f4-823e-4a55-bb46-78524ae9bbea --json`: pass, status `FINISHED`, distribution `INTERNAL`, artifact URL available
- iOS build configuration: `apps/mobile/app.json` now includes `ios.bundleIdentifier = com.twotwobread.ium.staging`
- iOS export compliance configuration: `ITSAppUsesNonExemptEncryption = false`
- `npx eas-cli@latest build --profile preview --platform ios --non-interactive --wait`: fail as expected for first iOS build; EAS could not find credentials suitable for internal distribution in non-interactive mode. First iOS build must be run interactively after Apple Developer Program activation so EAS can create/select credentials and register the test device.
- GitHub Actions CI run: not run yet because the branch/PR has not been pushed/opened
- Cloud Build trigger run: not run yet because the trigger points at `develop`, where F-004 files are not available until merge; equivalent Cloud Build pipeline was verified with `gcloud builds submit`

### Manual

- [x] GCP project와 billing을 확인한다.
- [x] Terraform remote state bucket을 bootstrap한다.
- [x] Cloud Build GitHub repo connection을 승인한다.
- [x] Neon staging database를 생성한다.
- [x] `DATABASE_URL`을 Secret Manager secret version으로 등록한다.
- [x] Terraform apply로 GCP staging resources를 생성/갱신한다.
- [ ] CI check가 PR/MR 또는 workflow dispatch에서 통과하는지 확인한다.
- [ ] Cloud Build trigger를 수동 실행하고 성공 여부를 확인한다. F-004 files must be on `develop` before this trigger can run; `gcloud builds submit` was used for pre-merge verification.
- [x] Cloud Run URL에서 `/health`가 성공하는지 확인한다.
- [x] F-003이 포함된 경우 Neon migration 후 Cloud Run URL에서 `/ready`가 성공하는지 확인한다.
- [ ] iOS internal build artifact/link를 생성한다. Follow-up: #67.
- [ ] 선택한 target platform에 internal build를 설치한다. Follow-up: #67.
- [ ] 앱 진단 화면이 Cloud Run staging API를 호출해 success 상태를 표시하는지 확인한다. Follow-up: #67.
- [ ] staging API를 일시적으로 잘못된 URL로 설정하거나 API 장애를 재현해 error/retry 상태를 확인한다.
- [ ] README/runbook에 실제 검증 결과와 제한사항을 기록한다.

## Release Notes

```text
- GitHub Actions 기반 repository verification을 추가한다.
- Terraform으로 GCP Cloud Run staging 리소스를 관리한다.
- Cloud Build GitHub trigger로 API Docker image를 빌드하고 Cloud Run에 배포한다.
- Neon Postgres를 staging DB로 연결할 수 있는 secret/runtime 구성을 추가한다.
- Expo preview/internal build가 Cloud Run staging API를 바라보도록 구성한다.
- 내부 테스터가 설치 가능한 빌드에서 live API 연결 상태를 확인할 수 있게 한다.
```

## Open Questions

구현 전 해결해야 할 남은 질문이다.

- [x] GCP project id와 region은 무엇인가? `i-um-488511`, `asia-northeast3`.
- [x] Terraform remote state bucket 이름은 무엇으로 할 것인가? `i-um-488511-terraform-state`.
- [x] Neon project/database는 F-004에서 수동 생성으로 둘 것인가, Neon Terraform provider까지 포함할 것인가? F-004에서는 수동 생성 + GCP Secret Manager secret version 등록으로 진행한다.
- [x] Expo internal build target platform은 Android first, iOS first, 또는 both 중 무엇인가? iOS first. Android는 Android tester/device가 생겼을 때 선택적으로 진행한다.
- [x] Android package id / iOS bundle identifier는 `com.twotwobread.ium`으로 확정해도 되는가? iOS staging bundle id는 `com.twotwobread.ium.staging`; Android package id는 `com.twotwobread.ium`.
- [x] EAS project/account와 필요한 signing credentials 사용이 가능한가? iOS는 Apple Developer Program 활성화를 전제로 EAS managed credentials로 진행한다. Android는 이미 EAS managed credentials로 build proof를 생성했다.
- [x] Cloud Build trigger는 초기 manual-only로 확정하는가, 아니면 `develop` push 자동 배포까지 포함하는가? 초기 manual-only로 진행한다.

## Follow-up Issues

- #67: iOS internal build 완료 및 설치 검증
- TBD: production deployment pipeline
- TBD: staging observability/alerting
- TBD: custom domain and TLS hardening if not covered by selected provider
- TBD: Neon resources Terraform provider migration if F-004 starts with manual Neon provisioning
