import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rootStackScreenOptions } from './root-stack-options';

test('root stack hides the default native header to avoid wasting top-screen space', () => {
  assert.equal(rootStackScreenOptions.headerShown, false);
  assert.ok(!('title' in rootStackScreenOptions));
  assert.ok(!('headerStyle' in rootStackScreenOptions));
  assert.ok(!('headerTintColor' in rootStackScreenOptions));
  assert.ok(!('headerTitleStyle' in rootStackScreenOptions));
});
