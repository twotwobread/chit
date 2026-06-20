# Feature Slice: F-001 Monorepo walking skeleton

## Metadata

- GitHub Issue: #1
- Status: Staging
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-20
- Updated: 2026-06-20

## Ouroboros Source

- Interview Session: `interview_20260620_023117`
- Seed: `seed_0c1d0f910142`
- PM Document: N/A
- Notes: Ambiguity score `0.063`. Scope was narrowed to a minimal end-to-end walking skeleton: Expo app → generated OpenAPI client → Go API `/health`.

## Goal

사용자가 Expo 앱에서 API 연결 상태를 확인할 수 있도록, 모바일 앱이 Go API의 `/health`를 실제로 호출하는 최소 모노레포 walking skeleton을 만든다.

이 기능은 제품 도메인 기능을 구현하기 전, App UI + API Contract + API Server + generated client + 검증 스크립트가 한 저장소에서 함께 동작함을 증명한다.

## Problem

- 현재 저장소는 문서 중심 상태이므로 앱, API 서버, API 계약, 생성 코드의 실제 연결 경로가 없다.
- 이후 feature slice가 App/API/Contract를 함께 구현하려면, 먼저 최소한의 monorepo 구조와 반복 가능한 검증 명령이 필요하다.
- staging/internal 배포 전체 인프라를 만들기 전에도, 내부 빌드로 확장 가능한 환경변수 기반 API 연결 방식이 필요하다.

## User Flow

1. 개발자가 로컬에서 Go API 서버를 실행한다.
2. 개발자가 Expo 앱에 `EXPO_PUBLIC_API_BASE_URL`을 설정하고 앱을 실행한다.
3. 사용자가 앱의 기본 health 화면을 연다.
4. 앱이 generated OpenAPI TypeScript client를 통해 `GET /health`를 호출한다.
5. API가 `200 application/json`과 `{ "status": "ok" }`를 반환한다.
6. 앱이 `API 연결 성공`과 `status: ok`를 표시한다.
7. 호출 중에는 loading 상태를, 실패 시에는 error/retry 상태를 표시한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: Expo 앱 scaffold와 기본 health check 화면
- [ ] API Contract: `packages/api-contract/openapi.yaml`에 `GET /health` 정의
- [ ] API Server: Go + chi 기반 API server scaffold와 `GET /health` handler
- [ ] Generated Code: OpenAPI에서 생성된 Go server artifact와 Expo에서 사용할 TypeScript client/type artifact
- [ ] Monorepo: root `pnpm` workspace와 `apps/mobile`, `apps/api`, `packages/api-contract` 구조
- [ ] Scripts: root `pnpm generate`, `pnpm verify`, `pnpm dev:api`, `pnpm dev:mobile`
- [ ] Env Config: `EXPO_PUBLIC_API_BASE_URL` 기반 API base URL 설정 문서화
- [ ] Tests: `/health` API test/build, mobile TypeScript check, generated artifact consistency check
- [ ] Deployment: staging 인프라는 제외하되 internal build readiness를 위한 환경변수/문서/로컬 런타임 증거 기록

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 인증, OAuth, 사용자 모델
- 여행 생성/조회/수정/삭제
- 일정, 장소, 지도, Google Places/Maps 연동
- 동행자 초대/협업
- 지출, 분할, 정산
- DB 도메인 schema, migration, sqlc 설정
  - DB/migration 기본 구성은 #3에서 다룬다.
- GitHub Actions, EAS, staging/internal 배포 파이프라인
  - staging/internal 배포 기본 구성은 #4에서 다룬다.
- Turborepo, Nx 같은 추가 task runner 도입
- Web app

## UX / UI Requirements

### Screens

- `apps/mobile/app/index.tsx`: API health check 기본 화면

### States

- Loading: API 호출 중 `API 상태 확인 중...`을 표시한다.
- Empty: 별도 empty state는 필요 없다.
- Error: API 호출 실패 시 `API 연결 실패`와 retry 동작을 제공한다.
- Success: API 호출 성공 시 `API 연결 성공`과 `status: ok`를 표시한다.

### Copy / Labels

- Loading: `API 상태 확인 중...`
- Success title: `API 연결 성공`
- Success detail: `status: ok`
- Error title: `API 연결 실패`
- Retry: `다시 시도`

## API Contract

### Endpoints

```text
GET /health
```

### Request

No request body.

### Response

HTTP status: `200`

