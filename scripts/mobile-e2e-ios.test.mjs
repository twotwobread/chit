import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildExpoEnv,
  buildExpoStartCommand,
  buildRunSummary,
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
    '--expo-port',
    '8082',
  ]);

  assert.equal(options.appId, 'com.twotwobread.ium.staging');
  assert.equal(options.deviceName, 'iPhone 15');
  assert.equal(options.skipStart, true);
  assert.equal(options.dryRun, true);
  assert.equal(options.artifactsDir, '.artifacts/custom');
  assert.equal(options.expoPort, 8082);
});

test('parseArgs defaults to Expo Go app id and generated artifact dir', () => {
  const options = parseArgs([]);

  assert.equal(options.appId, 'host.exp.Exponent');
  assert.equal(options.flowPath, '.maestro/ios-smoke.yaml');
  assert.match(options.artifactsDir, /^\.artifacts\/mobile-e2e\/ios-smoke-\d{8}-\d{6}$/);
});

test('parseArgs ignores the pnpm forwarded argument separator', () => {
  const options = parseArgs(['--', '--dry-run']);

  assert.equal(options.dryRun, true);
});

test('createArtifactDirName is stable and filesystem-safe', () => {
  assert.equal(createArtifactDirName(new Date('2026-07-23T04:05:06Z')), 'ios-smoke-20260723-040506');
});

test('selectSimulatorDevice prefers the requested device over an unrelated booted simulator', () => {
  const simctlJson = JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [
        { name: 'iPhone 15', udid: 'A', state: 'Shutdown', isAvailable: true },
        { name: 'iPhone 16', udid: 'B', state: 'Booted', isAvailable: true },
      ],
    },
  });

  assert.deepEqual(selectSimulatorDevice(simctlJson, 'iPhone 15'), {
    name: 'iPhone 15',
    udid: 'A',
    state: 'Shutdown',
  });
});

test('selectSimulatorDevice uses a booted simulator when no preferred device is requested', () => {
  const simctlJson = JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [
        { name: 'iPhone 15', udid: 'A', state: 'Shutdown', isAvailable: true },
        { name: 'iPhone 16', udid: 'B', state: 'Booted', isAvailable: true },
      ],
    },
  });

  assert.deepEqual(selectSimulatorDevice(simctlJson), {
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

test('buildExpoEnv enables safe local auth dev mode without mutating input', () => {
  const input = { EXPO_PUBLIC_AUTH_DEV_MODE: 'false', KEEP: 'value' };
  const output = buildExpoEnv(input);

  assert.equal(input.EXPO_PUBLIC_AUTH_DEV_MODE, 'false');
  assert.equal(output.EXPO_PUBLIC_AUTH_DEV_MODE, 'true');
  assert.equal(output.EXPO_PUBLIC_API_BASE_URL, 'http://localhost:8080');
  assert.equal(output.KEEP, 'value');
});

test('buildExpoStartCommand pins the requested Expo port for non-interactive runs', () => {
  assert.deepEqual(buildExpoStartCommand(8082), [
    '--filter',
    '@i-um/mobile',
    'exec',
    'expo',
    'start',
    '--ios',
    '--port',
    '8082',
  ]);
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

test('ios smoke flow supports both root no-session and already-open login states', () => {
  const flow = readFileSync('.maestro/ios-smoke.yaml', 'utf8');

  assert.doesNotMatch(flow, /launchApp/);
  assert.match(flow, /notVisible: ['"]칫 Chit['"]/);
  assert.match(flow, /visible: ['"]로그인하기['"]/);
  assert.match(flow, /tapOn: ['"]로그인하기['"]/);
});
