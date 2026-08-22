import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../../../../${relativePath}`, import.meta.url), 'utf8');

test('trip event linkage keeps trip routes canonical while exposing event context in API contract', () => {
  const openapi = readRepoFile('packages/api-contract/openapi.yaml');
  const routes = readRepoFile('apps/mobile/lib/trips/routes.ts');

  assert.match(openapi, /TripEventContext:/);
  assert.match(openapi, /eventContext:/);
  assert.match(openapi, /\/trips\/{tripId}:/);
  assert.match(routes, /\/trips\/\$\{tripId\}/);
  assert.doesNotMatch(routes, /\/events\/\$\{eventId\}\/\(tabs\)/);
});
