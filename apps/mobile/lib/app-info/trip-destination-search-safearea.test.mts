import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const newTripSource = readFileSync(new URL('../../app/trips/new.tsx', import.meta.url), 'utf8');

describe('trip destination search safe-area layout', () => {
  it('adds the top safe-area inset to the travel-registration destination search content', () => {
    assert.match(newTripSource, /useSafeAreaInsets/);
    assert.match(newTripSource, /buildDestinationSearchContentTopPadding\(insets\.top\)/);
  });
});
