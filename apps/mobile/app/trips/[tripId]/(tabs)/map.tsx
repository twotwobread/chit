import { useCallback, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { ListRow, PlacePin, PlaceTag, PrimaryButton, SecondaryButton, theme } from '../../../../lib/design';
import { DayChips } from '../../../../lib/trip-ui/DayChips';
import { RouteMap } from '../../../../lib/trip-ui/RouteMap';
import { TripListCard, TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { getTripDayItinerary, getTripDetail } from '../../../../lib/trips/client';
import {
  type DayItineraryViewModel,
  buildDayItineraryViewModel,
  getScheduleItems,
} from '../../../../lib/trips/day-itinerary';
import {
  buildDayItineraryMapRowActions,
  dayItineraryMapActionFailureState,
  dayItineraryMapActionSuccessState,
  type DayItineraryMapActionFeedback,
} from '../../../../lib/trips/day-itinerary-map-actions';
import { tripItineraryPath } from '../../../../lib/trips/routes';
import { localDateString } from '../../../../lib/trips/status';
import { buildRouteMapPlaces, buildTripMapDayChips, resolveTripMapSelectedDay } from '../../../../lib/trips/trip-map';
import type { RouteMapPlace } from '../../../../lib/trip-ui/RouteMap';
import { buildTripTabUnavailableViewModel, type TripTabUnavailableViewModel } from '../../../../lib/trips/trip-tabs';

type TripMapState =
  | { status: 'loading' }
  | {
      status: 'success';
      dayChips: ReturnType<typeof buildTripMapDayChips>;
      selectedDayId: string;
      viewModel: DayItineraryViewModel;
      mapPlaces: RouteMapPlace[];
    }
  | { status: 'unavailable'; viewModel: TripTabUnavailableViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export default function TripMapTabScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const selectedDayIdRef = useRef<string | null>(null);
  const [state, setState] = useState<TripMapState>({ status: 'loading' });
  const [feedback, setFeedback] = useState<DayItineraryMapActionFeedback | null>(null);

  const load = useCallback(
    async (preferredDayId: string | null = selectedDayIdRef.current) => {
      if (!tripId) {
        setState({ status: 'notFound' });
        return;
      }

      setFeedback(null);
      setState({ status: 'loading' });
      try {
        const detail = await getTripDetail(tripId);
        const selectedDay = resolveTripMapSelectedDay({
          days: detail.days,
          preferredDayId,
          today: localDateString(),
        });
        if (!selectedDay) {
          selectedDayIdRef.current = null;
          setState({ status: 'unavailable', viewModel: buildTripTabUnavailableViewModel('map', tripId) });
          return;
        }

        const itinerary = await getTripDayItinerary(tripId, selectedDay.id);
        selectedDayIdRef.current = selectedDay.id;
        setState({
          status: 'success',
          dayChips: buildTripMapDayChips(detail.days),
          selectedDayId: selectedDay.id,
          viewModel: buildDayItineraryViewModel(itinerary),
          mapPlaces: buildRouteMapPlaces(getScheduleItems(itinerary)),
        });
      } catch (error) {
        setState(mapFailureState(error));
      }
    },
    [tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openMap = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
      setFeedback(dayItineraryMapActionSuccessState('map'));
    } catch {
      setFeedback(dayItineraryMapActionFailureState('map'));
    }
  }, []);

  const copyAddress = useCallback(async (address: string) => {
    try {
      await Clipboard.setStringAsync(address);
      setFeedback(dayItineraryMapActionSuccessState('copy'));
    } catch {
      setFeedback(dayItineraryMapActionFailureState('copy'));
    }
  }, []);

  return (
    <TripScreen>
      <TripScreenHeader helper="Day별 이동할 장소와 지도 열기 동선을 한곳에서 확인해요." title="지도" />

      {state.status === 'loading' ? <TripStateCard loading title="지도 정보를 불러오는 중..." /> : null}
      {state.status === 'auth' ? (
        <TripStateCard
          primaryAction={{ label: '로그인하기', onPress: () => router.replace('/login') }}
          title="다시 로그인해주세요."
        />
      ) : null}
      {state.status === 'notFound' ? (
        <TripStateCard
          helper="삭제되었거나 접근할 수 없는 여행이에요."
          primaryAction={{ label: '홈으로', onPress: () => router.replace('/') }}
          title="여행을 찾을 수 없어요."
        />
      ) : null}
      {state.status === 'error' ? (
        <TripStateCard
          helper="잠시 후 다시 시도해주세요."
          primaryAction={{ label: '다시 시도', onPress: () => void load() }}
          title="지도 정보를 불러올 수 없어요."
        />
      ) : null}
      {state.status === 'unavailable' ? <UnavailableState viewModel={state.viewModel} /> : null}
      {state.status === 'success' ? (
        <MapContent
          copyAddress={copyAddress}
          feedback={feedback}
          onSelectDay={(dayId) => void load(dayId)}
          openMap={openMap}
          selectedDayId={state.selectedDayId}
          dayChips={state.dayChips}
          tripId={tripId ?? ''}
          viewModel={state.viewModel}
          mapPlaces={state.mapPlaces}
        />
      ) : null}
    </TripScreen>
  );
}

function MapContent({
  copyAddress,
  dayChips,
  feedback,
  onSelectDay,
  openMap,
  selectedDayId,
  tripId,
  viewModel,
  mapPlaces,
}: {
  viewModel: DayItineraryViewModel;
  mapPlaces: RouteMapPlace[];
  tripId: string;
  dayChips: ReturnType<typeof buildTripMapDayChips>;
  selectedDayId: string;
  feedback: DayItineraryMapActionFeedback | null;
  openMap: (url: string) => void;
  copyAddress: (address: string) => void;
  onSelectDay: (dayId: string) => void;
}) {
  return (
    <>
      <DayChips days={dayChips} selectedDayId={selectedDayId} onSelectDay={onSelectDay} />
      <View style={styles.mapWrap}>
        <RouteMap
          emptyHelper="좌표가 있는 장소를 추가하면 지도에 핀이 표시돼요."
          emptyTitle={`${viewModel.dayLabel}에 표시할 좌표가 없어요`}
          places={mapPlaces}
          style={styles.map}
        />
      </View>
      {viewModel.status === 'empty' ? (
        <TripStateCard
          helper="선택한 Day에 장소를 추가하면 지도에서 바로 열 수 있어요."
          primaryAction={{ label: '일정 보기', onPress: () => router.push(tripItineraryPath(tripId)) }}
          title={`${viewModel.dayLabel}에 등록된 장소가 없어요.`}
        />
      ) : (
        <SelectedDayList
          copyAddress={copyAddress}
          items={viewModel.items}
          openMap={openMap}
          summary={`${viewModel.formattedDate} · 장소 ${viewModel.items.length}곳 · 지도 ${mapPlaces.length}곳`}
          title={`${viewModel.dayLabel} 지도 동선`}
        />
      )}
      {feedback ? (
        <TripStateCard helper={feedback.kind === 'error' ? undefined : feedback.message} title={feedback.message} />
      ) : null}
    </>
  );
}

function SelectedDayList({
  copyAddress,
  items,
  openMap,
  summary,
  title,
}: {
  items: Extract<DayItineraryViewModel, { status: 'success' }>['items'];
  title: string;
  summary: string;
  openMap: (url: string) => void;
  copyAddress: (address: string) => void;
}) {
  return (
    <TripListCard>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summaryHelper}>{summary}</Text>
      </View>
      {items.map((item, index) => {
        const actions = buildDayItineraryMapRowActions({ address: item.address, placeName: item.placeName });

        return (
          <ListRow
            first={index === 0}
            key={item.id}
            leading={<PlacePin order={Number(item.orderLabel)} type={item.placeType} />}
            subtitle={
              <View style={styles.rowSubtitle}>
                <PlaceTag type={item.placeType} />
                <Text style={styles.address}>{item.address || '주소 정보가 없어요.'}</Text>
              </View>
            }
            title={item.placeName}
            trailing={
              <View style={styles.actionColumn}>
                <PrimaryButton
                  label={actions.map.label}
                  onPress={() => openMap(actions.map.url)}
                  style={styles.rowButton}
                />
                <SecondaryButton
                  accessibilityLabel={actions.copy.accessibilityLabel}
                  disabled={actions.copy.disabled}
                  label={actions.copy.label}
                  onPress={() => {
                    if (actions.copy.address) {
                      copyAddress(actions.copy.address);
                    }
                  }}
                  style={styles.rowButton}
                />
              </View>
            }
          />
        );
      })}
    </TripListCard>
  );
}

