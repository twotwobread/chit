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

검증 가능한 문장으로 작성한다.

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
```

## Implementation Plan

작업 순서와 각 단계의 검증 방법을 작성한다.

1. <작업>
   - Verify: <검증 방법>
2. <작업>
   - Verify: <검증 방법>
3. <작업>
   - Verify: <검증 방법>

권장 순서:

1. OpenAPI 계약 작성/수정
2. generated Go/TS code 갱신
3. DB migration 작성
4. API Server 구현
5. App UI 구현
6. generated client 연결
7. 테스트 추가
8. staging/internal build 검증

## Verification Plan

완료 전 실행할 검증 명령과 수동 확인 절차를 작성한다.

### Automated

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

### Manual

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
