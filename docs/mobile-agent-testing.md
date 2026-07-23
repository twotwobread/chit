# Mobile agent testing

This repo has a free local smoke path for AI agents and humans to verify the Expo/React Native app with an iOS Simulator. It uses **local Xcode Simulator + Maestro** only. It does not use BrowserStack, Sauce Labs, Appetize, AWS Device Farm, Maestro Cloud, or any other paid device service.

## What the first smoke covers

The initial iOS smoke is intentionally small and stable:

1. Start the mobile app in a local iOS Simulator.
2. Wait for the unauthenticated entry state.
3. Assert `로그인하기` is visible.
4. Tap `로그인하기`.
5. Assert login screen copy such as `칫 Chit` and `로그인하면 바로 이어가요`.

Real Apple/Kakao OAuth, API fixtures, Android emulator coverage, and broad navigation regression flows are out of scope for this first harness.

## Prerequisites

Install local tools:

- Xcode with an iOS Simulator runtime installed.
- pnpm via Corepack:

  ```bash
  corepack enable
  corepack prepare pnpm@9.15.9 --activate
  ```

- Maestro CLI:

  ```bash
  curl -Ls "https://get.maestro.mobile.dev" | bash
  ```

Then confirm tools are visible in your shell:

```bash
xcrun simctl list devices available
pnpm --version
maestro --version
```

## Commands

Run a prerequisite/render check without booting Simulator or running Maestro:

```bash
pnpm mobile:e2e:ios -- --dry-run
```

Run the local iOS smoke:

```bash
pnpm mobile:e2e:ios
```

Use a preferred simulator:

```bash
pnpm mobile:e2e:ios -- --device "iPhone 16"
```

Use another Expo port when `8081` is already occupied:

```bash
pnpm mobile:e2e:ios -- --expo-port 8082
```

Use an installed development build instead of Expo Go:

```bash
MOBILE_E2E_APP_ID=com.twotwobread.ium.staging pnpm mobile:e2e:ios
```

Equivalent explicit flag:

```bash
pnpm mobile:e2e:ios -- --app-id com.twotwobread.ium.staging
```

If an agent or developer has already opened the app manually, skip the Expo start step:

```bash
pnpm mobile:e2e:ios -- --skip-start
```

## Defaults

The default app id is `host.exp.Exponent` for Expo Go. This is the fastest free path for a local smoke. If you use a development build or an installed native app, override the app id with `MOBILE_E2E_APP_ID` or `--app-id`.

The runner starts Expo with safe local smoke env defaults:

- `EXPO_PUBLIC_AUTH_DEV_MODE=true`
- `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080` when not already set
- `EXPO_NO_TELEMETRY=1` when not already set

The first smoke does not require the API server because it stops at the unauthenticated login screen.

## Artifacts

Each run writes local artifacts under:

```text
.artifacts/mobile-e2e/ios-smoke-YYYYMMDD-HHMMSS/
```

Useful files:

- `runner.log`: prerequisite, device, and command summary.
- `expo.log`: Expo CLI output when the runner starts Expo.
- `maestro.log`: Maestro output.
- `ios-smoke.rendered.yaml`: the flow template with the app id filled in.
- `final.png`: final Simulator screenshot when screenshot capture succeeds.

`.artifacts/` is gitignored. Do not commit logs or screenshots.

## Troubleshooting

### `Missing Maestro CLI`

Install Maestro:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Restart the shell if `maestro` is still not found.

### `Missing xcrun/Xcode command line tools`

Install Xcode, open it once, install an iOS Simulator runtime from Xcode Settings > Platforms, then run:

```bash
xcode-select --install
```

### No available iOS Simulator devices

Open Xcode Settings > Platforms and install an iOS runtime. Then confirm:

```bash
xcrun simctl list devices available
```

### Port 8081 is already in use

If another Expo/Metro server is running on port `8081`, choose another port explicitly:

```bash
pnpm mobile:e2e:ios -- --expo-port 8082
```

Do not kill another worktree's Expo server unless you know it is safe.

### Expo Go vs development build app id

The default app id is Expo Go: `host.exp.Exponent`. If Maestro cannot attach to the app, and you are using an installed development build, run with:

```bash
MOBILE_E2E_APP_ID=com.twotwobread.ium.staging pnpm mobile:e2e:ios
```

### Persisted login/session state

The default flow expects a no-session state with `로그인하기`. If the app is already logged in, clear the app state manually or use a fresh Simulator. The first flow does not call Maestro `launchApp` or `clearState` because Expo CLI opens the project URL in Expo Go; launching Expo Go again can return to the Expo Go home screen, and clearing Expo Go can detach the loaded Expo project.

### Local `.env` changes test behavior

This repo may link a local `.env` into worktrees. For mobile helper baseline tests, unset receipt OCR fixture mode to avoid local dev fixture state affecting one test:

```bash
env -u EXPO_PUBLIC_RECEIPT_OCR_MODE pnpm --filter @i-um/mobile test
```

## Extending the harness later

Good next slices:

- Dev-mode login smoke with `EXPO_PUBLIC_AUTH_DEV_MODE=true` and local API fixtures.
- Trip creation smoke after stable auth fixture setup.
- Android emulator smoke with a separate Maestro flow.
- CI-friendly local macOS runner if a macOS CI budget is available.

Keep future flows small and write each as a separate Maestro YAML file under `.maestro/`.