function UnavailableState({ viewModel }: { viewModel: TripTabUnavailableViewModel }) {
  return (
    <TripStateCard
      helper={viewModel.helper}
      primaryAction={{
        label: viewModel.primaryAction.label,
        onPress: () => router.push(viewModel.primaryAction.route),
      }}
      secondaryAction={{
        label: viewModel.secondaryAction.label,
        onPress: () => router.push(viewModel.secondaryAction.route),
      }}
      title={viewModel.title}
    />
  );
}

function mapFailureState(error: unknown): TripMapState {
  if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
    return { status: 'auth' };
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { status: 'auth' };
    }
    if (error.status === 400 || error.status === 403 || error.status === 404) {
      return { status: 'notFound' };
    }
  }
  return { status: 'error' };
}

const styles = StyleSheet.create({
  actionColumn: {
    gap: theme.space[2],
    minWidth: 88,
  },
  address: {
    color: theme.color.textMuted,
    flexShrink: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  map: {
    height: 240,
    width: '100%',
  },
  mapWrap: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    maxWidth: theme.layout.cardMaxW,
    overflow: 'hidden',
    width: '100%',
  },
  rowButton: {
    minHeight: 34,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  rowSubtitle: {
    gap: theme.space[2],
  },
  summary: {
    gap: theme.space[1],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  summaryHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  summaryTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
});
