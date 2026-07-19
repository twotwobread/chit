import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const notificationRuntimeSource = readFileSync(new URL('../notifications/runtime.ts', import.meta.url), 'utf8');
const pushRegistrationSource = readFileSync(new URL('../notifications/push-registration.ts', import.meta.url), 'utf8');
const pushRegistrationCoreSource = readFileSync(
  new URL('../notifications/push-registration-core.ts', import.meta.url),
  'utf8',
);

describe('notification runtime Expo Go safety', () => {
  it('uses the optional expo-notifications loader for startup routing instead of a direct import', () => {
    assert.match(notificationRuntimeSource, /loadOptionalExpoNotifications/);
    assert.doesNotMatch(notificationRuntimeSource, /import\('expo-notifications'\)/);
  });

  it('keeps expo-notifications import behind a catchable optional loader', () => {
    assert.match(pushRegistrationCoreSource, /export async function loadOptionalExpoNotifications/);
    assert.match(pushRegistrationCoreSource, /catch/);
    assert.match(pushRegistrationCoreSource, /return null/);
  });

  it('uses a static Platform import instead of dynamically importing the react-native namespace', () => {
    assert.match(pushRegistrationSource, /import \{ Platform \} from 'react-native';/);
    assert.doesNotMatch(pushRegistrationSource, /import\('react-native'\)/);
  });
});
