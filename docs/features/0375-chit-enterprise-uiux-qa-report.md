# Issue 375: Chit enterprise UI/UX final QA report

## Metadata

- GitHub Issue: #375
- Status: Blocked for final closure until iOS and Android manual smoke can run
- Branch: `feature/F-375-issue-375`
- Run: `.harness/runs/0375-uiux-final-qa`
- Date: 2026-07-19

## Summary

This pass reviewed the current Expo mobile route inventory against the Chit enterprise/mobile criteria from `docs/features/0341-chit-brand-design-system.md` and `ui-ux-pro-max`:

- Paper Fintech default surfaces, constrained Dark Acid/Stamp Pop usage.
- 44pt+ touch targets for key controls.
- Explicit labels/roles/states for key navigation tabs and chips.
- Raw color usage outside design token/assets.
- Context-bound native UI wrappers.
- Dense list scannability and status-not-color-only patterns.

Applied fixes are limited to accessibility/touch-target polish and tests. No API, DB, generated, app metadata, or feature-behavior changes were intentionally made.

## Route inventory review

| Route | Area | Review status | Evidence / disposition |
|---|---|---:|---|
| `apps/mobile/app/_layout.tsx` | Root/session/provider shell | no-change-needed | Context-bound UI check passed; no route-specific raw color finding. |
| `apps/mobile/app/index.tsx` | Home | updated | Top-level BottomMenu now exposes explicit tab labels; static route review otherwise no-change. |
| `apps/mobile/app/login.tsx` | Login | no-change-needed | Provider buttons already expose labels/loading state; no raw color finding. |
| `apps/mobile/app/account.tsx` | Account/profile | no-change-needed | Form/action controls use shared 48pt buttons and labels. |
| `apps/mobile/app/mypage.tsx` | My page | updated | Top-level BottomMenu now exposes explicit tab labels; static route review otherwise no-change. |
| `apps/mobile/app/notifications.tsx` | Notifications | no-change-needed | Rows use text content and read/unread dot with text context; no must-fix found. |
| `apps/mobile/app/invite/[token].tsx` | Invite handoff | no-change-needed | Static review found no raw color/context-bound issue. |
| `apps/mobile/app/kakaolink.tsx` | Kakao link handoff | no-change-needed | Static review found no raw color/context-bound issue. |
| `apps/mobile/app/trips/new.tsx` | Trip creation form | updated | `theme.layout.controlHSm` now satisfies 44pt floor for compact controls using the token. |
| `apps/mobile/app/trips/[tripId]/_layout.tsx` | Trip shell | no-change-needed | Context-bound UI check passed; no route-specific issue. |
| `apps/mobile/app/trips/[tripId]/index.tsx` | Trip root redirect/shell | no-change-needed | Static review found no route-specific issue. |
| `apps/mobile/app/trips/[tripId]/detail.tsx` | Trip detail | no-change-needed | Static review found no route-specific issue; small icons are decorative/status markers. |
| `apps/mobile/app/trips/[tripId]/edit.tsx` | Trip edit | updated | Compact currency/action controls inherit 44pt `controlHSm` floor. |
| `apps/mobile/app/trips/[tripId]/participants.tsx` | Participants | no-change-needed | Participant remove controls already have labels/hitSlop; sheet actions reviewed. |
| `apps/mobile/app/trips/[tripId]/settlement-detail.tsx` | Settlement detail | no-change-needed | Metric icons are decorative; amount/status labels include text/signs beyond color. |
| `apps/mobile/app/trips/[tripId]/(tabs)/_layout.tsx` | Trip tab shell | updated | TripTabBar tabs now expose explicit accessibility labels and selected state. |
| `apps/mobile/app/trips/[tripId]/(tabs)/today.tsx` | Today | updated | Restored row action override to 44pt min height; test added. |
| `apps/mobile/app/trips/[tripId]/(tabs)/itinerary.tsx` | Itinerary tab | updated | Day chips now expose explicit accessibility labels and 44pt+ token floor. |
| `apps/mobile/app/trips/[tripId]/(tabs)/map.tsx` | Map tab | updated | Map search icon-only clear/favorite controls now use 44pt min touch targets; context-bound check passed. |
| `apps/mobile/app/trips/[tripId]/(tabs)/expenses.tsx` | Expenses tab | updated | Shared Chip/SegmentedControl touch target and labels apply; ExpenseRow category labels/icons remain covered. |
| `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx` | Settlement tab | no-change-needed | Credit/debit metrics include text/sign/icon context; metric icons are decorative. |
| `apps/mobile/app/trips/[tripId]/days/[date].tsx` | Day detail | updated | Day chips inherit explicit labels and 44pt+ token floor. |
| `apps/mobile/app/trips/[tripId]/days/[date]/place-search.tsx` | Place search | updated | GooglePlaceMapSearch icon-only controls and compact actions reviewed/fixed. |
| `apps/mobile/app/trips/[tripId]/days/[date]/places/new.tsx` | Manual place add | no-change-needed | Primary controls use 48pt shared button/form controls. |
| `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx` | OCR/quick expense | updated | QuickExpense participant chips now use 44pt min height; receipt retry/clear labels already covered. |
| `apps/mobile/app/trips/[tripId]/days/[date]/expenses/[expenseId]/edit.tsx` | Day expense edit | updated | Shared form chip/action touch target fixes apply. |
| `apps/mobile/app/trips/[tripId]/expenses/[expenseId]/edit.tsx` | Trip expense edit | updated | Shared form chip/action touch target fixes apply. |
| `apps/mobile/app/trips/[tripId]/flights/index.tsx` | Flights list | no-change-needed | Static review found no must-fix; passenger/status copy remains text-based. |
| `apps/mobile/app/trips/[tripId]/flights/new.tsx` | Flight create | updated | Shared compact token and explicit selected-state patterns apply. |
| `apps/mobile/app/trips/[tripId]/flights/[flightId].tsx` | Flight detail/edit | updated | Shared compact token and explicit selected-state patterns apply. |

