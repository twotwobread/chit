import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError, type TripDay } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { DayChips } from '../../../../lib/trip-ui/DayChips';
import { DayItineraryEditor } from '../../../../lib/trip-ui/DayItineraryEditor';
import { TripScreen, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { getTripDetail } from '../../../../lib/trips/trip-api';
import { tripDetailPath } from '../../../../lib/trips/routes';
import { localDateString } from '../../../../lib/trips/status';
import { buildTripMapDayChips, resolveTripMapSelectedDay } from '../../../../lib/trips/trip-map';

type ItineraryState =
  | { status: 'loading' }
  | {
      status: 'success';
      dayChips: ReturnType<typeof buildTripMapDayChips>;
      selectedDay: TripDay;
    }
  | { status: 'emptyDays'; tripId: string }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export default function TripItineraryTabScreen() {
  const { tripId: tripIdParam, dayId: dayIdParam } = useLocalSearchParams<{
    tripId?: string | string[];
    dayId?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const routeDayId = Array.isArray(dayIdParam) ? dayIdParam[0] : dayIdParam;
  const selectedDayIdRef = useRef<string | null>(null);
  const [state, setState] = useState<ItineraryState>({ status: 'loading' });

  const load = useCallback(
    async (preferredDayId: string | null = routeDayId ?? selectedDayIdRef.current) => {
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

        selectedDayIdRef.current = selectedDay.id;
        setState({
          status: 'success',
          dayChips: buildTripMapDayChips(detail.days),
          selectedDay,
        });
      } catch (error) {
        setState(itineraryFailureState(error));
      }
    },
    [routeDayId, tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void load(routeDayId ?? selectedDayIdRef.current);
    }, [load, routeDayId]),
  );

  const selectDay = (dayId: string) => {
    selectedDayIdRef.current = dayId;
    if (tripId) {
      router.setParams({ dayId });
    }
    void load(dayId);
  };

  if (state.status === 'success') {
    return (
      <DayItineraryEditor
        date={state.selectedDay.id}
        headerContent={<DayChips days={state.dayChips} selectedDayId={state.selectedDay.id} onSelectDay={selectDay} />}
        key={state.selectedDay.id}
        showHeader={false}
        tripId={tripId ?? ''}
      />
    );
  }

  return (
    <TripScreen>
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
    </TripScreen>
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
