import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDayItineraryDirtyClosePrompt,
  resolveDayItinerarySheetCloseAction,
  resolveDayItinerarySheetMode,
  resolveDayItineraryTimelineItemPress,
  shouldDismissDayItinerarySheet,
} from './day-itinerary-sheet';

describe('day itinerary sheet state helpers', () => {
  it('shows detail when a row is selected and no edit form is active', () => {
    assert.deepEqual(
      resolveDayItinerarySheetMode({
        selectedDetailItemId: 'item-1',
        editStatus: 'idle',
      }),
      { kind: 'detail', itemId: 'item-1' },
    );
  });

  it('prioritizes active place edit over selected detail so editing stays in the same sheet', () => {
    assert.deepEqual(
      resolveDayItinerarySheetMode({
        selectedDetailItemId: 'item-1',
        editStatus: 'editing',
      }),
      { kind: 'editPlace' },
    );
    assert.deepEqual(
      resolveDayItinerarySheetMode({
        selectedDetailItemId: 'item-1',
        editStatus: 'saving',
      }),
      { kind: 'editPlace' },
    );
  });

  it('opens the editable schedule sheet immediately when a timeline item is pressed from the idle schedule list', () => {
    assert.deepEqual(
      resolveDayItineraryTimelineItemPress({
        editStatus: 'idle',
        itemId: 'item-1',
      }),
      { kind: 'openEdit', itemId: 'item-1' },
    );
  });

  it('ignores timeline item presses while the edit sheet is active', () => {
    assert.deepEqual(
      resolveDayItineraryTimelineItemPress({
        editStatus: 'editing',
        itemId: 'item-1',
      }),
      { kind: 'none' },
    );
  });

  it('blocks dismiss while the place edit sheet is saving', () => {
    assert.equal(shouldDismissDayItinerarySheet({ editStatus: 'saving' }), false);
    assert.equal(shouldDismissDayItinerarySheet({ editStatus: 'editing' }), true);
    assert.equal(shouldDismissDayItinerarySheet({ editStatus: 'idle' }), true);
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
      }),
      { kind: 'promptSave' },
    );
    assert.deepEqual(
      resolveDayItinerarySheetCloseAction({
        editStatus: 'editing',
        hasEditChanges: false,
      }),
      { kind: 'close' },
    );
  });
});
