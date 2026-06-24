import assert from 'node:assert/strict';
import test from 'node:test';

import { DISPLAY_NAME_VALIDATION_MESSAGE, normalizeDisplayNameInput } from './display-name.ts';

test('normalizes valid display names by trimming only outer whitespace', () => {
  assert.deepEqual(normalizeDisplayNameInput('  지  영  '), { valid: true, value: '지  영' });
});

test('rejects empty-after-trim display names', () => {
  assert.deepEqual(normalizeDisplayNameInput(' \t  '), {
    valid: false,
    message: DISPLAY_NAME_VALIDATION_MESSAGE,
  });
});

test('counts display-name length by Unicode code points', () => {
  const twentyKoreanCodePoints = '가'.repeat(20);
  const twentyOneKoreanCodePoints = '가'.repeat(21);

  assert.deepEqual(normalizeDisplayNameInput(twentyKoreanCodePoints), {
    valid: true,
    value: twentyKoreanCodePoints,
  });
  assert.deepEqual(normalizeDisplayNameInput(twentyOneKoreanCodePoints), {
    valid: false,
    message: DISPLAY_NAME_VALIDATION_MESSAGE,
  });
});
