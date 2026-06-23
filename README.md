# i-um

이음(i-um)은 여행 중 다음 일정과 지출을 한 흐름으로 이어주는 공동 여행 실행 앱입니다.

## Monorepo Overview

이 저장소는 `pnpm` workspace 기반 monorepo입니다.

```text
apps/mobile             Expo app
apps/api                Go API server
packages/api-contract   OpenAPI contract and generated TypeScript client
```

## Prerequisites

asdf를 사용하는 경우 repository root의 `.tool-versions`를 기준으로 도구 버전을 설정합니다.

```bash
asdf install
```

필수 도구:

- Node.js 20+
- pnpm 9.15.9
- Go 1.22.5
- Terraform 1.6+
- Google Cloud SDK
- EAS CLI for internal mobile builds

## Install

```bash
pnpm install
```

## Design System

UI 작업은 `docs/design/README.md`와 모바일 토큰 `apps/mobile/lib/design/theme.ts`를 기준으로 합니다. 브랜드 SVG 에셋은 `apps/mobile/assets/brand/`에 있습니다.

## OpenAPI/codegen Workflow

API 계약 변경은 항상 `packages/api-contract/openapi.yaml`에서 시작합니다.
Generated 파일을 직접 수정하지 않습니다.

1. `packages/api-contract/openapi.yaml`을 수정합니다.
2. repository root에서 `pnpm generate`를 실행합니다.
3. OpenAPI 변경과 generated diff를 함께 review합니다.
4. custom server/mobile behavior는 non-generated 파일에 구현합니다.
5. `pnpm verify`로 generated drift와 downstream integration을 확인합니다.

### Generate OpenAPI and DB Artifacts

```bash
pnpm generate
```

`pnpm generate`는 OpenAPI artifact와 sqlc DB artifact를 재생성하는 단일 entrypoint입니다.
별도의 global `oapi-codegen`, `openapi-typescript-codegen`, `sqlc` 설치가 필요하지 않습니다.

Pinned generator tooling:

- OpenAPI Go: `oapi-codegen@v2.4.1` via `go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.4.1`
- OpenAPI TypeScript: `openapi-typescript-codegen@0.29.0` via workspace devDependency and `pnpm-lock.yaml`
- SQLC Go: `sqlc@v1.27.0` via `CGO_ENABLED=0 go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.27.0`

Committed generated artifacts:

- `apps/api/internal/openapi/server.gen.go`
- `apps/api/internal/db/`
- `packages/api-contract/gen/ts/`

These generated artifacts are read-only, committed, and reviewable. Update them only by running `pnpm generate`.

## Local Environment

로컬 secret/env 값은 프로젝트 루트의 `.env`를 source of truth로 둡니다. `.env`는 git ignore 대상이며, 커밋하지 않습니다.

처음 설정할 때는 샘플을 복사해 실제 값을 채웁니다.

```bash
cp .env.example .env
```

Go API는 `.env`를 자동 로드하지 않으므로 API, migration, test 명령을 실행하기 전에 현재 shell에 로드합니다.

```bash
set -a; source .env; set +a
```

Feature worktree에서는 `.env`를 복사하지 말고 루트 `.env`로 symlink합니다. 이렇게 하면 key rotation이나 local URL 변경이 모든 worktree에 같이 반영됩니다.

Worktree 안에서 실행:

```bash
cd .worktrees/<worktree-name>
ln -s ../../.env .env
```

또는 프로젝트 루트에서 실행:

```bash
ln -s ../../.env .worktrees/<worktree-name>/.env
```

이미 worktree에 `.env` 파일이 있다면 덮어쓰기 전에 내용을 확인하고 직접 정리합니다. 실제 API key, OAuth secret, DB URL은 git, GitHub issue, chat에 붙여넣지 않습니다.

## Local DB and Migration

F-003부터 API 서버는 PostgreSQL `DATABASE_URL`을 사용합니다.
로컬 기본 DB URL은 다음입니다.

```bash
export DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable'
```

로컬 PostgreSQL 실행:

```bash
pnpm db:up
```

migration 적용/상태 확인/rollback:

```bash
DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' pnpm db:migrate
DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' pnpm db:status
DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' pnpm db:rollback
```

로컬 DB 중지:

```bash
pnpm db:down
```

## Run API

```bash
DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' pnpm dev:api
```

F-005부터 auth 기능은 다음 env를 사용합니다.

