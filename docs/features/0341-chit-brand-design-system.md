# Feature Slice: Chit 브랜드/디자인 시스템

## Metadata

- GitHub Issue: not yet assigned
- Status: Approved for design source of truth
- Created: 2026-07-19
- Updated: 2026-07-21
- Source: user-approved brand brainstorming session; 2026-07-21 Pure Dark Graphite video/mockup review
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

Chit 디자인은 `Pure Dark Graphite`를 기본 앱 구조로 사용한다.

1. `Pure Dark Shell` — 거의 검정에 가까운 Charcoal/Graphite 앱 배경. 눈이 편한 다크 톤을 앱 전체 기본값으로 사용한다.
2. `Graphite Layers` — AppBar, bottom tab, card, list, form, sheet를 모두 어두운 graphite 계열의 단계 차이로 구분한다.
3. `Graphite UI Primary` — 일반 UI의 주요 액션은 Acid Lime 대신 차분한 Graphite fill + off-white text를 기본으로 한다.
4. `Sparse Acid Signal` — Acid Lime은 선택, 성공, 브랜드 기억점, 작은 dot/underline/edge signal에만 짧게 사용한다.
5. `Brand Stamp Moment` — 앱 아이콘, BrandStamp, 스플래시/온보딩, 빈 상태/완료/정산 hero 같은 브랜드 순간에만 Acid Lime을 선명하게 남긴다.
6. `Limited Light Escape` — Off-white는 기본 카드/시트가 아니라 법적 고지, 긴 읽기, 공유/export, 접근성상 밝은 표면이 명확히 필요한 예외 상황에만 제한적으로 사용한다.

Warm Paper는 핵심 UI 배경/카드 표면에서 retired 상태다. 이전 `Dark Shell + Off-white Content` 방향도 기본 앱 구조로는 폐기한다. 큰 오프화이트 덩어리와 반복적인 Acid Lime fill이 다크 앱의 세련됨을 해치므로, Chit은 어두운 graphite 레이어 안에서 크기·대비·간격·작은 라임 신호로 위계를 만든다.

### Video/mockup review corrections

`여비_어플_비교.MP4`와 Pure Dark mockup 검토에서 확인한 이전 문제를 다음 규칙으로 교정한다.

- 큰 오프화이트 카드가 다크 쉘 위에 떠 보이는 문제 → 기본 카드/시트/폼은 dark graphite layer를 사용한다.
- Acid Lime이 탭, FAB, 버튼, 칩, 검색 버튼, 배지에 반복되어 시끄러운 문제 → Lime은 화면당 1~2개의 작은 신호로 제한한다.
- 모든 컴포넌트가 큰 pill/rounded 형태라 장난감처럼 보이는 문제 → radius scale을 줄이고, 선택 상태는 underline/dot/edge로 표현한다.
- 제목/본문/버튼/칩/탭이 모두 굵어 위계가 약한 문제 → hero/금액/핵심 CTA만 크게, 반복 정보는 compact하고 정렬감 있게 둔다.
- day chip, carousel, app bar, bottom sheet의 미세 정렬/overflow 문제 → grid/gutter/width/safe-area 규칙을 고정하고 clipped chip/card가 어색하게 보이지 않게 한다.
- 지도/장소 검색의 placeholder-quality 카드 문제 → 실제 이미지가 있으면 우선 사용하고, 없으면 polished dark thumbnail/category icon을 사용한다.

### Color tokens

