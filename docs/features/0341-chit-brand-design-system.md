# Feature Slice: Chit 브랜드/디자인 시스템

## Metadata

- GitHub Issue: not yet assigned
- Status: Approved for design source of truth
- Created: 2026-07-19
- Updated: 2026-07-19
- Source: user-approved brand brainstorming session
- Scope type: Brand/design documentation first; implementation follows in separate slices

## Goal

기존 `이음(i-um)`의 따뜻한 여행 실행 앱 인상을 `칫 Chit`의 짧고 시크한 핀테크 감성으로 전환한다.

`Chit`은 영수증·전표를 뜻하므로 여행 지출/정산 앱의 맥락과 직접 연결된다. 한국어 브랜드 `칫`은 “칫, 정산 별거없네”처럼 귀찮은 정산을 가볍게 끝내는 태도를 만든다.

## Brand Decision

- 공식 브랜드명: `칫 Chit`.
- 앱 내 짧은 표기: `칫`.
- 앱스토어, 온보딩, 마케팅, 법적/설명 문맥: `칫 Chit`.
- 헤더, 앱 아이콘, 작은 배지, 카피 문장: `칫`.
- 영어 의미 설명이 필요한 초기 브랜딩 문맥에서는 `Chit`을 함께 노출한다.

### Brand attitude

```text
칫, 정산 별거없네.
```

- 짧고 펀치감 있다.
- 귀찮은 지출/정산을 도장 찍듯 끝낸다.
- Toss처럼 빠르고 명확하지만, Chit만의 전표/영수증 위트를 가진다.
- 장난스럽기보다 시크하고 감각적이어야 한다.

## Positioning

Chit은 여행 지출과 정산을 위한 `hip fintech settlement app`이다.

- Primary category: 공동 여행 지출/정산.
- Emotional value: 정산 스트레스 제거.
- Functional value: 빠른 지출 기록, 영수증 초안, 최신 정산 계산, 송금 제안.
- Target feel: 젊고 감각적, 짧고 명확, 금융앱처럼 신뢰 가능.

## Visual Direction

### System structure

Chit 디자인은 3단 구조를 사용한다.

1. `Paper Fintech` — 기본 앱 UI.
2. `Dark Acid` — 앱 아이콘, 스플래시, 키비주얼, 정산 완료 히어로.
3. `Stamp Pop` — 온보딩, 빈 상태, 완료 상태, 캠페인 장식.

기본 화면은 오래 사용해도 피로하지 않아야 하므로 `Paper Fintech`를 기본으로 한다. 브랜드 임팩트가 필요한 순간에만 `Dark Acid`와 `Stamp Pop`을 제한적으로 쓴다.

### Color tokens

| Role | Name | Hex | Usage |
|---|---|---:|---|
| Core dark | Charcoal | `#111315` | 다크 히어로, 로고 박스, 주요 텍스트, 강한 CTA 대체 배경 |
| Dark surface | Matte Charcoal | `#191B1F` | 다크 모드 배경, 스플래시 배경 |
| Dark elevated | Charcoal Elevated | `#24272C` | 다크 카드, 다크 리스트 row |
| Primary accent | Acid Lime | `#C8FF00` | 주요 CTA, 핵심 금액, 선택 상태, 완료 상태 |
| Background | Paper | `#F5F1E8` | 기본 앱 배경, 종이/전표 감성 |
| Surface | White | `#FFFFFF` | 카드, 리스트, 입력 필드 |
| Border | Paper Border | `#DDD5C8` | 라이트 카드/row 경계 |
| Info | Fintech Blue | `#2F6BFF` | 링크, 최신 계산 안내, 보조 정보 |
| Danger | Punch Red | `#FF4D5E` | 오류, 삭제, 위험 액션 |
| Warning/Review | Stamp Coral | `#FF4F2E` | 검토 필요, 영수증 초안, 장식적 강조 |

### Color rules

- Acid Lime은 브랜드의 기억점이지만 과다 사용하지 않는다.
- Acid Lime 허용 위치:
  - primary CTA 배경.
  - 큰 금액 숫자.
  - 선택된 탭/칩 상태.
  - 정산 완료/성공 상태.
  - 다크 히어로의 핵심 강조.
- Acid Lime 금지 위치:
  - 긴 본문.
  - 작은 보조 텍스트.
  - 오류/위험 의미.
  - 색상만으로 상태를 전달하는 경우.
- Charcoal은 순수 블랙 대신 사용한다.
- 기본 사용 화면은 Paper 배경 + White surface + Charcoal text를 우선한다.
- Fintech Blue는 신뢰/정보 보조색으로 제한한다. 브랜드 primary로 쓰지 않는다.

## Logo Direction

### Approved direction

- 공식 로고/워드마크: `B1 Stamp Lockup`.
- 앱 아이콘/스플래시: `B4 Dark Stamp Icon`.

### Logo principles

- `칫` 글자 자체가 주인공이다.
- 별도의 복잡한 영수증 그림 아이콘을 만들지 않는다.
- 전표/영수증 의미는 점선, 도장, 스탬프, 살짝 기울어진 lockup 같은 작은 장치로만 표현한다.
- 앱 아이콘은 작은 크기에서도 `칫`이 먼저 읽혀야 한다.
- 로고는 “도장 찍듯 툭” 끝내는 인상을 준다.

### Lockup usage

| Context | Preferred mark |
|---|---|
| App icon | Dark Stamp Icon: Charcoal background + Acid Lime accent + `칫` |
| Splash | Dark Stamp Icon with `CHIT` sublabel |
| App header | Simple `칫` text mark |
| Onboarding hero | Stamp Lockup |
| Marketing image | Stamp Lockup + short tagline |
| Legal/plain text | `칫 Chit` |

