# Feature Delivery Workflow

## 목적

이 문서는 이음(i-um)의 기능 개발 흐름을 정의한다.

프로젝트는 주 단위로 사용자에게 보여줄 수 있는 output을 만드는 것을 목표로 한다. 각 기능은 App UI와 API Server를 따로 분리해서 완료하지 않고, 기능 하나가 끝나면 배포 가능한 상태가 되도록 **vertical slice**로 구현한다.

```text
Feature Slice = App UI + API Contract + API Server + DB + Tests + Deployable State
```

## 핵심 원칙

### 1. 기능은 사용자 가치 기준으로 정의한다

좋은 기능 단위:

```text
사용자가 여행을 생성하고 목록에서 확인할 수 있다.
```

나쁜 기능 단위:

```text
trips 테이블 생성
POST /trips API 구현
여행 생성 UI 구현
```

DB, API, UI는 별도 완료 단위가 아니라 하나의 기능 slice 안에 포함되는 구현 작업이다.

### 2. 기능 구현 전 spec + plan을 먼저 작성한다

구현을 시작하기 전 `docs/features/` 하위에 기능별 문서를 작성한다.

예시:

```text
docs/features/0001-walking-skeleton.md
docs/features/0002-trip-create-and-list.md
docs/features/0003-itinerary-item-create.md
```

기능 문서는 다음을 포함해야 한다.

- 목표
- 사용자 흐름
- 포함 범위
- 제외 범위
- API 계약
- DB 변경
- UI 변경
- 비즈니스 규칙
- acceptance criteria
- implementation plan
- verification plan
- release notes

템플릿은 `docs/features/_template.md`를 사용한다.

### 3. 모호한 요구사항은 Ouroboros로 구체화한다

기능이 다음 중 하나에 해당하면 구현 전 Ouroboros를 사용한다.

- 사용자 흐름이 불명확하다.
- 제품 결정이 필요하다.
- scope와 out of scope가 모호하다.
- acceptance criteria를 바로 쓰기 어렵다.
- 기능이 여러 도메인에 걸쳐 있다.
- 구현 후 되돌리기 어려운 기술/제품 결정이 포함된다.

권장 사용 기준:

| 상황 | 권장 방식 |
|------|----------|
| MVP 전체, 큰 제품 방향 | `ooo pm` |
| 기능 요구사항 구체화 | `ooo interview` → `ooo seed` |
| Seed 기반 GitHub Issue 생성 | `ooo publish` |
| 단순 버그/오타/작은 수정 | Ouroboros 생략 가능 |

Ouroboros 결과물은 가능한 경우 feature 문서에 링크하거나 원본 경로를 기록한다.

예시:

```md
## Ouroboros Source

- Session: `<session_id>`
- Seed: `~/.ouroboros/seeds/<seed_id>.yaml`
- PM: `~/.ouroboros/pm/<pm_id>.md`
```

### 4. GitHub Issue는 상태 추적에 사용한다

GitHub Issue는 긴 spec을 모두 담는 장소가 아니라, 작업 상태를 추적하고 feature 문서를 연결하는 장소로 사용한다.

Issue 본문 예시:

```md
# Feature Slice: 여행 생성/목록

## Spec

- docs/features/0002-trip-create-and-list.md

## Goal

사용자가 앱에서 여행을 생성하고 목록에서 확인할 수 있다.

## Acceptance Summary

- [ ] 여행 생성 UI가 있다.
- [ ] `POST /trips` API가 동작한다.
- [ ] `GET /trips` API가 동작한다.
- [ ] 생성한 여행이 앱 목록에 표시된다.
- [ ] staging 또는 internal build에서 검증했다.

## Checklist

- [ ] Spec written
- [ ] Spec approved
- [ ] OpenAPI updated
- [ ] DB migration added
- [ ] API implemented
- [ ] App UI implemented
- [ ] Tests added
- [ ] Staging verified
```

권장 label:

```text
feature-slice
needs-spec
spec-ready
ready
in-progress
blocked
api
mobile
db
contract
deployable
```

권장 project status:

```text
Backlog → Spec Draft → Spec Review → Ready → In Progress → Code Review → Staging → Done
```

### 5. OpenAPI-first로 구현한다

API가 필요한 기능은 OpenAPI 계약을 먼저 수정한다.

```text
1. packages/api-contract/openapi.yaml 수정
2. Go server interface 생성
3. TypeScript client 생성
4. Go API 구현
5. Expo 앱에서 generated client 사용
6. 테스트와 타입 체크로 계약 준수 확인
```

App과 API가 서로 다른 계약을 암묵적으로 공유하지 않도록 한다.

### 6. 매주 배포 가능한 output을 만든다

주간 output은 문서나 내부 코드 조각만으로 보지 않는다. 가능하면 사용자가 앱에서 확인할 수 있어야 한다.

예시:

| 주차 | 목표 | Output |
|------|------|--------|
| 1주차 | Walking skeleton | 앱에서 API `/health` 호출 확인 |
| 2주차 | 여행 생성/목록 | 앱에서 여행 생성 후 목록 확인 |
| 3주차 | 날짜별 일정 구조 | 앱에서 Day별 일정 구조 확인 |
| 4주차 | 장소 추가 | 앱에서 장소 추가 후 일정 표시 |
| 5주차 | 오늘 실행 화면 | 다음 장소 카드, 도착/스킵 동작 |
| 6주차 | Google Maps 연결 | 길찾기 버튼으로 외부 지도 앱 연결 |
| 7주차 | 동행자 초대 | 초대 링크 생성/참여자 목록 확인 |
| 8주차 | 빠른 지출 등록 | 현재 장소에서 지출 저장 |
| 9주차 | 지출 분할 | 전체 1/N, 일부 인원 분할 확인 |
| 10주차 | 정산 결과 | 최종 송금 결과 확인 |

## 표준 흐름

### Step 1. Feature candidate 선정

기능 후보를 정한다.

기능 후보는 다음 질문에 답할 수 있어야 한다.

- 사용자가 이 기능으로 무엇을 할 수 있는가?
- 앱에서 어떤 화면/행동으로 확인할 수 있는가?
- 한 주 안에 끝낼 수 있는가?
- App UI와 API Server를 함께 완료할 수 있는가?

범위가 크면 더 작은 slice로 나눈다.

### Step 2. GitHub Issue 생성

기능 단위 GitHub Issue를 생성한다.

Issue에는 최소한 다음을 포함한다.

- 기능 이름
- 목표
- feature spec 문서 경로 또는 예정 경로
- 간단한 acceptance summary
- checklist

이 단계에서는 spec이 완성되지 않았을 수 있으므로 `needs-spec` label을 붙인다.

### Step 3. Ouroboros로 요구사항 구체화

기능 요구사항이 모호하면 Ouroboros를 사용한다.

예시:

```text
ooo interview
```

이후 seed가 필요하면:

```text
ooo seed
```

제품 요구사항 문서 형태가 필요하면:

```text
ooo pm
```

GitHub Issue 생성을 보조하고 싶으면:

```text
ooo publish <seed_path>
```

단, `ooo publish` 결과는 프로젝트의 feature 문서와 GitHub Issue 운영 방식에 맞게 검토 후 사용한다.

### Step 4. Feature spec + plan 작성

`docs/features/_template.md`를 복사해 기능 문서를 작성한다.

파일명 규칙:

```text
NNNN-short-kebab-case-name.md
```

예시:

```text
0001-walking-skeleton.md
0002-trip-create-and-list.md
0003-trip-day-itinerary.md
```

문서 작성 시 원칙:

- goal은 사용자 관점으로 쓴다.
- scope와 out of scope를 명확히 분리한다.
- API, DB, UI 변경을 모두 적는다.
- acceptance criteria는 검증 가능하게 쓴다.
- implementation plan은 순서와 검증 방법을 포함한다.
- 불확실한 항목은 open questions에 남긴다.

### Step 5. Spec review / approve

구현 전 spec을 검토한다.

검토 기준:

- 사용자 가치가 명확한가?
- 한 주 안에 구현 가능한 크기인가?
- App UI + API + DB가 모두 포함되어 있는가?
- out of scope가 충분히 명확한가?
- acceptance criteria가 테스트 가능한가?
- 배포 가능 상태의 기준이 명확한가?
- 기존 product/architecture 문서와 충돌하지 않는가?

승인되면 GitHub Issue 상태를 `Ready`로 이동하고 `spec-ready` 또는 `ready` label을 붙인다.

### Step 6. 구현 브랜치와 worktree 준비

기능 구현은 Gitflow 기반으로 진행한다.

원칙:

- 기본 통합 브랜치는 `develop`이다.
- 기능 구현은 `feature/<feature-id>-<short-name>` 형식의 feature branch에서 진행한다.
- PR/MR 하나마다 별도의 `git worktree`를 만든다.
- 모든 feature worktree는 repository root 하위 `.worktrees/` 디렉터리에 만든다.
- worktree 경로는 `.worktrees/<feature-id>-<short-name>` 형식을 사용한다.
- repository 형제 디렉터리(`../i-um-F001-*`)에 worktree를 만들지 않는다.
- 해당 PR/MR의 구현, 테스트, 문서 수정은 해당 worktree 안에서만 수행한다.
- 하나의 worktree에서 여러 feature issue를 섞어 구현하지 않는다.

예시:

```bash
git fetch origin
mkdir -p .worktrees
git worktree add .worktrees/F001-monorepo-walking-skeleton \
  -b feature/F-001-monorepo-walking-skeleton origin/develop
```

`origin/develop`이 아직 없으면 구현을 시작하기 전에 `develop` 생성 또는 기준 브랜치를 확인한다.

### Step 7. pi coding agent로 구현

