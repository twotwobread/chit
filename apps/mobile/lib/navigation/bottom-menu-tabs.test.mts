import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BOTTOM_MENU_TABS } from './bottom-menu-tabs';

test('root bottom menu exposes Home and My tabs with icon identifiers', () => {
  assert.deepEqual(
    BOTTOM_MENU_TABS.map(({ icon, id, label }) => ({ icon, id, label })),
    [
      { icon: 'house', id: 'home', label: '홈' },
      { icon: 'user-round', id: 'my', label: '마이' },
    ],
  );
});
