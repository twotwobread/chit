import assert from 'node:assert/strict';
import test from 'node:test';

import { theme } from '../design/theme';
import {
  DAY_ITINERARY_EDIT_MEMO_INPUT_MIN_HEIGHT,
  DAY_ITINERARY_EDIT_SHEET_KEYBOARD_BOTTOM_PADDING,
  DAY_ITINERARY_EDIT_SHEET_KEYBOARD_MIN_CLEARANCE,
} from './day-itinerary-sheet-layout';

test('place edit sheet keyboard clearance reserves the full memo input height plus comfortable bottom padding', () => {
  assert.equal(DAY_ITINERARY_EDIT_MEMO_INPUT_MIN_HEIGHT, theme.layout.controlHLg + theme.space[8]);
  assert.equal(DAY_ITINERARY_EDIT_SHEET_KEYBOARD_BOTTOM_PADDING, theme.space[5]);
  assert.equal(
    DAY_ITINERARY_EDIT_SHEET_KEYBOARD_MIN_CLEARANCE,
    DAY_ITINERARY_EDIT_MEMO_INPUT_MIN_HEIGHT + DAY_ITINERARY_EDIT_SHEET_KEYBOARD_BOTTOM_PADDING,
  );
});
