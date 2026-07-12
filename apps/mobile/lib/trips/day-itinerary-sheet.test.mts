import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveDayItinerarySheetMode, shouldDismissDayItinerarySheet } from './day-itinerary-sheet';

describe('day itinerary sheet state helpers', () => {
  it('shows detail when a row is selected and no edit form is active', () => {
    assert.deepEqual(
      resolveDayItinerarySheetMode({
        selectedDetailItemId: 'item-1',
        editStatus: 'idle',
        nonPlaceEditorStatus: 'idle',
      }),
      { kind: 'detail', itemId: 'item-1' },
    );
  });

  it('prioritizes active place edit over selected detail so editing stays in the same sheet', () => {
    assert.deepEqual(
      resolveDayItinerarySheetMode({
        selectedDetailItemId: 'item-1',
        editStatus: 'editing',
        nonPlaceEditorStatus: 'idle',
      }),
      { kind: 'editPlace' },
    );
    assert.deepEqual(
      resolveDayItinerarySheetMode({
        selectedDetailItemId: 'item-1',
        editStatus: 'saving',
        nonPlaceEditorStatus: 'idle',
      }),
      { kind: 'editPlace' },
    );
  });

  it('opens non-place create or edit forms as the active sheet even without selected detail', () => {
    assert.deepEqual(
      resolveDayItinerarySheetMode({
        selectedDetailItemId: null,
        editStatus: 'idle',
        nonPlaceEditorStatus: 'editing',
      }),
      { kind: 'editNonPlace' },
    );
    assert.deepEqual(
      resolveDayItinerarySheetMode({
        selectedDetailItemId: 'item-2',
        editStatus: 'idle',
        nonPlaceEditorStatus: 'saving',
      }),
      { kind: 'editNonPlace' },
    );
  });

  it('blocks dismiss while a sheet form is saving', () => {
    assert.equal(shouldDismissDayItinerarySheet({ editStatus: 'saving', nonPlaceEditorStatus: 'idle' }), false);
    assert.equal(shouldDismissDayItinerarySheet({ editStatus: 'idle', nonPlaceEditorStatus: 'saving' }), false);
    assert.equal(shouldDismissDayItinerarySheet({ editStatus: 'editing', nonPlaceEditorStatus: 'idle' }), true);
    assert.equal(shouldDismissDayItinerarySheet({ editStatus: 'idle', nonPlaceEditorStatus: 'idle' }), true);
  });
});
