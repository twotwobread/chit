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

function count(sourceText: string, pattern: RegExp): number {
  return sourceText.match(new RegExp(pattern.source, `${pattern.flags.includes('i') ? 'i' : ''}g`))?.length ?? 0;
}

test('issue 400 trip create and edit forms use shared field and choice primitives', () => {
  const createSource = source('app/trips/new.tsx');
  const editSource = source('app/trips/[tripId]/edit.tsx');

  assert.match(
    createSource,
    /import \{[^}]*ChoiceChip[^}]*FormField[^}]*InlineAction[^}]*PrimaryButton[^}]*SecondaryButton[^}]*\} from '\.\.\/\.\.\/lib\/design'/s,
    'trip create should import shared form/choice/action primitives from the design layer',
  );
  assert.ok(
    count(createSource, /<ChoiceChip\b/) >= 2,
    'trip create should render currency and travel-mode choices with ChoiceChip',
  );
  assert.match(
    createSource,
    /<FormField[\s\S]*label="도시 검색"/,
    'trip create destination search should use FormField',
  );
  assert.match(
    createSource,
    /<InlineAction[\s\S]*도시 삭제/,
    'trip create selected destination removal should use InlineAction',
  );
  assert.doesNotMatch(
    createSource,
    /<Pressable[\s\S]{0,500}styles\.optionChip/,
    'trip create should not keep local option chip Pressables',
  );

  assert.match(
    editSource,
    /import \{[^}]*ChoiceChip[^}]*FormField[^}]*PrimaryButton[^}]*SecondaryButton[^}]*\} from '\.\.\/\.\.\/\.\.\/lib\/design'/s,
    'trip edit should import shared form/choice primitives from the design layer',
  );
  assert.ok(
    count(editSource, /<ChoiceChip\b/) >= 2,
    'trip edit should render currency and travel-mode choices with ChoiceChip',
  );
  assert.match(editSource, /<FormField[\s\S]*label="기본 통화"/, 'trip edit currency group should use FormField');
  assert.match(editSource, /<FormField[\s\S]*label="이동 방식"/, 'trip edit travel-mode group should use FormField');
  assert.doesNotMatch(
    editSource,
    /<Pressable[\s\S]{0,500}styles\.currencyChip/,
    'trip edit should not keep local currency chip Pressables',
  );

  for (const fileSource of [createSource, editSource]) {
    assert.match(fileSource, /StickyActionFooter/, 'trip create/edit sticky footer should remain in place');
    assert.match(
      fileSource,
      /KeyboardAwareFormScrollView/,
      'trip create/edit keyboard-aware scroll should remain in place',
    );
  }
});

test('issue 400 expense forms adopt shared form choice and action primitives', () => {
  const sharedPartsSource = source('lib/trip-ui/ExpenseFormSharedParts.tsx');
  const quickSource = source('lib/trip-ui/QuickExpenseForm.tsx');

  assert.match(
    sharedPartsSource,
    /import \{[^}]*ChoiceChip[^}]*FormField[^}]*InlineAction[^}]*PrimaryButton[^}]*SegmentedControl[^}]*\} from '\.\.\/design'/s,
    'shared expense parts should import shared form/choice/action primitives',
  );
  assert.ok(
    count(sharedPartsSource, /<ChoiceChip\b/) >= 4,
    'shared expense parts should replace repeated simple chips with ChoiceChip',
  );
  assert.match(
    sharedPartsSource,
    /<SegmentedControl[\s\S]*SPLIT_POLICY_LABELS/,
    'expense split policy should use shared SegmentedControl',
  );
  assert.match(
    sharedPartsSource,
    /<InlineAction[\s\S]*accessibilityLabel=\{`\$\{title\} 변경`\}/,
    'expense summary rows should use InlineAction',
  );
  assert.doesNotMatch(
    sharedPartsSource,
    /<Pressable[\s\S]{0,500}styles\.modeChip/,
    'expense split mode should not keep local segmented Pressables',
  );

  assert.match(
    quickSource,
    /import \{[^}]*FormField[^}]*InlineAction[^}]*PrimaryButton[^}]*SecondaryButton[^}]*SegmentedControl[^}]*\} from '\.\.\/design'/s,
    'quick expense should import shared form/action primitives',
  );
  assert.match(quickSource, /<FormField[\s\S]*label="금액"/, 'quick expense amount field should use FormField');
  assert.match(
    quickSource,
    /<InlineAction[\s\S]*accessibilityLabel=\{`\$\{title\} 변경`\}/,
    'quick expense summary rows should use InlineAction',
  );
  assert.doesNotMatch(
    quickSource,
    /<Pressable[^>]*style=\{styles\.save\}/,
    'quick expense should not keep local save Pressable buttons',
  );
  assert.doesNotMatch(
    quickSource,
    /<Pressable[^>]*style=\{styles\.cancel\}/,
    'quick expense should not keep local cancel Pressable buttons',
  );
});

test('issue 400 flight create form adopts shared form and choice primitives without dropping keyboard footer wiring', () => {
  const flightSource = source('app/trips/[tripId]/flights/new.tsx');

  assert.match(
    flightSource,
    /import \{[^}]*Card[^}]*ChoiceChip[^}]*FormField[^}]*InlineAction[^}]*PrimaryButton[^}]*\} from '\.\.\/\.\.\/\.\.\/\.\.\/lib\/design'/s,
    'flight create should import shared form/choice/action primitives from the design layer',
  );
  assert.ok(
    count(flightSource, /<ChoiceChip\b/) >= 3,
    'flight create should use ChoiceChip for date/time and time-zone choices',
  );
  assert.match(
    flightSource,
    /<FormField[\s\S]*label="현지 날짜·시간"/,
    'flight create date/time group should use FormField',
  );
  assert.match(
    flightSource,
    /<InlineAction[\s\S]*expanded=\{open\}/,
    'flight time-zone selector should keep expanded state via shared action',
  );
  assert.match(
    flightSource,
    /<TripScreen\s+keyboardAware[\s\S]*footer=\{/,
    'flight create should keep TripScreen keyboard-aware footer wiring',
  );
  assert.match(flightSource, /footerActionCount=\{1\}/, 'flight create should keep single footer action reservation');
});
