
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

## Cloud Run deploy gates

- When deploying the current local code and the local branch is ahead of `origin/develop`, do not use a branch trigger that reads remote `develop`; use a direct Cloud Build submit from the intended worktree and record the image tag/short SHA.
- After every Cloud Run API deploy, verify the deployed image tag matches the intended commit, then run `/health` and `/ready` against the deployed service URL.
- If `DATABASE_URL` uses a Cloud SQL Unix socket path (`/cloudsql/...`), verify the Cloud Run service template includes the Cloud SQL instance attachment and the runtime service account has `roles/cloudsql.client` before treating `/ready` failures as app bugs.

## EAS internal build gates

- Before any Expo EAS internal build, run `pnpm --filter @i-um/mobile exec expo install --check`; this is blocking for staging deploys.
- Align every package reported by the Expo SDK compatibility check before starting the EAS build, especially launch-time native modules such as `expo-notifications`, `expo-constants`, and `react-native-keyboard-controller`.
- Do not reuse the same installable platform build number for a new internal build. Increment `expo.ios.buildNumber` for iOS internal builds and `expo.android.versionCode` for Android internal builds.
- Treat EAS build completion and device installation as separate from launch smoke. After install, open the app on a registered physical device and verify it launches past the splash/black screen.
- If an internal build crashes on launch, collect device crash logs before speculative fixes whenever the device is log-accessible. If logs are unavailable, state that root cause is unconfirmed and prioritize Expo SDK/native dependency compatibility checks before rebuilding.

## Completion

Report deploy command result, Cloud Run or EAS status, smoke result, and blockers.
