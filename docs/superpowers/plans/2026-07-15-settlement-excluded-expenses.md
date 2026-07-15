# Settlement Excluded Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-expense final-settlement inclusion so on-site-settled expenses stay in total/history but are excluded from settlement balances and transfers.

**Architecture:** Add a positive `includeInSettlement` API boolean backed by `expenses.include_in_settlement boolean not null default true`. API list/detail/create/update surfaces the flag; settlement input queries filter it; mobile create/edit forms and row models expose it with Korean copy.

**Tech Stack:** OpenAPI + oapi-codegen, Go API, PostgreSQL/goose/sqlc, Expo React Native, generated TypeScript API client.

## Global Constraints

- API changes start in `packages/api-contract/openapi.yaml`.
- DB changes use goose migrations and update `apps/api/schema.sql` plus sqlc generated code.
- Mobile uses generated API types/client and design tokens/primitives.
- Product copy is Korean first and should distinguish `총 사용 금액` from `정산 대상`.
- Default behavior must be backward-compatible: omitted create `includeInSettlement` means `true`; omitted update `includeInSettlement` preserves the existing value.

---

### Task 1: Contract and DB source changes

**Files:**
- Modify: `packages/api-contract/openapi.yaml`
- Create: `apps/api/migrations/00025_add_expense_settlement_inclusion.sql`
- Modify: `apps/api/schema.sql`
- Modify: `apps/api/queries/expenses.sql`

**Interfaces:**
- Produces API field: `includeInSettlement: boolean`.
- Produces DB column: `expenses.include_in_settlement boolean NOT NULL DEFAULT true`.

- [x] Add optional `includeInSettlement` to create/update request schemas.
- [x] Add required `includeInSettlement` to `DayExpenseListItem` and `Expense` response schemas.
- [x] Add migration with up/down goose sections.
- [x] Select/return `include_in_settlement` in expense list/detail/create/update queries.
- [x] Filter `ListSettlementRowsByTrip` and `ListSettlementRowsByTrips` with `e.include_in_settlement = true`.

### Task 2: API tests and implementation

**Files:**
- Modify: `apps/api/internal/trip/types.go`
- Modify: `apps/api/internal/trip/service.go`
- Modify: `apps/api/internal/trip/service_test.go`
- Modify: `apps/api/internal/storage/trip_repository.go`
- Modify: `apps/api/internal/storage/trip_repository_test.go`
- Modify: `apps/api/internal/server/trip_handlers.go`
- Modify: `apps/api/internal/server/mappers.go`
- Modify: `apps/api/internal/server/server_test.go`

**Interfaces:**
- Consumes: generated OpenAPI structs with pointer request field and required response field.
- Produces: `IncludeInSettlement bool` on domain expense/list/record types.

- [x] Write failing service tests proving create/update records carry default true and explicit false.
- [x] Write failing server tests proving JSON request/response mapping for create, update, list, and detail.
- [x] Write failing storage/settlement tests proving excluded expenses are listed but omitted from settlement input.
- [x] Implement domain fields, defaulting, mappers, and storage query parameter wiring.
- [x] Run `pnpm --filter @i-um/api test` until passing.

### Task 3: Generated artifacts

**Files:**
- Modify generated: `apps/api/internal/openapi/server.gen.go`
- Modify generated: `apps/api/internal/db/expenses.sql.go`
- Modify generated: `packages/api-contract/gen/ts/**`

**Interfaces:**
- Produces generated Go/TS/db code used by API and mobile.

- [x] Run `pnpm generate`.
- [x] Run `pnpm verify:generated`.
- [x] Fix source files only if generated verification fails.

### Task 4: Mobile helper tests and implementation

**Files:**
- Modify: `apps/mobile/lib/trips/quick-expense.ts`
- Modify: `apps/mobile/lib/trips/quick-expense.test.mts`
- Modify: `apps/mobile/lib/trips/expense-edit.ts`
- Modify: `apps/mobile/lib/trips/expense-edit.test.mts`
- Modify: `apps/mobile/lib/trips/day-expenses.ts`
- Modify: `apps/mobile/lib/trips/day-expenses.test.mts`
- Modify: `apps/mobile/lib/trips/settlement.ts`
- Modify: `apps/mobile/lib/trips/settlement.test.mts`

**Interfaces:**
- Consumes: generated `includeInSettlement` on request/response types.
- Produces: row/display metadata such as `settlementStatusLabel: '정산 제외' | null`.

- [x] Write failing request-builder tests for default true and explicit false.
- [x] Write failing update-builder tests for toggling included/excluded.
- [x] Write failing display-model tests proving excluded rows remain and get `정산 제외` copy.
- [x] Implement helper signatures and outputs.
- [x] Run `pnpm --filter @i-um/mobile test` until passing.

### Task 5: Mobile UI/controller wiring

**Files:**
- Modify: `apps/mobile/lib/trip-ui/QuickExpenseEntryParts.tsx`
- Modify: `apps/mobile/lib/trip-ui/useQuickExpenseController.ts`
- Modify: `apps/mobile/lib/trip-ui/ExpenseEditScreenParts.tsx`
- Modify: `apps/mobile/lib/trip-ui/useExpenseEditController.ts`
- Modify: `apps/mobile/lib/trip-ui/ExpenseRow.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx`

**Interfaces:**
- Consumes: mobile helper request builders and row labels.
- Produces: user-visible controls and badges.

- [x] Add default-on state `includeInSettlement` in quick expense controller.
- [x] Add default-on state initialized from expense detail in edit controller.
- [x] Add form controls labeled `최종 정산에 포함` with helper copy explaining excluded expenses stay in total/history.
- [x] Add row badge support and pass excluded labels from day/settlement rows.
- [x] Run `pnpm --filter @i-um/mobile typecheck`.

### Task 6: Final verification

**Files:**
- Modify: `.harness/runs/issue-306-settlement-excluded-expenses/artifacts/evaluation-report.md`

- [x] Run `pnpm verify:generated`.
- [x] Run `pnpm --filter @i-um/api test`.
- [x] Run `pnpm --filter @i-um/api build`.
- [x] Run `pnpm --filter @i-um/mobile test`.
- [x] Run `pnpm --filter @i-um/mobile typecheck`.
- [x] Record pass/fail evidence and any gaps.
