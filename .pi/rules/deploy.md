
<!--
GENERATED FILE. DO NOT EDIT.

Source:
.harness/rules/phase/deploy.rules.md

To modify this adapter:
edit the source file, then run:
pnpm harness:sync
-->

# Deploy Rule

Use only when the user asks for staging/internal deploy, build, rollback, or environment smoke checks.

## Sources

- Skill: `/skill:i-um-staging-deploy`

## Rules

- Do not print secrets in chat, git, logs, issues, or PR bodies.
- Prefer command summaries over full logs.
- Record URLs/build links only when they are safe to share.
- Manual smoke is deploy evidence, not regression coverage.

## Completion

Report deploy command result, Cloud Run or EAS status, smoke result, and blockers.
