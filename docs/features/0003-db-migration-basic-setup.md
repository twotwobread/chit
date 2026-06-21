# Feature Slice: F-003 DB/migration basic setup

## Metadata

- GitHub Issue: #3
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-21
- Updated: 2026-06-21

## Ouroboros Source

- Interview Session: `interview_20260621_000220`
- Seed: Not generated. Reason: feature spec + plan 문서 작성이 목적이며, interview 결과로 필요한 결정이 확정됨.
- PM Document: N/A
- Notes: Ambiguity score `0.12`. User confirmed the scope, minimum Done criteria, `/ready` contract, and OpenAPI/generated-client requirement.

Spec decisions from the interview:

- Include `/ready` endpoint, local Docker Compose PostgreSQL, initial foundation migration, sqlc sample query, mobile diagnostic UI, and development scripts/verification commands.
- `/health` remains API liveness. DB verification is exposed through `/ready`.
- `/ready` checks DB pool connectivity and one sqlc query against `app_metadata`.
- The existing mobile diagnostic screen is extended to show DB readiness so the slice remains App UI + API + DB verifiable.
- F-003 creates only a minimal foundation table/query for migration and sqlc verification. Product domain tables and CRUD are deferred to later feature slices.
- `/ready` must be added to OpenAPI and consumed from generated Go/TypeScript artifacts. Temporary hard-coded fetch/types are not allowed.

## Goal

개발자가 PostgreSQL, goose migration, sqlc generated query, pgx connection pool이 연결된 API 서버를 실행하고, Expo 앱에서 API와 DB readiness를 확인할 수 있는 기본 DB/migration 구조를 만든다.

이 기능은 여행/일정/정산 도메인 기능을 구현하기 전, DB schema 변경과 typed query 생성/검증 경로가 반복 가능하게 동작함을 증명한다.

## Problem

- 현재 F-001 walking skeleton은 앱과 API/OpenAPI 연결만 검증하며 DB 연결 경로가 없다.
- 이후 Trip, Itinerary, Expense feature slice는 migration, sqlc query, pgx connection이 선행되어야 한다.
- DB schema 변경을 수동 SQL이나 임시 로컬 상태에 의존하면 배포 가능성과 재현성이 떨어진다.
- 모바일 앱에서 live API뿐 아니라 API가 실제 DB에 연결되어 있는지도 확인할 내부 진단 흐름이 필요하다.

## User Flow