## Findings and changes

| Severity | Category | Finding | Disposition | Evidence |
|---|---|---|---|---|
| High | Touch target | `theme.layout.controlHSm` was 36pt, causing compact interactive chips/buttons to fall below the issue #375 44pt floor. | Fixed: `controlHSm` is now 44pt; regression test added. | `apps/mobile/lib/design/theme.ts`, `apps/mobile/lib/app-info/chit-ui-foundation.test.mts` |
| High | Touch target | Shared `SegmentedControl` tab items did not explicitly reserve 44pt height. | Fixed: `segmentItem.minHeight = theme.layout.tapMin`; regression test added. | `apps/mobile/lib/design/primitives.tsx` |
| High | Touch target | Map search icon-only clear and favorite buttons were 30/36pt. | Fixed: both use `minHeight/minWidth: theme.layout.tapMin`; regression test added. | `apps/mobile/lib/trip-ui/GooglePlaceMapSearch.tsx`, `google-place-search-entry.test.mts` |
| Medium | Touch target | Today tab row action style overrode shared `SecondaryButton` minHeight with 36pt. | Fixed: override now uses `theme.layout.tapMin`; regression test added. | `apps/mobile/app/trips/[tripId]/(tabs)/today.tsx` |
| Medium | Touch target | Quick expense participant chips were about 40pt. | Fixed: participant chips now use `theme.layout.tapMin`; regression test added. | `apps/mobile/lib/trip-ui/QuickExpenseForm.tsx`, `quick-expense-layout.test.mts` |
| Medium | Accessibility | Key bottom/trip tabs and chip primitives had roles/states but did not expose explicit labels in source. | Fixed: explicit `accessibilityLabel` added to BottomMenu, TripTabBar, shared Chip, SegmentedControl, and DayChips; regression test added. | `BottomMenu.tsx`, `TripTabBar.tsx`, `primitives.tsx`, `DayChips.tsx` |
| Info | Layout regression test | Increasing the reserved compact control height changed the expected full map search snap point from 208 to 200 in the constrained 280px test case. | Updated test expectation to match the larger top inset. | `apps/mobile/lib/places/google-search.test.mts` |

## Static audit results

| Audit | Result | Notes |
|---|---:|---|
| Raw colors outside approved token/assets | pass with approved test-only occurrences | `raw-color-audit-after.txt` only reports token/asset assertions in `brand-foundation.test.mts`; no app/screen raw color literals were introduced by this pass. |
| Context-bound native UI wrappers | pass | `check-mobile-context-bound-ui.mjs` passed after changes: 76 TSX/JSX files scanned. |
| Touch targets | updated/pass for code-level findings | Compact token, shared segmented tabs, map icon-only buttons, Today row actions, quick expense participant chips now have 44pt+ source evidence. Remaining small fixed sizes are decorative icons/markers or have hitSlop. |
| Accessibility roles/labels/states | updated/pass for key shared controls | Key tabs/chips now include explicit labels and selected/disabled state where applicable. Text buttons/rows rely on visible text plus role/state. |
| Dense list scannability | no-change-needed | No raw/decorative Stamp Pop or heavy visual changes were added. Fixes increase touch safety without adding decoration. |
| Status-not-color-only | no-change-needed | Settlement/expense amount patterns keep signs/text/icons: `AmountText` emits `+`/`−`, category rows keep accessible category labels/icons, settlement metric labels remain textual. |
| Stamp Pop overuse | no-change-needed | No new Stamp Pop/decorative assets or emoji/unicode icons were added. |

