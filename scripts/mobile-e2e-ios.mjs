#!/usr/bin/env node

import process from 'node:process';

export const DEFAULT_APP_ID = 'host.exp.Exponent';
export const DEFAULT_FLOW_PATH = '.maestro/ios-smoke.yaml';
export const DEFAULT_ARTIFACTS_ROOT = '.artifacts/mobile-e2e';
export const DEFAULT_DEVICE_NAMES = ['iPhone 16', 'iPhone 15', 'iPhone 14'];

export function parseArgs(argv, env = process.env, now = new Date()) {
  const options = {
    appId: env.MOBILE_E2E_APP_ID?.trim() || DEFAULT_APP_ID,
    artifactsDir: `${DEFAULT_ARTIFACTS_ROOT}/${createArtifactDirName(now)}`,
    deviceName: env.MOBILE_E2E_DEVICE?.trim() || undefined,
    dryRun: false,
    flowPath: DEFAULT_FLOW_PATH,
    skipStart: false,
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

export async function main() {
  console.error('mobile-e2e-ios runner CLI is not implemented yet.');
  return 2;
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

function pad2(value) {
  return String(value).padStart(2, '0');
}

if (isCliEntrypoint()) {
  const code = await main();
  process.exitCode = code;
}

function isCliEntrypoint() {
  return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
}
