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

test('main raw-scroll create/edit forms reserve sticky action footer clearance', () => {
  for (const relativePath of [
    'app/trips/new.tsx',
    'app/trips/[tripId]/days/[date]/places/new.tsx',
    'app/trips/[tripId]/days/[date]/expenses/quick.tsx',
    'app/trips/[tripId]/days/[date]/expenses/[expenseId]/edit.tsx',
  ]) {
    const fileSource = source(relativePath);

    assert.match(fileSource, /StickyActionFooter/, `expected ${relativePath} to render StickyActionFooter`);
    assert.match(
      fileSource,
      /keyboardFixedBottomOffset=\{footerLayout\.keyboardFixedBottomOffset\}/,
      `expected ${relativePath} to pass sticky footer offset to KeyboardAwareFormScrollView`,
    );
    assert.match(
      fileSource,
      /keyboardMinClearance=\{footerLayout\.keyboardMinClearance\}/,
      `expected ${relativePath} to pass sticky footer clearance to KeyboardAwareFormScrollView`,
    );
  }
});

test('TripScreen-based flight creation exposes its submit through a sticky footer', () => {
  const flightCreateSource = source('app/trips/[tripId]/flights/new.tsx');

  assert.match(flightCreateSource, /<TripScreen\s+keyboardAware[\s\S]*footer=\{/, 'expected TripScreen footer prop');
  assert.match(flightCreateSource, /footerActionCount=\{1\}/, 'expected single-action footer reservation');
  assert.doesNotMatch(
    flightCreateSource,
    /\{feedback \? <Text style=\{styles\.feedback\}>\{feedback\}<\/Text> : null\}\s*<PrimaryButton/,
    'expected flight save button to be outside the scroll body',
  );
});

test('scrollable bottom sheets support an action footer outside their scroll content', () => {
  const bottomSheetSource = source('lib/trip-ui/BottomSheet.tsx');

  assert.match(bottomSheetSource, /footer\?: ReactNode/, 'expected BottomSheet footer prop');
  assert.match(bottomSheetSource, /StickyActionFooter/, 'expected BottomSheet to render StickyActionFooter');
  assert.match(
    bottomSheetSource,
    /keyboardFixedBottomOffset=\{footer \? footerLayout\.keyboardFixedBottomOffset : undefined\}/,
    'expected BottomSheet scroll view to reserve sticky footer offset only when a footer is present',
  );
});

test('place edit sheet renders save and cancel in the BottomSheet sticky footer', () => {
  const contentSource = source('lib/trip-ui/DayItineraryContent.tsx');
  const editPanelSource = source('lib/trip-ui/EditPlacePanel.tsx');

  assert.match(contentSource, /footer=\{[\s\S]*onCancelEdit[\s\S]*onSubmitEdit/, 'expected edit sheet footer actions');
  assert.match(editPanelSource, /showActions = true/, 'expected EditPlacePanel to support hiding inline actions');
  assert.match(
    editPanelSource,
    /showActions \?/,
    'expected EditPlacePanel actions to be optional for sticky footer sheets',
  );
});

test('expense edit keeps delete out of the save footer in a destructive section', () => {
  const editPartsSource = source('lib/trip-ui/ExpenseEditScreenParts.tsx');

  assert.match(editPartsSource, /destructiveSection/, 'expected a separate destructive delete section');
  assert.match(editPartsSource, /viewModel\.deleteLabel/, 'expected delete label to remain wired to the view model');
});
