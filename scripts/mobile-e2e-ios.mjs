#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

export const DEFAULT_APP_ID = 'host.exp.Exponent';
export const DEFAULT_FLOW_PATH = '.maestro/ios-smoke.yaml';
export const DEFAULT_ARTIFACTS_ROOT = '.artifacts/mobile-e2e';
export const DEFAULT_DEVICE_NAMES = ['iPhone 16', 'iPhone 15', 'iPhone 14'];
export const DEFAULT_START_WAIT_MS = 90_000;

export function parseArgs(argv, env = process.env, now = new Date()) {
  const options = {
    appId: env.MOBILE_E2E_APP_ID?.trim() || DEFAULT_APP_ID,
    artifactsDir: `${DEFAULT_ARTIFACTS_ROOT}/${createArtifactDirName(now)}`,
    deviceName: env.MOBILE_E2E_DEVICE?.trim() || undefined,
    dryRun: false,
    flowPath: DEFAULT_FLOW_PATH,
    help: false,
    skipStart: false,
    startWaitMs: parsePositiveInt(env.MOBILE_E2E_START_WAIT_MS, DEFAULT_START_WAIT_MS),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--app-id':
        options.appId = readOptionValue(argv, (index += 1), arg);
        break;
      case '--artifacts-dir':
        options.artifactsDir = readOptionValue(argv, (index += 1), arg);
        break;
      case '--device':
        options.deviceName = readOptionValue(argv, (index += 1), arg);
        break;
      case '--flow':
        options.flowPath = readOptionValue(argv, (index += 1), arg);
        break;
      case '--start-wait-ms':
        options.startWaitMs = parsePositiveInt(readOptionValue(argv, (index += 1), arg), DEFAULT_START_WAIT_MS);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-start':
        options.skipStart = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

export function createArtifactDirName(date) {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hour = pad2(date.getUTCHours());
  const minute = pad2(date.getUTCMinutes());
  const second = pad2(date.getUTCSeconds());
  return `ios-smoke-${year}${month}${day}-${hour}${minute}${second}`;
}

export function selectSimulatorDevice(simctlJson, preferredName) {
  const parsed = JSON.parse(simctlJson);
  const devices = Object.values(parsed.devices ?? {})
    .flat()
    .filter((device) => device && device.isAvailable !== false && device.name && device.udid && device.state);

  const booted = devices.find((device) => device.state === 'Booted');
  if (booted) {
    return toSimulatorDevice(booted);
  }

  const preferred = preferredName ? devices.find((device) => device.name === preferredName) : null;
  if (preferred) {
    return toSimulatorDevice(preferred);
  }

  for (const candidateName of DEFAULT_DEVICE_NAMES) {
    const candidate = devices.find((device) => device.name === candidateName);
    if (candidate) {
      return toSimulatorDevice(candidate);
    }
  }

  return devices[0] ? toSimulatorDevice(devices[0]) : null;
}

export function renderMaestroFlow(template, appId) {
  return template.split('${APP_ID}').join(appId);
}

export function formatMissingToolMessage(tool) {
  switch (tool) {
    case 'maestro':
      return 'Missing Maestro CLI. Install it with: curl -Ls "https://get.maestro.mobile.dev" | bash';
    case 'xcrun':
      return 'Missing xcrun/Xcode command line tools. Install Xcode from the App Store, open it once, then run: xcode-select --install';
    case 'pnpm':
      return 'Missing pnpm. Enable it with: corepack enable && corepack prepare pnpm@9.15.9 --activate';
    default:
      return `Missing required tool: ${tool}`;
  }
}

export function buildExpoEnv(baseEnv = process.env) {
  return {
    ...baseEnv,
    EXPO_NO_TELEMETRY: baseEnv.EXPO_NO_TELEMETRY ?? '1',
    EXPO_PUBLIC_API_BASE_URL: baseEnv.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080',
    EXPO_PUBLIC_AUTH_DEV_MODE: 'true',
  };
}

export function buildRunSummary(options, device) {
  return [
    'Mobile iOS smoke: local iOS Simulator + Maestro',
    `appId: ${options.appId}`,
    `flow: ${options.flowPath}`,
    `device: ${device ? `${device.name} (${device.state}, ${device.udid})` : 'not selected'}`,
    `mode: ${options.dryRun ? 'dry-run' : 'run'}`,
    `start Expo: ${options.skipStart ? 'no (--skip-start)' : 'yes'}`,
  ].join('\n');
}

export async function main(argv = process.argv.slice(2), env = process.env, cwd = process.cwd()) {
  let options;
  try {
    options = parseArgs(argv, env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(helpText());
    return 2;
  }

  if (options.help) {
    console.log(helpText());
    return 0;
  }

  const artifactsDir = resolve(cwd, options.artifactsDir);
  mkdirSync(artifactsDir, { recursive: true });
  const logger = createLogger(join(artifactsDir, 'runner.log'));
  logger(`Artifacts: ${artifactsDir}`);

  try {
    assertRequiredTools(['xcrun', 'pnpm', 'maestro'], logger);
    const flowPath = resolve(cwd, options.flowPath);
    if (!existsSync(flowPath)) {
      throw new Error(`Missing Maestro flow: ${options.flowPath}`);
    }

    const device = discoverSimulatorDevice(options.deviceName);
    if (!device) {
      throw new Error('No available iOS Simulator devices found. Install an iOS Simulator runtime in Xcode > Settings > Platforms.');
    }

    const renderedFlowPath = renderFlowFile(flowPath, artifactsDir, options.appId);
    logger(buildRunSummary(options, device));
    logger(`Rendered flow: ${renderedFlowPath}`);

    if (options.dryRun) {
      logger('Dry-run complete. No simulator boot, Expo start, or Maestro execution was performed.');
      console.log(`Dry-run complete. Artifacts: ${artifactsDir}`);
      return 0;
    }

    await bootSimulatorIfNeeded(device, logger);

    let expoProcess = null;
    try {
      if (!options.skipStart) {
        expoProcess = startExpo(cwd, env, join(artifactsDir, 'expo.log'), logger);
        await waitForExpoStartup(expoProcess, options.startWaitMs, logger);
      } else {
        logger('Skipping Expo start because --skip-start was provided.');
      }

      const maestroCode = await runLoggedCommand('maestro', ['test', renderedFlowPath], {
        cwd,
        env: { ...env, APP_ID: options.appId },
        logPath: join(artifactsDir, 'maestro.log'),
        logger,
      });
      await captureScreenshot(device.udid, join(artifactsDir, 'final.png'), logger);
      logger(`Maestro exit code: ${maestroCode}`);
      return maestroCode;
    } finally {
      if (expoProcess) {
        await terminateChild(expoProcess, logger);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger(`ERROR: ${message}`);
    console.error(message);
    console.error(`Artifacts: ${artifactsDir}`);
    return 1;
  }
}

function assertRequiredTools(tools, logger) {
  const missing = tools.filter((tool) => !commandExists(tool));
  if (missing.length === 0) {
    logger(`Required tools found: ${tools.join(', ')}`);
    return;
  }

  const message = missing.map(formatMissingToolMessage).join('\n');
  throw new Error(message);
}

function commandExists(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  return result.status === 0;
}

function discoverSimulatorDevice(preferredName) {
  const result = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { encoding: 'utf8' });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || 'Failed to list iOS Simulator devices with xcrun simctl.');
  }
  return selectSimulatorDevice(result.stdout, preferredName);
}

function renderFlowFile(flowPath, artifactsDir, appId) {
  const template = readFileSync(flowPath, 'utf8');
  const rendered = renderMaestroFlow(template, appId);
  const renderedFlowPath = join(artifactsDir, 'ios-smoke.rendered.yaml');
  writeFileSync(renderedFlowPath, rendered);
  return renderedFlowPath;
}

async function bootSimulatorIfNeeded(device, logger) {
  if (device.state === 'Booted') {
    logger(`Simulator already booted: ${device.name} (${device.udid})`);
    return;
  }

  logger(`Booting simulator: ${device.name} (${device.udid})`);
  const boot = spawnSync('xcrun', ['simctl', 'boot', device.udid], { encoding: 'utf8' });
  if (boot.status !== 0 && !`${boot.stderr}\n${boot.stdout}`.includes('Unable to boot device in current state: Booted')) {
    throw new Error(boot.stderr?.trim() || `Failed to boot simulator ${device.name}.`);
  }

  const bootstatus = spawnSync('xcrun', ['simctl', 'bootstatus', device.udid, '-b'], { encoding: 'utf8' });
  if (bootstatus.status !== 0) {
    throw new Error(bootstatus.stderr?.trim() || `Simulator ${device.name} did not finish booting.`);
  }
}

function startExpo(cwd, env, logPath, logger) {
  logger('Starting Expo iOS command: pnpm --filter @i-um/mobile ios');
  const child = spawn('pnpm', ['--filter', '@i-um/mobile', 'ios'], {
    cwd,
    env: buildExpoEnv(env),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipeChildToLog(child, logPath);
  return child;
}

async function waitForExpoStartup(child, timeoutMs, logger) {
  const readyPatterns = [/Metro waiting/i, /Opening.*iOS/i, /Logs for your project/i, /Press \?/i];
  let buffer = '';

  const ready = new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => {
      cleanup();
      logger(`Expo startup wait timed out after ${timeoutMs}ms; continuing to Maestro because Expo may already be open.`);
      resolveReady(false);
    }, timeoutMs);

    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      if (readyPatterns.some((pattern) => pattern.test(buffer))) {
        cleanup();
        logger('Expo startup output detected.');
        resolveReady(true);
      }
    };

    const onExit = (code) => {
      cleanup();
      rejectReady(new Error(`Expo command exited before smoke test started with code ${code}.`));
    };

    function cleanup() {
      clearTimeout(timer);
      child.stdout?.off('data', onData);
      child.stderr?.off('data', onData);
      child.off('exit', onExit);
    }

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', onExit);
  });

  await ready;
}

