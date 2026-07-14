import type { CreateRoutePreviewRequest, RoutePreviewResponse, RoutablePlace } from '@i-um/api-contract';

import { travelModeDisplayLabel, travelModes, type TravelMode } from './travel-mode';

export type TodayRoutePreviewOrigin = {
  latitude: number;
  longitude: number;
};

export type TodayRoutePreviewDestination = {
  itemId: string;
  routablePlace: RoutablePlace | null;
};

export type TodayRoutePreviewState =
  | { status: 'idle' }
  | { status: 'loading'; message: string }
  | { status: 'permissionNeeded'; title: string; helper: string; retryLabel: string }
  | { status: 'unsupported'; title: string; helper: string }
  | { status: 'unavailable'; title: string; helper: string; retryLabel: string }
  | { status: 'success'; viewModel: TodayRoutePreviewViewModel };

export type TodayRoutePreviewViewModel = {
  itemId: string;
  durationLabel: string;
  distanceLabel: string;
  modeLabel: string;
  summaryText: string;
  map: TodayRoutePreviewMapViewModel | null;
  detailActionLabel: '구글 지도에서 자세히';
};

export type TodayRoutePreviewModeSummaryRow =
  | {
      status: 'success';
      mode: TravelMode;
      modeLabel: string;
      durationLabel: string;
      distanceLabel: string;
    }
  | {
      status: 'unavailable';
      mode: TravelMode;
      modeLabel: string;
      message: '확인 불가';
    };

export type TodayRoutePreviewNonSuccessState = Exclude<TodayRoutePreviewState, { status: 'success' }>;

export type TodayRoutePreviewSummaryState =
  | TodayRoutePreviewNonSuccessState
  | {
      status: 'success';
      title: '현 위치 기준 예상 이동';
      helper: string;
      rows: TodayRoutePreviewModeSummaryRow[];
    };

export type TodayRoutePreviewModeLoadResult = {
  mode: TravelMode;
  response: RoutePreviewResponse | null;
};

export const todayRoutePreviewModes = travelModes;

export type TodayRoutePreviewMapViewModel = {
  origin: TodayRoutePreviewOrigin;
  destination: TodayRoutePreviewOrigin;
  coordinates: TodayRoutePreviewOrigin[];
  bounds: {
    northeast: TodayRoutePreviewOrigin;
    southwest: TodayRoutePreviewOrigin;
  };
};

export const todayRoutePreviewHeroChipFallbackCopy = '경로 정보를 준비 중이에요';

export const todayRoutePreviewLoadingState = (): Extract<TodayRoutePreviewNonSuccessState, { status: 'loading' }> => ({
  status: 'loading',
  message: '경로 미리보기를 준비하고 있어요.',
});

export const todayRoutePreviewPermissionNeededState = (): Extract<
  TodayRoutePreviewNonSuccessState,
  { status: 'permissionNeeded' }
> => ({
  status: 'permissionNeeded',
  title: '현재 위치 권한이 필요해요.',
  helper: '권한을 허용하면 다음 장소까지의 예상 경로를 볼 수 있어요.',
  retryLabel: '다시 시도',
});

export const todayRoutePreviewUnsupportedState = (): Extract<
  TodayRoutePreviewNonSuccessState,
  { status: 'unsupported' }
> => ({
  status: 'unsupported',
  title: '정확한 지도 장소가 필요해요.',
  helper: 'Google 장소로 추가된 일정에서 경로 미리보기를 볼 수 있어요.',
});

export const todayRoutePreviewUnavailableState = (
  title: string = '경로 미리보기를 불러올 수 없어요.',
): Extract<TodayRoutePreviewNonSuccessState, { status: 'unavailable' }> => ({
  status: 'unavailable',
  title,
  helper: '잠시 후 다시 시도하거나 구글 지도에서 자세히 확인해주세요.',
  retryLabel: '다시 시도',
});

export function routePreviewEligibility(destination: TodayRoutePreviewDestination): 'eligible' | 'unsupported' {
  return destination.routablePlace ? 'eligible' : 'unsupported';
}

export function buildRoutePreviewRequest(
  origin: TodayRoutePreviewOrigin,
  mode?: TravelMode,
): CreateRoutePreviewRequest {
  return mode ? { origin, mode } : { origin };
}

export function buildTodayRoutePreviewViewModel(response: RoutePreviewResponse): TodayRoutePreviewViewModel {
  return {
    itemId: response.scheduleItemId ?? (response as unknown as { itemId?: string }).itemId ?? '',
    durationLabel: formatDuration(response.summary.durationSeconds),
    distanceLabel: formatDistance(response.summary.distanceMeters),
    modeLabel: routeModeLabel(response.mode),
    summaryText: response.summary.summaryText || '환승 정보 없음',
    map: response.map ? buildMapViewModel(response.map) : null,
    detailActionLabel: '구글 지도에서 자세히',
  };
}

