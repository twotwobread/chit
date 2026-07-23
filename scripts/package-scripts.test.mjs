import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const apiPackageJson = JSON.parse(
  await readFile(new URL('../apps/api/package.json', import.meta.url), 'utf8'),
);

test('api dev script disables cgo for macOS local runs', () => {
  assert.match(apiPackageJson.scripts.dev, /^CGO_ENABLED=0\b/);
});

test('api test script disables cgo for macOS local runs', () => {
  assert.match(apiPackageJson.scripts.test, /^CGO_ENABLED=0\b/);
});