async function runLoggedCommand(command, args, { cwd, env, logPath, logger }) {
  logger(`Running: ${command} ${args.join(' ')}`);
  return new Promise((resolveCommand) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    pipeChildToLog(child, logPath);
    child.on('exit', (code) => resolveCommand(code ?? 1));
  });
}

async function captureScreenshot(udid, outputPath, logger) {
  const result = spawnSync('xcrun', ['simctl', 'io', udid, 'screenshot', outputPath], { encoding: 'utf8' });
  if (result.status === 0) {
    logger(`Final screenshot: ${outputPath}`);
    return;
  }
  logger(`Screenshot capture skipped: ${result.stderr?.trim() || result.stdout?.trim() || 'unknown simctl error'}`);
}

async function terminateChild(child, logger) {
  if (child.exitCode !== null || child.killed) {
    return;
  }
  logger('Stopping Expo process.');
  child.kill('SIGTERM');
  await new Promise((resolveTerminate) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGKILL');
      }
      resolveTerminate();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolveTerminate();
    });
  });
}

function pipeChildToLog(child, logPath) {
  child.stdout?.on('data', (chunk) => appendFileSync(logPath, chunk));
  child.stderr?.on('data', (chunk) => appendFileSync(logPath, chunk));
}

function createLogger(logPath) {
  writeFileSync(logPath, '');
  return (message) => {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    appendFileSync(logPath, line);
    console.log(message);
  };
}

