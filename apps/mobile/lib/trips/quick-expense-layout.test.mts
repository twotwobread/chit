import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const quickExpenseFormSource = readFileSync(resolve(currentDir, '../trip-ui/QuickExpenseForm.tsx'), 'utf8');

test('renders Today quick expense amount input before the currency unit', () => {
  const amountFieldStart = quickExpenseFormSource.indexOf('<View style={styles.amountField}>');
  assert.notEqual(amountFieldStart, -1, 'expected QuickExpenseForm to render an amount field');

  const amountFieldEnd = quickExpenseFormSource.indexOf('</View>', amountFieldStart);
  const amountFieldSource = quickExpenseFormSource.slice(amountFieldStart, amountFieldEnd);
  const inputIndex = amountFieldSource.indexOf('<TextInput');
  const currencyLabelIndex = amountFieldSource.indexOf('<Text style={styles.currencyLabel}>');

  assert.notEqual(inputIndex, -1, 'expected amount field to render TextInput');
  assert.notEqual(currencyLabelIndex, -1, 'expected amount field to render currency label');
  assert.ok(inputIndex < currencyLabelIndex, 'expected amount input JSX to precede currency label JSX');
});

test('Today quick expense legacy form uses shared Chit actions and accessible amount controls', () => {
  assert.match(
    quickExpenseFormSource,
    /import \{[^}]*PrimaryButton[^}]*SecondaryButton[^}]*\} from '\.\.\/design'/s,
    'expected shared Chit buttons',
  );
  assert.match(quickExpenseFormSource, /accessibilityLabel="금액"/, 'expected amount input to be labelled');
  assert.match(quickExpenseFormSource, /loading=\{submitting\}/, 'expected save button loading state');
  assert.match(quickExpenseFormSource, /loadingLabel="저장 중\.\.\."/, 'expected Chit loading copy');
  assert.match(quickExpenseFormSource, /accessibilityLabel="영수증 다시 촬영"/, 'expected receipt retry action label');
  assert.match(quickExpenseFormSource, /accessibilityLabel="영수증 초안 해제"/, 'expected receipt clear action label');
});

test('quick expense settlement choices use SelectableCard radio semantics', () => {
  const body = functionBody(quickExpenseFormSource, 'SettlementChoice');

  assert.match(quickExpenseFormSource, /import \{[^}]*SelectableCard[^}]*\} from '\.\.\/design'/s);
  assert.match(body, /<SelectableCard\b/);
  assert.match(body, /mode="radio"/);
  assert.match(body, /checked=\{selected\}/);
  assert.match(body, /title=\{label\}/);
  assert.match(body, /description=\{description\}/);
  assert.doesNotMatch(body, /<Pressable\b/);
});

test('quick expense participant chips preserve the 44pt touch target floor', () => {
  assertStyleContains(quickExpenseFormSource, 'participantChip', /minHeight: theme\.layout\.tapMin/);
});

function functionBody(source: string, functionName: string): string {
  const startMarker = `function ${functionName}(`;
  const start = source.indexOf(startMarker);

  assert.notEqual(start, -1, `${functionName} function should exist`);

  const rest = source.slice(start + startMarker.length);
  const nextFunction = rest.search(/\nfunction \w+\b|\nconst styles =/);
  const end = nextFunction === -1 ? source.length : start + startMarker.length + nextFunction;

  return source.slice(start, end);
}

function assertStyleContains(source: string, styleName: string, expected: RegExp): void {
  const stylePattern = new RegExp(`${styleName}: \\{[\\s\\S]*?\\n  \\},`);
  const match = source.match(stylePattern);

  assert.ok(match, `${styleName} style should exist`);
  assert.match(match[0], expected);
}
