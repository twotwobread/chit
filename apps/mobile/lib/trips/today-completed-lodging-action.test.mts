import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const todayTabSource = readFileSync(new URL('../../app/trips/[tripId]/(tabs)/today.tsx', import.meta.url), 'utf8');

test('Today completed card keeps itinerary primary action and renders lodging as a secondary action', () => {
  // Given every Today itinerary place is completed,
  // when TodayReadyContent renders the completed state card,
  // then the card keeps the itinerary route as primary and exposes lodging navigation separately.
  assert.doesNotMatch(
    todayTabSource,
    /viewModel\.status === 'emptyItinerary'\s*\|\|\s*viewModel\.status === 'completed'\s*\|\|\s*viewModel\.status === 'recoverNeeded'/,
  );

  const completedCard = todayTabSource.match(
    /viewModel\.status === 'completed' \? \(\s*<Card>[\s\S]*?<\/Card>\s*\) : null/,
  );
  assert.ok(completedCard, 'TodayReadyContent should render a dedicated completed state card');

  const cardSource = completedCard[0];
  assert.match(cardSource, /<PrimaryButton\s+label=\{viewModel\.primaryAction\.label\}/);
  assert.match(cardSource, /<SecondaryButton[\s\S]*label=\{viewModel\.lodgingNavigationAction\.label\}/);
  assert.match(cardSource, /disabled=\{viewModel\.lodgingNavigationAction\.disabled\}/);
  assert.match(cardSource, /viewModel\.lodgingNavigationAction\.action/);
  assert.match(cardSource, /onAction\(viewModel\.lodgingNavigationAction\.action\)/);
  assert.match(cardSource, /viewModel\.lodgingNavigationAction\.helper/);
});
