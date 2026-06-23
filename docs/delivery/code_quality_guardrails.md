# Code Quality Guardrails

이 문서는 기능 개발 중 코드 중복과 파일 비대화를 방지하기 위한 최소 가드레일이다. 목적은 추상화를 미리 많이 만드는 것이 아니라, 반복이 실제로 나타난 시점에 작고 검증 가능한 단위로 정리하는 것이다.

UI primitive 정책의 정본은 다음 문서다.

- `docs/design/README.md`: 버튼/카드/리스트 행/배지/칩 등 UI 패턴은 두 번째로 필요해지는 순간 공용 primitive로 승격한다.
- `docs/design/mobile-ui-reference.md`: 공통 구조와 primitive 후보를 따른다.
- `AGENTS.md`: 같은 button/list/card 스타일을 screen에 복붙하지 말고 shared primitive를 추출/재사용한다.

이 문서는 위 원칙을 feature delivery와 PR review에서 체크하기 쉽게 풀어쓴 운영 문서다.

## 원칙

1. **두 번째 반복에서 확인하고, 세 번째 반복 전에 추출한다.**
   - 동일한 UI/state/error/date 로직이 2곳에 생기면 기존 primitive/helper 재사용 가능성을 확인한다.
   - 3곳째 복사하기 전에는 작은 shared helper 또는 component로 추출한다.
2. **화면 파일은 orchestration에 집중한다.**
   - route param 읽기, API 호출, navigation, 화면 조립은 screen에 둔다.
   - validation, formatting, sorting/grouping, API response → view state 변환은 `apps/mobile/lib/**` helper로 둔다.
3. **공통화는 현재 반복을 제거하는 만큼만 한다.**
   - 미래 요구를 예측한 option-heavy abstraction은 만들지 않는다.
   - 호출자가 1곳뿐인 추출은 명확한 테스트/가독성 이득이 있을 때만 한다.
4. **리팩터링은 behavior-preserving이어야 한다.**
   - API contract, copy, navigation path, validation rule 변경은 별도 feature/fix로 분리한다.
   - behavior 변경이 필요하면 feature spec/test plan에 기록한다.

## Mobile Guardrails

### UI primitive 재사용

다음 패턴은 screen에 새로 복사하지 말고 기존 primitive/helper를 먼저 확인한다.

- Screen scaffold: `ScrollView`/header/card 조합
- Card, primary/secondary/danger button, field label/input wrapper
- Loading/error/empty state card
- Trip date input/calendar picker
- Legal/settings row, trip row/list item

현재 공용 primitive/helper는 다음을 사용한다.

- Common card/buttons: `apps/mobile/lib/design/components.tsx`
- Trip date helper: `apps/mobile/lib/trips/date.ts`
- Trip date picker: `apps/mobile/lib/trips/date-picker.tsx`

새 날짜 계산은 screen 내부에 직접 만들지 말고 `date.ts`에 추가하고 `apps/mobile/lib/trips/*.test.mts`로 검증한다.

### Screen size signal

라인 수 자체가 품질 기준은 아니지만, 다음을 넘으면 분리 가능성을 반드시 검토한다.

- Screen file이 **450 lines**를 넘는다.
- 하나의 render branch가 loading/error/empty/success/mutation modal을 모두 직접 가진다.
- 같은 style block 또는 JSX 구조가 다른 screen과 2곳 이상 반복된다.

분리 우선순위:

1. Pure helper/state builder + unit test
2. Shared UI primitive
3. Feature-specific child component
4. Screen-level composition 유지

### Error/state mapping

API/Auth 에러 조건문은 screen마다 새로 나열하지 않는다. 같은 조건이 반복되면 helper로 올린다.

예:

- auth expired / unauthorized 판별
- 403/404를 not-found-like state로 매핑
- retryable error copy 결정

## API Guardrails

### Handler/service/repository 역할

- Handler: HTTP request/response 변환, auth context 추출, error mapping
- Service: 비즈니스 규칙, validation, authorization orchestration
- Repository: sqlc query/transaction, DB row mapping

### File size signal

다음 신호가 보이면 파일 분리를 검토한다.

- `server.go`가 domain별 handler, mapper, error mapping, config를 모두 포함한다.
- service 파일에서 동일한 `auth → id/date validation → load resource → authorization` 흐름이 3곳 이상 반복된다.
- repository interface가 새 feature를 추가할 때마다 모든 fake에 불필요한 method를 요구한다.

권장 분리 단위:

- `handlers_<domain>.go`
- `errors.go`
- `mappers.go`
- `config.go`
- domain별 repository interface

## Review Checklist

PR 전 다음을 확인한다.

- [ ] 새 screen-local helper가 기존 `apps/mobile/lib/**` helper와 중복되지 않는다.
- [ ] 같은 JSX/style 패턴을 세 번째로 복사하지 않았다.
- [ ] 변경한 mobile logic/state에는 단위 테스트가 있거나 기존 테스트가 명확히 커버한다.
- [ ] API handler/service/repository 역할이 섞이지 않았다.
- [ ] 파일이 커졌다면 분리하지 않은 이유가 PR 설명에 남아 있다.
