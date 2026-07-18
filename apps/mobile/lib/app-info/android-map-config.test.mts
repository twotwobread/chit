import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appConfigSource = readFileSync(new URL('../../app.config.ts', import.meta.url), 'utf8');

test('wires Android Google Maps SDK env into Expo android config', () => {
  assert.match(appConfigSource, /EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY/);
  assert.match(appConfigSource, /googleMaps:\s*\{/);
  assert.match(appConfigSource, /apiKey:\s*googleMapsAndroidApiKey/);
});
