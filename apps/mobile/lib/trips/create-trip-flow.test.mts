import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const newTripScreenSource = readFileSync(new URL('../../app/trips/new.tsx', import.meta.url), 'utf8');

test('successful trip creation redirects Home without rendering a multi-action success screen', () => {
  assert.match(newTripScreenSource, /await createTrip\(\{[\s\S]*?\}\);\n\s+router\.replace\('\/'\);/);
  assert.doesNotMatch(newTripScreenSource, /setCreated|const \[created|여행 상세 보기|마이페이지에서 보기/);
});
