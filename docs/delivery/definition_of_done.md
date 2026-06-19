# Definition of Done

이 문서는 이음(i-um)에서 기능 하나를 완료로 판단하는 기준을 정의한다.

기능은 App UI, API Server, DB, OpenAPI, 테스트가 함께 동작하고 배포 가능한 상태가 되었을 때 완료로 본다.

```text
Done = Spec 충족 + Vertical Slice 구현 + 검증 완료 + 배포 가능 상태
```

## 공통 완료 기준

모든 feature slice는 다음 조건을 만족해야 한다.

- [ ] GitHub Issue가 있다.
- [ ] `docs/features/` 하위에 feature spec + plan 문서가 있다.
- [ ] Scope와 out of scope가 명확하다.
- [ ] Acceptance criteria가 모두 충족되었다.
- [ ] Open questions가 없거나 후속 issue로 분리되었다.
- [ ] 구현 내용이 spec을 벗어나지 않는다.
- [ ] 완료 보고에 검증 명령과 결과가 포함되어 있다.
- [ ] staging 또는 internal build에서 확인 가능하다.

## Product / UX 기준

- [ ] 사용자가 앱에서 기능의 happy path를 수행할 수 있다.
- [ ] 빈 상태, 로딩 상태, 오류 상태 중 필요한 상태가 처리되어 있다.
- [ ] 사용자에게 노출되는 문구가 기능 목적과 일치한다.
- [ ] MVP 범위를 벗어나는 UI나 진입점이 추가되지 않았다.
- [ ] 미완성 기능은 사용자에게 노출되지 않거나 feature flag/숨김 진입점으로 보호되어 있다.

## API Contract 기준

API가 포함된 기능은 다음을 만족해야 한다.

- [ ] OpenAPI 계약이 먼저 정의 또는 수정되었다.
- [ ] request/response schema가 명확하다.
- [ ] error response가 공통 포맷을 따른다.
- [ ] Go server interface가 OpenAPI에서 생성 또는 갱신되었다.
- [ ] 모바일 TypeScript client가 OpenAPI에서 생성 또는 갱신되었다.
- [ ] 앱은 수동 fetch 타입 정의가 아니라 generated client/type을 사용한다.
- [ ] OpenAPI와 실제 서버 응답이 어긋나지 않는다.

## API Server 기준

Go API 서버 변경이 포함된 기능은 다음을 만족해야 한다.

- [ ] Handler는 HTTP 요청/응답 변환에 집중한다.
- [ ] 비즈니스 규칙은 service 계층에 둔다.
- [ ] DB 접근은 repository/sqlc query를 통해 수행한다.
- [ ] 인증/권한이 필요한 endpoint는 participant 권한을 확인한다.
- [ ] validation error, not found, forbidden 등 필요한 에러가 공통 포맷으로 반환된다.
- [ ] 관련 service test 또는 handler test가 있다.
- [ ] `go test ./...`가 통과한다.
- [ ] `go build` 또는 이에 준하는 build 검증이 통과한다.

## DB / Migration 기준

DB 변경이 포함된 기능은 다음을 만족해야 한다.

- [ ] goose migration이 추가되었다.
- [ ] migration 이름이 기능과 연결되어 있다.
- [ ] 필요한 index/foreign key/unique constraint가 정의되어 있다.
- [ ] 금액은 floating point로 저장하지 않는다.
- [ ] 날짜와 timestamp 저장 기준이 API 규칙과 일치한다.
- [ ] migration up/down 또는 적용/초기화 경로가 확인되었다.
- [ ] sqlc query가 필요한 경우 추가 또는 갱신되었다.
- [ ] generated DB code가 최신이다.

## Mobile App 기준

Expo 앱 변경이 포함된 기능은 다음을 만족해야 한다.

- [ ] 사용자가 앱에서 기능의 happy path를 수행할 수 있다.
- [ ] 실제 API client와 연결되어 있다.
- [ ] mock data는 spec에 명시된 경우 또는 임시 개발용으로만 사용한다.
- [ ] API loading state가 있다.
- [ ] API error state가 있다.
- [ ] empty state가 필요한 화면에는 empty state가 있다.
- [ ] 입력 validation이 필요한 경우 사용자에게 이해 가능한 피드백을 준다.
- [ ] TypeScript typecheck가 통과한다.
- [ ] Google Maps URL 등 순수 로직은 가능한 경우 단위 테스트가 있다.

## 테스트 기준

기능 성격에 맞게 최소 하나 이상의 검증이 있어야 한다.

권장 테스트:

- API service test
- API handler test
- settlement 계산 test
- repository integration test
- mobile hook 또는 utility test
- TypeScript typecheck
- OpenAPI lint
- DB migration 적용 확인

테스트 자동화가 아직 없는 초기 단계에서는 feature 문서의 `Verification` 섹션에 수동 검증 절차와 결과를 기록한다.

## 배포 가능 상태 기준

기능은 다음 조건을 만족할 때 배포 가능하다고 본다.

- [ ] main branch에 merge 가능한 상태다.
- [ ] 환경변수나 secret 설정이 문서화되어 있다.
- [ ] migration 적용 순서가 안전하다.
- [ ] 앱과 API의 버전/계약이 호환된다.
- [ ] 기존 핵심 기능을 깨뜨리지 않는다.
- [ ] staging 또는 internal build에서 happy path를 확인했다.
- [ ] release notes가 작성되었다.

## 완료 보고 형식

기능 완료 시 다음 형식으로 보고한다.

```md
## Summary

- <구현 요약>

## Changed Files

- `<path>`: <변경 내용>

## Verification

- `<command>`: pass/fail
- `<manual check>`: pass/fail

## Deployment

- Staging/Internal build: <확인 결과 또는 링크>

## Notes

- <제한사항, 후속 issue, open question>
```

## 완료로 보지 않는 상태

다음 상태는 Done이 아니다.

- API만 구현되고 App UI가 연결되지 않았다.
- App UI만 있고 실제 API가 연결되지 않았다.
- DB migration 없이 로컬 임시 schema에 의존한다.
- OpenAPI 계약과 실제 구현이 다르다.
- generated client가 갱신되지 않았다.
- happy path를 앱에서 확인하지 않았다.
- staging/internal build에서 검증하지 않았다.
- spec에 없는 기능을 추가했다.
- 실패한 테스트나 typecheck를 설명 없이 남겼다.

## 예외

문서 수정, 오타 수정, 설정 변경, 긴급 hotfix는 일부 기준을 생략할 수 있다.

단, 다음 중 하나라도 포함되면 이 Definition of Done을 적용한다.

- API 계약 변경
- DB migration
- 사용자 visible behavior 변경
- 새 화면 또는 주요 UI 상태 추가
- 결제/정산/권한 관련 로직 변경
- 배포 리스크가 있는 변경
