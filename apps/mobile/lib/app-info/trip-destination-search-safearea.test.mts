import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const newTripSource = readFileSync(new URL('../../app/trips/new.tsx', import.meta.url), 'utf8');

describe('trip destination search inline layout', () => {
  it('keeps destination search in the wizard card instead of adding a separate safe-area screen', () => {
    assert.match(newTripSource, /InlineDestinationSearchPanel/);
    assert.doesNotMatch(newTripSource, /useSafeAreaInsets/);
    assert.doesNotMatch(newTripSource, /buildDestinationSearchContentTopPadding\(insets\.top\)/);
  });
});
