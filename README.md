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

## Install

```bash
pnpm install
```

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

## Internal Build Readiness

F-003은 실제 staging/internal 배포 파이프라인을 만들지 않습니다. 해당 작업은 #4에서 다룹니다.
F-003의 readiness 기준은 다음입니다.

- API base URL이 `EXPO_PUBLIC_API_BASE_URL`로 주입된다.
- API 서버의 DB URL이 `DATABASE_URL`로 주입된다.
- 앱 코드에 hard-coded localhost가 없다.
- iOS Simulator, Android Emulator, 또는 physical device에서 live API `/health`와 `/ready` 호출 성공을 기록할 수 있다.
