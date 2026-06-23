import assert from 'node:assert/strict';
import test from 'node:test';

import { addMonths, dateFromString, formatLocalDate, isValidDate, monthString, monthStringFromDate, normalizeMonth, todayString } from './date.ts';

test('formats local dates and today using YYYY-MM-DD', () => {
  const date = new Date(2026, 6, 9);

  assert.equal(formatLocalDate(date), '2026-07-09');
  assert.equal(todayString(date), '2026-07-09');
});

test('validates calendar dates strictly', () => {
  assert.equal(isValidDate('2026-07-09'), true);
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('2026-7-9'), false);
  assert.equal(isValidDate('not-a-date'), false);
});

test('builds and normalizes month strings', () => {
  assert.equal(monthString(2026, 7), '2026-07-01');
  assert.equal(monthStringFromDate(dateFromString('2026-07-09')), '2026-07-01');
  assert.equal(normalizeMonth('2026-06-01', '2026-07-09'), '2026-07-01');
  assert.equal(normalizeMonth('2026-08-01', '2026-07-09'), '2026-08-01');
});

test('adds months across year boundaries', () => {
  assert.equal(addMonths('2026-12-01', 1), '2027-01-01');
  assert.equal(addMonths('2026-01-01', -1), '2025-12-01');
});