## Typography

### Decision

Use `Pretendard Punch`.

- Keep Pretendard as the app UI font family.
- Use heavier weights and tighter hierarchy for punch.
- Do not introduce a loud display font across core app screens.
- Money and numeric summaries must use tabular numerals where supported.

### Type rules

- Display/hero: Pretendard Bold, tight line height, strong negative-feeling spacing only if platform-safe.
- Section titles: Pretendard Bold or SemiBold.
- Body: Pretendard Regular or SemiBold depending on information density.
- Labels/badges: short, bold, optionally uppercase English only in visual/brand surfaces.
- Amounts: bold, tabular, high contrast.

## Component Language

### Cards

- Default cards use White surface on Paper background.
- Critical settlement summary cards may use Charcoal background with Acid Lime amount.
- Rounded cards stay modern and soft, but not bubbly.
- Borders are preferred over heavy shadows for everyday surfaces.
- Stamp-style hard shadow is reserved for onboarding/empty/completion states, not dense lists.

### Buttons

- Primary CTA: Acid Lime background + Charcoal text.
- Secondary CTA: White/Paper background + Charcoal border/text.
- Destructive CTA: Danger token, never Acid Lime.
- Pressed states should be fast and tactile, without layout shift.

### Lists and rows

- Expense/settlement rows must remain highly scannable.
- Use color plus text/icon; do not rely on color alone.
- Amounts align consistently and use tabular numerals.
- Metadata stays short: payer, split count/status, date/context when needed.

### Navigation

- Bottom tab remains text + vector icon.
- Current tab may use Charcoal active capsule or Acid Lime active accent depending on surface.
- Do not exceed five top-level trip tabs.

## Copy Voice

### Tone

- Korean first.
- Short, confident, slightly 시크.
- Avoid over-explaining.
- Prefer “끝”, “딱”, “별거없네” style punch when appropriate.
- Keep error/recovery copy clear and kind; do not be sarcastic in failure states.

### Example copy

```text
칫, 정산 별거없네.
칫, 정산 끝.
보낼 사람만 딱 확인해요.
영수증 초안 적용됨.
금액만 확인하면 끝.
최신 지출 기준으로 다시 계산했어요.
```

### Error copy rule

Brand attitude does not override usability. Error states must still explain what happened and how to recover.

Good:

```text
정산을 불러올 수 없어요.
잠시 후 다시 시도해주세요.
```

Avoid:

```text
칫, 오류났네.
```

## Accessibility and Usability

- Normal text contrast must meet WCAG AA where applicable.
- Acid Lime on Paper/White can be low legibility for text; use it mostly as fill behind Charcoal text or as large accent.
- Minimum touch target: 44pt.
- Do not communicate settlement status by color alone.
- Support Dynamic Type as much as current app patterns allow.
- Respect reduced motion. Motion should reinforce action completion, not decorate randomly.

## Implementation Source Mapping

| Area | Source / target |
|---|---|
| Brand/design spec | `docs/features/0341-chit-brand-design-system.md` |
| Mobile design tokens | `apps/mobile/lib/design/theme.ts` |
| Shared mobile components | `apps/mobile/lib/design/components.tsx`, `apps/mobile/lib/design/primitives.tsx` |
| Mobile UI rule | `.harness/rules/code/mobile-ui.md` |
| Brand assets | `apps/mobile/assets/brand/` |
| Expo app metadata | `apps/mobile/app.json`, `apps/mobile/app.config.ts` |

## Migration Scope for Follow-up Implementation

### In

- Rename user-facing app brand from `이음(i-um)` to `칫 Chit`.
- Replace old green i-um brand assets with Chit assets.
- Update `apps/mobile/lib/design/theme.ts` to Chit tokens.
- Update shared buttons/cards/primitives to use Chit component language.
- Update app metadata name/icon/adaptive icon colors.
- Update onboarding/login/home/trip/expense/settlement copy where brand name appears.
- Preserve existing API package names, bundle identifiers, project slugs, and infra identifiers unless a separate release/infrastructure migration approves changing them.

### Out

- API route renames.
- Database or package namespace renames.
- Bundle identifier changes.
- Legal policy rewrite.
- Payment/transfer execution features.

## Acceptance Criteria for Future Implementation

- [ ] App-visible brand name is `칫 Chit` where full name is needed and `칫` where short mark is needed.
- [ ] `apps/mobile/lib/design/theme.ts` exposes Chit color tokens without raw per-screen colors.
- [ ] Existing green/amber i-um primary visual language no longer appears in core app surfaces except where semantically required by category/status tokens.
- [ ] New brand assets replace `apps/mobile/assets/brand/*` and app icons.
- [ ] Primary CTA uses Acid Lime with accessible Charcoal text.
- [ ] Settlement summary screens use Paper Fintech by default and Dark Acid for high-emphasis summary/complete states.
- [ ] Copy follows short Chit voice while preserving clear recovery text for errors.
- [ ] iOS and Android smoke checks cover login, home, trip tabs, expense add, settlement summary, and app icon/splash.

## Open Questions

- Exact final SVG path/lettering for B1 Stamp Lockup and B4 Dark Stamp Icon.
- Whether to add a dedicated dark mode in the first rebrand implementation or ship dark-key surfaces inside the current automatic theme behavior first.
- Whether legal-site branding changes should happen in the same PR or a separate public-site PR.
