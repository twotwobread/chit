# 0391 Mobile visual and accessibility smoke system

## Metadata

- GitHub Issue: #391
- Status: Approved implementation source of truth
- Created: 2026-07-20
- Scope type: Mobile QA foundation

## Goal

Chit mobile UI changes must leave a reusable visual/accessibility smoke trail instead of ad hoc manual notes. This slice introduces a lightweight verification surface that works without adding a heavy E2E dependency: a reusable smoke checklist, a reproducible contrast audit command, and a consistent PR completion recording format.

## Smoke flows

| Flow | Required states | Minimum checks |
| --- | --- | --- |
| Login | idle, loading, provider failure | provider buttons disabled/loading, error copy visible, safe-area spacing |
| Home active/empty/error | active trip, empty list, retryable failure | loading/empty/error state copy, recovery action, stale content if available |
| Trip Today + tab navigation | Today ready/loading/error, tab switch | route summary readability, selected tab state, Android back/iOS swipe behavior |
| New trip wizard | destination search, validation error, submit | visible labels, helper/error copy, keyboard clearance, loading submit state |
| Expense add/edit + settlement summary | amount entry, split options, settlement list | numeric keyboard, first error focus/announce, amount wrapping, recovery state |
| Map search + bottom sheet | query, no result, result select, marker select, location denied | sheet handle affordance, selected state not color-only, permission recovery copy |

## Contrast audit

Run the mobile token contrast audit before PR completion when UI text/action colors change:

```bash
pnpm --filter @i-um/mobile contrast:audit
```

The command checks representative Chit token pairs for primary text, secondary text, shell text, primary CTA text, graphite action text, and accent-soft text. It is intentionally token-level rather than screenshot-based so it remains fast and deterministic in local and CI environments.

## PR completion recording

Every mobile UI PR should include the following fields in the PR body or completion report:

```md
Automated coverage:
- <test/typecheck/lint/context-bound/contrast commands>

Manual smoke:
- Android smoke: pass/fail/not run — <device/profile and flows>
- iOS smoke: pass/fail/not run — <device/profile and flows>

Visual/device gap:
- <none, or exact unverified platform/profile/flow>
```

## Definition of done for this QA slice

- A reusable smoke checklist exists for the core mobile flows.
- `pnpm --filter @i-um/mobile contrast:audit` provides a reproducible color-contrast audit command.
- PR/completion reports have a consistent place to record Android/iOS smoke status and visual/device gaps.
- Heavy E2E automation remains out of scope for this slice and can be evaluated later if manual smoke gaps remain high.
