import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TripDay } from '@i-um/api-contract';

import {
  buildDayLodgingPanel,
  buildDayLodgingPlaceOptions,
  buildDayLodgingRowViewModel,
  buildManualDayLodgingPlaceSubmitState,
  buildSetDayLodgingPlaceRequest,
  buildTripDayLodgingSummary,
  dayLodgingMutationFailureState,
  validateManualDayLodgingPlaceForm,
} from './lodging-place';

describe('day lodging place helpers', () => {
  it('maps non-selected and selected itinerary rows to lodging actions and badge state', () => {
    assert.deepEqual(buildDayLodgingRowViewModel({ id: 'item-1', isLodging: false }), {
      isLodging: false,
      badgeLabel: null,
      action: { kind: 'set', label: '숙소로 지정', disabled: false, isSubmitting: false },
    });

    assert.deepEqual(buildDayLodgingRowViewModel({ id: 'item-2', isLodging: true }), {
      isLodging: true,
      badgeLabel: '대표 숙소',
      action: { kind: 'clear', label: '숙소 해제', disabled: false, isSubmitting: false },
    });
  });

  it('disables duplicate lodging actions while setting or clearing without optimistic replacement', () => {
    assert.deepEqual(
      buildDayLodgingRowViewModel({ id: 'item-1', isLodging: false }, { kind: 'set', itemId: 'item-1' }),
      {
        isLodging: false,
        badgeLabel: null,
        action: { kind: 'set', label: '숙소로 지정 중...', disabled: true, isSubmitting: true },
      },
    );

    assert.deepEqual(
      buildDayLodgingRowViewModel({ id: 'item-2', isLodging: false }, { kind: 'set', itemId: 'item-1' }),
      {
        isLodging: false,
        badgeLabel: null,
        action: { kind: 'set', label: '숙소로 지정', disabled: true, isSubmitting: false },
      },
    );

    assert.deepEqual(
      buildDayLodgingRowViewModel({ id: 'item-3', isLodging: true }, { kind: 'clear', itemId: 'item-3' }),
      {
        isLodging: true,
        badgeLabel: '대표 숙소',
        action: { kind: 'clear', label: '숙소 해제 중...', disabled: true, isSubmitting: true },
      },
    );
  });

  it('builds the Day lodging panel for empty and selected lodging states', () => {
    assert.deepEqual(buildDayLodgingPanel(null), {
      label: '숙소',
      placeName: null,
      address: null,
      helper: '이 Day에 지정된 숙소가 없어요.',
      canClear: false,
    });

    assert.deepEqual(
      buildDayLodgingPanel({ id: 'place-1', name: '호텔 니코 오사카', address: 'Nishi', placeType: 'lodging' }),
      {
        label: '숙소',
        placeName: '호텔 니코 오사카',
        address: 'Nishi',
        helper: null,
        canClear: true,
      },
    );
  });

  it('builds existing trip place lodging options and marks the current selection', () => {
    assert.deepEqual(
      buildDayLodgingPlaceOptions(
        {
          places: [
            { id: 'place-1', name: '호텔 니코 오사카', address: 'Nishi', placeType: 'lodging', routablePlace: null },
            { id: 'place-2', name: '도톤보리', address: 'Dotonbori', placeType: 'sights', routablePlace: null },
          ],
        },
        'place-2',
      ),
      [
        { id: 'place-1', name: '호텔 니코 오사카', address: 'Nishi', placeType: 'lodging', selected: false },
        { id: 'place-2', name: '도톤보리', address: 'Dotonbori', placeType: 'sights', selected: true },
      ],
    );
  });

  it('validates and trims manual lodging registration form values', () => {
    assert.deepEqual(validateManualDayLodgingPlaceForm({ name: ' 호텔 ', address: ' Nishi ' }), {
      ok: true,
      request: { name: '호텔', address: 'Nishi' },
    });
    assert.deepEqual(validateManualDayLodgingPlaceForm({ name: ' ', address: '가'.repeat(301) }), {
      ok: false,
      errors: { name: '숙소명을 입력해주세요.', address: '주소는 300자 이하로 입력해주세요.' },
    });
  });

  it('builds manual lodging submit states', () => {
    assert.deepEqual(buildManualDayLodgingPlaceSubmitState(false), { disabled: false, label: '숙소 등록' });
    assert.deepEqual(buildManualDayLodgingPlaceSubmitState(true), { disabled: true, label: '숙소 등록 중...' });
  });

  it('builds generated set request shape from a trip place id', () => {
    assert.deepEqual(buildSetDayLodgingPlaceRequest('place-1'), { tripPlaceId: 'place-1' });
  });

  it('maps nullable trip day lodging summaries for trip detail rows', () => {
    const dayWithoutLodging: TripDay = { date: '2026-07-10', dayOrder: 1, lodgingPlace: null };
    assert.equal(buildTripDayLodgingSummary(dayWithoutLodging), null);

    const dayWithLodging: TripDay = {
      date: '2026-07-11',
      dayOrder: 2,
      lodgingPlace: { id: 'place-1', name: '호텔 니코 오사카', placeType: 'lodging', address: 'Nishi-Shinsaibashi' },
    };
    assert.deepEqual(buildTripDayLodgingSummary(dayWithLodging), {
      label: '숙소',
      placeName: '호텔 니코 오사카',
      address: 'Nishi-Shinsaibashi',
    });
  });

  it('returns generic retryable mutation failure copy', () => {
    assert.deepEqual(dayLodgingMutationFailureState(), {
      title: '숙소 정보를 저장할 수 없어요. 잠시 후 다시 시도해주세요.',
      helper: '기존 일정은 그대로 유지했어요.',
    });
  });
});
