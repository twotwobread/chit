import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const stateCardSource = readMobileSource('../design/patterns/state-card.tsx');
const componentsSource = readMobileSource('../design/components.tsx');
const indexSource = readMobileSource('../design/index.ts');
const tripScreenScaffoldSource = readMobileSource('../trip-ui/TripScreenScaffold.tsx');

test('Issue 387 shared state primitives include a skeleton placeholder pattern', () => {
  assert.match(stateCardSource, /export function SkeletonCard\b/);
  assert.match(stateCardSource, /accessibilityState=\{\{ busy: true \}\}/);
  assert.match(stateCardSource, /skeletonRow/);
  assert.match(stateCardSource, /theme\.color\.surfaceSunken/);
  assert.match(componentsSource, /SkeletonCard/);
  assert.match(indexSource, /SkeletonCard/);
});

test('Issue 387 TripStateCard maps long loading states to shared skeletons and recovery states', () => {
  assert.match(tripScreenScaffoldSource, /SkeletonCard/);
  assert.match(tripScreenScaffoldSource, /if \(loading\)/);
  assert.match(tripScreenScaffoldSource, /<SkeletonCard[\s\S]*title=\{title\}/);
  assert.doesNotMatch(tripScreenScaffoldSource, /<ActivityIndicator color=\{theme\.color\.primary\}/);
  assert.match(tripScreenScaffoldSource, /primaryAction[\s\S]*loadingLabel/);
});

function readMobileSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