| Role | Name | Hex / Value | Usage |
|---|---|---:|---|
| Core dark | Chit Black | `#0F1114` | 앱 최상위 shell, OLED에 가까운 기본 배경 |
| App shell | Pure Graphite Shell | `#101215` | root screen, map/search base, trip shell |
| Shell raised | Graphite Raised | `#1A1E23` | AppBar, bottom tab, elevated shell |
| Card | Graphite Card | `#20252B` | 기본 카드, 리스트 row, sheet 표면 |
| Card elevated | Graphite Elevated | `#262C33` | 강조 카드, selected tab/card surface |
| Card highest | Graphite Highest | `#303740` | 일반 primary CTA, strong action surface |
| Input/sunken | Graphite Sunken | `#171B20` | 입력창, 내부 패널, 눌린 표면 |
| Border | Graphite Line | `rgba(255,255,255,0.08)` | 다크 표면 경계/분리선 |
| Border strong | Graphite Line Strong | `rgba(255,255,255,0.15)` | focus/상위 경계 |
| Text primary | Off-white Text | `#F7F7F2` | 다크 표면 primary text |
| Text secondary | Muted Text | `#C5C9C1` | subtitle/body 주요 보조 텍스트 |
| Text tertiary | Faint Text | `#8E958B` | metadata, tab idle, helper |
| Brand accent | Acid Lime | `#C8FF00` | BrandStamp, 앱 아이콘, selected dot/underline, rare success |
| Accent surface | Acid Lime Surface | `#273218` | selected/brand soft dark surface |
| Legacy escape | Off-white Escape | `#FCFCF8` | 제한적 긴 읽기/공유/export/접근성 예외 표면 |
| Legacy retired | Warm Paper | `#F5F1E8` | 핵심 앱 배경/카드에는 사용 금지; 이력/마케팅 참고 전용 |
| Info | Fintech Blue | `#78A7FF` | 링크, 최신 계산 안내, 받을 돈/정보 보조 |
| Danger | Punch Red | `#FF5A67` | 오류, 삭제, 보낼 돈/위험 액션 |
| Warning/Review | Stamp Coral | `#FF765C` | 검토 필요, 영수증 초안, 장식적 강조 |

### Color rules

- App root/shell은 Pure Graphite Shell 계열을 기본으로 한다.
- 핵심 카드/리스트/입력/시트는 dark graphite layer만 사용한다.
- Off-white는 default content surface가 아니다. 예외적으로 긴 읽기, 법적 고지, 외부 공유/export, 접근성상 밝은 표면이 명확히 유리한 곳에만 사용한다.
- Warm Paper `#F5F1E8`는 핵심 UI 배경/카드에서 retired 상태다.
- Acid Lime은 브랜드 기억점이지만 일반 UI primary로 반복 사용하지 않는다.
- Acid Lime 허용 위치:
  - BrandStamp text/offset.
  - 앱 아이콘, 스플래시, 온보딩, 마케팅 hero 같은 브랜드 순간.
  - selected dot/underline/edge, 작은 상태 signal.
  - 완료/성공/정산 hero의 매우 제한적인 강조.
- 일반 UI primary action은 Graphite Highest fill + Off-white Text를 기본으로 한다.
- 선택/성공/상태 강조는 dark Acid Lime Surface + off-white/charcoal-safe foreground 또는 작은 Lime signal로 표현한다.
- Acid Lime 금지 위치:
  - 긴 본문.
  - 반복되는 일반 CTA/FAB/chip/tab fill.
  - 작은 텍스트, 스피너, 얇은 marker의 단독 전경색.
  - 오류/위험 의미.
  - 색상만으로 상태를 전달하는 경우.
- 핵심 앱 shell은 decorative glow/gradient 없이 정돈된 matte graphite를 기본으로 한다. 화면별 ad-hoc radial/rgba 장식은 만들지 않는다.
- 순수 블랙은 넓은 배경에서만 조심스럽게 사용하고, 카드/탭/폼은 graphite 단계로 분리한다.
- Fintech Blue와 Punch Red는 정산/정보/위험 의미에 제한하고 브랜드 primary로 쓰지 않는다.

## Logo Direction

### Approved direction

- 공식 로고/워드마크: `B1 Stamp Lockup`.
- 앱 아이콘/스플래시: `B4 Dark Stamp Icon`.
- 앱 내 재사용 컴포넌트: `BrandStamp` — Charcoal rounded square + Acid Lime `칫` + slight rotation + Acid Lime offset/shadow.

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
| App header | `BrandStamp` or simple `칫` text mark depending on density |
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

### Density

Chit은 `Compact Premium Dark` 밀도 모델을 사용한다.

- 크게 보여줄 것: 홈의 현재 여행, 오늘의 다음 행동, 총 지출, 정산 결과, 여행 생성 단계 제목, 빈 상태 메시지, 핵심 CTA.
- compact하게 보여줄 것: 장소 리스트, 지출 row, 참여자 row, 항공권 목록, 알림, 설정, day chip, category chip, metadata.
- 작게 만든다는 뜻은 터치 영역을 줄인다는 뜻이 아니다. 모든 주요 touch target은 44pt 이상이어야 한다.
- row 높이는 compact하되 metadata, amount, action alignment가 일정해야 한다.

### Cards