1. 개발자가 로컬 PostgreSQL을 실행한다.
2. 개발자가 goose migration을 적용한다.
3. 개발자가 sqlc generated DB code를 생성한다.
4. 개발자가 `DATABASE_URL`을 설정하고 Go API 서버를 실행한다.
5. API 서버가 `pgxpool`로 PostgreSQL에 연결한다.
6. 사용자가 Expo 앱의 기존 진단 화면을 연다.
7. 앱이 generated OpenAPI TypeScript client를 통해 API readiness endpoint를 호출한다.
8. API가 DB pool 연결과 `app_metadata` sqlc query를 확인하고 readiness response를 반환한다.
9. 앱이 `API 연결 성공`과 `DB 연결 성공`을 표시한다.
10. DB 연결 실패 시 앱은 오류 상태와 retry 동작을 표시한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 기존 health/diagnostic 화면에 DB readiness 상태 표시 추가
- [ ] API Contract: `GET /ready` endpoint와 readiness response schema 추가, generated Go/TypeScript artifacts 갱신
- [ ] API Server: `DATABASE_URL` 기반 config, `pgxpool` 연결/종료, readiness handler/service 추가
- [ ] DB: local PostgreSQL 실행 설정, goose migration 디렉터리, 첫 migration, migration scripts
- [ ] SQL: `sqlc.yaml`, `app_metadata` sample query file, pgx 기반 generated DB code 추가
- [ ] Scripts: DB up/down, migration, sqlc generation, verification 명령 문서화
- [ ] Tests: readiness handler/service 또는 storage test, generated code compile check
- [ ] Deployment: 실제 staging pipeline은 #4로 넘기되 local/internal verification evidence 기록

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- `users`, `trips`, `trip_participants`, `trip_days`, `trip_places`, `itinerary_items`, `expenses`, `expense_splits` 등 제품 도메인 테이블 생성
- 여행 생성/목록, 일정, 장소, 지출, 정산 API 구현
- 인증/권한 모델 구현
- production/staging managed PostgreSQL provisioning
- DB backup/restore, PITR, 운영 모니터링
- seed data 관리 체계
- complex migration branching/rollback 전략
- DB connection pool tuning 고도화
- staging/internal 배포 파이프라인 구성 (#4에서 처리)

## UX / UI Requirements

### Screens

- `apps/mobile/app/index.tsx`: 기존 API health check 진단 화면

### States

- Loading: API/DB readiness 확인 중 `API 및 DB 상태 확인 중...`을 표시한다.
- Empty: 별도 empty state는 필요 없다.
- Error: API 호출 또는 DB readiness 실패 시 `API 또는 DB 연결 실패`와 retry 동작을 제공한다.
- Success: API와 DB readiness가 모두 성공하면 `API 연결 성공`, `DB 연결 성공`을 표시한다.

### Copy / Labels

- Loading: `API 및 DB 상태 확인 중...`
- API success: `API 연결 성공`
- DB success: `DB 연결 성공`
- Error title: `API 또는 DB 연결 실패`
- Retry: `다시 시도`

## API Contract

### Endpoints

```text
GET /health
GET /ready
```

`GET /health`는 기존 liveness endpoint로 유지한다. DB query를 수행하지 않는다.

`GET /ready`는 API가 요청 처리에 필요한 DB 연결을 사용할 수 있는지 확인한다.

### Request

No request body.

### Response

HTTP status: `200`

Content-Type: `application/json`

```json
{
  "status": "ok",
  "checks": {
    "database": {
      "status": "ok"
    },
    "metadata": {
      "status": "ok",
      "schema": "initialized"
    }
  }
}
```

### Errors

DB 연결 실패 또는 readiness 확인 실패 시 공통 에러 포맷을 따른다.

HTTP status: `503`

```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "database is not ready",
    "details": []
  }
}
```

예상치 못한 서버 오류는 기존 공통 에러 포맷을 따른다.

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "internal server error",
    "details": []
  }
}
```

## DB Changes

### Tables

- `app_metadata`: migration/sqlc/pgx 연결을 검증하기 위한 최소 foundation table

예상 schema:

```sql
CREATE TABLE app_metadata (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

초기 row:

```sql
INSERT INTO app_metadata (key, value)
VALUES ('schema', 'initialized');
```

### Constraints / Indexes

- `app_metadata.key`: primary key

### Migration Notes

- goose migration은 `apps/api/migrations` 하위에 둔다.
- 첫 migration은 `app_metadata` 생성과 초기 row insert를 포함한다.
- rollback은 `app_metadata`를 drop한다.
- goose가 관리하는 migration version table 외에 제품 도메인 테이블은 만들지 않는다.
- `sqlc` query는 `app_metadata`의 `schema=initialized` 값을 조회하는 최소 query만 포함한다.
- CRUD query는 포함하지 않는다.

## Business Rules

- DB schema 변경은 goose migration으로만 수행한다.
- API 서버는 PostgreSQL 연결에 `pgxpool`을 사용한다.
- API 서버는 `DATABASE_URL` 환경변수에서 DB 연결 문자열을 읽는다.
- DB 연결 확인은 bounded context timeout 안에서 수행한다.
- `/health`는 liveness만 확인하며 DB에 의존하지 않는다.
- `/ready`는 DB pool 연결과 `app_metadata` sqlc query가 성공할 때만 `status: ok`를 반환한다.
- `/ready` 실패 시 서버는 `503`과 `SERVICE_UNAVAILABLE` 공통 에러 포맷을 반환한다.
- generated sqlc code는 repository에 commit하고 `pnpm generate` 또는 명시된 generation command로 재생성 가능해야 한다.
- 모바일 앱은 readiness API 호출에 generated OpenAPI TypeScript client/type을 사용한다.
- 모바일 앱은 서버 에러 메시지를 그대로 노출하지 않고 고정 문구 `API 또는 DB 연결 실패`로 매핑한다.
- F-003은 제품 도메인 schema를 선구현하지 않는다.

## Acceptance Criteria

- [x] `docs/features/0003-db-migration-basic-setup.md`에 feature spec + implementation plan이 작성되어 있다.
- [x] local PostgreSQL을 반복 실행할 수 있는 설정과 문서가 있다.
- [x] API 서버가 `DATABASE_URL` 환경변수를 통해 PostgreSQL에 연결한다.
- [x] API 서버가 종료 시 `pgxpool`을 정상 close한다.
- [x] `apps/api/migrations`에 goose migration이 추가되어 있다.
- [x] 빈 PostgreSQL DB에 goose migration `up`을 적용할 수 있다.
- [x] 적용된 migration을 rollback 후 다시 apply할 수 있다.
- [x] `apps/api/sqlc.yaml`과 query file이 추가되어 있다.
- [x] sqlc generated Go code가 repository에 commit되어 있다.
- [x] `pnpm generate` 또는 명시된 generation command로 OpenAPI/SQLC generated code를 재생성할 수 있다.
- [x] generated Go server artifact와 generated TypeScript client가 `GET /ready`를 포함한다.
- [x] `packages/api-contract/openapi.yaml`에 `GET /ready`가 정의되어 있다.
- [x] `GET /health`는 기존 liveness semantics를 유지한다.
- [x] `GET /ready`는 DB가 준비되면 `200`과 `{ status: "ok", checks: { database: { status: "ok" }, metadata: { status: "ok", schema: "initialized" } } }`를 반환한다.
- [x] DB가 준비되지 않았을 때 `GET /ready`는 공통 에러 포맷의 `503`을 반환한다.
- [x] Expo 앱의 진단 화면이 generated client로 readiness endpoint를 호출하며 hard-coded fetch/type을 사용하지 않는다.
- [ ] Expo 앱에서 API와 DB가 준비된 경우 `API 연결 성공`과 `DB 연결 성공`을 확인할 수 있다.
- [ ] Expo 앱에서 DB/API 오류 시 오류 상태와 retry 동작을 확인할 수 있다.
- [x] README 또는 관련 문서에 local DB 실행, migration, API 실행 순서가 기록되어 있다.
- [x] API test/build, mobile typecheck, generated artifact consistency check가 통과한다.
- [x] 실제 staging/internal pipeline이 #4 전까지 없으면, F-003 완료 보고에 local/internal verification evidence와 #4 defer note를 기록한다.

## Implementation Plan

1. Local PostgreSQL 개발 환경 정의
   - 작업: root 또는 API 문서에 Docker Compose 기반 PostgreSQL 실행 방법과 기본 `DATABASE_URL` 예시를 추가한다.
   - Verify: `docker compose up -d db` 후 DB container가 healthy 상태가 된다.

2. Goose migration 구조 추가
   - 작업: `apps/api/migrations`를 만들고 `app_metadata` foundation table을 생성/삭제하는 첫 migration을 작성한다.
   - Verify: 빈 DB에 migration `up`, `status`, `down`, 재-`up`이 성공한다.

3. sqlc 설정과 query 추가
   - 작업: `apps/api/sqlc.yaml`, `apps/api/queries/*.sql`, generated DB package를 추가하고 `app_metadata`의 `schema` 값을 조회하는 sample query를 만든다.
   - Verify: sqlc generation command가 성공하고 generated code가 git diff로 확인된다.

4. API DB storage layer 추가
   - 작업: `apps/api/internal/storage`에 `DATABASE_URL` config, `pgxpool` open/close, bounded ping/query helper를 추가한다.
   - Verify: DB가 실행 중일 때 Go test가 storage 연결 확인을 통과한다.

5. Readiness API contract 추가
   - 작업: `packages/api-contract/openapi.yaml`에 `GET /ready`, `ReadinessResponse`, `SERVICE_UNAVAILABLE` error case를 정의한다.
   - Verify: `pnpm generate`로 Go server artifact와 TypeScript client/type이 갱신된다.

6. API readiness handler 구현
   - 작업: generated interface에 맞춰 `/ready` handler를 구현하고 DB pool 연결 및 `app_metadata` sqlc query로 DB readiness를 확인한다.
   - Verify: `curl -i http://localhost:8080/ready`가 DB 준비 상태에서는 exact success body와 `200`, DB 장애 상태에서는 공통 에러 body와 `503`을 반환한다.

7. Mobile diagnostic 화면 연결
   - 작업: 기존 Expo health 화면에서 generated client로 `/ready`를 호출하고 API/DB 성공 및 오류 상태를 표시한다.
   - Verify: API와 DB가 실행 중일 때 앱 화면에 `API 연결 성공`, `DB 연결 성공`이 표시된다.

8. Scripts와 문서 갱신
   - 작업: root/API package scripts와 README에 DB 실행, migration, generation, verification 순서를 문서화한다.
   - Verify: 새로 문서화한 명령만 따라 로컬 DB → migration → API → mobile 확인 흐름이 재현된다.

9. Feature verification 수행 및 결과 기록
   - 작업: 자동 검증과 수동 앱 확인을 실행하고 완료 보고 또는 feature 문서에 결과를 기록한다.
   - Verify: acceptance criteria가 모두 충족되고, staging/internal pipeline 부재는 #4 defer note로 남긴다.

## Verification Plan

### Automated

구현 후 실제 script 이름은 implementation에서 확정하되, 최소 다음 검증을 수행한다.

```text
pnpm install
pnpm generate
pnpm verify
```

DB 포함 검증:

```text
docker compose up -d db
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api build
```

Contract/generated consistency:

```text
pnpm generate
git diff --exit-code -- apps/api/internal/openapi packages/api-contract/gen/ts apps/api/internal/db
```

### Verification Results

- `pnpm install`: pass
- `pnpm generate`: pass
- `pnpm --filter @i-um/api test`: pass
- `pnpm --filter @i-um/api build`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm verify`: pass
- `docker compose up -d db`: pass, PostgreSQL healthcheck reached `healthy`
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass, `00001_create_app_metadata.sql` applied
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback`: pass
- rollback 후 `pnpm db:migrate` 재실행: pass
- `PORT=18080 DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm dev:api` + `curl -i http://localhost:18080/health`: pass, `200` and `{ "status": "ok" }`
- `curl -i http://localhost:18080/ready`: pass, `200` and `{ "checks": { "database": { "status": "ok" }, "metadata": { "schema": "initialized", "status": "ok" } }, "status": "ok" }`
- DB stopped while API stayed running + `curl -i http://localhost:18080/ready`: pass, `503` and `SERVICE_UNAVAILABLE` common error body
- Mobile UI runtime check on simulator/emulator/physical device: not run in this environment. TypeScript integration with generated client passed.
- Staging/internal build: not available yet; deferred to #4.

### Manual

- [x] `docker compose up -d db`로 local PostgreSQL을 실행한다.
- [x] goose migration을 적용한다.
- [x] `DATABASE_URL=<local-db-url> pnpm dev:api`로 API 서버를 실행한다.
- [x] `curl -i http://localhost:8080/health`가 기존 liveness success를 반환하는지 확인한다. 검증 시 8080이 사용 중이라 `PORT=18080`으로 확인했다.
- [x] `curl -i http://localhost:8080/ready`가 DB readiness exact success body를 반환하는지 확인한다. 검증 시 8080이 사용 중이라 `PORT=18080`으로 확인했다.
- [x] DB를 중지하거나 잘못된 `DATABASE_URL`로 readiness failure가 `503`과 공통 에러 포맷을 반환하는지 확인한다.
- [ ] `EXPO_PUBLIC_API_BASE_URL=<local-api-url> pnpm dev:mobile`로 Expo 앱을 실행한다.
- [ ] iOS Simulator, Android Emulator, 또는 physical device 중 하나에서 `API 연결 성공`, `DB 연결 성공`을 확인한다.
- [ ] 오류 상태와 retry 동작을 확인한다.
- [x] staging/internal pipeline이 아직 없으면 #4로 defer됨을 완료 보고에 기록한다.

## Release Notes

```text
- PostgreSQL, goose migration, sqlc, pgx 기반 DB foundation을 추가한다.
- API readiness endpoint로 DB 연결 상태를 확인할 수 있다.
- Expo 앱 진단 화면에서 live API와 DB readiness를 함께 확인할 수 있다.
- 제품 도메인 테이블과 staging/internal 배포 파이프라인은 후속 feature에서 구현한다.
```

## Open Questions

None for implementation after spec approval.

Resolved by Ouroboros interview:

- Local DB는 Docker Compose 기준으로 작성한다.
- Readiness endpoint는 `/ready`로 작성하고 `/health`는 기존 liveness semantics를 유지한다.
- 첫 migration은 `app_metadata` foundation table만 생성한다.
- sqlc는 `app_metadata` sample query만 포함하고 CRUD는 제외한다.
- Mobile diagnostic UI는 generated client로 `/ready`를 호출하고 고정 오류 문구를 표시한다.

## Follow-up Issues

- #4: staging/internal 배포 기본 구성
- TBD: Trip/Participant 도메인 schema와 API feature slice
