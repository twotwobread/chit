import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { ListRow, PlacePin, PlaceTag, PrimaryButton, SecondaryButton, theme } from '../../../../lib/design';
import { TripListCard, TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { getTripDayItinerary, getTripDetail } from '../../../../lib/trips/client';
import { type DayItineraryViewModel, buildDayItineraryViewModel } from '../../../../lib/trips/day-itinerary';
import {
  buildDayItineraryMapRowActions,
  dayItineraryMapActionFailureState,
  dayItineraryMapActionSuccessState,
  type DayItineraryMapActionFeedback,
} from '../../../../lib/trips/day-itinerary-map-actions';
import { tripItineraryPath } from '../../../../lib/trips/routes';
import {
  buildTripTabUnavailableViewModel,
  findTripCalendarDay,
  type TripTabUnavailableViewModel,
} from '../../../../lib/trips/trip-tabs';
import { localDateString } from '../../../../lib/trips/status';

type TripMapState =
  | { status: 'loading' }
  | { status: 'success'; viewModel: DayItineraryViewModel }
  | { status: 'unavailable'; viewModel: TripTabUnavailableViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export default function TripMapTabScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [state, setState] = useState<TripMapState>({ status: 'loading' });
  const [feedback, setFeedback] = useState<DayItineraryMapActionFeedback | null>(null);

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    setFeedback(null);
    setState({ status: 'loading' });
    try {
      const detail = await getTripDetail(tripId);
      const currentDay = findTripCalendarDay(detail.days, localDateString());
      if (!currentDay) {
        setState({ status: 'unavailable', viewModel: buildTripTabUnavailableViewModel('map', tripId) });
        return;
      }

      const itinerary = await getTripDayItinerary(tripId, currentDay.id);
      setState({ status: 'success', viewModel: buildDayItineraryViewModel(itinerary) });
    } catch (error) {
      setState(mapFailureState(error));
    }
  }, [tripId]);

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
      <TripScreenHeader helper="오늘 이동할 장소와 지도 열기 동선을 한곳에서 확인해요." title="지도" />

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
          openMap={openMap}
          tripId={tripId ?? ''}
          viewModel={state.viewModel}
        />
      ) : null}
    </TripScreen>
  );
}

function MapContent({
  copyAddress,
  feedback,
  openMap,
  tripId,
  viewModel,
}: {
  viewModel: DayItineraryViewModel;
  tripId: string;
  feedback: DayItineraryMapActionFeedback | null;
  openMap: (url: string) => void;
  copyAddress: (address: string) => void;
}) {
  if (viewModel.status === 'empty') {
    return (
      <TripStateCard
        helper="오늘 일정에 장소를 추가하면 지도에서 바로 열 수 있어요."
        primaryAction={{ label: '일정 보기', onPress: () => router.push(tripItineraryPath(tripId)) }}
        title="오늘 지도에 표시할 장소가 없어요."
      />
    );
  }

  return (
    <>
      <TripListCard>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{viewModel.dayLabel} 지도 동선</Text>
          <Text style={styles.summaryHelper}>
            {viewModel.formattedDate} · 장소 {viewModel.items.length}곳
          </Text>
        </View>
        {viewModel.items.map((item, index) => {
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
      {feedback ? (
        <TripStateCard helper={feedback.kind === 'error' ? undefined : feedback.message} title={feedback.message} />
      ) : null}
    </>
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
