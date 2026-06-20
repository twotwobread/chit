# i-um

이음(i-um)은 여행 중 다음 일정과 지출을 한 흐름으로 이어주는 공동 여행 실행 앱입니다.

## F-001 Walking Skeleton

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

## Generate OpenAPI Artifacts

```bash
pnpm generate
```

이 명령은 다음 artifact를 재생성합니다.

- `apps/api/internal/openapi/server.gen.go`
- `packages/api-contract/gen/ts/`

## Run API

```bash
pnpm dev:api
```

기본 주소는 `http://localhost:8080`입니다.

```bash
curl http://localhost:8080/health
# {"status":"ok"}
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

`pnpm verify`는 OpenAPI generated artifact consistency, Go test/build, mobile TypeScript check를 실행합니다.

## Internal Build Readiness

F-001은 실제 staging/internal 배포 파이프라인을 만들지 않습니다. 해당 작업은 #4에서 다룹니다.
F-001의 readiness 기준은 다음입니다.

- API base URL이 `EXPO_PUBLIC_API_BASE_URL`로 주입된다.
- 앱 코드에 hard-coded localhost가 없다.
- iOS Simulator 또는 Android Emulator에서 live API `/health` 호출 성공을 기록할 수 있다.
