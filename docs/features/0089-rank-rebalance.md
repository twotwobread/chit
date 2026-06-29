# Feature Slice: F-089 일정 순서 rank rebalance 정책

## Metadata

- GitHub Issue: #89
- Status: In Progress
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #89 — https://github.com/twotwobread/i-um/issues/89
- Related Spec: `docs/features/0029-reorder-itinerary.md`
- Ouroboros/PM/Seed:
  - Interview Session: `interview_20260629_131430`
  - Ambiguity Score: `0.0635`
  - Seed: `seed_ff763bcd3073` (MCP-generated; no local repo file emitted)
- Notes: Ouroboros clarified #89 as transparent same-Day rank rebalance inside the existing reorder transaction. Current `develop` ordering source of truth is `schedule_items` scoped by `trip_id + trip_day_id`; this spec ports the original issue wording from `itinerary_items`/`scheduled_date` to the current schema.

## Goal

`schedule_items`의 rank 기반 정렬이 장기적으로 안정적으로 동작하도록, 같은 `trip_id + trip_day_id` 안의 active item rank 공간이 소진되거나 비정상적으로 길어질 때 서버가 안전하게 rank를 재분배한다.

사용자와 모바일 클라이언트는 별도 rebalance API나 UX를 알 필요 없이 기존 순서 변경 저장 흐름을 그대로 사용한다. 성공 시 표시 순서는 의도한 순서로 유지되고, 실패 시 기존 rank/order가 transaction rollback으로 보존된다.

## User Flow

1. 사용자가 Day 일정 화면에서 `순서 변경` 편집 모드로 장소 순서를 바꾸고 `저장`을 누른다.
2. 모바일 앱은 기존 generated client로 reorder 요청을 보낸다. rank 값은 보내지 않는다.
3. 서버는 기존과 동일하게 인증, participant 권한, Day/item/anchor membership, moved item version, anchor adjacency를 검증한다.
4. repository는 하나의 transaction 안에서 대상 `trip_id + trip_day_id` ordering lock을 잡고, active schedule item rows를 rank order로 잠근다.
5. rank 사이에 안전한 새 rank를 만들 수 있으면 기존 reorder 방식대로 move를 적용한다.
6. rank gap 소진, rank 길이 임계치 초과 등 rank-space health 문제가 감지되면 서버는 같은 transaction 안에서 해당 Day의 active item rank를 deterministic하게 재발급한다.
7. 서버는 rebalance 후 pending reorder를 한 번 재시도한다.
8. 성공하면 기존 reorder response shape로 최신 Day schedule items를 반환한다.
9. rebalance/retry 후에도 안전하게 완료할 수 없으면 transaction 전체를 rollback하고 기존 `409 CONFLICT`를 반환한다.

## Scope

- App UI: No changes. Existing reorder UI and conflict copy remain unchanged.
- API Contract: No public OpenAPI schema/path changes. Existing reorder endpoint behavior is extended internally.
- API Server: Same-Day ordering lock, rank rebalance helper, reorder retry integration, append rank allocator guard, conflict mapping.
- DB: No schema migration. Existing `schedule_items.rank`, `version`, active same-Day rank unique index, and rank index are reused.
- Tests: Repository tests for rebalance triggers, deterministic ordering, uniqueness, rollback, version policy, and append guard.
- Deploy/Smoke: No special deploy flow. Optional local API smoke with seeded dense ranks.

## Out of Scope

