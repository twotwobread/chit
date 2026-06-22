# Feature Slice: <feature name>

## Metadata

- GitHub Issue: #<number>
- Status: Draft | Spec Review | Ready | In Progress | Staging | Done
- Owner: <name>
- Target Sprint: <YYYY-WW>
- Created: <YYYY-MM-DD>
- Updated: <YYYY-MM-DD>

## Ouroboros Source

요구사항 구체화에 Ouroboros를 사용한 경우 기록한다.

- Interview Session: `<session_id>`
- Seed: `<seed_path>`
- PM Document: `<pm_path>`
- Notes: <요약 또는 링크>

사용하지 않은 경우:

```text
Not used. Reason: <단순 수정 / 요구사항 명확 / 기타>
```

## Goal

사용자 관점에서 이 기능이 달성해야 하는 목표를 한두 문장으로 작성한다.

예시:

```text
사용자가 앱에서 여행을 생성하고 목록에서 확인할 수 있다.
```

## Problem

이 기능이 해결하는 사용자 문제를 설명한다.

- <문제 1>
- <문제 2>

## User Flow

사용자가 앱에서 수행하는 흐름을 순서대로 작성한다.

1. <사용자 행동>
2. <앱 반응>
3. <사용자 행동>
4. <완료 상태>

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: <화면/컴포넌트>
- [ ] API Contract: <endpoint/schema>
- [ ] API Server: <handler/service/repository>
- [ ] DB: <migration/table/query>
- [ ] Tests: <test 대상>
- [ ] Deployment: <staging/internal build 확인>

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- <제외 항목 1>
- <제외 항목 2>
- <후속 feature로 분리할 항목>

## UX / UI Requirements

### Screens

- `<screen/path>`: <설명>

### States

- Loading: <필요 여부 및 동작>
- Empty: <필요 여부 및 동작>
- Error: <필요 여부 및 동작>
- Success: <필요 여부 및 동작>

### Copy / Labels

사용자에게 노출되는 주요 문구를 기록한다.

- `<label>`: <문구>

## API Contract

API 변경이 없으면 `No API changes.`라고 적는다.

### Endpoints

```text
METHOD /path
```

### Request

```json
{
  "field": "example"
}
```

### Response

```json
{
  "id": "example"
}
```

### Errors

공통 에러 포맷을 따른다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "message",
    "details": []
  }
}
```

## DB Changes

DB 변경이 없으면 `No DB changes.`라고 적는다.

### Tables

- `<table>`: <생성/변경 내용>

### Constraints / Indexes

- `<constraint_or_index>`: <설명>

### Migration Notes

- <migration 적용/rollback 주의사항>

## Business Rules

기능에 적용되는 도메인 규칙을 작성한다.

- <규칙 1>
- <규칙 2>

예시:

```text
여행 생성자는 자동으로 Owner participant가 된다.
startDate는 endDate보다 늦을 수 없다.
```

## Acceptance Criteria

검증 가능한 문장으로 작성한다. Acceptance Criteria는 아래 `Regression Test Plan`의 자동화 테스트와 연결되어야 한다. 수동 검증은 회귀 방지 증거가 아니므로 acceptance criteria의 유일한 검증 수단으로 쓰지 않는다.

- [ ] <조건 1>
- [ ] <조건 2>
- [ ] <조건 3>

좋은 예:

```text
- [ ] 사용자가 여행 이름, 시작일, 종료일, 기본 통화를 입력해 여행을 생성할 수 있다.
- [ ] 생성 후 여행 목록 화면에 새 여행이 표시된다.
- [ ] startDate가 endDate보다 늦으면 validation error가 표시된다.
```

나쁜 예:

```text
- [ ] 여행 기능 잘 동작
- [ ] 수동으로 화면에서 확인한다
```

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| <검증할 동작> | <API handler / API service / DB / Mobile logic / Mobile state / Contract> | `<path>` 또는 `<gate>` | `<command>` |

## Regression Gaps

자동화하지 못한 behavior가 있으면 기록한다. 기본값은 `None`이다.

- None

예외가 있으면 다음 형식으로 적는다.

```text
- <behavior>: <자동화하지 못한 이유>
  - Risk: <회귀 감지 리스크>
  - Follow-up: #<issue>
```

## TDD Implementation Plan

Red-Green-Refactor 순서로 작성한다. 구현 계획보다 실패 테스트와 회귀 테스트 게이트를 먼저 고정한다.

1. Red: <실패 테스트 작성>
   - Verify: <테스트 실패 확인 명령과 기대 실패 이유>
2. Green: <최소 구현>
   - Verify: <테스트 통과 확인 명령>
3. Refactor: <구조 정리>
   - Verify: <관련 테스트 재실행>
4. Regression gate
   - Verify: `pnpm verify`

API/DB가 포함된 경우 권장 순서:

1. Red: OpenAPI/API/DB/Mobile behavior별 실패 테스트 작성
2. OpenAPI 계약 작성/수정
3. generated Go/TS code 갱신
4. DB migration/query 작성
5. API Server 최소 구현
6. App UI/generated client 연결
7. Refactor
8. `pnpm verify`와 DB migration 검증

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
<command>
<command>
<command>
```

예시:

```text
go test ./...
pnpm typecheck
pnpm lint
```

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] <앱에서 확인할 happy path>
- [ ] <오류 상태 확인>
- [ ] <staging/internal build 확인>

## Release Notes

사용자 또는 팀에게 공유할 릴리즈 요약을 작성한다.

```text
- <기능 추가/변경 요약>
```

## Open Questions

구현 전 해결해야 할 질문을 기록한다.

- [ ] <질문 1>
- [ ] <질문 2>

질문이 남아 있는 경우 `Ready` 상태로 이동하지 않는다. 단, 명시적으로 후속 issue로 분리한 질문은 링크를 남긴다.

## Follow-up Issues

이번 feature slice에서 제외된 후속 작업을 기록한다.

- #<number>: <설명>
