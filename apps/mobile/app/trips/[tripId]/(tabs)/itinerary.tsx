import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { PrimaryButton, theme } from '../../../../lib/design';
import { DayChips } from '../../../../lib/trip-ui/DayChips';
import { ItineraryTimeline } from '../../../../lib/trip-ui/ItineraryTimeline';
import { TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { getTripDayItinerary, getTripDetail } from '../../../../lib/trips/client';
import {
  type DayItineraryViewModel,
  buildDayItineraryRoute,
  buildDayItineraryViewModel,
} from '../../../../lib/trips/day-itinerary';
import {
  ITINERARY_TAB_ADD_CTA_LABEL,
  ITINERARY_TAB_ADD_NON_PLACE_CTA_LABEL,
  ITINERARY_TAB_EMPTY_HELPER,
  ITINERARY_TAB_EMPTY_TITLE,
  ITINERARY_TAB_REORDER_CTA_LABEL,
  buildItineraryTimelineItems,
} from '../../../../lib/trips/itinerary-tab';
import { buildDayItineraryAddPlaceSearchRoute } from '../../../../lib/trips/day-itinerary-add-place-navigation';
import { tripDetailPath } from '../../../../lib/trips/routes';
import { localDateString } from '../../../../lib/trips/status';
import { buildTripMapDayChips, resolveTripMapSelectedDay } from '../../../../lib/trips/trip-map';

type ItineraryState =
  | { status: 'loading' }
  | {
      status: 'success';
      dayChips: ReturnType<typeof buildTripMapDayChips>;
      selectedDayId: string;
      viewModel: DayItineraryViewModel;
    }
  | { status: 'emptyDays'; tripId: string }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export default function TripItineraryTabScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const selectedDayIdRef = useRef<string | null>(null);
  const [state, setState] = useState<ItineraryState>({ status: 'loading' });

  const load = useCallback(
    async (preferredDayId: string | null = selectedDayIdRef.current) => {
      if (!tripId) {
        setState({ status: 'notFound' });
        return;
      }

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
          setState({ status: 'emptyDays', tripId });
          return;
        }

        const itinerary = await getTripDayItinerary(tripId, selectedDay.id);
        selectedDayIdRef.current = selectedDay.id;
        setState({
          status: 'success',
          dayChips: buildTripMapDayChips(detail.days),
          selectedDayId: selectedDay.id,
          viewModel: buildDayItineraryViewModel(itinerary),
        });
      } catch (error) {
        setState(itineraryFailureState(error));
      }
    },
    [tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <TripScreen>
      <TripScreenHeader helper="Day별 일정을 선택해 순서대로 확인해요." title="일정" />

      {state.status === 'loading' ? <TripStateCard loading title="일정을 불러오는 중..." /> : null}
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
          title="일정을 불러올 수 없어요."
        />
      ) : null}
      {state.status === 'emptyDays' ? <EmptyDaysState tripId={state.tripId} /> : null}
      {state.status === 'success' ? (
        <ItineraryContent
          onSelectDay={(dayId) => void load(dayId)}
          selectedDayId={state.selectedDayId}
          dayChips={state.dayChips}
          tripId={tripId ?? ''}
          viewModel={state.viewModel}
        />
      ) : null}
    </TripScreen>
  );
}

function ItineraryContent({
  dayChips,
  onSelectDay,
  selectedDayId,
  tripId,
  viewModel,
}: {
  dayChips: ReturnType<typeof buildTripMapDayChips>;
  selectedDayId: string;
  viewModel: DayItineraryViewModel;
  tripId: string;
  onSelectDay: (dayId: string) => void;
}) {
  const detailRoute = buildDayItineraryRoute(tripId, selectedDayId);
  const addPlaceRoute = buildDayItineraryAddPlaceSearchRoute(tripId, selectedDayId);
  const nonPlaceRoute = `${detailRoute}?action=nonPlace` as Href;
  const reorderRoute = `${detailRoute}?action=reorder` as Href;
  const timelineItems = buildItineraryTimelineItems(viewModel);
  const canReorder = viewModel.status === 'success' && viewModel.items.length >= 2;

  return (
    <>
      <DayChips days={dayChips} selectedDayId={selectedDayId} onSelectDay={onSelectDay} />
      <View style={styles.summaryWrap}>
        <Text style={styles.summaryTitle}>{viewModel.dayLabel} 일정</Text>
        <Text style={styles.summaryHelper}>{viewModel.formattedDate}</Text>
      </View>
      <View style={styles.actionWrap}>
        <PrimaryButton label={ITINERARY_TAB_ADD_CTA_LABEL} onPress={() => router.push(addPlaceRoute)} />
        <View style={styles.secondaryActionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(nonPlaceRoute)}
            style={styles.secondaryActionButton}
          >
            <Text style={styles.secondaryActionText}>{ITINERARY_TAB_ADD_NON_PLACE_CTA_LABEL}</Text>
          </Pressable>
          {canReorder ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(reorderRoute)}
              style={styles.secondaryActionButton}
            >
              <Text style={styles.secondaryActionText}>{ITINERARY_TAB_REORDER_CTA_LABEL}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {timelineItems.length > 0 ? (
        <View style={styles.timelineWrap}>
          <ItineraryTimeline items={timelineItems} />
        </View>
      ) : (
        <TripStateCard helper={ITINERARY_TAB_EMPTY_HELPER} title={ITINERARY_TAB_EMPTY_TITLE} />
      )}
    </>
  );
}

function EmptyDaysState({ tripId }: { tripId: string }) {
  return (
    <TripStateCard
      helper="여행 기간이 아직 준비되지 않았어요. 여행 정보를 확인해 주세요."
      primaryAction={{ label: '여행 정보 보기', onPress: () => router.push(tripDetailPath(tripId)) }}
      title="일정이 없어요."
    />
  );
}

function itineraryFailureState(error: unknown): ItineraryState {
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
  actionWrap: {
    gap: theme.space[3],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  secondaryActionButton: {
    alignItems: 'center',
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[3],
  },
  secondaryActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  secondaryActionText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
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
  summaryWrap: {
    gap: theme.space[1],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  timelineWrap: {
    gap: theme.space[4],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
});