```bash
export AUTH_TOKEN_SECRET='<long-random-secret>'
export APPLE_CLIENT_ID='com.twotwobread.ium.staging' # 또는 APPLE_BUNDLE_ID
export AUTH_ALLOW_DEV_OAUTH=true                    # local/internal smoke only
```

`AUTH_ALLOW_DEV_OAUTH=true`일 때만 Apple/Kakao provider token 대신 `devSubject` credential을 local/internal smoke test에 사용할 수 있습니다. 실제 provider access token이나 identity token은 저장하지 않습니다.

F-027부터 Google Places 검색은 API 서버가 호출하며 다음 env를 사용합니다. 모바일 앱에는 Google API key를 설정하지 않습니다.

```bash
export GOOGLE_PLACES_API_KEY='<google-places-api-key>'
```

기본 주소는 `http://localhost:8080`입니다.

```bash
curl http://localhost:8080/health
# {"status":"ok"}

curl http://localhost:8080/ready
# {"checks":{"database":{"status":"ok"},"metadata":{"schema":"initialized","status":"ok"}},"status":"ok"}
```

## Run Mobile

Expo 앱은 API base URL을 `EXPO_PUBLIC_API_BASE_URL`에서 읽습니다.
코드에 `localhost`를 고정하지 않습니다.

F-005/F-007 auth 화면은 다음 public env를 사용합니다.

```bash
export EXPO_PUBLIC_AUTH_DEV_MODE=true                 # local/internal smoke only
export EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY='<native-key>' # real iOS Kakao Native SDK flow; do not commit the value
```

Apple login은 iOS에서 `expo-apple-authentication`을 사용합니다. Kakao login은 iOS internal/development build에서 `@react-native-seoul/kakao-login` Native SDK를 사용하며, native scheme은 `kakao${EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY}`로 주입됩니다. Expo Go에서는 Native SDK 로그인을 검증할 수 없습니다.

### iOS Simulator

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080 pnpm dev:mobile
```

### Android Emulator

Android Emulator에서 host machine의 localhost는 `10.0.2.2`입니다.

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080 pnpm dev:mobile
```

### Physical Device optional

같은 네트워크에 있는 실제 기기에서는 host machine의 LAN IP를 사용합니다.

```bash
EXPO_PUBLIC_API_BASE_URL=http://<your-lan-ip>:8080 pnpm dev:mobile
```

## Verify

```bash
pnpm verify
```

`pnpm verify`는 다음을 실행합니다.

- `pnpm verify:generated`로 generated artifact 재생성 전/후 checksum 비교
- Go API tests
- Go API build
- mobile TypeScript typecheck

Generated artifact가 current source와 drift되거나, regenerated artifact가 server/mobile consumer와 맞지 않으면 실패해야 합니다.

## Staging / Internal Deployment

F-004부터 staging API는 GCP Cloud Run에 배포하고, Expo iOS internal build는 Cloud Run staging URL을 `EXPO_PUBLIC_API_BASE_URL`로 사용합니다. Android internal build는 Android tester/device가 생겼을 때 선택적으로 생성합니다.

Fixed staging resources:

```text
GCP project: i-um-488511
Region: asia-northeast3
Cloud Run service: i-um-api-staging
Artifact Registry repository: i-um-staging
Secret Manager secret: i-um-staging-database-url
Cloud Build trigger: i-um-api-staging-deploy
Terraform state bucket: i-um-488511-terraform-state
```

Terraform validation:

```bash
terraform -chdir=infra/terraform/gcp-staging init
terraform -chdir=infra/terraform/gcp-staging fmt -check
terraform -chdir=infra/terraform/gcp-staging validate
terraform -chdir=infra/terraform/gcp-staging plan
```

Deploy staging API through the manual Cloud Build trigger:

```bash
gcloud builds triggers run i-um-api-staging-deploy \
  --region=asia-northeast3 \
  --branch=develop
```

Run staging smoke checks:

```bash
CLOUD_RUN_URL="$(gcloud run services describe i-um-api-staging \
  --region=asia-northeast3 \
  --format='value(status.url)')"

curl -i "$CLOUD_RUN_URL/health"
curl -i "$CLOUD_RUN_URL/ready"
```

iOS internal build uses `apps/mobile/eas.json` profile `preview` and EAS managed credentials:

```bash
cd apps/mobile
npx eas-cli@latest build --profile preview --platform ios
```

Full bootstrap, migration, deploy, EAS environment, smoke test, and rollback steps are documented in `docs/delivery/staging_internal_deploy.md`.
