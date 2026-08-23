# Feature Slice: 모임 중심 IA 기준 문서

## Metadata

- GitHub Issue: #450
- Parent Epic: #449
- Status: Ready
- Created: 2026-08-22
- Updated: 2026-08-22

## Source

- Issue: #450 — `[모임 전환] 모임 중심 IA 기준 문서`
- Parent: #449 — `[Epic] 모임 중심 일정/정산 구조 전환`
- Brand/design source: `docs/features/0341-chit-brand-design-system.md`
- Notes: This document is the current terminology and IA source of truth for follow-up meeting/event/domain slices.

## Goal

Chit은 **모임의 일정을 관리하고, 지출·정산을 쉽게 끝내며, 지난 일정이 이력으로 남는 앱**으로 전환한다.

Brand sentence remains:

```text
기록은 정확하게, 기억은 다정하게.
```

The product direction is **Event-first + 모임-backed**: users start by creating an event/schedule, and Chit links that event to an existing meeting, a newly saved meeting, or a one-off hidden container.

## Product Principle

Users should not have to understand or maintain a formal group model before making plans.

```text
먼저 일정 만들기
→ 누구와 함께하는지 선택
→ 필요하면 모임으로 저장
→ 일정·장부·정산이 모임의 이력으로 남음
```

This preserves the current lightweight trip creation habit while creating a durable meeting backbone for future group life ledger features.

## Terminology

| Term | User-facing meaning | Product rule | Technical direction |
|---|---|---|---|
| 모임 | 반복되거나 저장된 사람들의 관계 단위. 예: 일본 여행 멤버, 동네 친구들, 커플, 동아리. | `내 모임`에 보인다. 모임 상세에서 예정/지난 일정과 멤버를 본다. | Future `meeting` aggregate. |
| 일정/event | 실제로 날짜와 참여자와 장부가 붙는 실행 단위. | 사용자는 대부분 `일정 만들기`로 시작한다. | Future common `event` aggregate. |
| 여행 | 일정/event의 강한 타입. 장소·기간·일정표·지도·장부·정산 탭을 가진다. | 기존 trip 기능은 유지하되 모임 하위 일정으로 연결한다. | Existing `trip` remains compatible while being linked to an event model. |
| 약속/모임 | 여행보다 가벼운 일정 타입. 당일/짧은 만남, 식사, 데이트, 모임 등을 포괄한다. | MVP 이후 여행이 아닌 event type으로 추가한다. | Future `event.type = outing` or equivalent. |
| 이번만 함께하기 | 사용자에게 저장된 모임으로 보이지 않는 일회성 동행 컨테이너. | 일회성 일정은 `내 모임`에 보이지 않는다. 다만 `다가오는 일정`과 `지난 일정`에는 보인다. | Hidden/ephemeral meeting-backed container or equivalent compatibility layer. |

## IA Direction

Root navigation remains simple.

```text
Root: `홈 / 마이`
```

The root does not add a third bottom tab for meetings.

### Home

Home becomes event-first:

1. `다가오는 일정` — upcoming trips/outing events across all visible and one-off containers.
2. `정산할 일` — unsettled or attention-needed settlement summaries.
3. `내 모임` — saved meetings only.
4. `지난 일정` — recently completed events and trips.

Home may show one-off events in `다가오는 일정` and `지난 일정`, but not in `내 모임`.

### My

My remains the account/settings/profile area. It may include personal settlement summaries, app settings, legal links, and account management, but it is not the primary meeting browser.

### Meeting detail

모임 상세는 일반 상세 페이지이다. It is not a root bottom-nav destination and does not introduce its own bottom tab.

A meeting detail page should show:

- meeting name/identity and members;
- next events/trips;
- active settlement summaries;
- past event history;
- invite/member management entry points.

### Event shell

Event shell tabs appear only after entering an event such as a trip/date/outing.

Travel event shell keeps:

```text
오늘 / 일정 / 지도 / 장부 / 정산
```

Lighter outing/date event shells may later use a smaller set, for example:

```text
일정 또는 오늘 / 장소 / 장부 / 정산
```

This preserves the rule: root is `홈 / 마이`; event work happens inside the event shell.

## Creation Flow

The default creation CTA should move from object-first to event-first.

```text
홈
→ + 만들기
→ 무엇을 할까요?
   - 여행
   - 약속/모임
→ 누구와 함께하나요?
   - 기존 모임
   - 새 모임으로 저장
   - 이번만 함께하기
→ 일정 정보 입력
→ 완료 또는 초대/공유
```

### Existing meeting

Use when the people already belong to a saved meeting. The new event becomes part of that meeting history.

### New meeting

Use when the user wants this group to persist. The app creates/saves a meeting and links the new event to it.

