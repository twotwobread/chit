import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNotificationSettleActionPath, resolveNotificationActionRoute } from './navigation.ts';

test('builds and resolves settlement notification action paths', () => {
  const actionPath = buildNotificationSettleActionPath('trip-a', 'expense-a');

  assert.equal(actionPath, '/trips/trip-a/settle?expenseId=expense-a');
  assert.equal(resolveNotificationActionRoute(actionPath), '/trips/trip-a/settle?expenseId=expense-a');
});

test('rejects malformed or unsupported notification action paths', () => {
  assert.equal(resolveNotificationActionRoute('/trips/trip-a/settle'), null);
  assert.equal(resolveNotificationActionRoute('/trips/trip-a/settle?expenseId='), null);
  assert.equal(resolveNotificationActionRoute('/trips/trip-a/days/day-a'), null);
  assert.equal(resolveNotificationActionRoute('//example.com/trips/trip-a/settle?expenseId=expense-a'), null);
  assert.equal(resolveNotificationActionRoute('https://example.com/trips/trip-a/settle?expenseId=expense-a'), null);
});