## Smoke matrix

Manual platform smoke was **not completed** in this environment. Do not close issue #375 on this report alone.

| Area | iOS status | Android status | Notes |
|---|---:|---:|---|
| Root/login/session | blocked | blocked | iOS `xcrun simctl` unavailable; Android `adb devices` shows no attached devices. |
| Home | blocked | blocked | Requires simulator/device smoke. |
| Mypage/account/notifications | blocked | blocked | Requires simulator/device smoke. |
| Trip shell/tabs | blocked | blocked | Requires simulator/device smoke. |
| Today | blocked | blocked | Code-level touch fix verified by tests; route smoke still blocked. |
| Itinerary/place | blocked | blocked | Code-level DayChip/map-search fixes verified by tests; route smoke still blocked. |
| Map | blocked | blocked | Context-bound/static checks passed; native map behavior still requires device/simulator smoke. |
| Expenses | blocked | blocked | Requires simulator/device smoke. |
| OCR/quick expense | blocked | blocked | QuickExpense code-level fix verified by tests; OCR/camera behavior still requires device smoke. |
| Settlement | blocked | blocked | Requires simulator/device smoke. |
| Participants/invite | blocked | blocked | Requires simulator/device smoke. |
| Flights | blocked | blocked | Requires simulator/device smoke. |

## Verification evidence

| Command | Result | Evidence |
|---|---:|---|
| `pnpm install` | pass | `.harness/runs/0375-uiux-final-qa/artifacts/checks/pnpm-install.log` |
| RED: compact controls 36pt test | fail as expected | `chit-ui-touch-red.log` |
| RED: segmented item missing minHeight | fail as expected | `chit-ui-touch-segment-red.log` |
| GREEN: compact controls/tabs | pass | `chit-ui-touch-green.log` |
| RED/GREEN: map icon-only buttons | fail/pass as expected | `google-place-touch-red.log`, `google-place-touch-green.log` |
| RED/GREEN: Today row action | fail/pass as expected | `today-row-touch-red.log`, `today-row-touch-green.log` |
| RED/GREEN: quick expense participant chips | fail/pass as expected | `quick-expense-chip-red.log`, `quick-expense-chip-green.log` |
| RED/GREEN: key tab/chip accessibility labels | fail/pass as expected | `a11y-labels-red.log`, `a11y-labels-green.log` |
| `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .` | pass | `mobile-context-bound-ui-after.log` |
| `pnpm --filter @i-um/mobile test` | pass | `mobile-test-after.log` — 680 tests passed |
| `pnpm --filter @i-um/mobile typecheck` | pass | `mobile-typecheck.log` |
| `pnpm --filter @i-um/mobile lint` | pass | `mobile-lint.log` |
| `pnpm --filter @i-um/mobile format:check` | pass | `mobile-format-check.log` |
| `pnpm harness:validate` | pass | `adapter-sync.log` / `harness-validate.log` |
| `node .harness/scripts/check-worktree-isolation.mjs --repo-root .` | pass | `worktree-isolation.log` |
| `node .harness/scripts/check-bugfix-scenario-coverage.mjs --run-dir .harness/runs/0375-uiux-final-qa` | pass/skipped | Non-bugfix run skipped. |
| `pnpm verify:generated` | pass | `verify-generated.log` |
| `xcrun simctl list devices available` | blocked | `ios-simulator-availability.log` — `simctl` unavailable. |
| `adb devices` | blocked | `android-device-availability.log` — no devices attached. |

## Follow-up / handoff

- Required before closing #375: run and record the iOS smoke matrix on an available Simulator or physical device.
- Required before closing #375: run and record the Android smoke matrix on an emulator or physical device.
- Recommended smoke data to attach to #375 or a linked PR: platform, device/simulator, app build/source, API environment, account/session setup, route area result, and screenshot/video only where a failure needs visual evidence.