- New public rebalance API, admin endpoint, cron/background job, or manual operation UI.
- Mobile UI/copy changes for rebalance-specific states.
- Realtime shared edit push/WebSocket/SSE (#46).
- CRDT-based collaborative ordering.
- Place add/update/delete UX changes.
- Changing rank format beyond the existing 19-character decimal policy.
- Removing or renumbering legacy `item_order`.

## Requirements

### UI / UX

- Screens: No changes.
- States: Existing reorder success/conflict/error states remain unchanged.
- Copy: No rebalance-specific user-visible copy.
- Client behavior: mobile continues to use generated client/types and never sends rank values.

### API Contract

No public API changes.

Rebalance-related exhaustion/failure maps to existing `409 CONFLICT`. No new error code, response schema, or client-side branch is introduced.

### DB Changes

No required schema migration.

Existing DB source of truth:

- `schedule_items.rank text COLLATE "C" NOT NULL`
- `schedule_items.version integer NOT NULL DEFAULT 1`
- `schedule_items_active_day_rank_unique ON (trip_day_id, rank) WHERE deleted_at IS NULL`
- `schedule_items_trip_day_rank_idx ON (trip_day_id, rank) WHERE deleted_at IS NULL`

Implementation notes:

- Rebalance updates active `schedule_items.rank` values only.
- Rebalance does not rewrite legacy `item_order`; API display `itemOrder` continues to be computed from rank-ordered query results.
- A transaction-scoped same-Day ordering lock may use PostgreSQL advisory locks or an equivalent repository-level mechanism.

### Rank Rebalance Policy

- Rank is a server-owned positive decimal string sorted under PostgreSQL `COLLATE "C"`.
- Fresh ranks use the existing format:
  - fixed step: `1024`
  - formatted width: `19` decimal digits
  - 1-based position `N` gets rank `N * 1024`, left-padded to 19 characters
- Examples:
  - position 1: `0000000000000001024`
  - position 2: `0000000000000002048`
  - position 3: `0000000000000003072`

Automatic rebalance is attempted for rank-space health failures:

- no integer rank gap exists between selected before/after anchors;
- a newly generated append/move rank would exceed 19 digits;
- an existing active same-Day rank exceeds 19 digits.

The following are not rebalance triggers:

- stale moved item `clientVersion`;
- stale or non-adjacent anchors;
- item/anchor membership validation failure;
- auth, forbidden, or not-found failures;
- malformed/corrupt non-decimal rank data that prevents safe interpretation.

When rebalance runs, it rewrites every active schedule item in the target `trip_id + trip_day_id` set. If rebalance is invoked while applying a validated reorder move, it uses that move's post-validation target display order. Otherwise it uses persisted display order from `rank ASC, id ASC`.

### Retry, Rollback, and Version Policy

- Reorder may perform at most one deterministic rebalance attempt for a rank-space failure in a transaction.
- After rebalance, the pending rank assignment/reorder is retried once.
- If retry cannot preserve uniqueness/order or allocate a valid 19-digit stepped rank, the transaction rolls back and returns `409 CONFLICT`.
- Rebalance spacing rewrites do not increment `version` for rows only touched to refresh rank spacing.
- Each successfully moved item increments `version` once per successful move.
- Append/add keeps default new item `version = 1`.

### Existing Append/Add Rank Allocation

The existing append flow creates ranks at the end of a Day. #89 does not change the public add-place API or UX, but the repository rank allocator should share the same policy guard:

- it must not create a rank longer than 19 digits;
- it must use the same-Day ordering lock when reading current max/order and inserting;
- if append rank allocation would breach the 19-digit policy, it may rebalance the target Day in the same transaction and then append after the refreshed last rank;
- if append still cannot allocate a valid rank, it returns the existing mutation error mapping without partial writes.

## Business Rules

- Only authenticated trip participants can trigger reorder, as defined by existing service validation.
- Rebalance is scoped to one `trip_id + trip_day_id`.
- Mobile clients never generate, inspect, or submit rank values.
- Active same-Day rank uniqueness must hold before transaction commit.
- Successful rebalance must not change user-visible order except for the validated reorder move that triggered it.
- Any rebalance/reorder failure rolls back all rank changes and moved-item version increments from that transaction.
- Rebalance-specific failures use existing reorder conflict semantics; no client migration is required.

## Acceptance Criteria

- [x] AC-01: Reorder automatically attempts same-Day rank rebalance when rank allocation fails because no integer gap exists between anchors.
- [x] AC-02: Rebalance is also attempted when a candidate rank or existing same-Day rank exceeds the 19-digit policy.
- [x] AC-03: Rebalance rewrites all target-Day active ranks deterministically as `position * 1024`, left-padded to 19 decimal digits.
- [x] AC-04: Rebalance preserves current display order for pure spacing refresh and uses the validated target order when invoked by a reorder move.
- [x] AC-05: Active same-Day `(trip_day_id, rank)` uniqueness is preserved after successful rebalance.
- [x] AC-06: Successful rebalance followed by reorder returns the existing reorder response shape with items sorted by rank.
- [x] AC-07: Spacing-only rank rewrites do not increment `version`; moved items still increment per successful reorder move.
- [x] AC-08: If rebalance/retry still cannot allocate a valid rank or uniqueness fails, the transaction rolls back and returns existing `409 CONFLICT`.
- [x] AC-09: Stale moved item version, stale anchors, membership validation failures, auth failures, forbidden, and not-found errors do not trigger rebalance and keep existing mappings.
- [x] AC-10: Existing append/add rank allocation cannot persist ranks longer than 19 digits and shares the same-Day ordering lock/allocator policy.
- [x] AC-11: Same-Day ordering mutations that can interleave with rebalance use the same transaction-scoped ordering lock or equivalent serialization mechanism.
- [x] AC-12: No OpenAPI path/schema/error-code changes are required for #89.
- [x] AC-13: Failure during deterministic full rewrite preserves prior rank/order and does not expose partial intermediate state.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-01, AC-03, AC-04, AC-05: no-gap reorder triggers full rebalance and preserves target order/unique ranks | Repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-02, AC-08: rank length > 19 triggers rebalance; post-rebalance failure maps to conflict/rollback | Repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-07: moved item versions increment, spacing-only rows keep version | Repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-10: append/add rank allocator shares threshold guard and does not persist >19-digit rank | Repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-12: no OpenAPI/generated drift | Contract | generated artifacts | `pnpm verify:generated` |
| All ACs: API build remains green | API | API package | `pnpm --filter @i-um/api build` |

## Regression Gaps

- True concurrent transaction interleavings are not fully stress-tested.
  - Risk: an insert/delete race against rebalance could pass unit tests but fail under production timing.
  - Follow-up: add two-connection transaction-barrier integration coverage if ordering lock regressions are observed.

## TDD Implementation Plan

1. Add repository tests for dense ranks, over-width ranks, rollback on rewrite failure, and append threshold guard.
2. Extract rank policy constants/helpers for step `1024`, width `19`, and deterministic rewrite sequence.
3. Add same-Day ordering transaction lock helper.
4. Integrate rebalance/retry into reorder flow.
5. Integrate append rank allocator guard.
6. Verify API test/build/lint/format gates.

## Verification Record

### Automated Regression

- `DATABASE_URL= pnpm --filter @i-um/api test`: pass — storage integration tests skipped, API packages compile and unit tests pass.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium_f089_rank_rebalance_test?sslmode=disable pnpm --filter @i-um/api db:migrate && pnpm --filter @i-um/api test`: pass — fresh temporary DB migrated through 00014; storage integration tests including #89 pass. Temporary DB dropped after the run.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/api lint`: pass.
- `pnpm --filter @i-um/api format:check`: pass.
- `pnpm verify:generated`: fail — `openapi` CLI is not installed because `node_modules` is missing in this worktree; no generated file diff was left behind.

### Manual Smoke

- Local seeded dense-rank API smoke: covered by repository integration tests.
- Staging/internal smoke: not run.

## Release Notes

```text
- 일정 순서 저장 중 rank 공간이 부족해져도 서버가 같은 Day의 rank를 자동으로 재분배해 기존 순서 변경 API와 사용자 경험을 유지합니다.
- 재분배는 transaction 안에서 처리되며, 실패 시 기존 순서와 rank가 보존됩니다.
```

## Open Questions

None for implementation.

## Follow-up Issues

- #46: 공동 일정 편집 반영. 화면을 보고 있는 중 타인의 일정 변경을 감지/안내/refetch하는 UX를 다룬다.
