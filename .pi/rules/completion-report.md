
<!--
GENERATED FILE. DO NOT EDIT.

Source:
.harness/rules/core/completion-report.md

To modify this adapter:
edit the source file, then run:
pnpm harness:sync
-->

# Completion Report Rule

Use at the end of implementation, PR lifecycle, or docs cleanup tasks.

## Format

```md
## Summary
- <what changed>

## Verification
- `<command>`: pass/fail/not run with reason

## Manual Smoke / Deploy
- <result or not applicable>

## Gaps / Risks
- None or <risk/follow-up>

## Notes
- <PR URL, issue link, limitations, or cleanup notes>
```

## Rules

- Separate automated tests from manual smoke.
- Do not paste secrets or full long logs.
- Mention pre-existing unrelated dirty files only if they affect the task.
- For PR lifecycle tasks, include PR URL, CI/check status, and merge result.
