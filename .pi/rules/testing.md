
<!--
GENERATED FILE. DO NOT EDIT.

Source:
.harness/rules/code/testing.md

To modify this adapter:
edit the source file, then run:
pnpm harness:sync
-->

# Testing Rule

Use when planning or running tests, or when changed behavior needs regression coverage.

## Principles

- Changed behavior needs automated regression coverage or an explicit gap.
- Manual smoke checks deployment/device/environment wiring; it does not replace tests.
- Write failing tests before implementation when practical.
- Make time, current user, random values, and external API responses injectable.

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