### One-off: 이번만 함께하기

Use when users need a trip or event without creating a visible meeting.

Rules:

- 일회성 일정은 `내 모임`에 보이지 않는다.
- It appears in `다가오는 일정` while active/upcoming.
- It appears in `지난 일정` after completion.
- It can later support `모임으로 저장` as a follow-up feature (#458).

## Route and Screen Principles

These are product/IA principles, not final route names for every future implementation.

| Area | Principle |
|---|---|
| Root | Keep `홈 / 마이`. Do not add `모임` as root bottom navigation by default. |
| Meeting detail | Normal pushed/detail page. It can be opened from Home, search, history, or event context. |
| Event detail/shell | Event-specific tabs only after entering a concrete event. |
| Trip routes | Existing `/trips/*` routes remain compatible until migration slices replace or alias them safely. |
| Future event routes | Introduce explicit event/meeting route helpers before changing public deep links. |
| Naming | User-facing copy should prefer `일정`, `모임`, `장부`, and `정산` where the feature is generalized; keep `여행` where the behavior is specifically trip-only. |

## Compatibility Principles

- Do not rename every `trip` identifier in one sweep.
- API contract changes start in `packages/api-contract/openapi.yaml`.
- DB changes start in `apps/api/migrations/`, generated `apps/api/schema.sql`, and sqlc query sources.
- Existing trips remain first-class travel events during migration.
- Route compatibility should be maintained with helpers/aliases until old links can be retired safely.
- User-visible copy can move toward `일정/event` language before internal table names are fully generalized.
- Settlement and expense math must stay unchanged unless a specific domain issue owns the change.

## MVP Cut

1. #450 — this IA 기준 문서.
2. #451 — meeting and event domain model foundation.
3. #452 — connect existing trips under meeting/event structure.
4. #453 — Home v1 around upcoming events, settlements, and saved meetings.
5. #454 — Event-first trip creation flow.
6. #455 — Meeting detail screen for events and members.
7. #456 — Meeting-level invite/member management.
8. #457 — Event participant selection from meeting members.

## Follow-up Cut

- #458 — Convert one-off event to saved meeting.
- #459 — Non-trip outing/date event MVP.
- #460 — Generalize common expense/settlement model across trip and outing.
- #461 — Legacy trip-centered naming/routes/list cleanup.

## Non-goals

- Building a full calendar app.
- Building a couple-only diary product.
- Adding photos, recaps, memory cards, or retrospective summaries in this MVP foundation slice.
- Replacing every trip API/DB/mobile route at once.
- Introducing API, DB, or mobile behavior changes in #450.

Memory/recap work is a later layer after event history exists.

## Stale terminology search plan

Follow-up implementation slices should search for stale 여행 중심 terminology before changing behavior.

Suggested search groups:

```bash
rg "내 여행|여행 초대|여행 참여자" apps/mobile README.md docs/features/045*.md
rg "event|meeting|모임|일정" docs apps packages
rg "지출|장부|정산" apps/mobile/app apps/mobile/lib
```

Use results as evidence, not as an automatic rename list. In particular:

- Keep `trip` in code where the implementation is still trip-specific.
- Prefer `event` for new shared abstractions.
- Prefer `meeting` for saved group/container domain objects.
- Prefer `장부` in UI where the surface is a ledger, while keeping `지출` for individual expense records/actions.

## Acceptance Criteria

- [x] Document explains Event-first + 모임-backed direction.
- [x] One-off visibility is explicit: hidden from `내 모임`, visible in `다가오는 일정` and `지난 일정`.
- [x] Route/screen principles are explicit for root, meeting detail, event shell, trip compatibility, and future event routes.
- [x] Memory/recap features are documented as follow-up, not MVP.
- [x] Stale terminology search plan is included for follow-up slices.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| IA doc contains required direction, one-off policy, and terminology search plan | Source guard | `apps/mobile/lib/app-info/meeting-centered-ia-doc.test.mts` | `cd apps/mobile && node --import tsx --test lib/app-info/meeting-centered-ia-doc.test.mts` |
| Harness remains valid | Process | `.harness` validation | `pnpm harness:validate` |

## Regression Gaps

- No product UI smoke for this slice because it is docs-only.

## Verification Record

### Automated Regression

- Pending in PR.

### Manual Smoke

- Not applicable; docs-only.

## Release Notes

- Added the canonical meeting-centered IA 기준 문서 for follow-up domain/API/mobile slices.

## Open Questions

- Exact API route names for `meeting` and `event` resources belong to #451.
- Exact mobile Home layout belongs to #453.
- Exact Event-first trip creation screens belong to #454.

## Follow-up Issues

- #451, #452, #453, #454, #455, #456, #457, #458, #459, #460, #461