Content-Type: `application/json`

```json
{
  "status": "ok"
}
```

### Errors

`GET /health`는 정상 서버 상태 확인용 endpoint이므로 인증을 요구하지 않는다.
예상치 못한 서버 오류는 공통 에러 포맷을 따른다.

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "internal server error",
    "details": []
  }
}
```

### Code Generation Requirements

- OpenAPI source of truth는 `packages/api-contract/openapi.yaml`이다.
- Go server artifact는 OpenAPI에서 생성되어야 하며, `oapi-codegen` 사용을 기준으로 한다.
- TypeScript client/type artifact는 OpenAPI에서 생성되어야 하며 Expo 앱에서 사용할 수 있어야 한다.
- 앱은 hand-written duplicate API type이나 hand-written fetch response type에 의존하지 않는다.
- 실제로 app/server가 사용하는 generated artifact는 repository에 commit한다.
- 생성 명령은 `pnpm generate`로 반복 실행 가능해야 한다.
- TypeScript generated client는 `openapi-typescript-codegen`의 fetch client를 사용한다.

## DB Changes

No DB changes.

### Tables

N/A

### Constraints / Indexes

N/A

### Migration Notes

- F-001에서는 DB 연결이나 migration placeholder를 만들지 않는다.
- DB/migration 기본 구성은 #3에서 별도 feature slice로 처리한다.

## Business Rules

- `/health`는 인증 없이 호출 가능해야 한다.
- `/health` 응답은 서비스의 생존 여부만 표현한다.
- health 화면은 실제 configured API base URL을 호출해야 하며 mock success를 표시하지 않는다.
- 모바일 앱의 API base URL은 `EXPO_PUBLIC_API_BASE_URL`에서 읽는다.
- localhost를 앱 코드에 고정하지 않는다.
- F-001은 이후 feature slice가 따라갈 최소 구조를 만드는 것이며, 제품 도메인 동작을 선구현하지 않는다.

## Acceptance Criteria

- [x] `docs/features/0001-monorepo-walking-skeleton.md`에 feature spec + implementation plan이 작성되어 있다.
- [x] root monorepo가 `pnpm` workspace로 구성된다.
- [x] repository 구조에 `apps/mobile`, `apps/api`, `packages/api-contract`가 존재한다.
- [x] `packages/api-contract/openapi.yaml`에 `GET /health`가 정의되어 있다.
- [x] `GET /health`는 `200 application/json`과 `{ "status": "ok" }`를 반환한다.
- [x] Go API server는 chi 기반으로 `/health`를 제공한다.
- [x] OpenAPI에서 생성된 Go server artifact가 repository에 commit되어 있다.
- [x] OpenAPI에서 생성된 TypeScript client/type artifact가 repository에 commit되어 있다.
- [x] Expo 앱은 generated TypeScript client/type을 통해 live API를 호출한다.
- [x] Expo 앱은 loading, success, error/retry 상태를 표시한다.
- [x] 성공 시 앱 화면에 `API 연결 성공`과 `status: ok`가 표시된다.
- [x] root `pnpm generate`가 OpenAPI 기반 Go/TypeScript artifact를 재생성한다.
- [x] root `pnpm verify`가 최소한 OpenAPI/generation consistency, Go test, Go build, mobile TypeScript check를 실행한다.
- [x] root `pnpm dev:api`로 API 서버를 실행할 수 있다.
- [x] root `pnpm dev:mobile`로 Expo 앱을 실행할 수 있다.
- [x] `EXPO_PUBLIC_API_BASE_URL` 설정 방법이 로컬 simulator/emulator와 선택적 physical device 기준으로 문서화되어 있다.
- [x] iOS Simulator, Android Emulator, 또는 physical device 중 하나에서 health 화면이 live API 성공 상태를 표시함을 수동 검증하고 결과를 기록한다.
- [x] 실제 staging/internal 배포 파이프라인은 #4로 분리되어 있으며, F-001에서는 internal build readiness evidence만 기록한다.

## Implementation Plan

1. Monorepo workspace scaffold 작성
   - 작업: root `package.json`, `pnpm-workspace.yaml`, 기본 README/env 문서 구조를 만든다.
   - Verify: `pnpm install`이 workspace를 인식한다.

2. API contract 작성
   - 작업: `packages/api-contract/openapi.yaml`에 `GET /health`와 공통 error schema를 정의한다.
   - Verify: OpenAPI validation 또는 generation command가 실패하지 않는다.

3. Codegen script 구성
   - 작업: `pnpm generate`가 Go server artifact와 TypeScript client/type artifact를 생성하도록 한다.
   - Verify: `pnpm generate` 실행 후 git diff가 예측 가능하며 generated output이 repository에 존재한다.

4. Go API server scaffold 구현
   - 작업: `apps/api`에 Go module, chi router, `/health` handler, generated interface wiring을 만든다.
   - Verify: `go test ./...`, `go build ./...`, `curl <api-base-url>/health`가 성공한다.

5. Expo mobile scaffold 구현
   - 작업: `apps/mobile`에 Expo 앱과 기본 health screen을 만든다.
   - Verify: mobile TypeScript check가 성공한다.

6. Mobile API client 연결
   - 작업: 앱이 `EXPO_PUBLIC_API_BASE_URL`과 generated TypeScript client/type을 사용해 `/health`를 호출하게 한다.
   - Verify: API 서버 실행 상태에서 iOS Simulator, Android Emulator, 또는 physical device 화면에 `API 연결 성공`과 `status: ok`가 표시된다.

7. Root scripts와 verification 통합
   - 작업: root `pnpm dev:api`, `pnpm dev:mobile`, `pnpm generate`, `pnpm verify`를 문서화하고 동작하게 한다.
   - Verify: `pnpm verify`가 generation/OpenAPI consistency, Go test, Go build, mobile TypeScript check를 통과한다.

8. Internal build readiness 기록
   - 작업: `EXPO_PUBLIC_API_BASE_URL` 설정 예시, simulator/emulator/physical device 기준 API base URL 주의사항, F-004로 넘길 staging/internal pipeline 범위를 문서화한다.
   - Verify: feature 문서 또는 완료 보고에 local runtime proof와 F-004 defer note가 기록되어 있다.

## Verification Plan

### Automated

```text
pnpm install
pnpm generate
pnpm verify
```

`pnpm verify`는 최소한 다음을 포함해야 한다.

```text
# API
cd apps/api && go test ./...
cd apps/api && go build ./...

