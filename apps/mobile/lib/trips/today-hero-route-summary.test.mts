import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const heroSource = readFileSync(new URL('../trip-ui/NextPlaceHeroCard.tsx', import.meta.url), 'utf8');

test('Today hero keeps route duration and distance text without rendering a route illustration', () => {
  // Given the Today hero receives a route summary chip with duration/distance text.
  assert.match(heroSource, /routeChip\s*\?\?\s*ROUTE_FALLBACK_COPY/);

  // Then the hero should not render decorative route geometry or a second route handoff surface.
  assert.doesNotMatch(heroSource, /styles\.routeCanvas/);
  assert.doesNotMatch(heroSource, /styles\.routeLine/);
  assert.doesNotMatch(heroSource, /styles\.routeDot/);
  assert.doesNotMatch(heroSource, /routeHandoff/);
});
