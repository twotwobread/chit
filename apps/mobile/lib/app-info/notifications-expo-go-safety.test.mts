import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const notificationRuntimeSource = readFileSync(new URL('../notifications/runtime.ts', import.meta.url), 'utf8');
const pushRegistrationSource = readFileSync(new URL('../notifications/push-registration.ts', import.meta.url), 'utf8');

describe('notification runtime Expo Go safety', () => {
  it('uses the optional expo-notifications loader for startup routing instead of a direct import', () => {
    assert.match(notificationRuntimeSource, /loadOptionalExpoNotifications/);
    assert.doesNotMatch(notificationRuntimeSource, /import\('expo-notifications'\)/);
  });

  it('keeps expo-notifications import behind a catchable optional loader', () => {
    assert.match(pushRegistrationSource, /export async function loadOptionalExpoNotifications/);
    assert.match(pushRegistrationSource, /catch/);
    assert.match(pushRegistrationSource, /return null/);
  });
});
