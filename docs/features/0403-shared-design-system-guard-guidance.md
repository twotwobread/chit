# Feature 0403: Shared design-system guard and guidance hardening

## Metadata

- GitHub Issue: #403
- Parent: #395
- Related: #389, #383
- Status: Implemented guidance
- Updated: 2026-08-22
- Scope type: Mobile design-system guard and contributor guidance

## Purpose

`apps/mobile/lib/design`는 foundation, components, patterns 구조를 갖는다. 이 문서는 새 화면이나 새 shared primitive가 다시 local raw `Pressable`, raw color, inconsistent accessibility state, or off-brand UI로 돌아가지 않도록 contributor와 agent가 먼저 확인할 기준이다.

Current visual source of truth is **Chit Ledger × Memory**:

```text
기록은 정확하게, 기억은 다정하게.
```

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
- `surface-frame.tsx`: paper, memory, ledger, receipt, dark frame variant를 token으로 고정한다.
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

- Hero and state patterns use Receipt Cream/Paper White/Ledger Ink by default.
- Ledger summary moments may use Ledger Ink surfaces with tabular money.
- Receipt/stamp/ticket motifs are completion/share/report accents, not routine UI chrome.
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

## Ledger × Memory hierarchy

- Chit Coral is brand/action/selection, not a financial state color.
- Action Coral is the default primary action fill.
- Paper White is the default ledger/form/calculation surface.
- Receipt Cream is the default home/meeting/memory atmosphere.
- Ledger Ink is the default high-emphasis text and amount color.
- Clear Green, Alert Red, and Info Blue carry semantic state meaning.
- Receipt/ticket/stamp motifs are limited to completion, share/export, reports, invites, and memory cards.

Practical rules:

- `PrimaryButton` default tone stays `coral` for primary actions; use `ink` for ledger/dark high-emphasis moments.
- Dense rows, routine form actions, and destructive actions do not use decorative receipt/stamp treatment.
- Selected chips/tabs should prefer Paper/Soft Gray surfaces plus a Coral text/edge/dot signal; avoid repeated large Coral fills in dense UI.
- Product UI uses vector/custom iconography, not emoji structural icons.

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

### Receipt motif moment

```tsx
<Card variant="receipt">
  <Text>정산 완료</Text>
  <Text>이 기록은 모임에 남아요.</Text>
</Card>
```

Use this only for completion/share/report/invite/memory moments. Do not use it for every list row.

### Public export compatibility

When adding, removing, or renaming anything exported from `apps/mobile/lib/design/index.ts`, update `apps/mobile/lib/app-info/design-public-surface.snapshot.json` in the same PR and explain why the public surface changed.

## Source guards

The mobile app-info guard suite protects this guidance:

- Design public export surface stays tracked.
- Shared design layer files stay token-only and avoid decorative glyph drift.
- Contributor guidance and `.harness/rules/code/mobile-ui.md` stay aligned on layer rules, `InteractiveSurface`, accessibility, touch targets, Ledger × Memory hierarchy, and semantic color usage.

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

Manual iOS/Android smoke is required when runtime UI files change. Record Android and iOS smoke status in the completion report.