- Default cards use Graphite Card on Pure Graphite Shell.
- Internal panels/input wells use Graphite Sunken.
- Critical settlement summary cards may use darker Acid Lime Surface or Graphite Elevated with Acid Lime only for large, rare emphasis.
- Rounded cards stay modern and soft, but not bubbly. Repeated nested pill/card shapes are avoided.
- Borders and subtle layer contrast are preferred over heavy shadows for everyday dense surfaces.
- Stamp-style offset/shadow is reserved for BrandStamp, onboarding/empty/completion/settlement hero states, not dense lists.
- Off-white cards are exceptional light escape surfaces, not the default app card language.

### Buttons

- Primary CTA: Graphite Highest background + Off-white Text.
- Secondary CTA: Graphite Card/Input background + Graphite Line border + Muted/Primary text.
- Selected chips/tabs: Graphite Elevated or Acid Lime Surface + small Acid Lime underline/dot/edge signal.
- Routine FAB: dark floating surface + Acid Lime icon/signal, not a large Acid Lime circle.
- Destructive CTA: Danger token, never Acid Lime.
- Pressed states should be fast and tactile, without layout shift.

### Lists and rows

- Expense/settlement rows must remain highly scannable.
- Use color plus text/icon; do not rely on color alone.
- Amounts align consistently and use tabular numerals.
- Metadata stays short: payer, split count/status, date/context when needed.

### Navigation

- Bottom tab remains text + vector icon on dark raised shell surface.
- Active tab uses Graphite Elevated with a small Acid Lime underline/dot/edge signal. Avoid large Acid Lime selected capsules in dense nav.
- AppBar, trip tabs, and bottom tabs use graphite shell surfaces and fixed safe-area aware spacing.
- Header icon, trip title, utility action, and avatar must align to a predictable grid and avoid cramped/uneven optical centers.
- Day chips should have predictable width/rhythm and must not clip awkwardly at the viewport edge.
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
- Dark-only surfaces require explicit text tiers: primary off-white, secondary muted, tertiary faint. Do not rely on near-identical graphite tones for text/background pairs.
- Acid Lime is not a body-text color. Use it as a selected/brand signal with text or shape context.
- Off-white escape surfaces must define separate foreground, border, and pressed-state pairs when used.
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
- Update `apps/mobile/lib/design/theme.ts` to Pure Dark Graphite Chit tokens.
- Update shared buttons/cards/primitives to use Pure Dark Graphite component language.
- Update navigation shell, tabs, forms, sheets, maps, expenses, settlement, participants, flights, mypage, and notifications to remove off-white-default surfaces.
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
- [ ] `apps/mobile/lib/design/theme.ts` exposes Pure Dark Graphite Chit color tokens without raw per-screen colors.
- [ ] Existing green/amber i-um primary visual language no longer appears in core app surfaces except where semantically required by category/status tokens.
- [ ] New brand assets replace `apps/mobile/assets/brand/*` and app icons.
- [ ] Primary CTA uses Graphite Highest with accessible Off-white text; Acid Lime is reserved for BrandStamp/app-icon/selected/success/rare brand moments.
- [ ] Core screens use Pure Graphite Shell with dark graphite card/list/form/sheet surfaces by default.
- [ ] Off-white is not used as the default content card/sheet surface; any Off-white Escape usage is explicitly justified by readability/accessibility context.
- [ ] Warm Paper `#F5F1E8` is not visible in core app backgrounds/cards.
- [ ] Core shell remains clean matte graphite without decorative per-screen Acid Lime glow/gradient.
- [ ] BrandStamp appears only in approved brand/header/empty/loading/settlement moments.
- [ ] Bottom tabs/trip tabs avoid large repeated Acid Lime capsules; active state uses dark selected surface plus small Acid Lime signal.
- [ ] Repeated lists/forms use Compact Premium Dark density while preserving 44pt touch targets.
- [ ] Map/search place cards use real imagery or polished dark thumbnails instead of text-only placeholder blocks.
- [ ] Copy follows short Chit voice while preserving clear recovery text for errors.
- [ ] iOS and Android smoke checks cover login, home, trip tabs, expense add, settlement summary, and app icon/splash.

## Open Questions

- Exact final SVG path/lettering for B1 Stamp Lockup and B4 Dark Stamp Icon.
- Whether to add a user-selectable dedicated dark mode later; current direction uses dark shell as the default visual shell.
- Whether legal-site branding changes should happen in the same PR or a separate public-site PR.
