import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentSources = [
  '../design/components.tsx',
  '../design/primitives.tsx',
  '../navigation/BottomMenu.tsx',
  '../navigation/TripTabBar.tsx',
  '../navigation/tab-selection.ts',
  '../trip-ui/AppBar.tsx',
  '../trip-ui/TripScreenScaffold.tsx',
  '../trip-ui/BottomSheet.tsx',
  '../trip-ui/ExpenseRow.tsx',
];

test('Chit foundation components do not introduce raw hex colors outside theme tokens', () => {
  const rawHexPattern = /#[0-9a-fA-F]{3,8}\b/;

  for (const relativePath of componentSources) {
    const source = readMobileSource(relativePath);
    assert.doesNotMatch(source, rawHexPattern, `${relativePath} should use theme tokens instead of raw hex colors`);
  }
});

test('shared primary and secondary buttons use enterprise Chit action hierarchy', () => {
  const source = readMobileSource('../design/components.tsx');

  assert.match(source, /primaryButton:[\s\S]*backgroundColor: theme\.color\.primary/);
  assert.match(source, /primaryButtonText:[\s\S]*color: theme\.color\.onPrimary/);
  assert.match(source, /secondaryButton:[\s\S]*backgroundColor: theme\.color\.surface/);
  assert.match(source, /secondaryButton:[\s\S]*borderColor: theme\.color\.borderDefault/);
  assert.match(source, /secondaryButtonText:[\s\S]*color: theme\.color\.textStrong/);
});

test('selected bottom and trip tab surfaces use Acid fill with on-primary icon and label contrast', () => {
  const tabSelectionSource = readMobileSource('../navigation/tab-selection.ts');
  const bottomMenuSource = readMobileSource('../navigation/BottomMenu.tsx');
  const tripTabBarSource = readMobileSource('../navigation/TripTabBar.tsx');

  assert.match(tabSelectionSource, /backgroundColor: theme\.color\.primary/);
  assert.match(tabSelectionSource, /theme\.shadow\.xs/);
  assert.match(bottomMenuSource, /focused \? theme\.color\.onPrimary : theme\.color\.textFaint/);
  assert.match(bottomMenuSource, /selectedLabel:[\s\S]*color: theme\.color\.onPrimary/);
  assert.match(tripTabBarSource, /focused \? theme\.color\.onPrimary : theme\.color\.textFaint/);
  assert.match(tripTabBarSource, /labelActive:[\s\S]*color: theme\.color\.onPrimary/);
});

test('expense rows keep explicit category icon markers and accessible category labels', () => {
  const source = readMobileSource('../trip-ui/ExpenseRow.tsx');

  assert.match(source, /getExpenseCategoryMarkerMeta\(category\)/);
  assert.match(source, /CATEGORY_ICON\[categoryMeta\.iconName\]/);
  assert.match(source, /accessibilityLabel=\{`\$\{categoryMeta\.label\} 카테고리`\}/);
  assert.match(source, /<CategoryIcon/);
});

test('keyboard-aware forms are backed by the production keyboard controller with Expo Go fallback', () => {
  const source = readMobileSource('../trip-ui/KeyboardAwareFormScrollView.tsx');

  assert.match(source, /require\('react-native-keyboard-controller'\)/);
  assert.match(source, /FallbackKeyboardAwareScrollView/);
  assert.match(source, /bottomOffset=\{keyboardConfig\.keyboardBottomOffset\}/);
  assert.match(source, /disableScrollOnKeyboardHide/);
});

function readMobileSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