복잡하거나 장기 실행 feature라고 판단되면 바로 구현하지 않고 사용자에게 Ouroboros 기반 구현 실행으로 진행해도 되는지 확인한다. 사용자가 승인하면 feature spec과 Seed/실행 입력이 서로 어긋나지 않는지 확인한 뒤 Ouroboros 실행 흐름으로 진행한다. 사용자가 승인하지 않거나 단순 feature라면 pi coding agent가 feature spec 문서를 기준으로 직접 구현한다. 사용자의 명시 승인 없이 Ouroboros 구현 실행으로 전환하지 않는다.

pi coding agent에게는 다음 정보를 제공한다.

- GitHub Issue 번호
- feature spec 문서 경로
- 관련 product/architecture 문서 경로
- 완료 기준

요청 예시:

```text
GitHub Issue #12를 구현해줘.
반드시 AGENTS.md, docs/delivery/definition_of_done.md,
docs/features/0002-trip-create-and-list.md를 먼저 읽고 진행해.
기능은 App UI + API Server + DB + OpenAPI + tests를 포함한 vertical slice로 완성해.
Spec에 없는 기능은 구현하지 마.
완료 보고에는 실행한 검증 명령과 결과를 포함해.
```

구현 중 원칙:

- API 변경은 OpenAPI부터 수정한다.
- 생성 코드는 필요한 경우 명령어로 재생성한다.
- DB 변경은 migration으로 관리한다.
- App UI는 mock에 머물지 않고 실제 API client를 연결한다.
- 구현 중 spec과 충돌하는 요구가 나오면 임의로 결정하지 않고 spec을 업데이트한다.

### Step 8. Verification 수행

기능 완료 전 `definition_of_done.md`를 기준으로 검증한다.

기본 검증 항목:

- OpenAPI lint 또는 계약 확인
- Go test
- Go build
- TypeScript typecheck
- mobile lint/typecheck
- DB migration 적용 확인
- 앱에서 happy path 확인
- staging 또는 internal build 확인

프로젝트 초기에는 모든 자동화가 없을 수 있다. 자동화가 없으면 feature 문서의 `Verification` 섹션에 실제로 수행한 수동 검증을 기록한다.

### Step 9. 배포 가능 상태 확인

기능이 main branch에 merge될 수 있고, staging 또는 internal build에서 확인 가능해야 한다.

배포 가능 상태란 다음을 의미한다.

- 미완성 화면이 사용자에게 노출되지 않는다.
- migration이 누락되지 않았다.
- API와 앱의 계약이 맞다.
- 환경변수나 설정 누락이 없다.
- 기존 핵심 흐름이 깨지지 않는다.
- 필요 시 feature flag 또는 숨김 진입점으로 보호되어 있다.

### Step 10. PR/MR 생성과 Issue close

완료 보고에는 다음을 포함한다.

- 구현 요약
- 변경된 주요 파일
- 검증 명령과 결과
- staging/internal build 확인 결과
- 남은 제한사항 또는 후속 issue

Issue를 닫기 전에 feature 문서의 release notes를 업데이트한다.

PR/MR 규칙:

- 하나의 PR/MR은 하나의 feature issue를 닫는 것을 기본으로 한다.
- PR/MR description 마지막에는 GitHub issue 자동 close 문구를 넣는다.
- 표준 문구는 다음 형식을 사용한다.

```md
Fixes #<issue-number>
```

예시:

```md
Fixes #1
```

여러 issue를 닫아야 하는 예외 상황에서는 각 issue를 별도 줄로 명시한다.

## 기능 크기 조절 기준

한 기능이 다음 조건 중 하나에 해당하면 더 작게 나눈다.

- 한 주 안에 구현/검증/배포하기 어렵다.
- API endpoint가 너무 많다.
- 화면이 3개 이상 새로 생긴다.
- DB 모델이 여러 도메인을 크게 바꾼다.
- acceptance criteria가 10개를 넘는다.
- 모호한 open question이 많다.

분할 예시:

```text
동행자 초대 전체
→ 참여자 목록 조회
→ 초대 링크 생성
→ 초대 링크 수락
→ 참여자 제거
```

```text
정산 전체
→ 지출 저장
→ 지출 목록 조회
→ 기본 1/N split 생성
→ 정산 결과 계산
→ 정산 화면 표시
```

## 예외 처리

### 단순 수정

오타, 문서 정리, 작은 버그 수정은 전체 Ouroboros/spec 흐름을 생략할 수 있다.

단, 다음 중 하나라도 해당하면 feature workflow를 따른다.

- 사용자 visible behavior가 바뀐다.
- API 계약이 바뀐다.
- DB migration이 필요하다.
- 새 화면이나 주요 UI 상태가 추가된다.
- 배포 리스크가 있다.

### 긴급 버그

긴급 버그는 spec 문서 없이 수정할 수 있다.

다만 완료 후 issue 또는 문서에 다음을 기록한다.

- 원인
- 수정 내용
- 재발 방지 검증
- 후속 feature/spec 필요 여부

## 관련 문서

- `docs/delivery/definition_of_done.md`
- `docs/features/_template.md`
- `docs/product/mvp_scope.md`
- `docs/architecture/technical_architecture.md`
