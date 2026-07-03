# Contract: staging-deploy

## Purpose

Deploy, smoke-test, or roll back the i-um staging API or Expo internal builds safely.

## Inputs

- User deploy/build/smoke/rollback request.
- `.harness/skills/staging-deploy/SKILL.md` runbook.
- `.harness/policies/rulepacks/staging-deploy.yml`.

## Outputs

- Deployment/build/smoke/rollback command results.
- Safe URLs/build links when shareable.
- Completion report with blockers and skipped steps.

## Done conditions

- Secrets are never printed in chat, git, logs, issues, or PR bodies.
- Long logs are summarized.
- Manual smoke evidence is separated from regression testing.
- Rollback risk is explicit when applicable.
