# Feature Slice: Mobile UI 디자인 프리미티브 추가

## Metadata

- GitHub Issue: #158
- Status: In Progress
- Created: 2026-06-28
- Updated: 2026-06-28

## Source

- Issue: #158 — [Mobile UI Refactor 1/6] 디자인 프리미티브 추가
- Ouroboros/PM/Seed: `interview_20260628_060941` / `seed_428d9f30bd19` (ambiguity 0.05)
- Local handoff package: `refactor/README.md`, `refactor/MAPPING.md`, `refactor/PROMPT.md`, `refactor/apps/mobile/lib/design/primitives.tsx`
- Current mobile design source: `apps/mobile/lib/design/theme.ts`, `apps/mobile/lib/design/index.ts`, `apps/mobile/lib/design/components.tsx`
- Notes: `refactor/` handoff의 1단계만 적용한다. 프리미티브 레이어를 순수 추가하고 기존 화면/네비게이션/데이터 로직은 변경하지 않는다.

## Goal

오늘·지도·일정·정산 리팩토링에서 반복 UI를 회수할 수 있도록 `apps/mobile/lib/design`에 토큰 기반 공통 프리미티브 10개를 추가한다. 이번 단계는 후속 UI 리팩토링의 기반만 만드는 작업이며, 기존 화면에 연결하지 않아 사용자-visible 동작 변화가 없어야 한다.

## User Flow

1. 사용자는 기존 앱 화면을 평소처럼 사용한다.
2. 앱은 기존 화면과 동일하게 렌더링되고 기존 데이터 로딩/세션/에러 처리를 유지한다.
3. 개발자는 후속 #159~#163 작업에서 `lib/design`에서 새 프리미티브를 import해 화면 리팩토링을 진행할 수 있다.

## Scope

- App UI: yes — add `apps/mobile/lib/design/primitives.tsx`, update `apps/mobile/lib/design/index.ts`
- API Contract: no — `No API changes.`
- API Server: no
- DB: no
- Tests: mobile test/typecheck/lint gates; component visual snapshot infra는 도입하지 않음
- Deploy/Smoke: not needed; 기존 화면 미연결 additive change

## Out of Scope

