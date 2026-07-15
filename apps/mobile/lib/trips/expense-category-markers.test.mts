import assert from 'node:assert/strict';
import test from 'node:test';

import { expenseCategoryValues, getExpenseCategoryMarkerMeta } from '../trip-ui/expense-category-markers.ts';

test('defines icon marker metadata for every settlement expense category', () => {
  assert.deepEqual(expenseCategoryValues, ['cafe', 'etc', 'food', 'lodging', 'shopping', 'sights', 'transport']);

  assert.deepEqual(
    expenseCategoryValues.map((category) => {
      const meta = getExpenseCategoryMarkerMeta(category);
      return [category, meta.label, meta.iconName, Object.hasOwn(meta, 'glyph')];
    }),
    [
      ['cafe', '카페', 'coffee', false],
      ['etc', '기타', 'map-pin', false],
      ['food', '식당', 'utensils', false],
      ['lodging', '숙소', 'bed', false],
      ['shopping', '쇼핑', 'shopping-bag', false],
      ['sights', '관광지', 'landmark', false],
      ['transport', '교통', 'train-front', false],
    ],
  );
});
