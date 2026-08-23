# 0461 — Legacy Travel Copy & Route Cleanup

- Issue: #461
- Epic: #449
- Status: Implemented
- Date: 2026-08-23

## Goal

모임 중심 전환 후에도 루트/초대/참여자 표면에 남아 있는 여행 중심 명칭을 정리하고, 유지하는 `/trips/*` compatibility route의 역할과 종료 조건을 문서화한다.

## Scope

### In

- Root/login/My page/Today empty-state copy에서 `내 여행` 중심 표현을 `내 일정` 중심으로 정리한다.
- Legacy trip invite/share copy를 `여행 초대`에서 `일정 초대`로 조정하고, meeting invite는 `모임 초대`를 유지한다.
- Trip participant management copy를 `여행 참여자`에서 `일정 참여자`로 조정한다.
- Mobile route helper tests/documentation에 `/trips/*` compatibility policy를 명시한다.
- README와 current meeting-transition feature docs의 stale travel-app framing을 정리한다.

### Out

- `/trips/*` route removal or deep-link breakage.
- API/DB behavior changes.
- Full rebrand or large visual redesign.
- Historical docs/superpowers plan rewrites where travel wording is intentionally historical.

## Acceptance Criteria

- User-facing root/invite/participant copy no longer says `내 여행`, `여행 초대`, or `여행 참여자` for meeting/event model surfaces.
- `/trips/*` remains available for trip-specific planning behavior and has an explicit compatibility/retirement note.
- Stale-reference search is documented and excludes intentionally trip-specific screens/docs.
- Route helper regression tests pass.
- Mobile typecheck passes.

## Stale Reference Search

Use this focused search for current implementation surfaces:

```sh
rg "내 여행|여행 초대|여행 참여자" apps/mobile README.md docs/features/045*.md docs/features/0461-legacy-travel-cleanup.md
```

Expected remaining hits are this spec’s acceptance criteria/scope text or historical/current feature-doc notes; user-facing mobile source should have none. Trip-specific planning language such as `여행 이름`, `여행 기간`, Day, 숙소, 항공편, and `여행 전체` remains intentional under `/trips/*` until route parity work retires that surface.

## Test Plan

- Add mobile app-info/source tests for legacy copy cleanup and route compatibility policy.
- Update affected helper unit tests for Today empty states, invite share copy, form accessibility, and participant labels.
- Run stale-reference search over mobile sources and README/current feature docs.
- Run `pnpm --filter @i-um/mobile test`, `pnpm --filter @i-um/mobile typecheck`, lint/format/harness gates.
