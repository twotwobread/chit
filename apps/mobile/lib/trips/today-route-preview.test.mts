import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildRoutePreviewRequest,
  buildTodayRoutePreviewHeroChip,
  buildTodayRoutePreviewSummarySuccessState,
  buildTodayRoutePreviewViewModel,
  decodeEncodedPolyline,
  routePreviewEligibility,
  todayRoutePreviewCacheKey,
  todayRoutePreviewPermissionNeededState,
  todayRoutePreviewUnavailableState,
  todayRoutePreviewUnsupportedState,
} from './today-route-preview';

const routablePlace = {
  provider: 'google' as const,
  googlePlaceId: 'google-1',
  latitude: 37.5665,
  longitude: 126.978,
};

describe('today route preview helpers', () => {
  it('detects unsupported legacy manual destinations without geocoding', () => {
    assert.equal(routePreviewEligibility({ itemId: 'item-1', routablePlace: null }), 'unsupported');
    assert.deepEqual(todayRoutePreviewUnsupportedState(), {
      status: 'unsupported',
      title: '정확한 지도 장소가 필요해요.',
      helper: 'Google 장소로 추가된 일정에서 경로 미리보기를 볼 수 있어요.',
    });
  });

  it('builds current-location origin request body with an optional route mode', () => {
    assert.deepEqual(buildRoutePreviewRequest({ latitude: 37.5, longitude: 127 }), {
      origin: { latitude: 37.5, longitude: 127 },
    });
    assert.deepEqual(buildRoutePreviewRequest({ latitude: 37.5, longitude: 127 }, 'walking'), {
      origin: { latitude: 37.5, longitude: 127 },
      mode: 'walking',
    });
  });

  it('formats successful preview summary and decodes map polyline', () => {
    const viewModel = buildTodayRoutePreviewViewModel({
      itemId: 'item-1',
      mode: 'transit',
      generatedAt: '2026-06-25T00:00:00Z',
      summary: {
        durationSeconds: 1320,
        distanceMeters: 5400,
        summaryText: '환승 1회',
        transferCount: 1,
      },
      map: {
        encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
        origin: { latitude: 38.5, longitude: -120.2 },
        destination: { latitude: 43.252, longitude: -126.453 },
        bounds: {
          northeast: { latitude: 43.252, longitude: -120.2 },
          southwest: { latitude: 38.5, longitude: -126.453 },
        },
      },
    });

    assert.equal(viewModel.durationLabel, '약 22분');
    assert.equal(viewModel.distanceLabel, '5.4km');
    assert.equal(viewModel.modeLabel, '대중교통');
    assert.equal(viewModel.summaryText, '환승 1회');
    assert.equal(viewModel.detailActionLabel, '구글 지도에서 자세히');
    assert.deepEqual(viewModel.map?.coordinates, [
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it('builds route preview hero chip summaries with safe fallback copy', () => {
    assert.equal(
      buildTodayRoutePreviewHeroChip({
        status: 'success',
        viewModel: {
          itemId: 'item-1',
          durationLabel: '약 22분',
          distanceLabel: '5.4km',
          modeLabel: '대중교통',
          summaryText: '환승 1회',
          map: null,
          detailActionLabel: '구글 지도에서 자세히',
        },
      }),
      '대중교통 · 약 22분 · 5.4km',
    );
    assert.equal(
      buildTodayRoutePreviewHeroChip({
        status: 'success',
        viewModel: {
          itemId: 'item-1',
          durationLabel: '약 22분',
          distanceLabel: '',
          modeLabel: '대중교통',
          summaryText: '환승 1회',
          map: null,
          detailActionLabel: '구글 지도에서 자세히',
        },
      }),
      '대중교통 · 약 22분',
    );
    assert.equal(buildTodayRoutePreviewHeroChip({ status: 'idle' }), '경로 정보를 준비 중이에요');
    assert.equal(
      buildTodayRoutePreviewHeroChip(todayRoutePreviewUnavailableState()),
      '경로 미리보기를 불러올 수 없어요.',
    );
    assert.equal(
      buildTodayRoutePreviewHeroChip(todayRoutePreviewPermissionNeededState()),
      '현재 위치 권한이 필요해요.',
    );
    assert.equal(
      buildTodayRoutePreviewHeroChip({
        status: 'success',
        viewModel: {
          itemId: 'item-1',
          durationLabel: '',
          distanceLabel: '',
          modeLabel: '대중교통',
          summaryText: '환승 1회',
          map: null,
          detailActionLabel: '구글 지도에서 자세히',
        },
      }),
      '경로 정보를 준비 중이에요',
    );
  });

  it('builds multi-mode route summary rows and keeps partial failures visible', () => {
    const state = buildTodayRoutePreviewSummarySuccessState([
      {
        mode: 'transit',
        response: {
          itemId: 'item-1',
          mode: 'transit',
          generatedAt: '2026-06-25T00:00:00Z',
          summary: { durationSeconds: 1320, distanceMeters: 5400, summaryText: '환승 1회', transferCount: 1 },
          map: null,
        },
      },
      {
        mode: 'walking',
        response: {
          itemId: 'item-1',
          mode: 'walking',
          generatedAt: '2026-06-25T00:00:00Z',
          summary: {
            durationSeconds: 2100,
            distanceMeters: 2800,
            summaryText: 'Google Maps 기준 예상 경로',
            transferCount: null,
          },
          map: null,
        },
      },
      { mode: 'driving', response: null },
    ]);

    assert.equal(state.status, 'success');
    if (state.status !== 'success') {
      return;
    }
    assert.equal(state.title, '현 위치 기준 예상 이동');
    assert.deepEqual(
      state.rows.map((row) => [row.mode, row.modeLabel, row.status]),
      [
        ['transit', '대중교통', 'success'],
        ['walking', '도보', 'success'],
        ['driving', '자동차', 'unavailable'],
      ],
    );
    assert.equal(state.rows[0].status === 'success' ? state.rows[0].durationLabel : '', '약 22분');
    assert.equal(state.rows[1].status === 'success' ? state.rows[1].distanceLabel : '', '2.8km');
    assert.equal(state.rows[2].status === 'unavailable' ? state.rows[2].message : '', '확인 불가');
  });

  it('returns unavailable when no travel mode preview succeeds', () => {
    const state = buildTodayRoutePreviewSummarySuccessState([
      { mode: 'transit', response: null },
      { mode: 'walking', response: null },
      { mode: 'driving', response: null },
    ]);

    assert.equal(state.status, 'unavailable');
    assert.equal(state.status === 'unavailable' ? state.title : '', '예상 소요 시간을 불러올 수 없어요.');
  });

  it('builds stable session cache keys from coarse origin and fixed mode', () => {
    assert.equal(
      todayRoutePreviewCacheKey({
        itemId: 'item-1',
        origin: { latitude: 37.5004, longitude: 127.0004 },
        routablePlace,
      }),
      todayRoutePreviewCacheKey({
        itemId: 'item-1',
        origin: { latitude: 37.50049, longitude: 127.00049 },
        routablePlace,
      }),
    );
  });

  it('maps permission and provider failure copy', () => {
    assert.equal(todayRoutePreviewPermissionNeededState().title, '현재 위치 권한이 필요해요.');
    assert.equal(todayRoutePreviewUnavailableState().title, '경로 미리보기를 불러올 수 없어요.');
  });

  it('decodes Google encoded polylines defensively', () => {
    assert.deepEqual(decodeEncodedPolyline(''), []);
  });
});
