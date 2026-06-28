import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { GetDayScheduleItemsResponse } from '@i-um/api-contract';

import {
  DAY_ITINERARY_SHARED_UPDATE_BANNER,
  DAY_ITINERARY_SHARED_UPDATE_POLL_INTERVAL_MS,
  DAY_ITINERARY_SHARED_UPDATE_RELOAD_CONFIRMATION,
  buildDayItinerarySharedUpdateBanner,
  buildDayItinerarySharedUpdateSignature,
  isDayItinerarySharedUpdateProtected,
  isDayItinerarySharedUpdateReloadDisabled,
  markDayItinerarySharedUpdateApplied,
  reduceDayItinerarySharedUpdateFromResponse,
  shouldReconcileDayItinerarySharedUpdate,
  type DayItinerarySharedUpdateLocalState,
} from './shared-itinerary-updates';

function baseLocalState(
  overrides: Partial<DayItinerarySharedUpdateLocalState> = {},
): DayItinerarySharedUpdateLocalState {
  return {
    reorderStatus: 'idle',
    editStatus: 'idle',
    deleteStatus: 'idle',
    lodgingStatus: 'idle',
    ...overrides,
  };
}

function baseResponse(overrides: Partial<GetDayScheduleItemsResponse> = {}): GetDayScheduleItemsResponse {
  const response: GetDayScheduleItemsResponse = {
    day: { date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
    items: [
      {
        id: 'item-2',
        itemOrder: 2,
        version: 3,
        isLodging: false,
        place: { id: 'place-2', name: '도톤보리', placeType: 'food', address: 'Dotonbori' },
      },
      {
        id: 'item-1',
        itemOrder: 1,
        version: 7,
        isLodging: true,
        place: { id: 'place-1', name: '우메다 공중정원', placeType: 'sights', address: 'Umeda' },
      },
    ],
  };

  return {
    ...response,
    ...overrides,
  };
}

function withFirstItem(overrides: Partial<GetDayScheduleItemsResponse['items'][number]>): GetDayScheduleItemsResponse {
  const response = baseResponse();
  return {
    ...response,
    items: response.items.map((item) => (item.id === 'item-1' ? { ...item, ...overrides } : item)),
  };
}

describe('shared itinerary update helpers', () => {
  it('uses a 10 second polling interval constant', () => {
    assert.equal(DAY_ITINERARY_SHARED_UPDATE_POLL_INTERVAL_MS, 10_000);
  });

  it('builds a deterministic signature from displayed itinerary fields', () => {
    const signature = buildDayItinerarySharedUpdateSignature(baseResponse());
    const sameContentDifferentObject = baseResponse({ items: [...baseResponse().items].reverse() });

    assert.equal(buildDayItinerarySharedUpdateSignature(sameContentDifferentObject), signature);

    const changes: GetDayScheduleItemsResponse[] = [
      withFirstItem({ itemOrder: 3 }),
      withFirstItem({ version: 8 }),
      withFirstItem({ isLodging: false }),
      withFirstItem({ place: { id: 'place-9', name: '우메다 공중정원', placeType: 'sights', address: 'Umeda' } }),
      withFirstItem({ place: { id: 'place-1', name: '신우메다 공중정원', placeType: 'sights', address: 'Umeda' } }),
      withFirstItem({ place: { id: 'place-1', name: '우메다 공중정원', placeType: 'etc', address: 'Umeda' } }),
      withFirstItem({ place: { id: 'place-1', name: '우메다 공중정원', placeType: 'sights', address: 'Osaka' } }),
    ];

    for (const changed of changes) {
      assert.notEqual(buildDayItinerarySharedUpdateSignature(changed), signature);
    }
  });

  it('auto-applies a changed polling response when local state is unprotected', () => {
    const initial = markDayItinerarySharedUpdateApplied(baseResponse());
    const changed = withFirstItem({ version: 8 });

    const result = reduceDayItinerarySharedUpdateFromResponse(initial, changed, baseLocalState());

    assert.equal(result.decision, 'autoApply');
    assert.equal(result.state.baselineSignature, buildDayItinerarySharedUpdateSignature(changed));
    assert.equal(result.state.pendingSignature, null);
    assert.equal(buildDayItinerarySharedUpdateBanner(result.state), null);
  });

  it('keeps view mode quiet when a polling response has the same signature', () => {
    const initial = markDayItinerarySharedUpdateApplied(baseResponse());

    const result = reduceDayItinerarySharedUpdateFromResponse(initial, baseResponse(), baseLocalState());

    assert.equal(result.decision, 'unchanged');
    assert.deepEqual(result.state, initial);
  });

  it('protects all local Day-screen edit and mutation states from auto-apply', () => {
    const initial = markDayItinerarySharedUpdateApplied(baseResponse());
    const changed = withFirstItem({ version: 8 });
    const protectedStates: DayItinerarySharedUpdateLocalState[] = [
      baseLocalState({ reorderStatus: 'editing' }),
      baseLocalState({ reorderStatus: 'saving' }),
      baseLocalState({ editStatus: 'editing' }),
      baseLocalState({ editStatus: 'saving' }),
      baseLocalState({ deleteStatus: 'confirming' }),
      baseLocalState({ deleteStatus: 'deleting' }),
      baseLocalState({ lodgingStatus: 'setting' }),
      baseLocalState({ lodgingStatus: 'clearing' }),
    ];

    for (const localState of protectedStates) {
      const result = reduceDayItinerarySharedUpdateFromResponse(initial, changed, localState);

      assert.equal(isDayItinerarySharedUpdateProtected(localState), true);
      assert.equal(result.decision, 'pending');
      assert.equal(result.state.baselineSignature, initial.baselineSignature);
      assert.equal(result.state.pendingSignature, buildDayItinerarySharedUpdateSignature(changed));
      assert.deepEqual(buildDayItinerarySharedUpdateBanner(result.state), DAY_ITINERARY_SHARED_UPDATE_BANNER);
    }
  });

  it('collapses repeated remote changes into one persistent banner', () => {
    const initial = markDayItinerarySharedUpdateApplied(baseResponse());
    const firstRemote = withFirstItem({ version: 8 });
    const secondRemote = withFirstItem({ version: 9 });
    const protectedState = baseLocalState({ editStatus: 'editing' });

    const firstResult = reduceDayItinerarySharedUpdateFromResponse(initial, firstRemote, protectedState);
    const secondResult = reduceDayItinerarySharedUpdateFromResponse(firstResult.state, secondRemote, protectedState);

    assert.equal(secondResult.decision, 'pending');
    assert.equal(secondResult.state.pendingSignature, buildDayItinerarySharedUpdateSignature(secondRemote));
    assert.deepEqual(buildDayItinerarySharedUpdateBanner(secondResult.state), {
      message: '다른 참여자가 일정을 변경했어요.',
      actionLabel: '최신 내용 보기',
    });
  });

  it('defines reload confirmation copy and disables reload only for in-flight mutation states', () => {
    assert.deepEqual(DAY_ITINERARY_SHARED_UPDATE_RELOAD_CONFIRMATION, {
      title: '최신 일정으로 불러올까요?',
      helper: '현재 편집 중인 내용은 저장되지 않고 사라져요.',
      confirmLabel: '불러오기',
      cancelLabel: '계속 편집',
    });

    assert.equal(isDayItinerarySharedUpdateReloadDisabled(baseLocalState({ reorderStatus: 'editing' })), false);
    assert.equal(isDayItinerarySharedUpdateReloadDisabled(baseLocalState({ editStatus: 'editing' })), false);
    assert.equal(isDayItinerarySharedUpdateReloadDisabled(baseLocalState({ deleteStatus: 'confirming' })), false);
    assert.equal(isDayItinerarySharedUpdateReloadDisabled(baseLocalState({ reorderStatus: 'saving' })), true);
    assert.equal(isDayItinerarySharedUpdateReloadDisabled(baseLocalState({ editStatus: 'saving' })), true);
    assert.equal(isDayItinerarySharedUpdateReloadDisabled(baseLocalState({ deleteStatus: 'deleting' })), true);
    assert.equal(isDayItinerarySharedUpdateReloadDisabled(baseLocalState({ lodgingStatus: 'setting' })), true);
    assert.equal(isDayItinerarySharedUpdateReloadDisabled(baseLocalState({ lodgingStatus: 'clearing' })), true);
  });

  it('requests immediate reconcile when pending remote state becomes unprotected', () => {
    const initial = markDayItinerarySharedUpdateApplied(baseResponse());
    const pending = reduceDayItinerarySharedUpdateFromResponse(
      initial,
      withFirstItem({ version: 8 }),
      baseLocalState({ reorderStatus: 'editing' }),
    ).state;

    assert.equal(shouldReconcileDayItinerarySharedUpdate(pending, baseLocalState({ reorderStatus: 'editing' })), false);
    assert.equal(shouldReconcileDayItinerarySharedUpdate(pending, baseLocalState()), true);
  });

  it('treats a successful mutation or explicit reload response as the new clean baseline', () => {
    const initial = markDayItinerarySharedUpdateApplied(baseResponse());
    const pending = reduceDayItinerarySharedUpdateFromResponse(
      initial,
      withFirstItem({ version: 8 }),
      baseLocalState({ editStatus: 'editing' }),
    ).state;
    const successfulMutation = withFirstItem({ version: 9 });

    const next = markDayItinerarySharedUpdateApplied(successfulMutation);

    assert.notEqual(pending.pendingSignature, null);
    assert.equal(next.baselineSignature, buildDayItinerarySharedUpdateSignature(successfulMutation));
    assert.equal(next.pendingSignature, null);
  });

  it('keeps a pending banner available when a local mutation error is handled elsewhere', () => {
    const initial = markDayItinerarySharedUpdateApplied(baseResponse());
    const pending = reduceDayItinerarySharedUpdateFromResponse(
      initial,
      withFirstItem({ version: 8 }),
      baseLocalState({ editStatus: 'saving' }),
    ).state;

    assert.deepEqual(buildDayItinerarySharedUpdateBanner(pending), DAY_ITINERARY_SHARED_UPDATE_BANNER);
  });
});
