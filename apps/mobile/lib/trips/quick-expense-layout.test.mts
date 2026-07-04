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