function helpText() {
  return `Usage: pnpm mobile:e2e:ios -- [options]\n\nOptions:\n  --app-id <id>             App id for Maestro. Default: ${DEFAULT_APP_ID}\n  --device <name>           Preferred simulator name, e.g. "iPhone 16"\n  --flow <path>             Maestro flow template. Default: ${DEFAULT_FLOW_PATH}\n  --artifacts-dir <path>    Output directory. Default: ${DEFAULT_ARTIFACTS_ROOT}/ios-smoke-<timestamp>\n  --skip-start              Do not run Expo; use an already-open app/dev build\n  --dry-run                 Check tools, render flow, and report without running\n  --start-wait-ms <ms>      Wait for Expo startup output before Maestro. Default: ${DEFAULT_START_WAIT_MS}\n  -h, --help                Show this help\n\nExamples:\n  pnpm mobile:e2e:ios -- --dry-run\n  pnpm mobile:e2e:ios\n  MOBILE_E2E_APP_ID=com.twotwobread.ium.staging pnpm mobile:e2e:ios\n`;
}

function readOptionValue(argv, index, optionName) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function toSimulatorDevice(device) {
  return {
    name: device.name,
    state: device.state,
    udid: device.udid,
  };
}

function parsePositiveInt(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

if (isCliEntrypoint()) {
  const code = await main();
  process.exitCode = code;
}

function isCliEntrypoint() {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}
