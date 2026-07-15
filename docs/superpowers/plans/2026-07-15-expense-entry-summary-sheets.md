# Expense Entry Summary Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for helper/view-model changes and run verification before completion.

**Goal:** Refactor expense entry/edit UI so core screens show compact summary rows while settlement/split details live in bottom sheets.

**Architecture:** Keep existing controller state and request builders. Add pure summary helpers to `quick-expense.ts` / `expense-edit.ts`, then render summary rows that open local `BottomSheet` sections for split and settlement status editing.

**Tech Stack:** Expo React Native, existing `BottomSheet`, Node test runner, TypeScript.

## Global Constraints

- No API/DB behavior changes.
- Preserve `includeInSettlement` semantics: default included, on-site settled means `includeInSettlement: false`.
- Main form must show current state in one line: payer/split summary and settlement status summary.
- Detailed explanatory copy belongs inside the sheet, not always-visible on the main form.

---

### Task 1: Add summary helper tests and helpers

**Files:**
- Modify: `apps/mobile/lib/trips/quick-expense.test.mts`
- Modify: `apps/mobile/lib/trips/quick-expense.ts`
- Modify: `apps/mobile/lib/trips/expense-edit.test.mts`
- Modify: `apps/mobile/lib/trips/expense-edit.ts`

**Interfaces:**
- Produces: `buildExpenseSplitSummaryLabel(...)` and `settlementStatusSummaryLabel(includeInSettlement)`.

- [ ] Add failing tests for `민수 결제 · 전체 1/N`, subset split, direct split, and settlement labels.
- [ ] Implement helper functions.
- [ ] Run `pnpm --filter @i-um/mobile test`.

### Task 2: Refactor quick expense full-screen form

**Files:**
- Modify: `apps/mobile/lib/trip-ui/QuickExpenseEntryParts.tsx`
- Modify: `apps/mobile/lib/trip-ui/QuickExpenseEntryStyles.ts`

**Interfaces:**
- Consumes existing props/state.
- Produces compact rows: `결제/분할` and `정산 옵션`, each opening a bottom sheet.

- [ ] Replace always-visible payer/split/settlement controls with summary rows.
- [ ] Move payer/split controls into `결제/분할 설정` bottom sheet.
- [ ] Move settlement status choices into `정산 옵션` bottom sheet.
- [ ] Keep validation messages visible near the relevant summary row.

### Task 3: Refactor Today quick expense overlay and edit form

**Files:**
- Modify: `apps/mobile/lib/trip-ui/QuickExpenseForm.tsx`
- Modify: `apps/mobile/lib/trip-ui/ExpenseEditScreenParts.tsx`
- Modify: `apps/mobile/lib/trip-ui/ExpenseEditScreenStyles.ts`

**Interfaces:**
- Uses the same summary helper labels.
- Keeps existing controller state and submit payloads.

- [ ] Refactor Today overlay to summary row + bottom sheet for split/settlement settings.
- [ ] Refactor edit form to summary row + bottom sheet for split/settlement settings.
- [ ] Preserve current edit initialization and save behavior.

### Task 4: Verify

- [ ] Run `pnpm --filter @i-um/mobile test`.
- [ ] Run `pnpm --filter @i-um/mobile typecheck`.
- [ ] Run `pnpm --filter @i-um/mobile lint`.
- [ ] Run `pnpm format:check`.