# Mobile
pnpm --filter @i-um/mobile typecheck

# Contract / generated code
pnpm generate 또는 generation consistency check
```

### Verification Results

- `pnpm install`: pass
- `pnpm generate`: pass
- `pnpm verify`: pass
- `pnpm dev:api` + `curl -i http://localhost:8080/health`: pass, returned `HTTP/1.1 200 OK` and `{ "status": "ok" }`
- `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080 pnpm dev:mobile -- --localhost`: pass, Expo dev server started
- Physical iPhone + Expo Go manual proof: pass, user confirmed loading, success, and error/retry states work with live API.
- iOS Simulator / Android Emulator manual proof: not run in this environment because `xcrun simctl`, Android emulator, and `adb` were unavailable.
- Expo SDK compatibility: upgraded mobile app to Expo SDK 54 so the current iOS Expo Go can open the project.

### Manual

- [x] API 서버를 `pnpm dev:api`로 실행한다.
- [x] Expo 앱을 `EXPO_PUBLIC_API_BASE_URL=<local-api-url> pnpm dev:mobile`로 실행한다.
- [x] physical iPhone + Expo Go에서 기본 화면을 연다.
- [x] loading 상태가 표시되는지 확인한다.
- [x] API 성공 시 `API 연결 성공`과 `status: ok`가 표시되는지 확인한다.
- [x] API 서버를 끄거나 잘못된 base URL을 설정해 `API 연결 실패`와 retry 상태를 확인한다.
- [x] physical device 검증 시 LAN IP 기반 base URL을 사용한다.
- [x] staging/internal pipeline은 #4 전까지 필수 검증으로 요구하지 않고, F-001 완료 보고에 readiness evidence와 한계를 기록한다.

## Release Notes

```text
- Expo 앱, Go API, OpenAPI contract, generated client/server artifact가 연결되는 최소 monorepo walking skeleton을 추가한다.
- 앱 기본 화면에서 live API /health 호출 결과를 확인할 수 있다.
- staging/internal 배포 파이프라인은 후속 #4에서 구성한다.
```

## Open Questions

None.

Resolved during implementation:

- TypeScript generated client library: `openapi-typescript-codegen` fetch client.

## Follow-up Issues

- #2: OpenAPI/codegen 기본 구성 고도화
- #3: DB/migration 기본 구성
- #4: staging/internal 배포 기본 구성
