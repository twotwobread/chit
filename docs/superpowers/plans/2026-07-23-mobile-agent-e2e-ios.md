# Mobile Agent E2E iOS Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free local iOS Simulator + Maestro smoke harness that an AI agent can run from one repo command.

**Architecture:** A small Node runner owns environment checks, Simulator orchestration, Expo launch, Maestro execution, and artifact capture. A declarative Maestro YAML flow owns the UI assertions. Docs explain the free/local path and how to extend it later.

**Tech Stack:** Node.js built-ins, pnpm, Expo CLI via existing mobile scripts, Xcode `xcrun simctl`, Maestro YAML.

## Global Constraints

- Use local iOS Simulator + Maestro only; do not add paid cloud services.
- Initial smoke covers unauthenticated launch/login entry only.
- Do not automate real Apple/Kakao OAuth in this pass.
- Do not add Android emulator support in this pass.
- Do not commit local artifacts, logs, screenshots, secrets, or `.env` values.
- Default app id is Expo Go (`host.exp.Exponent`); development builds can override with `--app-id` or `MOBILE_E2E_APP_ID`.

---

### Task 1: Runner helper tests and pure helpers

**Files:**

- Create: `scripts/mobile-e2e-ios.test.mjs`
- Create: `scripts/mobile-e2e-ios.mjs`

**Interfaces:**

- Produces:
  - `parseArgs(argv: string[]): RunnerOptions`
  - `createArtifactDirName(date: Date): string`
  - `selectSimulatorDevice(simctlJson: string, preferredName?: string): SimulatorDevice | null`
  - `renderMaestroFlow(template: string, appId: string): string`
  - `formatMissingToolMessage(tool: string): string`

- [ ] **Step 1: Write the failing test**

Create `scripts/mobile-e2e-ios.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createArtifactDirName,
  formatMissingToolMessage,
  parseArgs,
  renderMaestroFlow,
  selectSimulatorDevice,
} from './mobile-e2e-ios.mjs';

test('parseArgs applies safe local defaults and supports overrides', () => {
  const options = parseArgs([
    '--app-id',
    'com.twotwobread.ium.staging',
    '--device',
    'iPhone 15',
    '--skip-start',
    '--dry-run',
    '--artifacts-dir',
    '.artifacts/custom',
  ]);

  assert.equal(options.appId, 'com.twotwobread.ium.staging');
  assert.equal(options.deviceName, 'iPhone 15');
  assert.equal(options.skipStart, true);
  assert.equal(options.dryRun, true);
  assert.equal(options.artifactsDir, '.artifacts/custom');
});

test('parseArgs defaults to Expo Go app id and generated artifact dir', () => {
  const options = parseArgs([]);

  assert.equal(options.appId, 'host.exp.Exponent');
  assert.equal(options.flowPath, '.maestro/ios-smoke.yaml');
  assert.match(options.artifactsDir, /^\.artifacts\/mobile-e2e\/ios-smoke-\d{8}-\d{6}$/);
});

test('createArtifactDirName is stable and filesystem-safe', () => {
  assert.equal(createArtifactDirName(new Date('2026-07-23T04:05:06Z')), 'ios-smoke-20260723-040506');
});

test('selectSimulatorDevice prefers booted devices before named available devices', () => {
  const simctlJson = JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [
        { name: 'iPhone 15', udid: 'A', state: 'Shutdown', isAvailable: true },
        { name: 'iPhone 16', udid: 'B', state: 'Booted', isAvailable: true },
      ],
    },
  });

  assert.deepEqual(selectSimulatorDevice(simctlJson, 'iPhone 15'), {
    name: 'iPhone 16',
    udid: 'B',
    state: 'Booted',
  });
});

test('selectSimulatorDevice returns preferred available shutdown device when none are booted', () => {
  const simctlJson = JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [
        { name: 'iPhone 14', udid: 'A', state: 'Shutdown', isAvailable: true },
        { name: 'iPhone 15', udid: 'B', state: 'Shutdown', isAvailable: true },
      ],
    },
  });

  assert.deepEqual(selectSimulatorDevice(simctlJson, 'iPhone 15'), {
    name: 'iPhone 15',
    udid: 'B',
    state: 'Shutdown',
  });
});

test('renderMaestroFlow replaces only the APP_ID placeholder', () => {
  const rendered = renderMaestroFlow('appId: ${APP_ID}\n---\n- assertVisible: "로그인하기"\n', 'host.exp.Exponent');

  assert.equal(rendered, 'appId: host.exp.Exponent\n---\n- assertVisible: "로그인하기"\n');
});

test('formatMissingToolMessage includes install guidance for known tools', () => {
  assert.match(formatMissingToolMessage('maestro'), /curl -Ls "https:\/\/get\.maestro\.mobile\.dev" \| bash/);
  assert.match(formatMissingToolMessage('xcrun'), /Xcode/);
  assert.match(formatMissingToolMessage('pnpm'), /corepack/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test scripts/mobile-e2e-ios.test.mjs
```

