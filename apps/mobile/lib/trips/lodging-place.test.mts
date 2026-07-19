import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TripDay } from '@i-um/api-contract';

import {
  buildDayLodgingPanel,
  buildDayLodgingManagementActionRows,
  buildDayLodgingManagementActions,
  buildDayLodgingPlaceOptions,
  buildDayLodgingPlaceOptionsPresentation,
  buildDayLodgingRowViewModel,
  buildGoogleDayLodgingPlaceRequest,
  buildSetDayLodgingPlaceRequest,
  buildTripDayLodgingSummary,
  dayLodgingMutationFailureState,
  runDayLodgingSearchRegisterAction,
} from './lodging-place';

describe('day lodging place helpers', () => {
  it('maps itinerary lodging rows to badge-only management entry state', () => {
    assert.deepEqual(buildDayLodgingRowViewModel({ id: 'item-1', isLodging: false }), {
      isLodging: false,
      badgeLabel: null,
      opensManagement: false,
    });

    assert.deepEqual(buildDayLodgingRowViewModel({ id: 'item-2', isLodging: true }), {
      isLodging: true,
      badgeLabel: '대표 숙소',
      opensManagement: true,
    });
  });

  it('builds compact Day lodging summary without exposing address', () => {
    assert.deepEqual(buildDayLodgingPanel(null).summary, {
      label: '숙소',
      placeName: '숙소 미지정',
      actionLabel: '지정하기',
      address: null,
    });

    assert.deepEqual(
      buildDayLodgingPanel({ id: 'place-1', name: '호텔 니코 오사카', address: 'Nishi', placeType: 'lodging' }).summary,
      {
        label: '숙소',
        placeName: '호텔 니코 오사카',
        actionLabel: '변경',
        address: null,
      },
    );
  });

  it('builds management sheet view models for empty and selected lodging states', () => {
    assert.deepEqual(buildDayLodgingPanel(null).sheet, {
      title: '숙소 지정',
      placeName: null,
      address: null,
      helper: '현재 여행에 저장된 장소 중 선택하거나 숙소를 직접 등록해 주세요.',
      canCopyAddress: false,
      canClear: false,
      selectExistingAction: '기존 장소에서 선택',
      manualRegisterAction: '숙소 검색해서 등록',
      changeAction: null,
      clearAction: null,
      copyAddressAction: null,
    });

    assert.deepEqual(
      buildDayLodgingPanel({ id: 'place-1', name: '호텔 니코 오사카', address: 'Nishi', placeType: 'lodging' }).sheet,
      {
        title: '숙소 관리',
        placeName: '호텔 니코 오사카',
        address: 'Nishi',
        helper: null,
        canCopyAddress: true,
        canClear: true,
        selectExistingAction: '기존 장소에서 선택',
        manualRegisterAction: '숙소 검색해서 등록',
        changeAction: '다른 숙소로 변경',
        clearAction: '숙소 해제',
        copyAddressAction: '주소 복사',
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

  it('constrains long existing-place option lists to an internal scroll area', () => {
    assert.deepEqual(buildDayLodgingPlaceOptionsPresentation(Array.from({ length: 4 })), {
      isScrollable: false,
      visibleOptionCount: 4,
    });
    assert.deepEqual(buildDayLodgingPlaceOptionsPresentation(Array.from({ length: 5 })), {
      isScrollable: true,
      visibleOptionCount: 4,
    });
  });

  it('builds Google-backed lodging registration request from a selected map search result', () => {
    assert.deepEqual(buildGoogleDayLodgingPlaceRequest(' google-hotel-1 '), {
      googlePlaceId: 'google-hotel-1',
    });
  });

  it('uses direct map-search actions for initial lodging assignment', () => {
    assert.deepEqual(buildDayLodgingManagementActions(buildDayLodgingPanel(null).sheet), [
      { kind: 'searchRegister', label: '숙소 검색해서 등록' },
    ]);
  });

  it('orders existing lodging management actions with clear directly below address copy', () => {
    const sheet = buildDayLodgingPanel({
      id: 'place-1',
      name: '호텔 니코 오사카',
      address: 'Nishi',
      placeType: 'lodging',
    }).sheet;

    assert.deepEqual(buildDayLodgingManagementActions(sheet), [
      { kind: 'copyAddress', label: '주소 복사' },
      { kind: 'clear', label: '숙소 해제', destructive: true },
      { kind: 'change', label: '다른 숙소로 변경' },
    ]);
  });

  it('groups compact lodging management actions into horizontal rows', () => {
    const actions = buildDayLodgingManagementActions(
      buildDayLodgingPanel({
        id: 'place-1',
        name: '호텔 니코 오사카',
        address: 'Nishi',
        placeType: 'lodging',
      }).sheet,
    );

    assert.deepEqual(buildDayLodgingManagementActionRows(actions), [
      {
        id: 'current-place-actions',
        actions: [
          { kind: 'copyAddress', label: '주소 복사' },
          { kind: 'clear', label: '숙소 해제', destructive: true },
        ],
      },
      {
        id: 'management-actions',
        actions: [{ kind: 'change', label: '다른 숙소로 변경' }],
      },
    ]);
  });

  it('closes the lodging sheet before opening map-based lodging search', () => {
    const events: string[] = [];

    runDayLodgingSearchRegisterAction({
      closeSheet: () => events.push('close-sheet'),
      openSearchRegister: () => events.push('open-search-register'),
    });

    assert.deepEqual(events, ['close-sheet', 'open-search-register']);
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
