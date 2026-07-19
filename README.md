# i-um

칫 Chit(구 이음/i-um)은 여행 중 다음 일정과 지출·정산을 한 흐름으로 이어주는 공동 여행 실행 앱입니다.

## Monorepo Overview

이 저장소는 `pnpm` workspace 기반 monorepo입니다.

```text
apps/mobile             Expo + React Native app
apps/api                Go API server
packages/api-contract   OpenAPI contract and generated TypeScript client
```

## Stack and Source of Truth

| Area | Technology / Source |
|---|---|
| Mobile | Expo, React Native, Expo Router |
| API | Go, chi, `net/http` |
| API Contract | `packages/api-contract/openapi.yaml` |
| API generated code | `apps/api/internal/openapi/`, `packages/api-contract/gen/ts/` |
| DB | PostgreSQL, goose migrations, sqlc + pgx |
| DB schema/query source | `apps/api/migrations/`, `apps/api/schema.sql`, `apps/api/queries/` |
| Mobile brand/design | `docs/features/0341-chit-brand-design-system.md` |
| Mobile design tokens | `apps/mobile/lib/design/theme.ts` |
| Shared mobile primitives | `apps/mobile/lib/design/components.tsx` |
| Agent workflow rules | `.pi/rules/` |


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

## Mobile UI

모바일 브랜드/디자인 기준은 `docs/features/0341-chit-brand-design-system.md`, 구현 규칙은 `.pi/rules/mobile-ui.md`, 토큰은 `apps/mobile/lib/design/theme.ts`, 공용 primitive는 `apps/mobile/lib/design/components.tsx`를 기준으로 합니다. 브랜드 에셋은 `apps/mobile/assets/brand/`에 있습니다.

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

Agent workflow 전용 helper는 `.pi/bin/`에 둡니다. `scripts/`는 앱/인프라/CI처럼 agent 밖에서도 쓰는 범용 스크립트에만 사용합니다.

`.pi/bin/worktree-create`는 worktree 생성 후 `.pi/bin/worktree-post-create`를 실행해 루트 `.env`가 있으면 새 worktree의 `.env` symlink를 자동 생성합니다. 이미 worktree에 `.env` 파일이나 symlink가 있으면 덮어쓰지 않습니다.

기존 worktree의 `.env` symlink를 수동으로 보정해야 하면 프로젝트 루트에서 실행합니다.

```bash
.pi/bin/worktree-post-create .worktrees/<worktree-name>
```

실제 API key, OAuth secret, DB URL은 git, GitHub issue, chat에 붙여넣지 않습니다.

## Local DB and Migration

F-003부터 API 서버는 PostgreSQL `DATABASE_URL`을 사용합니다.
로컬 기본 DB URL은 다음입니다.

```bash
export DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable'
```

로컬 PostgreSQL만 실행:

```bash
pnpm db:up
```

로컬 DB와 파일 업로드용 MinIO를 함께 실행:

```bash
pnpm dev:infra
```

migration 적용/상태 확인/rollback:

```bash
DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' pnpm db:migrate
DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' pnpm db:status
DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' pnpm db:rollback
```

로컬 DB/MinIO 중지:

```bash
pnpm db:down
```

## Local Object Storage

Local dev file uploads use docker-compose MinIO instead of real GCS credentials. `.env.example` defaults to:

```bash
export OBJECT_STORAGE_PROVIDER=minio
export OBJECT_STORAGE_BUCKET=ium-dev-objects
export OBJECT_STORAGE_ENDPOINT=http://localhost:9000
export OBJECT_STORAGE_ACCESS_KEY=minioadmin
export OBJECT_STORAGE_SECRET_KEY=minioadmin
export OBJECT_STORAGE_REGION=us-east-1
export OBJECT_STORAGE_FORCE_PATH_STYLE=true
```

Start only MinIO and bucket initialization when PostgreSQL is already running:

```bash
pnpm storage:up
```

MinIO console is available at `http://localhost:9001`. If a mobile client cannot open signed URLs from `localhost`, set `OBJECT_STORAGE_PUBLIC_ENDPOINT` to a client-reachable origin such as `http://10.0.2.2:9000` for Android Emulator.

Staging/prod keep using GCS with `OBJECT_STORAGE_PROVIDER=gcs`, `OBJECT_STORAGE_BUCKET`, `GCS_SIGNING_ACCESS_ID`, and `GCS_SIGNING_PRIVATE_KEY`.

## Run API

```bash
DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' pnpm dev:api
```

F-005부터 auth 기능은 다음 env를 사용합니다.

```bash
export AUTH_TOKEN_SECRET='<long-random-secret>'
export APPLE_CLIENT_ID='com.twotwobread.ium.staging'
export AUTH_ALLOW_DEV_OAUTH=true                    # local/internal smoke only
```

`AUTH_ALLOW_DEV_OAUTH=true`일 때만 Apple/Kakao provider token 대신 `devSubject` credential을 local/internal smoke test에 사용할 수 있습니다. 실제 provider access token이나 identity token은 저장하지 않습니다.

F-027부터 Google Places/Routes 호출은 API 서버가 수행하며 다음 shared server-side env를 사용합니다. 모바일 앱에 노출되는 Android Maps SDK key는 `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`로 별도 관리합니다.

```bash
export GOOGLE_MAPS_API_KEY='<server-side-google-maps-api-key>'
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

Staging/internal deployment uses `.env.stage` as the local source for deployment inputs. Copy the example file and replace placeholder secret values locally:

```bash
cp .env.stage.example .env.stage
```

Run the full staging flow for real Apple/Kakao login, API deploy, DB migration, smoke checks, EAS preview env sync, and the default iOS internal build. If `.env.stage` leaves `INVITE_BASE_URL` / `EXPO_PUBLIC_INVITE_LINK_HOST` blank, the deploy script uses the Cloud Run URL/host for demo invite links instead of assuming a purchased domain:

```bash
pnpm run deploy stage
# or
pnpm deploy:stage
```

`pnpm deploy stage` is not used because `deploy` is a built-in pnpm command.

Useful scoped runs:

```bash
pnpm run deploy stage --dry-run
pnpm run deploy stage --only api
pnpm run deploy stage --only mobile --platform ios
pnpm run deploy stage --only mobile --platform android
pnpm run deploy stage --only eas-env
```

Do not commit `.env.stage` or paste its secret values into chat, issues, git, or logs. Server-side file upload/opening features use shared `OBJECT_STORAGE_PROVIDER=gcs`, `OBJECT_STORAGE_BUCKET`, `GCS_SIGNING_ACCESS_ID`, and `GCS_SIGNING_PRIVATE_KEY`; the bucket must grant the Cloud Run runtime service account object read/write/delete access.
