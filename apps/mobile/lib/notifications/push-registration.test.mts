import assert from 'node:assert/strict';
import test from 'node:test';

import { ensurePushRegistration, type PushRegistrationDeps } from './push-registration.ts';

test('registers an Expo push token after permission is granted', async () => {
  const calls: string[] = [];
  const deps: PushRegistrationDeps = {
    platform: 'ios',
    createInstallationId: () => 'installation-123',
    getStoredInstallationId: async () => null,
    saveInstallationId: async (id) => calls.push(`save:${id}`),
    getPermissionsAsync: async () => ({ status: 'undetermined' }),
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    getExpoPushTokenAsync: async () => 'ExpoPushToken[xxxxxxxxxxxxxxxxxxxx]',
    registerPushToken: async (request) => {
      calls.push(`${request.installationId}:${request.expoPushToken}:${request.platform}`);
    },
  };

  const result = await ensurePushRegistration(deps);

  assert.deepEqual(result, { status: 'registered', installationId: 'installation-123' });
  assert.deepEqual(calls, ['save:installation-123', 'installation-123:ExpoPushToken[xxxxxxxxxxxxxxxxxxxx]:ios']);
});

test('does not register when permission is denied', async () => {
  let registered = false;
  const result = await ensurePushRegistration({
    platform: 'android',
    createInstallationId: () => 'installation-123',
    getStoredInstallationId: async () => 'installation-123',
    saveInstallationId: async () => undefined,
    getPermissionsAsync: async () => ({ status: 'denied' }),
    requestPermissionsAsync: async () => ({ status: 'denied' }),
    getExpoPushTokenAsync: async () => 'ExpoPushToken[xxxxxxxxxxxxxxxxxxxx]',
    registerPushToken: async () => {
      registered = true;
    },
  });

  assert.deepEqual(result, { status: 'denied' });
  assert.equal(registered, false);
});

test('reports unsupported platforms without requesting permission', async () => {
  let requested = false;
  const result = await ensurePushRegistration({
    platform: 'web',
    createInstallationId: () => 'installation-123',
    getStoredInstallationId: async () => null,
    saveInstallationId: async () => undefined,
    getPermissionsAsync: async () => ({ status: 'undetermined' }),
    requestPermissionsAsync: async () => {
      requested = true;
      return { status: 'granted' };
    },
    getExpoPushTokenAsync: async () => 'ExpoPushToken[xxxxxxxxxxxxxxxxxxxx]',
    registerPushToken: async () => undefined,
  });

  assert.deepEqual(result, { status: 'unsupported' });
  assert.equal(requested, false);
});
