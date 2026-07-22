import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const newTripSource = readFileSync(new URL('../../app/trips/new.tsx', import.meta.url), 'utf8');

describe('trip destination search inline layout', () => {
  it('keeps destination search inline while padding the wizard below the top safe area', () => {
    assert.match(newTripSource, /InlineDestinationSearchPanel/);
    assert.match(newTripSource, /useSafeAreaInsets/);
    assert.match(newTripSource, /insets\.top \+ theme\.space\[4\]/);
    assert.doesNotMatch(newTripSource, /buildDestinationSearchContentTopPadding\(insets\.top\)/);
  });
});
