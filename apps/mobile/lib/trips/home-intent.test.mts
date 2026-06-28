import assert from 'node:assert/strict';
import test from 'node:test';

import { clearExplicitHomeIntent, consumeExplicitHomeIntent, markExplicitHomeIntent } from './home-intent.ts';

test('explicit Home intent is consumed once', () => {
  clearExplicitHomeIntent();

  markExplicitHomeIntent();

  assert.equal(consumeExplicitHomeIntent(), true);
  assert.equal(consumeExplicitHomeIntent(), false);
});

test('explicit Home intent can be cleared before a fresh root evaluation', () => {
  markExplicitHomeIntent();
  clearExplicitHomeIntent();

  assert.equal(consumeExplicitHomeIntent(), false);
});
