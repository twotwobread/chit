# Feature 0403: Shared design-system guard and guidance hardening

## Metadata

- GitHub Issue: #403
- Parent: #395
- Related: #389, #383
- Status: Implemented guidance
- Scope type: Mobile design-system guard and contributor guidance

## Purpose

#395로 `apps/mobile/lib/design`가 foundation, components, patterns 구조를 갖게 됐다. 이 문서는 새 화면이나 새 shared primitive가 다시 local raw `Pressable`, raw color, inconsistent accessibility state, Lime-heavy hierarchy로 돌아가지 않도록 contributor와 agent가 먼저 확인할 기준이다.

Runtime UI redesign은 이 문서의 범위가 아니다. 기존 화면을 바꾸는 대신 guard, source snapshot, 문서, `.harness` context를 강화한다.

## Layer model

```text
theme tokens
  -> foundation
  -> components
  -> patterns
  -> trip-ui / screens
```

### foundation

`foundation`은 shared design layer 내부에서 반복되는 낮은 단계의 동작을 모은다.

- `accessibility.ts`: `accessibilityState`를 일관되게 만든다.
- `interactive-surface.tsx`: `InteractiveSurface`로 `Pressable` role/state/disabled/busy/selected/pressed/touch target을 표준화한다.
- `responsive-label.tsx`: 반응형 text/line-height profile을 적용한다.
- `surface-frame.tsx`: card/surface frame variant를 token으로 고정한다.
- `action-group.tsx`: 인접 action spacing과 layout을 공유한다.

새 foundation primitive는 higher layer를 import하지 않는다. 의존 방향은 `theme -> foundation -> components -> patterns`다.

### components

`components`는 화면이 직접 import해도 되는 작은 reusable UI다. Button, IconButton, Link, ActionRow, Chip, Card, Badge, AmountText 같은 단일 책임 요소가 여기에 있다.

- Interactive component는 기본적으로 `InteractiveSurface`를 사용한다.
- 색, spacing, radius, typography, shadow는 `theme.*` token에서 온다.
- icon-only control은 `accessibilityLabel`을 필수로 받고 필요하면 `accessibilityHint`를 노출한다.
- 기존 `apps/mobile/lib/design/index.ts` public export surface를 깨지 않는다.

### patterns

`patterns`는 여러 component를 조합해 반복 화면 구조를 만든다. Hero, form field, state card처럼 섹션 단위 의미가 있을 때 사용한다.

- `HeroCard`, `HeroHeader`, `HeroMetricPanel`, `HeroActions`는 Pure Dark Graphite 중심 구조와 rare/explicit Lime signal 또는 CTA를 표현한다.
- Loading, empty, error state는 screen state를 소유하지 않고 표시 구조만 제공한다.
- Pattern은 route, API call, business state를 직접 알지 않는다.

## New interactive primitive checklist

새 shared primitive가 press/tap 동작을 갖는다면 아래를 모두 확인한다.

- `InteractiveSurface`를 사용한다. Provider/context-bound overlay에서 안전하지 않은 경우에만 plain React Native primitive를 쓰고 이유를 남긴다.
- `accessibilityRole`을 명시하거나 합리적인 default를 제공한다.
- `accessibilityState`에 `disabled`, `busy`, `selected`, `checked`, `expanded` 중 해당 상태를 연결한다.
- Disabled/busy 상태에서는 duplicate submit이나 duplicate navigation을 막는다.
- Pressed feedback은 opacity/background 등 tokenized style로 처리하고 layout shift를 만들지 않는다.
- Touch target은 최소 `theme.layout.tapMin`이다. 작은 icon-only control은 `hitSlop`으로 보정한다.
- Label이 아이콘뿐이면 `accessibilityLabel`을 필수로 두고, 결과가 모호하면 `accessibilityHint`를 받는다.
- Style literal에는 raw hex, ad-hoc `rgba(...)`, 임의 spacing/radius/font 값을 추가하지 않는다.

대표 기준:

```tsx
<InteractiveSurface
  accessibilityLabel="장소 삭제"
  accessibilityRole="button"
  accessibilityHint="현재 Day에서 이 장소를 제거합니다."
  disabled={submitting}
  busy={submitting}
  hitSlop={theme.space[3]}
  minHeight={theme.layout.tapMin}
  onPress={onDelete}
  style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
>
  <Text style={styles.actionLabel}>삭제</Text>
</InteractiveSurface>
```

## Graphite primary and sparse Acid Lime hierarchy

Graphite is the default primary action for normal product UI. In Korean context: 일반 주요 액션의 기본 primary CTA는 Graphite fill + Off-white text다.

Acid Lime is sparse and explicit. Use Acid Lime for BrandStamp/app icon/splash/onboarding brand moments, selected dot/underline/edge signals, rare success emphasis, or one high-emphasis CTA only when the current screen spec explicitly approves it. Do not use Acid Lime repeatedly as small foreground text, neutral spinners, dense routine tabs/chips/FAB/buttons, danger actions, or long body copy.

Practical rules:

- `PrimaryButton` default tone stays Graphite. Use `tone="lime"` only when the current spec says this is the one high-emphasis CTA.
- `HeroActions` may contain a Lime primary action, but keep it rare and explicit; Graphite remains the default hero CTA.
- Dense rows, routine form actions, and destructive actions stay Graphite/neutral/danger tokens, not Lime.
- Selected chips/tabs should prefer Graphite Elevated or Acid Lime Surface with a small Lime underline/dot/edge signal; avoid repeated full Acid Lime fill in dense UI.

## Representative examples

### Component-level action

Use shared components first:

```tsx
<InlineAction
  accessibilityLabel="주소 복사"
  label="복사"
  onPress={copyAddress}
  tone="primary"
/>
```

Do not create a local raw `Pressable` with hand-written role, state, pressed opacity, hitSlop, and token copies unless a provider/context boundary makes the shared wrapper unsafe.

### Explicit rare Lime hero CTA

```tsx
<HeroActions
  actions={[
    { label: '지출 추가', onPress: goToExpenseCreate, tone: 'lime' },
    { label: '전체 보기', onPress: goToExpenses, tone: 'secondary' },
  ]}
/>
```

Use this only when the current screen spec explicitly approves a Lime hero CTA. Otherwise keep the primary action Graphite. If two actions feel equally important, pick the actual next action and keep the other Graphite/secondary.

### Public export compatibility

When adding, removing, or renaming anything exported from `apps/mobile/lib/design/index.ts`, update `apps/mobile/lib/app-info/design-public-surface.snapshot.json` in the same PR and explain why the public surface changed.

## Source guards

The mobile app-info guard suite protects this guidance:

- `Issue 403 design public export surface matches the tracked snapshot` compares `index.ts` named exports to `design-public-surface.snapshot.json`.
- `Issue 403 shared design layer files stay token-only and avoid decorative glyph drift` scans `apps/mobile/lib/design/**/*.ts(x)` for raw hex outside `theme.ts` and decorative emoji/glyph drift.
- `Issue 403 contributor guidance documents shared primitive guardrails` keeps this doc and `.harness/rules/code/mobile-ui.md` aligned on layer rules, `InteractiveSurface`, accessibility, touch targets, Graphite default, and sparse Acid Lime.

## Verification

Run before PR:

```bash
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm --filter @i-um/mobile format:check
pnpm lint
node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .
pnpm harness:validate
```

Manual iOS/Android smoke is not required for this guard-only change unless runtime UI files change. If runtime UI files change later, record Android and iOS smoke status in the completion report.