export function todayRoutePreviewSuccessState(response: RoutePreviewResponse): TodayRoutePreviewState {
  return { status: 'success', viewModel: buildTodayRoutePreviewViewModel(response) };
}

export function buildTodayRoutePreviewSummarySuccessState(
  results: TodayRoutePreviewModeLoadResult[],
): TodayRoutePreviewSummaryState {
  const rows = results.map((result): TodayRoutePreviewModeSummaryRow => {
    const modeLabel = travelModeDisplayLabel(result.mode);
    if (!result.response) {
      return { status: 'unavailable', mode: result.mode, modeLabel, message: '확인 불가' };
    }
    const viewModel = buildTodayRoutePreviewViewModel(result.response);
    return {
      status: 'success',
      mode: result.mode,
      modeLabel,
      durationLabel: viewModel.durationLabel,
      distanceLabel: viewModel.distanceLabel,
    };
  });

  if (!rows.some((row) => row.status === 'success')) {
    return todayRoutePreviewUnavailableState('예상 소요 시간을 불러올 수 없어요.');
  }

  return {
    status: 'success',
    title: '현 위치 기준 예상 이동',
    helper: '실제 경로와 소요 시간은 구글 지도에서 확인해주세요.',
    rows,
  };
}

export function buildTodayRoutePreviewHeroChip(state: TodayRoutePreviewState): string {
  if (state.status === 'permissionNeeded' || state.status === 'unsupported' || state.status === 'unavailable') {
    return state.title;
  }
  if (state.status !== 'success') {
    return todayRoutePreviewHeroChipFallbackCopy;
  }

  const modeLabel = state.viewModel.modeLabel.trim();
  const durationLabel = state.viewModel.durationLabel.trim();
  const distanceLabel = state.viewModel.distanceLabel.trim();
  if (!modeLabel || !durationLabel) {
    return todayRoutePreviewHeroChipFallbackCopy;
  }

  return distanceLabel ? `${modeLabel} · ${durationLabel} · ${distanceLabel}` : `${modeLabel} · ${durationLabel}`;
}

export function todayRoutePreviewCacheKey({
  itemId,
  origin,
  routablePlace,
}: {
  itemId: string;
  origin: TodayRoutePreviewOrigin;
  routablePlace: RoutablePlace;
}): string {
  return [
    itemId,
    routablePlace.provider,
    routablePlace.googlePlaceId,
    roundedCoordinate(origin.latitude),
    roundedCoordinate(origin.longitude),
    roundedCoordinate(routablePlace.latitude),
    roundedCoordinate(routablePlace.longitude),
    'transit',
  ].join(':');
}

export function decodeEncodedPolyline(encoded: string): TodayRoutePreviewOrigin[] {
  const points: TodayRoutePreviewOrigin[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeResult = decodePolylineValue(encoded, index);
    index = latitudeResult.nextIndex;
    latitude += latitudeResult.delta;

    const longitudeResult = decodePolylineValue(encoded, index);
    index = longitudeResult.nextIndex;
    longitude += longitudeResult.delta;

    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }

  return points;
}

function buildMapViewModel(map: NonNullable<RoutePreviewResponse['map']>): TodayRoutePreviewMapViewModel {
  const decoded = decodeEncodedPolyline(map.encodedPolyline);
  return {
    origin: map.origin,
    destination: map.destination,
    coordinates: decoded.length > 0 ? decoded : [map.origin, map.destination],
    bounds: map.bounds,
  };
}

function decodePolylineValue(encoded: string, startIndex: number): { delta: number; nextIndex: number } {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte = 0;

  do {
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20 && index <= encoded.length);

  const delta = result & 1 ? ~(result >> 1) : result >> 1;
  return { delta, nextIndex: index };
}

function routeModeLabel(mode: RoutePreviewResponse['mode']): string {
  if (isTravelMode(mode)) {
    return travelModeDisplayLabel(mode);
  }
  return travelModeDisplayLabel('transit');
}

function isTravelMode(mode: unknown): mode is TravelMode {
  return typeof mode === 'string' && travelModes.includes(mode as TravelMode);
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) {
    return `약 ${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `약 ${hours}시간` : `약 ${hours}시간 ${rest}분`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.max(0, Math.round(meters))}m`;
  }
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)}km`;
}

function roundedCoordinate(value: number): string {
  return value.toFixed(3);
}
