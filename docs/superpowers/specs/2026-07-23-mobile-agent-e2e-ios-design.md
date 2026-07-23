# Mobile Agent E2E iOS Smoke Design

## Goal

Create a free, local testing path that an AI agent can run to verify the Expo/React Native mobile app through iOS Simulator automation. The first target is a stable smoke check, not full product E2E coverage.

## Chosen approach

Use **Maestro + local iOS Simulator**.

- Free: no BrowserStack, Sauce Labs, Appetize, AWS Device Farm, or Maestro Cloud dependency.
- Agent-friendly: flows are declarative YAML and terminal output is easy for an agent to inspect.
- Expo/RN-friendly: suitable for launch, tap, assert-visible, screenshot, and smoke-level navigation checks.

## Initial smoke behavior

The first smoke flow verifies the unauthenticated path:

1. Launch the app in an iOS Simulator.
2. Confirm the no-session entry state exposes `로그인하기`.
3. Tap `로그인하기`.
4. Confirm login screen copy such as `칫 Chit` or `로그인하면 바로 이어가요`.

This deliberately avoids real Apple/Kakao OAuth because that requires native provider setup, secrets, and external accounts. Dev-mode login/API-backed flows can be added later after a stable local fixture path exists.

## Components

- `.maestro/ios-smoke.yaml`: declarative Maestro flow for the first app smoke.
- `scripts/mobile-e2e-ios.mjs`: agent-friendly runner that checks prerequisites, starts the app if needed, runs Maestro, and writes artifacts.
- Package script: a single command such as `pnpm mobile:e2e:ios`.
- `docs/mobile-agent-testing.md`: setup/run/troubleshooting guide for humans and agents.

## Error handling and artifacts

The runner should fail with clear messages when required tools are missing:

- Xcode command line tools / iOS Simulator unavailable.
- No bootable iOS simulator runtime.
- Maestro CLI missing.
- Expo/mobile app command fails.

On failure, the runner should preserve useful local artifacts, for example logs and a final screenshot when possible. Generated artifacts should be ignored by git.

## Test plan

- Verify the existing mobile helper baseline with `env -u EXPO_PUBLIC_RECEIPT_OCR_MODE pnpm --filter @i-um/mobile test` because the local `.env` can enable receipt OCR fixture mode and affect one baseline test.
- Add a script dry-run/self-test path where practical to cover prerequisite reporting without needing to boot Simulator.
- Run lint/typecheck after implementation.
- Run the actual Maestro smoke when local Xcode Simulator and Maestro are installed; otherwise document that environment gap explicitly.

## Out of scope

- Paid cloud device services.
- Android emulator support.
- Real OAuth login automation.
- API/database fixture orchestration.
- Broad app navigation regression suite.

## Review notes

This is intentionally a small first slice. Once stable, deeper flows can add dev-mode auth, API fixture setup, trip creation, and Android coverage.
