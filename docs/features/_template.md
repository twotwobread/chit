# Feature Slice: <feature name>

## Metadata

- GitHub Issue: #<number>
- Status: Draft | Spec Review | Ready | In Progress | Staging | Done
- Created: <YYYY-MM-DD>
- Updated: <YYYY-MM-DD>

## Source

- Issue: #<number>
- Ouroboros/PM/Seed: <path or `Not used`>
- Notes: <short source summary>

## Goal

<사용자 관점 목표를 1-2문장으로 작성한다.>

## User Flow

1. <user action>
2. <app/server response>
3. <done state>

## Scope

- App UI: <yes/no + path>
- API Contract: <yes/no + endpoint/schema>
- API Server: <yes/no + handler/service/repository>
- DB: <yes/no + migration/query>
- Tests: <target tests>
- Deploy/Smoke: <needed/not needed>

## Out of Scope

- <excluded item>
- <follow-up issue if known>

## Requirements

### UI / UX

- Screens: <paths>
- States: loading / empty / error / success requirements
- Copy: <user-visible labels/messages>

### API Contract

`No API changes.` or:

```text
METHOD /path
```

Request/response/error schemas are defined in OpenAPI first.

### DB Changes

`No DB changes.` or:

- Migration: <name/intent>
- Tables/constraints/indexes: <summary>
- Queries: <summary>

### Business Rules

- <rule>

## Acceptance Criteria

- [ ] <testable criterion>
- [ ] <testable criterion>

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| <behavior> | <layer> | `<path>` | `<command>` |

## Regression Gaps

- None

If any behavior is not automated:

```text
- <behavior>: <reason>
  - Risk: <risk>
  - Follow-up: #<issue or plan>
```

## TDD Implementation Plan

1. Red: <failing test>
   - Verify: <command>
2. Green: <minimal implementation>
   - Verify: <command>
3. Refactor: <cleanup>
   - Verify: <command>
4. Gate: <final verification command>

## Verification Record

### Automated Regression

- `<command>`: <pass/fail/not run>

### Manual Smoke

- <check>: <pass/fail/not run + reason>

## Release Notes

- <user/team-facing summary>

## Open Questions

- None

## Follow-up Issues

- None
