import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const newTripScreenSource = readFileSync(new URL('../../app/trips/new.tsx', import.meta.url), 'utf8');

test('successful trip creation redirects Home without rendering a multi-action success screen', () => {
  assert.match(newTripScreenSource, /await createTrip\(\{[\s\S]*?\}\);\n\s+router\.replace\('\/'\);/);
  assert.doesNotMatch(newTripScreenSource, /setCreated|const \[created|여행 상세 보기|마이페이지에서 보기/);
});

test('trip creation wizard keeps destination search inline without an extra screen depth', () => {
  assert.doesNotMatch(
    newTripScreenSource,
    /destinationSearchOpen|DestinationSearchFlow/,
    'destination search should render inside the step card instead of switching to a separate full-screen flow',
  );
  assert.doesNotMatch(newTripScreenSource, />여행 만들기<\/Text>/, 'global create-title header should be removed');
  assert.match(newTripScreenSource, /InlineDestinationSearchPanel/, 'expected an inline destination search panel');
  assert.match(newTripScreenSource, /stepHero/, 'expected the step card to own the prominent step title area');
});
