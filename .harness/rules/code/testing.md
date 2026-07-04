# Testing Rule

Use when planning or running tests, or when changed behavior needs regression coverage.

## Principles

- Changed behavior needs automated regression coverage or an explicit gap.
- Manual smoke checks deployment/device/environment wiring; it does not replace tests.
- Write failing tests before implementation when practical.
- Make time, current user, random values, and external API responses injectable.

## Bugfix minimum scenario regression test

Every bugfix needs at least one minimum scenario regression test before implementation when practical.

The test must represent the reported reproduction path, not only an adjacent implementation hypothesis. Use this shape:

```text
Given <reported input/state>
When <reported user action or system trigger>
Then <expected observable behavior>
```

Choose the closest practical test seam:

1. Pure function/helper test when the bug is validation, branching, state gating, formatting, or mapping.
2. Controller/hook/orchestration test when the bug is API-call flow, navigation, mutation sequencing, or side effects.
3. Component, E2E, or manual smoke only when lower-level seams cannot represent the reported behavior.

A test does not satisfy this rule if it only proves a nearby hypothesis while skipping the reported trigger or expected observable behavior.

If no automated scenario test is practical, record an explicit regression gap:

```md
- Minimum scenario regression test: <why not automated>
  - Reported scenario: Given/When/Then
  - Risk: <risk>
  - Follow-up: <issue or plan>
```

## Layer commands

```bash
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

Run only commands relevant to the change first; use broader checks before completion when appropriate.

## Long output

- Redirect long logs to a file.
- Report pass/fail summary.
- On failure, show the command and relevant tail only.

## Regression gap format

```md
- <behavior>: <why not automated>
  - Risk: <risk>
  - Follow-up: <issue or plan>
```
