# TDD and Regression Test Guidelines

## 목적

이 문서는 이음(i-um)의 기능 개발에서 테스트를 어떻게 설계하고 구현할지 정의한다.

핵심 목표는 기능 동작을 사람이 일회성으로 확인하는 데서 끝내지 않고, 코드와 같은 산출물로 남는 자동화 테스트로 회귀를 즉시 감지하는 것이다.

```text
Quality Gate = Regression Test Code + Automated Verification
Manual Smoke = 배포/기기/환경 연결 보조 확인
```

수동 검증은 필요할 수 있지만 회귀 방지 수단이 아니며, 자동화 테스트의 대체물로 인정하지 않는다.

## 핵심 원칙

### 1. Acceptance Criteria는 회귀 테스트와 연결한다

Feature spec의 acceptance criteria는 구현 전에 regression test plan으로 번역한다.

좋은 예:

```md
| Behavior | Layer | Test File / Gate | Command |
|---|---|---|---|
| 시작일 당일은 진행 중이다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
```

나쁜 예:

```md
- 수동으로 화면에서 확인한다.
```

수동 확인은 smoke check일 수는 있지만 acceptance criteria를 회귀 가능하게 증명하지 못한다.

### 2. 변경한 layer에는 test-first를 적용한다

변경한 layer에는 먼저 실패하는 테스트를 작성한다.

```text
Red   = 실패하는 테스트 작성 및 실패 확인
Green = 테스트를 통과시키는 최소 구현
Refactor = 테스트가 통과한 상태에서 구조 정리
```

변경하지 않은 layer에 억지로 신규 테스트를 만들지는 않는다. 대신 기존 regression suite로 깨지지 않았음을 확인한다.

예: Mobile-only feature

- API 신규 테스트 없음
- Mobile logic/state 테스트 추가
- `pnpm verify`로 API regression도 함께 확인

### 3. 수동 검증과 회귀 테스트를 분리한다

Feature 문서는 다음을 분리해서 작성한다.

```md
## Regression Test Plan
코드로 남고 CI/verify에서 반복 실행되는 테스트.

## Manual Smoke Plan
실제 기기, staging, internal build에서 사람이 확인하는 보조 smoke check.
Regression Test Plan을 대체하지 않는다.
```

Manual Smoke가 실패하면 배포 판단에는 영향을 줄 수 있지만, Manual Smoke만으로 feature가 회귀 보호되었다고 주장하지 않는다.

### 4. 테스트 자동화 공백은 명시한다

자동화하지 못한 behavior가 있으면 숨기지 않고 `Regression Gaps`로 기록한다.

```md
## Regression Gaps

- `<behavior>`: <자동화하지 못한 이유>
  - Risk: <회귀 감지 리스크>
  - Follow-up: #<issue>
```

기본값은 자동화이며, gap은 예외다.

## Layer별 TDD 규칙

### API Contract

API 계약이 변경되면 OpenAPI가 source of truth다.

Regression gate:

```text
pnpm verify:generated
```

필수 검증:

- OpenAPI schema가 request/response/error를 표현한다.
- Go server interface가 재생성된다.
- TypeScript client/type이 재생성된다.
- generated drift가 없다.

### API Server

API server 동작이 변경되면 handler/service/repository 중 해당 layer에 실패 테스트를 먼저 작성한다.

권장 test matrix:

| Layer | 필수 테스트 |
|---|---|
| Handler | 401, 400 validation, 403/404, happy path status/response, common error format |
| Service | 비즈니스 규칙, 권한, 정렬/필터링, transaction/rollback behavior |
| Repository | SQL filtering/sorting, inaccessible row exclusion, empty result, deterministic ordering |

Regression gate:

```text
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
```

### DB / Migration

DB schema나 query가 바뀌면 migration/query 검증이 필요하다.

필수 검증:

```text
DATABASE_URL=... pnpm db:migrate
DATABASE_URL=... pnpm db:status
DATABASE_URL=... pnpm db:rollback
DATABASE_URL=... pnpm db:migrate
```

sqlc query가 추가/변경되면 repository 또는 service test에서 query behavior를 검증한다.

### Mobile

Expo Go 없이도 핵심 동작을 회귀 검증할 수 있도록 UI 안의 로직을 helper/state layer로 분리한다.

우선순위:

1. Pure logic test
2. API response → UI state 변환 test
3. Component/render test
4. Manual smoke

테스트 우선 대상:

- 날짜/시간 계산
- grouping/sorting/filtering
- formatting
- API 응답을 화면 상태로 변환하는 로직
- loading/error/empty/success 상태 결정
- 외부 URL 생성
- 정산/금액 계산

Regression gate:

```text
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
```

## 주입 가능성 규칙

날짜/시간, 랜덤, 현재 사용자, 외부 API 응답 같은 외부 입력은 테스트에서 고정할 수 있어야 한다.

좋은 예:

```ts
groupTripsByStatus(trips, today)
```

나쁜 예:

```ts
function groupTripsByStatus(trips) {
  const today = new Date();
}
```

UI component가 현재 값을 읽어야 한다면, 실제 계산은 주입 가능한 helper에 둔다.

## Ouroboros 기반 spec 설계 규칙

Ouroboros interview/seed/spec 단계에서도 테스트 가능성을 먼저 확정한다.

필수 질문:

- 각 acceptance criteria는 어떤 regression test로 남는가?
- API/Mobile/DB 중 어느 layer가 변경되는가?
- 어떤 실패 테스트를 먼저 작성할 것인가?
- 날짜/시간/현재 사용자/외부 API는 어떻게 주입 가능하게 만들 것인가?
- Expo Go 없이 검증 가능한 mobile logic/state는 무엇인가?
- API 변경이 있다면 handler/service/repository 중 어디에 테스트를 둘 것인가?
- 자동화하지 못하는 behavior가 있다면 gap과 follow-up은 무엇인가?

Feature spec은 구현 계획보다 regression test plan을 먼저 작성한다.

## 표준 TDD Implementation Plan

```md
## TDD Implementation Plan

1. Red: <실패 테스트 작성>
   - Verify: <테스트 실패 확인>
2. Green: <최소 구현>
   - Verify: <테스트 통과 확인>
3. Refactor: <구조 정리>
   - Verify: <관련 테스트 재실행>
4. Regression gate
   - Verify: `pnpm verify`
```

## 표준 Regression Test Plan

```md
## Regression Test Plan

| Behavior | Layer | Test File / Gate | Command |
|---|---|---|---|
| <동작> | API handler | `<path>` | `pnpm --filter @i-um/api test` |
| <동작> | Mobile logic | `<path>` | `pnpm --filter @i-um/mobile test` |
```

## 기본 verification command

모든 feature PR은 기본적으로 다음을 통과해야 한다.

```text
pnpm verify
```

`pnpm verify`는 최소한 다음을 포함해야 한다.

```text
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
```

DB 변경이 있는 feature는 migration 검증을 추가한다.

## 완료 보고 규칙

완료 보고에는 regression test 결과를 수동 smoke와 분리해서 작성한다.

```md
## Regression Tests

- `<command>`: pass/fail
- `<test file>`: <covered behavior>

## Manual Smoke

- Staging/Internal build: <run/not run/result>
- Device/simulator: <run/not run/result>

## Regression Gaps

- None
```

Manual Smoke는 배포 확인 결과일 뿐 Regression Tests를 대체하지 않는다.
