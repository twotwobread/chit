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

test('scrollable bottom sheets keep a visible sheet height instead of collapsing to only the handle', () => {
  const bottomSheetSource = source('lib/trip-ui/BottomSheet.tsx');

  assert.match(
    bottomSheetSource,
    /scrollable \? styles\.scrollableSheet : null/,
    'expected scrollable BottomSheet to apply a bounded visible height style',
  );
  assert.match(
    bottomSheetSource,
    /scrollableSheet:[\s\S]*height: '86%'/,
    'expected scrollable BottomSheet to reserve visible content height below the handle',
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

test('expense create and edit screens actively scroll only the hidden memo delta into view on focus', () => {
  const quickExpenseScreenSource = source('app/trips/[tripId]/days/[date]/expenses/quick.tsx');
  const expenseEditScreenSource = source('app/trips/[tripId]/days/[date]/expenses/[expenseId]/edit.tsx');
  const quickExpenseFormSource = source('lib/trip-ui/QuickExpenseEntryParts.tsx');
  const expenseEditFormSource = source('lib/trip-ui/ExpenseEditScreenParts.tsx');

  for (const [name, fileSource] of [
    ['quick expense', quickExpenseScreenSource],
    ['expense edit', expenseEditScreenSource],
  ] as const) {
    assert.doesNotMatch(fileSource, /scrollToEnd/, `expected ${name} screen not to launch to the scroll end`);
    assert.match(
      fileSource,
      /buildFocusedMemoScrollTarget/,
      `expected ${name} screen to calculate the hidden memo delta`,
    );
    assert.match(
      fileSource,
      /scrollTo\(\{ y: target\.targetY, animated: true \}\)/,
      `expected ${name} screen to scroll only to the calculated target`,
    );
  }
  assert.match(
    quickExpenseFormSource,
    /onMemoFocus\?: \(\) => void/,
    'expected quick expense form to accept a memo-focus scroll callback',
  );
  assert.match(
    quickExpenseFormSource,
    /onMemoLayout\?: \(layout: \{ height: number; y: number \}\) => void/,
    'expected quick expense form to report the memo container layout',
  );
  assert.match(
    quickExpenseFormSource,
    /onFocus=\{onMemoFocus\}/,
    'expected quick expense memo TextInput to invoke the memo-focus scroll callback',
  );
  assert.match(
    expenseEditFormSource,
    /onMemoFocus\?: \(\) => void/,
    'expected expense edit form to accept a memo-focus scroll callback',
  );
  assert.match(
    expenseEditFormSource,
    /onMemoLayout\?: \(layout: \{ height: number; y: number \}\) => void/,
    'expected expense edit form to report the memo container layout',
  );
  assert.match(
    expenseEditFormSource,
    /onFocus=\{onMemoFocus\}/,
    'expected expense edit memo TextInput to invoke the memo-focus scroll callback',
  );
});

test('expense create and edit screens reserve memo-height keyboard clearance when the memo field is focused', () => {
  const quickExpenseScreenSource = source('app/trips/[tripId]/days/[date]/expenses/quick.tsx');
  const expenseEditScreenSource = source('app/trips/[tripId]/days/[date]/expenses/[expenseId]/edit.tsx');
  const stylesSource = source('lib/trip-ui/QuickExpenseEntryStyles.ts');

  for (const [name, fileSource] of [
    ['quick expense', quickExpenseScreenSource],
    ['expense edit', expenseEditScreenSource],
  ] as const) {
    assert.match(
      fileSource,
      /QUICK_EXPENSE_MEMO_KEYBOARD_MIN_CLEARANCE/,
      `expected ${name} screen to use a memo-specific keyboard clearance`,
    );
    assert.match(
      fileSource,
      /minClearance: QUICK_EXPENSE_MEMO_KEYBOARD_MIN_CLEARANCE/,
      `expected ${name} sticky footer layout to reserve the full memo field above the keyboard`,
    );
  }
  assert.match(
    stylesSource,
    /QUICK_EXPENSE_MEMO_INPUT_MIN_HEIGHT/,
    'expected quick expense memo style to use the same memo-height constant as keyboard clearance',
  );
});

test('place edit sheet includes read-only place name and address context above editable fields', () => {
  const editPanelSource = source('lib/trip-ui/EditPlacePanel.tsx');

  assert.match(
    editPanelSource,
    /buildDayItineraryEditPlaceSummary/,
    'expected edit sheet to build read-only place context from the selected item',
  );
  assert.match(editPanelSource, />장소명</, 'expected edit sheet to label the place name as read-only context');
  assert.match(editPanelSource, />주소</, 'expected edit sheet to label the address as read-only context');
  assert.match(editPanelSource, /placeSummary\.placeName/, 'expected edit sheet to render the selected place name');
  assert.match(editPanelSource, /placeSummary\.address/, 'expected edit sheet to render the selected place address');
});

test('place edit sheet uses a multiline-height memo input instead of a one-line control', () => {
  const stylesSource = source('lib/trip-ui/DayItineraryEditorStyles.ts');

  assert.match(
    stylesSource,
    /DAY_ITINERARY_EDIT_MEMO_INPUT_MIN_HEIGHT/,
    'expected edit memo input style to use the shared memo-height constant',
  );
});

test('place edit sheet reserves memo-height keyboard clearance when save and cancel are sticky', () => {
  const bottomSheetSource = source('lib/trip-ui/BottomSheet.tsx');
  const contentSource = source('lib/trip-ui/DayItineraryContent.tsx');

  assert.match(
    bottomSheetSource,
    /footerKeyboardMinClearance\?: number/,
    'expected BottomSheet to expose a focused-control clearance override',
  );
  assert.match(
    bottomSheetSource,
    /minClearance: footerKeyboardMinClearance/,
    'expected BottomSheet footer layout to use the clearance override',
  );
  assert.match(
    contentSource,
    /footerKeyboardMinClearance=\{DAY_ITINERARY_EDIT_SHEET_KEYBOARD_MIN_CLEARANCE\}/,
    'expected place edit sheet to reserve enough keyboard clearance for the full memo input',
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
