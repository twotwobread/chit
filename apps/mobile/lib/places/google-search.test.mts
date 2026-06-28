import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addingGooglePlaceState,
  buildCreateGooglePlaceScheduleItemRequest,
  buildGooglePlaceSearchInputState,
  buildGooglePlaceSearchRoute,
  canSearchGooglePlaces,
  confirmingDuplicateGooglePlaceState,
  duplicateDayPlaceConfirmationMessage,
  errorGooglePlaceAddState,
  errorGooglePlaceSearchState,
  getGooglePlaceTypeHint,
  googlePlaceAddFailureMessage,
  googlePlaceSearchLoadingState,
  idleGooglePlaceAddState,
  isDuplicateDayPlaceConfirmationError,
  normalizeGooglePlaceSearchQuery,
  successGooglePlaceSearchState,
} from './google-search';

describe('google place search helpers', () => {
  it('builds the Day-scoped search route from trip id and date', () => {
    assert.equal(
      buildGooglePlaceSearchRoute('00000000-0000-0000-0000-000000000001', '2026-07-10'),
      '/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/place-search',
    );
  });

  it('normalizes and validates query length without calling API for short input', () => {
    assert.equal(normalizeGooglePlaceSearchQuery('  도톤보리  '), '도톤보리');
    assert.equal(canSearchGooglePlaces(' 도 '), false);
    assert.equal(canSearchGooglePlaces(' 도톤 '), true);
    assert.deepEqual(buildGooglePlaceSearchInputState(''), {
      status: 'initial',
      message: '장소 이름을 검색해 보세요.',
      results: [],
    });
    assert.deepEqual(buildGooglePlaceSearchInputState('도'), {
      status: 'minQuery',
      message: '두 글자 이상 입력해 주세요.',
      results: [],
    });
  });

  it('maps loading, empty, error, and not-found states', () => {
    assert.deepEqual(googlePlaceSearchLoadingState(), {
      status: 'loading',
      message: '장소를 검색하는 중...',
      results: [],
    });
    assert.deepEqual(successGooglePlaceSearchState([]), {
      status: 'empty',
      message: '검색 결과가 없어요. 다른 이름으로 검색해 주세요.',
      results: [],
    });
    assert.deepEqual(errorGooglePlaceSearchState(), {
      status: 'error',
      title: '장소를 검색할 수 없어요.',
      helper: '잠시 후 다시 시도해 주세요.',
      canRetry: true,
      results: [],
    });
    assert.deepEqual(errorGooglePlaceSearchState(404), {
      status: 'notFound',
      title: '일정을 찾을 수 없어요.',
      helper: '삭제되었거나 접근할 수 없는 여행 일정이에요.',
      results: [],
    });
  });

  it('builds add request and add states', () => {
    const result = { id: 'google-1', placeName: '도톤보리', address: 'Osaka', typeHint: '관광지' };

    assert.deepEqual(buildCreateGooglePlaceScheduleItemRequest(' google-1 ', false), {
      googlePlaceId: 'google-1',
      duplicateConfirmed: false,
    });
    assert.deepEqual(idleGooglePlaceAddState(), { status: 'idle' });
    assert.deepEqual(addingGooglePlaceState('google-1'), { status: 'adding', googlePlaceId: 'google-1' });
    assert.deepEqual(confirmingDuplicateGooglePlaceState(result), {
      status: 'confirmingDuplicate',
      result,
      message: duplicateDayPlaceConfirmationMessage,
    });
    assert.deepEqual(errorGooglePlaceAddState(), { status: 'error', message: googlePlaceAddFailureMessage });
  });

  it('detects duplicate confirmation API errors', () => {
    assert.equal(
      isDuplicateDayPlaceConfirmationError({ error: { code: 'DUPLICATE_DAY_PLACE_CONFIRMATION_REQUIRED' } }),
      true,
    );
    assert.equal(isDuplicateDayPlaceConfirmationError({ error: { code: 'CONFLICT' } }), false);
    assert.equal(isDuplicateDayPlaceConfirmationError(undefined), false);
  });

  it('builds result row view models with Google primary type hints', () => {
    assert.deepEqual(
      successGooglePlaceSearchState([
        {
          googlePlaceId: 'google-1',
          displayName: '도톤보리',
          formattedAddress: 'Osaka',
          primaryType: 'tourist_attraction',
        },
        {
          googlePlaceId: 'google-2',
          displayName: '우메다 카페',
          formattedAddress: 'Umeda',
          primaryType: 'cafe',
        },
      ]),
      {
        status: 'success',
        results: [
          { id: 'google-1', placeName: '도톤보리', address: 'Osaka', typeHint: '관광지' },
          { id: 'google-2', placeName: '우메다 카페', address: 'Umeda', typeHint: '카페' },
        ],
      },
    );
    assert.equal(getGooglePlaceTypeHint('unknown_google_type'), '장소');
  });
});