- 기존 화면 파일 수정 또는 새 프리미티브 연결
- `lib/trip-ui/*`, `TripTabBar`, 트립 Tabs IA 도입 (#159~#162)
- 홈 redirect/슬림화 (#163)
- 새 디자인 토큰 추가 또는 theme 구조 변경
- OpenAPI/API/DB/generated code 변경
- RN component snapshot/renderer test infra 도입
- `lucide-react-native`, `react-native-svg` 등 아이콘 의존성 추가 (#159 이후 필요 시 검토)

## Requirements

### UI / UX

- Screens: none. 이번 PR에서 `app/**` 화면 파일을 수정하지 않는다.
- States: 기존 화면에 연결하지 않으므로 loading/empty/error/success 상태 변화가 없어야 한다.
- Copy: 새 컴포넌트 내부 label은 prop으로 받는다. 사용자-facing 기본 money format은 i-um 규칙에 맞춰 `18,500원`, `3,200엔`처럼 comma + 한국식 suffix를 기본으로 한다.
- Accessibility: `Pressable` 기반 컴포넌트는 기본 `accessibilityRole`과 선택 상태(`accessibilityState.selected`)를 제공한다.

### Primitive Contracts

원칙: `refactor/apps/mobile/lib/design/primitives.tsx`를 baseline으로 삼되, 아래 표가 #158의 self-contained public contract다. StyleSheet 수치와 JSX 구현은 spec에 고정하지 않고 `theme.*` 토큰 사용과 semantics만 고정한다.

#### Badge

| 항목 | 계약 |
|---|---|
| Role | 상태 배지. 예: 다음, 확인 필요, 정산 완료, 에러 상태 |
| Export | `Badge` |
| Props | `label: string`, `tone?: 'primary' | 'amber' | 'neutral' | 'success' | 'danger'`, `solid?: boolean` |
| Defaults | `tone = 'neutral'`, `solid = false` |
| Semantics | `solid`가 아니면 tone별 soft background + foreground를 사용한다. `solid`면 foreground 색을 background로 쓰고 text는 `theme.color.onPrimary`를 사용한다. |
| Tokens | `theme.color.primarySoft`, `accentSoft`, `surfaceSunken`, `green`, `red`, `onPrimary`, `theme.radius.pill`, `theme.font.*`, `theme.space.*` |

#### Pill

| 항목 | 계약 |
|---|---|
| Role | Day 진행 상태 등 dot이 있는 알약 라벨 |
| Export | `Pill` |
| Props | `label: string`, `tone?: BadgeTone` |
| Defaults | `tone = 'neutral'` |
| Semantics | Badge tone palette를 공유한다. label 앞에 tone foreground 색 dot을 표시한다. |
| Tokens | Badge tone tokens, `theme.radius.pill`, `theme.font.*`, `theme.space.*` |

#### Chip

| 항목 | 계약 |
|---|---|
| Role | 필터, 멤버 선택, 옵션 선택 chip |
| Export | `Chip` |
| Props | `label: string`, `selected?: boolean`, `leading?: ReactNode`, `onPress?: PressableProps['onPress']` |
| Defaults | `selected = false` |
| Semantics | 항상 button role을 갖는 pressable chip이다. `selected`면 primary border/soft background/text를 사용하고 `accessibilityState.selected`를 반영한다. `leading`은 label 앞에 렌더링한다. |
| Tokens | `theme.color.borderDefault`, `primary`, `primarySoft`, `surface`, `textBody`, `theme.radius.pill`, `theme.layout.controlHSm`, `theme.font.*`, `theme.space.*` |

#### AmountText

| 항목 | 계약 |
|---|---|
| Role | 지출/정산 금액 표시 |
| Export | `AmountText` |
| Props | `value: number`, `currency?: 'KRW' | 'JPY' | string`, `tone?: 'credit' | 'debit' | 'neutral'`, `size?: 'sm' | 'md' | 'lg' | 'xl'`, `style?: StyleProp<TextStyle>` |
| Defaults | `currency = 'KRW'`, `tone = 'neutral'`, `size = 'md'` |
| Semantics | `Math.round(value)`의 절댓값을 `ko-KR` comma로 표시한다. `credit`은 `+`와 `theme.color.credit`, `debit`은 `−`와 `theme.color.debit`, `neutral`은 sign 없이 `theme.color.textStrong`을 쓴다. 기본 통화 표기는 i-um mobile rule에 맞춰 `KRW -> 원`, `JPY -> 엔` suffix를 사용한다. 알 수 없는 currency는 suffix 없이 숫자만 표시하거나 후속 구현에서 안전한 fallback을 둔다. `fontVariant: ['tabular-nums']`를 유지한다. |
| Tokens | `theme.color.credit`, `debit`, `textStrong`, `theme.font.family.bold`, `theme.font.size.*` |
| Exception | refactor scaffold의 symbol prefix(`₩`, `¥`)보다 i-um mobile rule의 한국식 suffix를 우선한다. |

#### PlacePin

| 항목 | 계약 |
|---|---|
| Role | 장소 순서/타입을 나타내는 원형 핀 |
| Export | `PlacePin` |
| Props | `type: keyof typeof theme.placeType`, `order?: number | string`, `size?: number`, `faded?: boolean` |
| Defaults | `size = 32`, `faded = false` |
| Semantics | background는 반드시 `theme.placeType[type].color`에서 가져온다. `order`가 있으면 중앙에 표시한다. `faded`면 opacity를 낮춘다. |
| Tokens | `theme.placeType`, `theme.color.onPrimary`, `theme.font.*` |

#### PlaceTag

| 항목 | 계약 |
|---|---|
| Role | 장소 타입 dot + label chip |
| Export | `PlaceTag` |
| Props | `type: keyof typeof theme.placeType` |
| Defaults | none |
| Semantics | label과 foreground color는 반드시 `theme.placeType[type]`에서 가져온다. 배경은 해당 place color의 soft/tint 표현으로 구현하되 새 token을 만들지 않는다. |
| Tokens | `theme.placeType`, `theme.radius.pill`, `theme.font.*`, `theme.space.*` |

#### Avatar

| 항목 | 계약 |
|---|---|
| Role | 참여자 이니셜 아바타 |
| Export | `Avatar` |
| Props | `name: string`, `color?: string`, `size?: number`, `ring?: string` |
| Defaults | `color = theme.color.primary`, `size = 30`, `ring = theme.color.bg` |
| Semantics | `name.slice(0, 1)`을 중앙에 표시한다. 외곽 ring은 배경과 겹침을 고려해 border color로 사용한다. |
| Tokens | `theme.color.primary`, `bg`, `onPrimary`, `theme.font.*` |

#### AvatarGroup

| 항목 | 계약 |
|---|---|
| Role | 여러 참여자 아바타를 겹쳐 보여주는 그룹 |
| Export | `AvatarGroup` |
| Props | `members: { name: string; color?: string }[]`, `size?: number`, `max?: number`, `overlap?: number` |
| Defaults | `size = 30`, `max`는 구현 기본값을 둘 수 있음, `overlap`은 size 기반 기본 겹침 사용 |
| Semantics | 앞에서부터 렌더링하며 두 번째 이후 아바타는 왼쪽으로 겹친다. `max`가 구현되면 초과 인원은 `+N` 형태 fallback을 제공한다. `max`를 구현하지 않는 경우에도 refactor scaffold의 전체 members 렌더링 동작과 호환되어야 한다. |
| Tokens | `Avatar` tokens, `theme.color.bg`, `theme.color.primary` |

#### ListRow

| 항목 | 계약 |
|---|---|
| Role | 남은 장소, 사람별 잔액, 지출 내역 등에 쓰는 공통 row |
| Export | `ListRow` |
| Props | `leading?: ReactNode`, `title: ReactNode`, `subtitle?: ReactNode`, `trailing?: ReactNode`, `onPress?: PressableProps['onPress']`, `first?: boolean` |
| Defaults | `first = false` |
| Semantics | `onPress`가 있으면 `Pressable` + button role, 없으면 non-pressable `View`로 렌더링한다. `title`/`subtitle`이 string이면 기본 typography를 적용하고 ReactNode면 그대로 렌더링한다. `first`가 아니면 top divider를 표시한다. |
| Tokens | `theme.color.surface`, `borderSubtle`, `textStrong`, `textMuted`, `theme.layout.tapMin`, `theme.font.*`, `theme.space.*` |

#### SegmentedControl

| 항목 | 계약 |
|---|---|
| Role | 이동수단/분할 방식 등 상호 배타 옵션 토글 |
| Export | `SegmentedControl` |
| Props | `options: string[]`, `value: string`, `onChange: (value: string) => void`, `dark?: boolean` |
| Defaults | `dark = false` |
| Semantics | 각 option은 tab role을 갖고 `value`와 일치하면 selected state를 표시한다. active option press는 동일 value라도 안전하게 `onChange(opt)`를 호출할 수 있다. `dark`는 어두운 카드 위에서 쓰는 contrast variant다. |
| Tokens | `theme.color.surfaceSunken`, `surface`, `primary`, `textMuted`, `green`, `theme.radius.pill`, `theme.shadow.xs`, `theme.font.*`, `theme.space.*` |

### Allowed Adjustment Policy

#158은 Ouroboros clarification에서 **기준 3: 컴포넌트별 예외 명시 기준**으로 고정했다.

- 기본 원칙: refactor scaffold의 prop/variant/default semantics를 보수적으로 유지한다.
- 허용 조정:
  - TypeScript/RN 타입 안전성 확보
  - 접근성 prop/state 수용
  - 현재 `theme` token shape에 맞춘 연결
  - unused import 제거, formatting/lint/typecheck compliance
  - i-um mobile rule과 충돌하는 default의 컴포넌트별 예외 적용 (`AmountText` 한국식 suffix)
- Breaking change로 간주:
  - 10개 export 누락 또는 이름 변경
  - 후속 #159~#163 expected usage가 쓰는 prop 제거/rename
  - tone/size/state variant 축소
  - 위 component contract의 기본 시각/행동 semantics와 다른 변경
  - `PlaceTag`/`PlacePin`이 `theme.placeType` 외 source로 장소 타입 색/label을 결정하는 변경
  - `AmountText` credit `+`, debit `−`, neutral no-sign 규칙 변경
  - `Pressable` 기반 컴포넌트의 기본 접근성 semantics 누락
  - 기존 화면 import/render/동작을 바꾸는 변경

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

### Business Rules

- `apps/mobile/lib/design/theme.ts`가 색/간격/radius/typography/shadow/placeType의 단일 출처다.
- 새 디자인 토큰을 추가하지 않는다.
- 화면 코드에 raw hex를 추가하지 않는다. 프리미티브 구현도 가능하면 `theme.*` 또는 token에서 파생한 값만 사용한다.
- `primitives.tsx`는 앱 도메인 타입, API client, navigation, screen state에 의존하지 않는다. 기본 의존은 `react`, `react-native`, `./theme`로 제한한다.
- 이번 PR은 기존 화면을 새 컴포넌트로 교체하지 않는다.

## Acceptance Criteria

- [ ] `apps/mobile/lib/design/primitives.tsx`가 추가되고 10개 export가 존재한다: `Badge`, `Pill`, `Chip`, `AmountText`, `PlacePin`, `PlaceTag`, `Avatar`, `AvatarGroup`, `ListRow`, `SegmentedControl`.
- [ ] `apps/mobile/lib/design/index.ts`에서 10개 프리미티브를 re-export한다.
- [ ] 기존 `Card`, `PrimaryButton`, `SecondaryButton`, `useDesignFonts`, theme token exports는 유지된다.
- [ ] 기존 화면 파일(`apps/mobile/app/**`)은 변경하지 않는다.
- [ ] `primitives.tsx`는 `./theme` 기반 token을 사용하고 새 token을 만들지 않는다.
- [ ] `AmountText`는 comma formatting, 한국식 suffix 기본값, credit/debit/neutral sign/color semantics, tabular numerals를 만족한다.
- [ ] `PlacePin`/`PlaceTag`는 `theme.placeType`을 단일 출처로 사용한다.
- [ ] `Chip`, `ListRow`, `SegmentedControl`의 pressable/selected accessibility semantics가 반영된다.
- [ ] refactor scaffold와 후속 #159~#163에서 기대하는 props surface를 축소하지 않는다.
- [ ] `pnpm --filter @i-um/mobile test`가 통과한다.
- [ ] `pnpm --filter @i-um/mobile typecheck`가 통과한다.
- [ ] 가능하면 `pnpm --filter @i-um/mobile lint`도 통과한다.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| 기존 mobile domain tests 회귀 없음 | Mobile tests | existing `apps/mobile/lib/**/*.test.mts` suite | `pnpm --filter @i-um/mobile test` |
| 새 `primitives.tsx`와 `index.ts` export가 TS/RN 타입에 맞음 | Mobile typecheck | TypeScript compile via `apps/mobile/lib/design/index.ts` export | `pnpm --filter @i-um/mobile typecheck` |
| formatting/lint convention 위반 없음 | Mobile lint | ESLint | `pnpm --filter @i-um/mobile lint` |
| 기존 화면 렌더링 변경 없음 | Code review | `git diff -- apps/mobile/app` should be empty | manual review |
| refactor baseline semantics 보존 | Code review | component contract table vs implementation | manual review |

## Regression Gaps

- RN visual parity for Badge/Chip/AmountText/PlaceTag/Avatar/ListRow/SegmentedControl: 현재 repo에 RN component renderer/snapshot test infra가 없고 이번 단계는 기존 화면에 연결하지 않는다.
  - Risk: 후속 화면 리팩토링에서 spacing/contrast 차이를 늦게 발견할 수 있다.
  - Follow-up: #160~#161에서 실제 화면 적용 시 시뮬레이터 smoke와 코드리뷰로 보완한다.
- `AmountText` rendered glyph/suffix visual 확인: pure typecheck로는 실제 Text 렌더링을 검증하지 못한다.
  - Risk: suffix/부호 조합이 디자인 의도와 다르게 보일 수 있다.
  - Follow-up: #160 today 화면 적용 시 실제 지출 금액 표시 smoke에 포함한다.

## TDD Implementation Plan

1. Red: `apps/mobile/lib/design/index.ts`에 신규 primitive re-export를 먼저 추가하거나 compile-only import path를 만든 뒤 typecheck를 실행해 `./primitives` 미존재 실패를 확인한다.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
2. Green: `refactor/apps/mobile/lib/design/primitives.tsx`를 implementation input으로 사용해 `apps/mobile/lib/design/primitives.tsx`를 추가한다.
   - 현재 `theme.ts` token shape에 맞춘다.
   - `AmountText`는 spec의 한국식 suffix 예외를 적용한다.
   - unused import와 타입 에러를 제거한다.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
3. Refactor: 접근성 semantics, token 사용, component contract table과 public props surface를 점검한다.
   - Verify: `pnpm --filter @i-um/mobile lint`
4. Regression: 기존 mobile domain tests가 여전히 통과하는지 확인한다.
   - Verify: `pnpm --filter @i-um/mobile test`
5. Gate: 기존 화면 diff가 없는지 확인하고 최종 타입/테스트를 다시 실행한다.
   - Verify: `git diff --name-only -- apps/mobile/app`
   - Verify: `pnpm --filter @i-um/mobile typecheck`
   - Verify: `pnpm --filter @i-um/mobile test`

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (238 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass

### Manual Smoke

- Existing app screens: pass by diff review — `git diff --name-only -- apps/mobile/app` returned no changed files
- Visual primitive parity: not run — primitives are not connected to screens in #158; code review/manual review remains the planned check

## Release Notes

- Team-facing: mobile UI 리팩토링의 1단계로 토큰 기반 디자인 프리미티브 레이어를 추가한다. 기존 화면에는 연결하지 않으므로 사용자-visible 변화는 없다.

## Open Questions

- None

## Follow-up Issues

- #159 — 트립 UI 셸 컴포넌트와 탭바 추가
- #160 — 오늘 실행 화면 컴포넌트 조립형 리팩토링
- #161 — 지도·일정·정산 화면 UI 순차 이관
- #162 — 트립 레벨 Tabs IA 도입
- #163 — 홈 슬림화와 진행 중 여행 딥링크 적용
