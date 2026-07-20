import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const expensesSource = readMobileSource('../../app/trips/[tripId]/(tabs)/expenses.tsx');
const mapControllerSource = readMobileSource('../trip-ui/useTripMapController.ts');
const tabBarSource = readMobileSource('../navigation/TripTabBar.tsx');
const featureDocSource = readRepoSource('../../../../docs/features/0390-trip-state-preservation.md');

test('Issue 390 Expenses tab promotes sub-mode and filter state to route params', () => {
  assert.match(expensesSource, /resolveTripExpensesRouteState/);
  assert.match(expensesSource, /tripExpensesStatePath/);
  assert.match(expensesSource, /router\.replace\(tripExpensesStatePath\(tripId/);
  assert.doesNotMatch(expensesSource, /const \[mode, setMode\] = useState/);
  assert.doesNotMatch(expensesSource, /const \[selectedDayId, setSelectedDayId\] = useState/);
  assert.doesNotMatch(expensesSource, /const \[selectedCategory, setSelectedCategory\] = useState/);
});

test('Issue 390 Map tab restores route layer state from route params without persisting search input', () => {
  assert.match(mapControllerSource, /routeDays: routeDaysParam/);
  assert.match(mapControllerSource, /parseTripMapRouteDayIdsParam\(routeDaysParam\)/);
  assert.match(mapControllerSource, /tripMapStatePath\(tripId/);
  assert.doesNotMatch(mapControllerSource, /query: queryParam/);
  assert.doesNotMatch(mapControllerSource, /selectedSheetTab: selectedSheetTabParam/);
});

test('Issue 390 tab navigation preserves known tab route params', () => {
  assert.match(tabBarSource, /params\?: Readonly<object>/);
  assert.match(tabBarSource, /router\.replace\([\s\S]*tripTabPathWithState\(tripId, route\.name, route\.params/);
});

test('Issue 390 state preservation policy is documented with manual smoke coverage', () => {
  assert.match(featureDocSource, /Expenses `mode`/);
  assert.match(featureDocSource, /Map `routeDays`/);
  assert.match(featureDocSource, /search query|검색어/);
  assert.match(featureDocSource, /Android back gesture/);
  assert.match(featureDocSource, /iOS swipe-back/);
});

function readMobileSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function readRepoSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
