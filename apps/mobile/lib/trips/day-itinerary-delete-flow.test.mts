import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canDismissDayItineraryDeleteModal,
  canSubmitDayItineraryDelete,
  resolveDayItineraryDeleteSuccessFocusTarget,
} from './day-itinerary-edit';

describe('day itinerary delete modal flow helpers', () => {
  it('allows delete mutation only from confirming state', () => {
    assert.equal(canSubmitDayItineraryDelete('idle'), false);
    assert.equal(canSubmitDayItineraryDelete('confirming'), true);
    assert.equal(canSubmitDayItineraryDelete('deleting'), false);
  });

  it('allows modal dismissal only before deletion is submitting', () => {
    assert.equal(canDismissDayItineraryDeleteModal('confirming'), true);
    assert.equal(canDismissDayItineraryDeleteModal('deleting'), false);
    assert.equal(canDismissDayItineraryDeleteModal('idle'), false);
  });

  it('focuses the next row after deleting a middle item', () => {
    assert.deepEqual(
      resolveDayItineraryDeleteSuccessFocusTarget(
        [
          { id: 'item-1' },
          { id: 'item-2' },
          { id: 'item-3' },
        ],
        'item-2',
      ),
      { kind: 'placeRow', itemId: 'item-3' },
    );
  });

  it('focuses the previous row after deleting the last item', () => {
    assert.deepEqual(
      resolveDayItineraryDeleteSuccessFocusTarget(
        [
          { id: 'item-1' },
          { id: 'item-2' },
        ],
        'item-2',
      ),
      { kind: 'placeRow', itemId: 'item-1' },
    );
  });

  it('focuses the empty state after deleting the only item', () => {
    assert.deepEqual(resolveDayItineraryDeleteSuccessFocusTarget([{ id: 'item-1' }], 'item-1'), { kind: 'emptyState' });
  });
});
