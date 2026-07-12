import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDayItineraryDirtyClosePrompt,
  resolveDayItinerarySheetCloseAction,
  resolveDayItinerarySheetMode,
  shouldDismissDayItinerarySheet,
} from './day-itinerary-sheet';

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

  it('offers cancel, discard, and save choices for dirty close prompts', () => {
    assert.deepEqual(buildDayItineraryDirtyClosePrompt(), {
      title: '변경 사항을 저장할까요?',
      buttons: [
        { label: '취소', role: 'cancel', style: 'cancel' },
        { label: '저장 안 함', role: 'discard', style: 'destructive' },
        { label: '저장', role: 'save' },
      ],
    });
  });

  it('prompts to save when closing a dirty edit sheet and closes clean sheets directly', () => {
    assert.deepEqual(
      resolveDayItinerarySheetCloseAction({
        editStatus: 'editing',
        hasEditChanges: true,
        hasNonPlaceEditorChanges: false,
        nonPlaceEditorStatus: 'idle',
      }),
      { kind: 'promptSave', target: 'place' },
    );
    assert.deepEqual(
      resolveDayItinerarySheetCloseAction({
        editStatus: 'editing',
        hasEditChanges: false,
        hasNonPlaceEditorChanges: false,
        nonPlaceEditorStatus: 'idle',
      }),
      { kind: 'close' },
    );
    assert.deepEqual(
      resolveDayItinerarySheetCloseAction({
        editStatus: 'idle',
        hasEditChanges: false,
        hasNonPlaceEditorChanges: true,
        nonPlaceEditorStatus: 'editing',
      }),
      { kind: 'promptSave', target: 'nonPlace' },
    );
  });
});