Expected: FAIL with module-not-found for `scripts/mobile-e2e-ios.mjs`.

- [ ] **Step 3: Write minimal helper implementation**

Create `scripts/mobile-e2e-ios.mjs` with exported helper functions first. Keep CLI `main()` stubbed until Task 2.

- [ ] **Step 4: Run test to verify helpers pass**

Run:

```bash
node --test scripts/mobile-e2e-ios.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/mobile-e2e-ios.mjs scripts/mobile-e2e-ios.test.mjs
git commit -m "test: add mobile e2e runner helpers"
```

### Task 2: Runner CLI behavior

**Files:**

- Modify: `scripts/mobile-e2e-ios.mjs`
- Modify: `scripts/mobile-e2e-ios.test.mjs`

**Interfaces:**

- Consumes: Task 1 helper exports.
- Produces: CLI command `node scripts/mobile-e2e-ios.mjs [--dry-run] [--skip-start] [--app-id <id>] [--device <name>] [--artifacts-dir <path>]`.

- [ ] **Step 1: Add CLI tests for dry-run planning helpers**

Extend `scripts/mobile-e2e-ios.test.mjs` with tests for `buildRunSummary(options, device)` and `buildExpoEnv(baseEnv)`:

```js
import { buildExpoEnv, buildRunSummary } from './mobile-e2e-ios.mjs';

test('buildExpoEnv enables safe local auth dev mode without mutating input', () => {
  const input = { EXPO_PUBLIC_AUTH_DEV_MODE: 'false', KEEP: 'value' };
  const output = buildExpoEnv(input);

  assert.equal(input.EXPO_PUBLIC_AUTH_DEV_MODE, 'false');
  assert.equal(output.EXPO_PUBLIC_AUTH_DEV_MODE, 'true');
  assert.equal(output.EXPO_PUBLIC_API_BASE_URL, 'http://localhost:8080');
  assert.equal(output.KEEP, 'value');
});

test('buildRunSummary records local/free smoke settings', () => {
  const summary = buildRunSummary(
    { appId: 'host.exp.Exponent', dryRun: true, skipStart: false, flowPath: '.maestro/ios-smoke.yaml' },
    { name: 'iPhone 16', udid: 'B', state: 'Booted' },
  );

  assert.match(summary, /local iOS Simulator/);
  assert.match(summary, /host\.exp\.Exponent/);
  assert.match(summary, /iPhone 16/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test scripts/mobile-e2e-ios.test.mjs
```

Expected: FAIL because `buildExpoEnv` and `buildRunSummary` are not exported.

- [ ] **Step 3: Implement CLI and helper exports**

Implement:

- command checks via `command -v`,
- simulator discovery via `xcrun simctl list devices available -j`,
- artifact creation with `runner.log`, `expo.log`, `maestro.log`, rendered flow, and `final.png`,
- `--dry-run` path that checks tools/flow/device and reports without booting/running,
- normal path that boots Simulator, starts Expo unless `--skip-start`, runs Maestro, captures screenshot, and exits with Maestro's status.

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test scripts/mobile-e2e-ios.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/mobile-e2e-ios.mjs scripts/mobile-e2e-ios.test.mjs
git commit -m "feat: add mobile e2e ios runner"
```

### Task 3: Maestro flow and root command

**Files:**

- Create: `.maestro/ios-smoke.yaml`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: runner renders `.maestro/ios-smoke.yaml` into the artifact directory.
- Produces: `pnpm mobile:e2e:ios`.

- [ ] **Step 1: Create Maestro flow**

Create `.maestro/ios-smoke.yaml`:

```yaml
appId: ${APP_ID}
---
- extendedWaitUntil:
    visible: '로그인하기'
    timeout: 90000
- tapOn: '로그인하기'
- extendedWaitUntil:
    visible: '칫 Chit'
    timeout: 30000
- assertVisible: '로그인하면 바로 이어가요'
```

- [ ] **Step 2: Add root script**

Modify `package.json` scripts:

```json
"mobile:e2e:ios": "node scripts/mobile-e2e-ios.mjs"
```

- [ ] **Step 3: Ignore local artifacts**

Add this line to `.gitignore` near log/local generated entries:

```gitignore
.artifacts/
```

- [ ] **Step 4: Run package/script checks**

Run:

```bash
node --test scripts/mobile-e2e-ios.test.mjs
pnpm test:deploy
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .maestro/ios-smoke.yaml package.json .gitignore scripts/mobile-e2e-ios.mjs scripts/mobile-e2e-ios.test.mjs
git commit -m "feat: add local ios maestro smoke command"
```

### Task 4: Documentation and verification

**Files:**

- Create: `docs/mobile-agent-testing.md`

**Interfaces:**

- Consumes: `pnpm mobile:e2e:ios`, `.maestro/ios-smoke.yaml`, `.artifacts/mobile-e2e/*`.
- Produces: setup and troubleshooting guide for humans and agents.

- [ ] **Step 1: Write docs**

Create `docs/mobile-agent-testing.md` with sections:

- Overview: local/free, no cloud.
- Prerequisites: Xcode Simulator, pnpm, Maestro.
- Commands:
  - `pnpm mobile:e2e:ios -- --dry-run`
  - `pnpm mobile:e2e:ios`
  - `MOBILE_E2E_APP_ID=com.twotwobread.ium.staging pnpm mobile:e2e:ios`
- Artifacts: `.artifacts/mobile-e2e/ios-smoke-*/runner.log`, `expo.log`, `maestro.log`, `final.png`.
- Troubleshooting: missing Maestro, missing simulator, Expo Go vs development build app id, persisted session, local `.env` caveat.
- Extension points: dev-mode auth, API fixtures, Android later.

- [ ] **Step 2: Run verification**

Run:

```bash
node --test scripts/mobile-e2e-ios.test.mjs
pnpm test:deploy
pnpm --filter @i-um/mobile typecheck
pnpm --filter @i-um/mobile lint
pnpm --filter @i-um/mobile format:check
env -u EXPO_PUBLIC_RECEIPT_OCR_MODE pnpm --filter @i-um/mobile test
```

Expected: PASS.

- [ ] **Step 3: Run local smoke or record environment gap**

Run:

```bash
pnpm mobile:e2e:ios -- --dry-run
pnpm mobile:e2e:ios
```

Expected if tools are installed: dry-run passes; smoke passes and writes artifacts. If Xcode Simulator or Maestro is missing, record the missing tool output in the run ledger and completion report.

- [ ] **Step 4: Commit docs and verification notes**

```bash
git add docs/mobile-agent-testing.md
git commit -m "docs: explain local mobile agent smoke testing"
```

## Self-review

- Spec coverage: AC-01 through AC-05 map to Tasks 2-4. AC-06 maps to Task 4 verification.
- Placeholder scan: no `TBD`, `TODO`, or future-only implementation step remains.
- Type consistency: helper names are declared in Task 1 and reused consistently in later tasks.
