import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(currentDir, '../..');

function source(relativePath: string): string {
  return readFileSync(resolve(mobileRoot, relativePath), 'utf8');
}

test('declares native keyboard controller dependency', () => {
  const packageJson = JSON.parse(source('package.json')) as { dependencies?: Record<string, string> };

  assert.ok(
    packageJson.dependencies?.['react-native-keyboard-controller'],
    'expected @i-um/mobile to depend on react-native-keyboard-controller',
  );
});

test('wraps the app root with the shared keyboard controller provider', () => {
  const rootLayout = source('app/_layout.tsx');
  const providerIndex = rootLayout.indexOf('<KeyboardControllerProvider>');
  const stackIndex = rootLayout.indexOf('<Stack screenOptions={rootStackScreenOptions} />');

  assert.match(rootLayout, /KeyboardControllerProvider/, 'expected root layout to import the shared provider');
  assert.notEqual(providerIndex, -1, 'expected root stack to be wrapped by KeyboardControllerProvider');
  assert.ok(providerIndex < stackIndex, 'expected KeyboardControllerProvider to wrap Stack');
});

test('uses the shared keyboard-aware primitive on main raw-scroll form screens', () => {
  for (const relativePath of [
    'app/account.tsx',
    'app/trips/new.tsx',
    'app/trips/[tripId]/edit.tsx',
    'app/trips/[tripId]/days/[date]/places/new.tsx',
    'app/trips/[tripId]/days/[date]/expenses/quick.tsx',
    'app/trips/[tripId]/days/[date]/expenses/[expenseId]/edit.tsx',
    'app/trips/[tripId]/(tabs)/today.tsx',
    'lib/trip-ui/DayItineraryEditor.tsx',
    'lib/trip-ui/BottomSheet.tsx',
  ]) {
    assert.match(
      source(relativePath),
      /KeyboardAwareFormScrollView/,
      `expected ${relativePath} to use KeyboardAwareFormScrollView`,
    );
  }
});

test('opts TripScreen-based flight mutation screens into keyboard-aware scrolling', () => {
  for (const relativePath of ['app/trips/[tripId]/flights/new.tsx', 'app/trips/[tripId]/flights/[flightId].tsx']) {
    assert.match(source(relativePath), /<TripScreen\s+keyboardAware/, `expected ${relativePath} to pass keyboardAware`);
  }
});
